// server/core/baseline.js
// Работа с базовой линией из data/methodology/baseline.csv.
//
// Формула из постановки:
//   g          = (c_2019 - c_2015) / 4
//   c_base,y   = max(0, c_2019 + g * (y - 2019))
//   E_base     = -A * (c_base,t1 - c_base,t0) * 44/12
//
// baseline.csv уже содержит готовые reference_mean_2015_tc_ha,
// reference_mean_2019_tc_ha и historical_rate_tc_ha_yr — используем их
// как первичный источник, а формулу g проверяем отдельно.

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PATHS } = require('../config');
const { CO2_PER_C } = require('./units');

let _cache = null;

/** Читает baseline.csv один раз и кэширует. */
function loadBaseline() {
    if (_cache) return _cache;
    const csv = fs.readFileSync(PATHS.baselineCsv, 'utf8');
    const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
    _cache = rows.map(r => ({
        baseline_id:                r.baseline_id,
        aoi_id:                     r.aoi_id,
        year_start:                 Number(r.year_start),
        year_end:                   Number(r.year_end),
        pool:                       r.pool,
        reference_mean_2015_tc_ha:  Number(r.reference_mean_2015_tc_ha),
        reference_mean_2019_tc_ha:  Number(r.reference_mean_2019_tc_ha),
        historical_rate_tc_ha_yr:   Number(r.historical_rate_tc_ha_yr),
        baseline_stock_start_tc_ha: Number(r.baseline_stock_start_tc_ha),
        baseline_stock_end_tc_ha:   Number(r.baseline_stock_end_tc_ha),
        baseline_delta_tc_ha:       Number(r.baseline_delta_tc_ha),
        kind:                       r.kind,
    }));
    return _cache;
}

/** Все строки базовой линии для участка, отсортированные по year_start. */
function getBaselineForAoi(aoiId) {
    return loadBaseline()
        .filter(r => r.aoi_id === aoiId)
        .sort((a, b) => a.year_start - b.year_start);
}

/**
 * Запас по базовой линии на конкретный год (т С/га).
 * Логика: c_base,y — значение на НАЧАЛО года y.
 *   year = 2019 → reference_mean_2019_tc_ha
 *   year = 2015 → reference_mean_2015_tc_ha
 *   остальное   → c_2019 + g * (y - 2019), не меньше 0
 */
function cBaseAtYear(aoiId, year) {
    const rows = getBaselineForAoi(aoiId);
    if (!rows.length) return null;
    const first = rows[0];
    const c2015 = first.reference_mean_2015_tc_ha;
    const c2019 = first.reference_mean_2019_tc_ha;
    const g     = (c2019 - c2015) / 4;

    if (year === 2015) return c2015;
    if (year === 2019) return c2019;
    return Math.max(0, c2019 + g * (year - 2019));
}

/**
 * Результат базовой линии за период [yearStart, yearEnd] по участку.
 * E_base = -A * (c_base,t1 - c_base,t0) * 44/12   [т CO2-экв.]
 */
function computeEBase(aoiId, areaHa, yearStart, yearEnd) {
    const c_t0 = cBaseAtYear(aoiId, yearStart);
    const c_t1 = cBaseAtYear(aoiId, yearEnd);
    if (c_t0 === null || c_t1 === null) return null;

    const dC   = areaHa * (c_t1 - c_t0);        // т С
    const E    = -dC * CO2_PER_C;               // т CO2-экв.
    return {
        c_base_t0_tCha:  c_t0,
        c_base_t1_tCha:  c_t1,
        deltaC_tC:       dC,
        E_base_tCO2e:    E,
    };
}

module.exports = { loadBaseline, getBaselineForAoi, cBaseAtYear, computeEBase };
