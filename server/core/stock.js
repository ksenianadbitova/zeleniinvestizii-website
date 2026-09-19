// server/core/stock.js
// Расчёт запаса и его изменения по методу stock-difference.
//
//   c_t     = средний запас (т С/га) на год t
//   C_t     = A * c_t          (т С)
//   ΔC      = C_t1 - C_t0
//   E_proj  = -ΔC * 44/12      (т CO2-экв.)
//   e       = E_proj / (A * Δt) — на га и год
//
// Знак E_proj: положительное — потеря углерода из пула, отрицательное — накопление.

const { CO2_PER_C, round } = require('./units');
const { getBaselineForAoi } = require('./baseline');

/**
 * Средний запас на начало года y по baseline-строке с year_start = y.
 * Для year = yearEnd используем baseline_stock_end строки с year_start = y-1
 * (последний завершённый переход).
 */
function stockForYear(aoiId, year) {
    const rows = getBaselineForAoi(aoiId);
    if (!rows.length) return null;

    // Точное совпадение year_start
    const startRow = rows.find(r => r.year_start === year);
    if (startRow && Number.isFinite(startRow.baseline_stock_start_tc_ha)) {
        return startRow.baseline_stock_start_tc_ha;
    }

    // Для year = yearEnd: stock_end строки year_start = year - 1
    const prevRow = rows.find(r => r.year_start === year - 1);
    if (prevRow && Number.isFinite(prevRow.baseline_stock_end_tc_ha)) {
        return prevRow.baseline_stock_end_tc_ha;
    }

    // Fallback: ближайшая строка
    const nearest = rows.reduce((best, r) => {
        const d = Math.abs(r.year_start - year);
        return (!best || d < best.d) ? { r, d } : best;
    }, null);
    return nearest ? nearest.r.baseline_stock_start_tc_ha : null;
}

/**
 * Основной расчёт запаса и его изменения.
 *
 * @param {string} aoiId
 * @param {number} areaHa
 * @param {number} yearStart
 * @param {number} yearEnd
 */
function computeStock(aoiId, areaHa, yearStart, yearEnd) {
    const dt = yearEnd - yearStart;
    if (dt <= 0) throw new Error('yearEnd должен быть больше yearStart');

    const c_t0 = stockForYear(aoiId, yearStart);
    const c_t1 = stockForYear(aoiId, yearEnd);
    if (c_t0 === null || c_t1 === null) {
        throw new Error('Нет данных о запасе для ' + aoiId + ' на ' + yearStart + '–' + yearEnd);
    }

    const C_t0 = areaHa * c_t0;
    const C_t1 = areaHa * c_t1;
    const dC   = C_t1 - C_t0;
    const E    = -dC * CO2_PER_C;
    const e    = E / (areaHa * dt);
    const cMean = (c_t0 + c_t1) / 2;

    return {
        c_t0_tCha:      round(c_t0, 3),
        c_t1_tCha:      round(c_t1, 3),
        c_mean_tCha:    round(cMean, 3),
        C_t0_tC:        round(C_t0, 3),
        C_t1_tC:        round(C_t1, 3),
        deltaC_tC:      round(dC, 3),
        E_proj_tCO2e:   round(E, 3),
        e_per_ha_yr:    round(e, 4),
        dt,
    };
}

module.exports = { stockForYear, computeStock };
