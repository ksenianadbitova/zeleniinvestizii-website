// server/core/parameters.js
// Чтение data/methodology/parameters.csv.
// Все параметры кейса — CF, CO2_per_C, UNC_allowance, BUF, LK, цены.

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { PATHS, DEFAULTS } = require('../config');

let _cache = null;

/**
 * Возвращает объект параметров:
 *   { CF_AGB, CO2_per_C, UNC_allowance, UNC_stop_ratio, BUF, LK,
 *     PRICE_LOW, PRICE_MID, PRICE_HIGH, ... }
 */
function getParameters() {
    if (_cache) return _cache;

    const params = { ...DEFAULTS };

    if (fs.existsSync(PATHS.parametersCsv)) {
        const csv = fs.readFileSync(PATHS.parametersCsv, 'utf8');
        const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });

        for (const row of rows) {
            const name = row.parameter;
            const value = row.value;

            // СО2_per_C хранится строкой "44/12"
            if (name === 'CO2_per_C') {
                params.CO2_per_C = evalFraction(value);
                continue;
            }

            // Приводим к числу
            const num = parseFloat(value);
            if (Number.isFinite(num)) {
                params[name] = num;
            }
        }
    }

    // Маппинг prices из parameters.csv в наши ключи
    if (params.price_low   !== undefined) params.PRICE_LOW  = params.price_low;
    if (params.price_base  !== undefined) params.PRICE_MID  = params.price_base;
    if (params.price_high  !== undefined) params.PRICE_HIGH = params.price_high;

    _cache = params;
    return params;
}

/** "44/12" → 3.6667 */
function evalFraction(s) {
    if (typeof s === 'number') return s;
    if (!s) return 44 / 12;
    const m = String(s).match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (m) return parseFloat(m[1]) / parseFloat(m[2]);
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 44 / 12;
}

module.exports = { getParameters };
