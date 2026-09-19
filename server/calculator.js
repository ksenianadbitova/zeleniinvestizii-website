// server/calculator.js
const db = require('./db');

const PARAM_DEFAULTS = {
    CF_AGB: 0.47, CO2_per_C: 44/12,
    UNC_allowance: 0.10, UNC_stop_ratio: 1.0,
    BUF: 0.15, LK: 0.0,
    PRICE_LOW: 500, PRICE_MID: 1500, PRICE_HIGH: 4000
};

function getParams() {
    const rows = db.prepare('SELECT parameter, value FROM parameters').all();
    const out = { ...PARAM_DEFAULTS };
    rows.forEach(r => {
        if (r.parameter === 'CO2_per_C') return;
        const num = parseFloat(r.value);
        if (!isNaN(num)) out[r.parameter] = num;
    });
    return out;
}

/**
 * Запас (т С/га) "на год Y" — это baseline_stock_start_tc_ha строки,
 * где year_start = Y (то есть переход Y → Y+1 начинается с этого запаса).
 * Если точной строки нет — берём ближайшую.
 */
function getStockForYear(aoiId, year) {
    // Ищем строку, где year_start = указанный год
    const row = db.prepare(`
        SELECT baseline_stock_start_tc_ha AS stock_start,
               baseline_stock_end_tc_ha   AS stock_end,
               year_start
        FROM baseline
        WHERE aoi_id = ? AND CAST(year_start AS INTEGER) = ?
        LIMIT 1
    `).get(aoiId, year);

    if (row && row.stock_start != null) return { start: row.stock_start, end: row.stock_end };

    // Ближайший доступный год
    const near = db.prepare(`
        SELECT baseline_stock_start_tc_ha AS stock_start,
               baseline_stock_end_tc_ha   AS stock_end,
               year_start
        FROM baseline
        WHERE aoi_id = ?
        ORDER BY ABS(CAST(year_start AS INTEGER) - ?)
        LIMIT 1
    `).get(aoiId, year);

    if (near) {
        console.warn('[warn] ' + aoiId + ': year_start=' + year + ' не найден, взят ' + near.year_start);
        return { start: near.stock_start, end: near.stock_end };
    }
    return { start: 50, end: 50 };
}

