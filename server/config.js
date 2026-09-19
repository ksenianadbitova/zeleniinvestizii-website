// server/config.js
// Централизованные пути и параметры по умолчанию.
// Значения-коэффициенты читаются из data/methodology/parameters.csv
// и могут переопределяться здесь только для fallback.

const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
    ROOT,
    PATHS: {
        data:          path.join(ROOT, 'data'),
        rasters:       path.join(ROOT, 'data', 'rasters'),
        methodology:   path.join(ROOT, 'data', 'methodology'),
        baselineCsv:   path.join(ROOT, 'data', 'methodology', 'baseline.csv'),
        parametersCsv: path.join(ROOT, 'data', 'methodology', 'parameters.csv'),
        areasGeojson:  path.join(ROOT, 'data', 'areas.geojson'),
        areasCsv:      path.join(ROOT, 'data', 'areas.csv'),
        scenesCsv:     path.join(ROOT, 'data', 'scenes.csv'),
        eventsCsv:     path.join(ROOT, 'data', 'events.csv'),
        sourcesCsv:    path.join(ROOT, 'data', 'sources.csv'),
        fileCatalog:   path.join(ROOT, 'data', 'file_catalog.csv'),
        db:            path.join(ROOT, 'data', 'carbon.db'),
        publicDir:     path.join(ROOT, 'public'),
    },
    // Границы допустимого запроса
    PERIOD: {
        MIN_YEAR: 2019,
        MAX_YEAR: 2024,
    },
    // Fallback-коэффициенты, если parameters.csv недоступен
    DEFAULTS: {
        CF_AGB:         0.47,
        CO2_per_C:      44 / 12,
        UNC_allowance:  0.10,
        UNC_stop_ratio: 1.00,
        BUF:            0.15,
        LK:             0.00,
        PRICE_LOW:      500,
        PRICE_MID:      1500,
        PRICE_HIGH:     4000,
    },
};
