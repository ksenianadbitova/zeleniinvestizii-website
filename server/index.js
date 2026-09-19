const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { calculateMetrics, getSeries, getParams } = require('./calculator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.get('/api/aoi', (req, res) => {
    const rows = db.prepare('SELECT * FROM aoi').all();
    res.json(rows.map(r => ({ ...r, geometry: r.geometry ? JSON.parse(r.geometry) : null })));
});

app.get('/api/metrics/:aoiId', (req, res) => {
    try {
        const yearStart = parseInt(req.query.yearStart) || 2019;
        const yearEnd = parseInt(req.query.yearEnd) || 2024;
        res.json(calculateMetrics(req.params.aoiId, yearStart, yearEnd));
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/metrics', (req, res) => {
    try {
        const yearStart = parseInt(req.query.yearStart) || 2019;
        const yearEnd = parseInt(req.query.yearEnd) || 2024;
        const aois = db.prepare('SELECT aoi_id FROM aoi').all();
        const results = aois.map(a => calculateMetrics(a.aoi_id, yearStart, yearEnd));
        const total = results.reduce((acc, r) => {
            acc.area_ha += r.aoi.area_ha;
            acc.units_Q += r.carbon.units_Q;
            acc.value_mid_rub += r.value.price_mid_rub;
            acc.E_proj_tCO2e += r.carbon.E_proj_tCO2e;
            return acc;
        }, { area_ha: 0, units_Q: 0, value_mid_rub: 0, E_proj_tCO2e: 0 });
        res.json({ results, total, period: { yearStart, yearEnd } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/series/:aoiId', (req, res) => res.json(getSeries(req.params.aoiId)));

app.get('/api/scenes/:aoiId', (req, res) =>
    res.json(db.prepare('SELECT * FROM scenes WHERE aoi_id = ? ORDER BY datetime_utc').all(req.params.aoiId)));

app.get('/api/events/:aoiId', (req, res) =>
    res.json(db.prepare('SELECT * FROM events WHERE aoi_id = ?').all(req.params.aoiId)));

app.get('/api/sources', (req, res) =>
    res.json(db.prepare('SELECT * FROM sources').all()));

app.get('/api/parameters', (req, res) =>
    res.json(db.prepare('SELECT * FROM parameters').all()));

app.get('/api/baseline/:aoiId', (req, res) =>
    res.json(db.prepare('SELECT * FROM baseline WHERE aoi_id = ? ORDER BY year_start').all(req.params.aoiId)));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.listen(PORT, () => {
    console.log('');
    console.log('🌱 Carbon Credits Service');
    console.log('   Сервер: http://localhost:' + PORT);
    console.log('   API:    http://localhost:' + PORT + '/api/health');
    console.log('');
});