function calculateMetrics(aoiId, yearStart = 2019, yearEnd = 2024) {
    const p = getParams();
    const aoi = db.prepare('SELECT * FROM aoi WHERE aoi_id = ?').get(aoiId);
    if (!aoi) throw new Error('AOI not found: ' + aoiId);

    const A = aoi.area_ha;
    const dt = yearEnd - yearStart;
    if (dt <= 0) throw new Error('yearEnd должен быть больше yearStart');

    const first = db.prepare('SELECT * FROM baseline WHERE aoi_id = ? ORDER BY year_start LIMIT 1').get(aoiId);

    // Запас на t0 = начало первого года периода
    const s_t0 = getStockForYear(aoiId, yearStart);
    const s_t1 = getStockForYear(aoiId, yearEnd);

    // Запас на t0 — это начало первого перехода
    // Запас на t1 — это КОНЕЦ перехода, который начинается с года yearEnd - 1
    // Проще: берём stock_start для t0 и stock_end для (t1 - 1)
    const c_t0 = Number(s_t0.start);
    // Для t1 используем stock_end строки, где year_start = yearEnd - 1 (последний завершённый переход)
    const lastRow = db.prepare(`
        SELECT baseline_stock_end_tc_ha AS stock_end
        FROM baseline
        WHERE aoi_id = ? AND CAST(year_start AS INTEGER) = ?
        LIMIT 1
    `).get(aoiId, yearEnd - 1);
    const c_t1 = lastRow && lastRow.stock_end != null ? Number(lastRow.stock_end) : Number(s_t1.end);

    // Основной расчёт: ΔC = A × (c_t1 - c_t0)
    const deltaC = A * (c_t1 - c_t0);
    const E_proj = -deltaC * p.CO2_per_C;
    const c_mean = (c_t0 + c_t1) / 2;
    const e_per_ha = E_proj / (A * dt);

    // Базовая линия
    const c_2015 = Number(first ? first.reference_mean_2015_tc_ha : c_t0);
    const c_2019 = Number(first ? first.reference_mean_2019_tc_ha : c_t0);
    const g = (c_2019 - c_2015) / 4;
    const c_base_t0 = Math.max(0, c_2019 + g * (yearStart - 2019));
    const c_base_t1 = Math.max(0, c_2019 + g * (yearEnd   - 2019));
    const E_base = -A * (c_base_t1 - c_base_t0) * p.CO2_per_C;

    const R = E_base - E_proj - p.LK;

    // Неопределённость (сценарная ±20%)
    const unc = Math.abs(E_proj) * 0.20;
    const L = E_proj - unc;
    const U = E_proj + unc;
    const H = Math.max(Math.abs(E_proj - L), Math.abs(U - E_proj));

    // Расчёт единиц
    let Q = 0, UNC = 0, R_adj = 0, B = 0, reason = null;
    if (R <= 0) {
        reason = 'R ≤ 0: проект не даёт дополнительного эффекта относительно базовой линии';
    } else if (H / R >= p.UNC_stop_ratio) {
        reason = 'H/R ≥ 1: неопределённость превышает результат';
    } else {
        UNC = Math.min(1, Math.max(0, H / R - p.UNC_allowance));
        R_adj = R * (1 - UNC);
        Q = Math.floor(R_adj * (1 - p.BUF));
        B = R_adj * p.BUF;
    }

    // ================= СТАТУС =================
    // Логика:
    //  1. ΔC < 0 → лес теряет углерод → "create" (создать ферму/восстановить)
    //  2. ΔC ≈ 0 или > 0 и Q > 0 → есть единицы → "buy"
    //  3. ΔC > 0 и Q = 0 → запас стабилен → "hold"
    let status;
    if (deltaC < 0) {
        status = 'create';      // потеря → нужна ферма/восстановление
    } else if (Q > 0) {
        status = 'buy';         // есть углеродные единицы → можно покупать
    } else {
        status = 'hold';        // стабильно → держать
    }

    const events = db.prepare('SELECT * FROM events WHERE aoi_id = ?').all(aoiId);

    return {
        aoi: {
            aoi_id: aoi.aoi_id, name: aoi.name, region: aoi.region,
            area_ha: A,
            bbox: [aoi.bbox_south, aoi.bbox_west, aoi.bbox_north, aoi.bbox_east],
            geometry: aoi.geometry ? JSON.parse(aoi.geometry) : null,
            selection_role: aoi.selection_role
        },
        period: { yearStart, yearEnd, dt },
        stocks: {
            c_t0_tCha: +c_t0.toFixed(3),
            c_t1_tCha: +c_t1.toFixed(3),
            c_mean_tCha: +c_mean.toFixed(3),
            deltaC_tC: +deltaC.toFixed(2)
        },
        carbon: {
            E_proj_tCO2e: +E_proj.toFixed(2),
            e_per_ha_yr: +e_per_ha.toFixed(4),
            E_base_tCO2e: +E_base.toFixed(2),
            R_tCO2e: +R.toFixed(2),
            L_tCO2e: +L.toFixed(2),
            U_tCO2e: +U.toFixed(2),
            H_tCO2e: +H.toFixed(2),
            UNC: +UNC.toFixed(4),
            R_adj_tCO2e: +R_adj.toFixed(2),
            buffer_B_tCO2e: +B.toFixed(2),
            units_Q: Q
        },
        value: {
            price_low_rub:  Q * p.PRICE_LOW,
            price_mid_rub:  Q * p.PRICE_MID,
            price_high_rub: Q * p.PRICE_HIGH
        },
        status, reason, events
    };
}

function getSeries(aoiId) {
    const aoi = db.prepare('SELECT * FROM aoi WHERE aoi_id = ?').get(aoiId);
    if (!aoi) return [];
    // Берём stock_start каждой строки — это запас на год year_start
    const rows = db.prepare(`
        SELECT year_start AS year, baseline_stock_start_tc_ha AS stock_tCha
        FROM baseline WHERE aoi_id = ?
        ORDER BY year_start
    `).all(aoiId);
    return rows.map(r => ({
        year: r.year, stock_tCha: r.stock_tCha,
        total_tC: +(r.stock_tCha * aoi.area_ha).toFixed(2),
        co2e: +(r.stock_tCha * aoi.area_ha * (44/12)).toFixed(2)
    }));
}

module.exports = { calculateMetrics, getSeries, getParams };
