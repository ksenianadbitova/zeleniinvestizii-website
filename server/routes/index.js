// server/routes/index.js
// Собирает все роуты в один Router.
//
// Каждый роут отвечает только за:
//   1. приём запроса
//   2. вызов сервиса
//   3. возврат JSON
// Обработка ошибок — в middleware/error-handler.js.

const express = require('express');
const db = require('../db');
const { getSeries } = require('../calculator');
const { validatePeriod, validateAnalyzeRequest } = require('../middleware/validate');

const router = express.Router();

// --- Health ---
router.get('/health', (req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
});

// --- AOI ---
router.get('/aoi', (req, res, next) => {
    try {
        const rows = db.prepare('SELECT * FROM aoi').all();
        res.json(rows.map(r => ({
            ...r,
            geometry: r.geometry ? JSON.parse(r.geometry) : null,
        })));
    } catch (e) { next(e); }
});

// --- Metrics (по AOI + период) ---
router.get('/metrics', validatePeriod, (req, res, next) => {
    try {
        const { calculateMetrics } = require('../calculator');
        const { yearStart, yearEnd } = req.period;
        const aois = db.prepare('SELECT aoi_id FROM aoi').all();
        const results = aois.map(a => calculateMetrics(a.aoi_id, yearStart, yearEnd));

        const total = results.reduce((acc, r) => {
            acc.area_ha        += r.aoi.area_ha;
            acc.units_Q        += r.carbon.units_Q;
            acc.value_mid_rub  += r.value.price_mid_rub;
            acc.E_proj_tCO2e   += r.carbon.E_proj_tCO2e;
            return acc;
        }, { area_ha: 0, units_Q: 0, value_mid_rub: 0, E_proj_tCO2e: 0 });

        res.json({ results, total, period: { yearStart, yearEnd } });
    } catch (e) { next(e); }
});

router.get('/metrics/:aoiId', validatePeriod, (req, res, next) => {
    try {
        const { calculateMetrics } = require('../calculator');
        const { yearStart, yearEnd } = req.period;
        res.json(calculateMetrics(req.params.aoiId, yearStart, yearEnd));
    } catch (e) { next(e); }
});

// --- Series ---
router.get('/series/:aoiId', (req, res, next) => {
    try { res.json(getSeries(req.params.aoiId)); } catch (e) { next(e); }
});

// --- Scenes / Events / Sources / Parameters / Baseline ---
router.get('/scenes/:aoiId', (req, res, next) => {
    try {
        res.json(db.prepare('SELECT * FROM scenes WHERE aoi_id = ? ORDER BY datetime_utc').all(req.params.aoiId));
    } catch (e) { next(e); }
});

router.get('/events/:aoiId', (req, res, next) => {
    try { res.json(db.prepare('SELECT * FROM events WHERE aoi_id = ?').all(req.params.aoiId)); }
    catch (e) { next(e); }
});

router.get('/sources', (req, res, next) => {
    try { res.json(db.prepare('SELECT * FROM sources').all()); }
    catch (e) { next(e); }
});

router.get('/parameters', (req, res, next) => {
    try { res.json(db.prepare('SELECT * FROM parameters').all()); }
    catch (e) { next(e); }
});

router.get('/baseline/:aoiId', (req, res, next) => {
    try {
        res.json(db.prepare('SELECT * FROM baseline WHERE aoi_id = ? ORDER BY year_start').all(req.params.aoiId));
    } catch (e) { next(e); }
});

// --- Analysis (произвольный полигон) ---
router.post('/analyze', validateAnalyzeRequest, (req, res, next) => {
    try {
        // TODO: реализовать в services/analysis.service.js
        res.status(501).json({
            error: {
                code: 'NOT_IMPLEMENTED',
                message: 'Эндпоинт /api/analyze в разработке. Используйте /api/metrics.',
            },
        });
    } catch (e) { next(e); }
});

module.exports = router;
