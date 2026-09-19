// server/core/credits.js
// Формулы расчёта потенциальных углеродных единиц.
// Соответствует разделу "Расчёт потенциальных единиц" постановки.

const { round } = require('./units');

/**
 * Параметры по умолчанию (из parameters.csv кейса).
 */
const DEFAULT_PARAMS = {
    UNC_allowance:  0.10,   // порог без вычета
    UNC_stop_ratio: 1.00,   // H/R >= 1 → Q = 0
    BUF:            0.15,   // резерв
    LK:             0.00,   // вычет за утечку (кейс: 0)
};

/**
 * Расчёт результата относительно базовой линии.
 *
 *   R = E_proj - E_base - LK
 *
 * Все аргументы в т CO2-экв. за период.
 */
function computeR(E_proj_tCO2e, E_base_tCO2e, LK = 0) {
    // R = E_base - E_proj - LK
    // (в постановке E_base и E_proj отрицательные; R положительный = эффект проекта)
    return E_base_tCO2e - E_proj_tCO2e - LK;
}

/**
 * H — расстояние от E_proj до наиболее удалённой границы диапазона [L, U].
 * Оба конца диапазона в т CO2-экв.
 */
function computeH(E_proj_tCO2e, L_tCO2e, U_tCO2e) {
    return Math.max(
        Math.abs(E_proj_tCO2e - L_tCO2e),
        Math.abs(U_tCO2e - E_proj_tCO2e)
    );
}

/**
 * Доля вычета за неопределённость.
 *
 * ВНИМАНИЕ: точная формула UNC в PDF-постановке (стр. 6) не распарсилась.
 * Реализована гипотеза B:  UNC = max(0, H/R - UNC_allowance).
 *   - При H/R <= UNC_allowance (0.10) вычет = 0.
 *   - При H/R > UNC_allowance вычет = H/R - 0.10.
 * Проверка на примере из постановки: R=517, H=103.4, H/R=0.20
 *   → UNC = max(0, 0.20 - 0.10) = 0.10  ✔ (совпадает с текстом)
 *
 * Если в PDF формула другая — поправить здесь и обновить тест.
 */
function computeUNC(H, R, allowance = DEFAULT_PARAMS.UNC_allowance) {
    if (R <= 0) return 0;
    const ratio = H / R;
    if (ratio <= allowance) return 0;
    return ratio - allowance;
}

/**
 * Итоговый расчёт потенциальных единиц.
 *
 * @param {object} args
 * @param {number} args.E_proj_tCO2e    проектный результат
 * @param {number} args.E_base_tCO2e    результат базовой линии
 * @param {number} args.L_tCO2e         нижняя граница диапазона
 * @param {number} args.U_tCO2e         верхняя граница диапазона
 * @param {object} [args.params]        UNC_allowance, UNC_stop_ratio, BUF, LK
 *
 * @returns {object} подробный результат со всеми промежуточными значениями
 */
function computeCredits(args) {
    const params = { ...DEFAULT_PARAMS, ...(args.params || {}) };
    const { E_proj_tCO2e, E_base_tCO2e, L_tCO2e, U_tCO2e } = args;

    const R = computeR(E_proj_tCO2e, E_base_tCO2e, params.LK);
    const H = computeH(E_proj_tCO2e, L_tCO2e, U_tCO2e);

    let UNC = 0;
    let R_adj = 0;
    let B = 0;
    let Q = 0;
    let reason = null;

    if (R <= 0) {
        reason = 'R <= 0: проект не даёт дополнительного эффекта относительно базовой линии';
    } else if (H / R >= params.UNC_stop_ratio) {
        reason = 'H/R >= ' + params.UNC_stop_ratio + ': неопределённость превышает результат';
    } else {
        UNC = computeUNC(H, R, params.UNC_allowance);
        R_adj = R * (1 - UNC);
        B = R_adj * params.BUF;
        Q = Math.floor(R_adj - B);
        if (Q < 0) Q = 0;  // защита от отрицательного округления
    }

    return {
        E_proj_tCO2e:   round(E_proj_tCO2e, 3),
        E_base_tCO2e:   round(E_base_tCO2e, 3),
        L_tCO2e:        round(L_tCO2e, 3),
        U_tCO2e:        round(U_tCO2e, 3),
        H_tCO2e:        round(H, 3),
        R_tCO2e:        round(R, 3),
        UNC:            round(UNC, 4),
        R_adj_tCO2e:    round(R_adj, 3),
        buffer_B_tCO2e: round(B, 3),
        units_Q:        Q,
        reason,
        params,
    };
}

module.exports = {
    DEFAULT_PARAMS,
    computeR,
    computeH,
    computeUNC,
    computeCredits,
};

