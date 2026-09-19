// server/middleware/error-handler.js
// Единая обработка ошибок в API.
//
// Все ошибки должны быть либо Error, либо AppError с кодом.
// В ответе клиенту — JSON { error: { code, message, details? } }.

class AppError extends Error {
    constructor(message, code = 'INTERNAL_ERROR', status = 500, details = null) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

function notFound(req, res, next) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Не найдено: ' + req.originalUrl } });
}

function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Внутренняя ошибка';

    console.error(`[ERROR] ${code} (${status}):`, message);
    if (process.env.NODE_ENV !== 'production' && err.stack) {
        console.error(err.stack);
    }

    res.status(status).json({
        error: {
            code,
            message,
            ...(err.details ? { details: err.details } : {}),
        },
    });
}

module.exports = { AppError, notFound, errorHandler };
