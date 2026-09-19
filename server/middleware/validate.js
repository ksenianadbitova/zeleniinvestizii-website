// server/middleware/validate.js
// Простые проверки query и body. Без внешних зависимостей.

const { AppError } = require('./error-handler');

const PERIOD = { MIN: 2019, MAX: 2024 };

function parseIntStrict(value, name) {
    if (value === undefined || value === null) return null;
    const n = Number(value);
    if (!Number.isInteger(n)) {
        throw new AppError(`Параметр "${name}" должен быть целым числом`, 'INVALID_INPUT', 400);
    }
    return n;
}

/**
 * Валидация query {yearStart, yearEnd}.
 */
function validatePeriod(req, res, next) {
    try {
        const yearStart = parseIntStrict(req.query.yearStart, 'yearStart') ?? PERIOD.MIN;
        const yearEnd   = parseIntStrict(req.query.yearEnd,   'yearEnd')   ?? PERIOD.MAX;

        if (yearEnd <= yearStart) {
            throw new AppError('yearEnd должен быть больше yearStart', 'INVALID_PERIOD', 400);
        }
        if (yearStart < PERIOD.MIN || yearEnd > PERIOD.MAX) {
            throw new AppError(
                `Период должен быть в диапазоне ${PERIOD.MIN}–${PERIOD.MAX}`,
                'INVALID_PERIOD', 400,
                { yearStart, yearEnd, allowed: [PERIOD.MIN, PERIOD.MAX] }
            );
        }

        req.period = { yearStart, yearEnd };
        next();
    } catch (e) {
        next(e);
    }
}

/**
 * Валидация body { polygon, yearStart, yearEnd } для POST /api/analyze.
 * polygon — GeoJSON Polygon в WGS84.
 */
function validateAnalyzeRequest(req, res, next) {
    try {
        const { polygon, yearStart, yearEnd } = req.body || {};
        if (!polygon || polygon.type !== 'Polygon') {
            throw new AppError('polygon должен быть GeoJSON Polygon', 'INVALID_POLYGON', 400);
        }
        if (!Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
            throw new AppError('polygon.coordinates пуст', 'INVALID_POLYGON', 400);
        }

        const y0 = parseIntStrict(yearStart, 'yearStart');
        const y1 = parseIntStrict(yearEnd,   'yearEnd');
        if (y0 === null || y1 === null) {
            throw new AppError('yearStart и yearEnd обязательны', 'INVALID_PERIOD', 400);
        }
        if (y1 <= y0) {
            throw new AppError('yearEnd должен быть больше yearStart', 'INVALID_PERIOD', 400);
        }
        if (y0 < PERIOD.MIN || y1 > PERIOD.MAX) {
            throw new AppError(
                `Период должен быть в диапазоне ${PERIOD.MIN}–${PERIOD.MAX}`,
                'INVALID_PERIOD', 400
            );
        }

        req.analysis = { polygon, yearStart: y0, yearEnd: y1 };
        next();
    } catch (e) {
        next(e);
    }
}

module.exports = { validatePeriod, validateAnalyzeRequest, PERIOD };
