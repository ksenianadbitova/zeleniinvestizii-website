// server/calculator.js
// Высокоуровневый расчёт метрик по AOI.
// Вся математика — в server/core/*. Этот модуль только связывает БД и core.

const db = require('./db');
const { computeStock }      = require('./core/stock');
const { computeEBase }      = require('./core/baseline');
const { computeRange }      = require('./core/uncertainty');
const { computeCredits }    = require('./core/credits');
const { getParameters }     = require('./core/parameters');
const { round }             = require('./core/units');

const { AppError } = require('./middleware/error-handler');

/**
 * Основной расчёт метрик по AOI за период.
 *
 * @param {string} aoiId
 * @param {number} yearStart
 * @param {number} yearEnd
 * @returns {object}
 */
function calculateMetrics(aoiId, yearStart = 2019, yearEnd = 2024) {
    const aoi = db.prepare('SELECT * FROM aoi WHERE aoi_id = ?').get(aoiId);
    if (!aoi) throw new AppError('Участок не найден: ' + aoiId, 'AOI_NOT_FOUND', 404);

    const areaHa = Number(aoi.area_ha);
    const dt = yearEnd - yearStart;
    if (dt <= 0) throw new AppError('yearEnd должен быть больше yearStart', 'INVALID_PERIOD', 400);

    const params = getParameters();

    // 1. Запас и его изменение
    const stock = computeStock(aoiId, areaHa, yearStart, yearEnd);

    // 2. Базовая линия
    const base = computeEBase(aoiId, areaHa, yearStart, yearEnd);
    if (!base) throw new AppError('Нет базовой линии для ' + aoiId, 'BASELINE_MISSING', 500);

    // 3. Неопределённость (L, U, H)
    const range = computeRange(
        stock.E_proj_tCO2e,
        areaHa,
        stock.c_t0_tCha,
        stock.c_t1_tCha,
        params.SIGMA_REL || 0.20
    );

    // 4. Потенциальные единицы
    const credits = computeCredits({
        E_proj_tCO2e: stock.E_proj_tCO2e,
        E_base_tCO2e: base.E_base_tCO2e,
        L_tCO2e:      range.L_tCO2e,
        U_tCO2e:      range.U_tCO2e,
        params: {
            UNC_allowance:  params.UNC_allowance,
            UNC_stop_ratio: params.UNC_stop_ratio,
            BUF:            params.BUF,
            LK:             params.LK,
        },
    });

    // 5. Статус для UI
    const status = deriveStatus(stock.deltaC_tC, credits.units_Q);

    const events = db.prepare('SELECT * FROM events WHERE aoi_id = ?').all(aoiId);

    return {
        aoi: {
            aoi_id: aoi.aoi_id,
            name: aoi.name,
            region: aoi.region,
            area_ha: areaHa,
            bbox: [aoi.bbox_south, aoi.bbox_west, aoi.bbox_north, aoi.bbox_east],
            geometry: aoi.geometry ? JSON.parse(aoi.geometry) : null,
            selection_role: aoi.selection_role,
        },
        period: { yearStart, yearEnd, dt },
        stocks: {
            c_t0_tCha:   stock.c_t0_tCha,
            c_t1_tCha:   stock.c_t1_tCha,
            c_mean_tCha: stock.c_mean_tCha,
            deltaC_tC:   stock.deltaC_tC,
        },
        carbon: {
            E_proj_tCO2e:   stock.E_proj_tCO2e,
            e_per_ha_yr:    stock.e_per_ha_yr,
            E_base_tCO2e:   base.E_base_tCO2e,
            R_tCO2e:        credits.R_tCO2e,
            L_tCO2e:        credits.L_tCO2e,
            U_tCO2e:        credits.U_tCO2e,
            H_tCO2e:        credits.H_tCO2e,
            UNC:            credits.UNC,
            R_adj_tCO2e:    credits.R_adj_tCO2e,
            buffer_B_tCO2e: credits.buffer_B_tCO2e,
            units_Q:        credits.units_Q,
            reason:         credits.reason,
        },
        value: {
            price_low_rub:  credits.units_Q * params.PRICE_LOW,
            price_mid_rub:  credits.units_Q * params.PRICE_MID,
            price_high_rub: credits.units_Q * params.PRICE_HIGH,
        },
        uncertainty: {
            sigma_rel:  range.sigma_rel,
            sigma_E:    range.sigma_E,
            margin_95:  range.margin_95,
            status:     range.status,
        },
        status,
        events,
    };
}

/** Логика UI-статуса */
function deriveStatus(deltaC_tC, Q) {
    if (deltaC_tC < 0) return 'create';
    if (Q > 0)         return 'buy';
    return 'hold';
}

/** Серия годовых значений по AOI (для графика динамики) */
function getSeries(aoiId) {
    const aoi = db.prepare('SELECT * FROM aoi WHERE aoi_id = ?').get(aoiId);
    if (!aoi) return [];

    const rows = db.prepare(`
        SELECT year_start AS year, baseline_stock_start_tc_ha AS stock_tCha
        FROM baseline WHERE aoi_id = ?
        ORDER BY year_start
    `).all(aoiId);

    const { CO2_PER_C } = require('./core/units');

    return rows.map(r => ({
        year: r.year,
        stock_tCha: r.stock_tCha,
        total_tC: +(r.stock_tCha * aoi.area_ha).toFixed(2),
        co2e:     +(r.stock_tCha * aoi.area_ha * CO2_PER_C).toFixed(2),
    }));
}

/** Параметры — тонкая обёртка над core/parameters */
function getParams() {
    return getParameters();
}

module.exports = { calculateMetrics, getSeries, getParams };
