// server/middleware/logger.js
// Простое логирование запросов: метод, путь, статус, время.

function logger(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        const ts = new Date().toISOString();
        console.log(`[${ts}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
}

module.exports = logger;
