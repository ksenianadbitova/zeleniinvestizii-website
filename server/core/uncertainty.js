// server/core/uncertainty.js
// Оценка диапазона результата [L, U] вокруг E_proj.
//
// По постановке (стр. 5): SD пикселя CCI характеризует исходный продукт
// биомассы. Точный перенос ошибок через stock-difference требует чтения
// растра CCI (канал 2 — AGB_SD). Пока сервис использует агрегированный
// подход: относительная ошибка среднего запаса ε (доля от c_mean_t0/t1).
//
// Формула:
//   sigma_dC  = A * sqrt( (ε * c_t0)^2 + (ε * c_t1)^2 )   [т С]
//   sigma_E   = sigma_dC * 44/12                          [т CO2-экв.]
//   L = E_proj - 1.96 * sigma_E
//   U = E_proj + 1.96 * sigma_E
//
// ε = 0.20 (20 %) — эвристика по умолчанию, пока не подключён реальный SD
// из CCI_Biomass_YYYY.tif, канал 2. В отчёте указан статус "сценарная".

const { CO2_PER_C, round } = require('./units');

const DEFAULT_SIGMA_REL = 0.20;   // 20 % — сценарная относительная ошибка
const Z_95 = 1.96;                // квантиль нормального распределения

/**
 * @param {number} E_proj_tCO2e   проектный результат
 * @param {number} areaHa         площадь
 * @param {number} c_t0_tCha      средний запас t0
 * @param {number} c_t1_tCha      средний запас t1
 * @param {number} [sigmaRel]     относительная ошибка (доля)
 */
function computeRange(E_proj_tCO2e, areaHa, c_t0_tCha, c_t1_tCha, sigmaRel = DEFAULT_SIGMA_REL) {
    const s0 = sigmaRel * c_t0_tCha;
    const s1 = sigmaRel * c_t1_tCha;
    const sigma_dC = areaHa * Math.sqrt(s0 * s0 + s1 * s1);
    const sigma_E  = sigma_dC * CO2_PER_C;
    const margin   = Z_95 * sigma_E;

    return {
        L_tCO2e:      round(E_proj_tCO2e - margin, 3),
        U_tCO2e:      round(E_proj_tCO2e + margin, 3),
        sigma_E:      round(sigma_E, 3),
        margin_95:    round(margin, 3),
        sigma_rel:    sigmaRel,
        status:       'сценарная оценка (±20 % относительная ошибка среднего запаса)',
    };
}

module.exports = { DEFAULT_SIGMA_REL, Z_95, computeRange };
