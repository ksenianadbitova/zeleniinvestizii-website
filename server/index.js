// server/index.js
// Точка входа: только слушает порт и логирует старт.

const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
    console.log('');
    console.log('🌱 Carbon Credits Service');
    console.log('   Сервер: http://localhost:' + PORT);
    console.log('   API:    http://localhost:' + PORT + '/api/health');
    console.log('');
});
