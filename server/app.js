// server/app.js
// Сборка Express-приложения.
// Экспортирует готовый app, не слушает порт (это делает index.js).

const express = require('express');
const cors = require('cors');
const path = require('path');

const logger = require('./middleware/logger');
const { notFound, errorHandler } = require('./middleware/error-handler');
const apiRoutes = require('./routes');

function createApp() {
    const app = express();

    // Промежуточные слои
    app.use(cors());
    app.use(express.json({ limit: '5mb' }));
    app.use(logger);

    // API
    app.use('/api', apiRoutes);

    // Статика фронта
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // SPA-фолбэк — все не-API маршруты отдают index.html
    app.get(/^\/(?!api).*/, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });

    // 404 и обработка ошибок
    app.use(notFound);
    app.use(errorHandler);

    return app;
}

module.exports = { createApp };
