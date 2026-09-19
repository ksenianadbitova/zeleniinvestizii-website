// server/core/units.js
// Хелперы для единиц и числовых преобразований.
// Отдельный модуль, чтобы формулы в других местах читались однозначно.

const CO2_PER_C = 44 / 12;  // молярное отношение, безразмерное

/** Биомасса (т сух. в-ва) → углерод (т С). CF = 0.47 по МГЭИК. */
function biomassToCarbon(biomass_t, cf = 0.47) {
    return biomass_t * cf;
}

/** Углерод (т С) → CO2-эквивалент (т CO2-экв.). */
function carbonToCO2e(carbon_t) {
    return carbon_t * CO2_PER_C;
}

/** Безопасное приведение к числу, NaN → null. */
function numOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/** Округление до n знаков без накопления мусора. */
function round(v, digits = 2) {
    if (!Number.isFinite(v)) return null;
    const k = Math.pow(10, digits);
    return Math.round(v * k) / k;
}

module.exports = { CO2_PER_C, biomassToCarbon, carbonToCO2e, numOrNull, round };
