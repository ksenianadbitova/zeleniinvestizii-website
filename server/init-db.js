// server/init-db.js — исправленная версия под реальные CSV
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const db = require('./db');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readCsv(filename) {
    const fullPath = path.join(DATA_DIR, filename);
    console.log('  → Читаю: ' + fullPath);
    if (!fs.existsSync(fullPath)) {
        console.warn('  ⚠️  Файл не найден: ' + filename);
        return [];
    }
    const content = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    console.log('     ✅ ' + rows.length + ' строк, поля: ' + Object.keys(rows[0] || {}).join(', '));
    return rows;
}

console.log('🗑️  Удаление старых таблиц...');
db.exec(`
    DROP TABLE IF EXISTS aoi;
    DROP TABLE IF EXISTS baseline;
    DROP TABLE IF EXISTS parameters;
    DROP TABLE IF EXISTS scenes;
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS sources;
`);

console.log('📋 Создание схемы (исправленной)...');
db.exec(`
    CREATE TABLE aoi (
        aoi_id TEXT PRIMARY KEY,
        name TEXT, region TEXT, area_ha REAL,
        analysis_start_year INTEGER, analysis_end_year INTEGER,
        bbox_west REAL, bbox_south REAL, bbox_east REAL, bbox_north REAL,
        selection_role TEXT, project_status TEXT, baseline_id TEXT,
        stand_age TEXT, dominant_species TEXT, site_class TEXT,
        geometry TEXT
    );

    CREATE TABLE baseline (
        baseline_id TEXT,
        aoi_id TEXT,
        year_start INTEGER,
        year_end INTEGER,
        pool TEXT,
        reference_mean_2015_tc_ha REAL,
        reference_mean_2019_tc_ha REAL,
        historical_rate_tc_ha_yr REAL,
        baseline_stock_start_tc_ha REAL,
        baseline_stock_end_tc_ha REAL,
        baseline_delta_tc_ha REAL,
        kind TEXT,
        history_product TEXT,
        source_start TEXT,
        source_end TEXT,
        clipped_at_zero INTEGER,
        PRIMARY KEY (aoi_id, year_start)      -- ← КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ
    );

    CREATE TABLE parameters (
        parameter TEXT PRIMARY KEY, value TEXT, unit TEXT, kind TEXT,
        source_id TEXT, locator TEXT, applicability TEXT
    );

    CREATE TABLE scenes (
        scene_key TEXT PRIMARY KEY, aoi_id TEXT, item_id TEXT,
        datetime_utc TEXT, year INTEGER, collection TEXT,
        processing_baseline TEXT, source_scene_cloud_percent REAL,
        scl_4_5_6_7_fraction_crop REAL, selection_role TEXT,
        reflectance_path TEXT, scl_path TEXT
    );

    CREATE TABLE events (
        event_id TEXT PRIMARY KEY, aoi_id TEXT, evidence_type TEXT,
        cause_supported TEXT, date_min_product TEXT, date_max_product TEXT,
        burned_pixel_centers_in_aoi INTEGER, all_pixel_centers_in_aoi INTEGER,
        date_uncertainty_days_min INTEGER, date_uncertainty_days_max INTEGER,
        source_id TEXT, context_url TEXT, limitations TEXT
    );

    CREATE TABLE sources (
        source_id TEXT PRIMARY KEY, product TEXT, version TEXT, kind TEXT,
        primary_url TEXT, doi TEXT, license_url TEXT,
        redistribution_basis TEXT, required_attribution TEXT,
        access_date TEXT, limitations TEXT
    );
`);

// ==================== AOI ====================
console.log('\n📍 Загрузка areas.csv + areas.geojson...');
const areas = readCsv('areas.csv');
const geojsonPath = path.join(DATA_DIR, 'areas.geojson');
const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
const geojsonById = {};
geojson.features.forEach(f => { geojsonById[f.properties.aoi_id] = f.geometry; });

const insertAoi = db.prepare(`
    INSERT INTO aoi VALUES (
        @aoi_id, @name, @region, @area_ha,
        @analysis_start_year, @analysis_end_year,
        @bbox_west, @bbox_south, @bbox_east, @bbox_north,
        @selection_role, @project_status, @baseline_id,
        @stand_age, @dominant_species, @site_class, @geometry
    )
`);
db.transaction(() => {
    areas.forEach(a => insertAoi.run({
        aoi_id: a.aoi_id, name: a.name, region: a.region,
        area_ha: parseFloat(a.area_ha),
        analysis_start_year: parseInt(a.analysis_start_year) || 2019,
        analysis_end_year: parseInt(a.analysis_end_year) || 2024,
        bbox_west: parseFloat(a.bbox_west), bbox_south: parseFloat(a.bbox_south),
        bbox_east: parseFloat(a.bbox_east), bbox_north: parseFloat(a.bbox_north),
        selection_role: a.selection_role || '',
        project_status: a.project_status || '',
        baseline_id: a.baseline_id || '',
        stand_age: a.stand_age || '',
        dominant_species: a.dominant_species || '',
        site_class: a.site_class || '',
        geometry: JSON.stringify(geojsonById[a.aoi_id] || null)
    }));
})();
console.log('   ✅ AOI: ' + db.prepare('SELECT COUNT(*) AS n FROM aoi').get().n + ' строк');

// ==================== BASELINE ====================
console.log('\n📈 Загрузка baseline.csv...');
const baseline = readCsv('baseline.csv');

if (baseline.length === 0) {
    console.error('   ❌ CSV пустой!');
} else {
    const insertBaseline = db.prepare(`
        INSERT OR REPLACE INTO baseline VALUES (
            @baseline_id, @aoi_id, @year_start, @year_end, @pool,
            @reference_mean_2015_tc_ha, @reference_mean_2019_tc_ha,
            @historical_rate_tc_ha_yr, @baseline_stock_start_tc_ha,
            @baseline_stock_end_tc_ha, @baseline_delta_tc_ha,
            @kind, @history_product, @source_start, @source_end, @clipped_at_zero
        )
    `);
    let ok = 0, fail = 0;
    db.transaction(() => {
        baseline.forEach((b, idx) => {
            try {
                insertBaseline.run({
                    baseline_id: b.baseline_id,
                    aoi_id: b.aoi_id,
                    year_start: parseInt(b.year_start),
                    year_end: parseInt(b.year_end),
                    pool: b.pool || 'AGB',
                    reference_mean_2015_tc_ha: parseFloat(b.reference_mean_2015_tc_ha),
                    reference_mean_2019_tc_ha: parseFloat(b.reference_mean_2019_tc_ha),
                    historical_rate_tc_ha_yr: parseFloat(b.historical_rate_tc_ha_yr),
                    baseline_stock_start_tc_ha: parseFloat(b.baseline_stock_start_tc_ha),
                    baseline_stock_end_tc_ha: parseFloat(b.baseline_stock_end_tc_ha),
                    baseline_delta_tc_ha: parseFloat(b.baseline_delta_tc_ha),
                    kind: b.kind || '',
                    history_product: b.history_product || '',
                    source_start: b.source_start || '',
                    source_end: b.source_end || '',
                    clipped_at_zero: (b.clipped_at_zero === 'true' || b.clipped_at_zero === '1') ? 1 : 0
                });
                ok++;
            } catch (e) {
                fail++;
                if (fail <= 3) {
                    console.error('   ❌ Строка ' + idx + ': ' + e.message);
                }
            }
        });
    })();
    console.log('   ✅ Baseline: добавлено ' + ok + ', ошибок ' + fail);
    console.log('   ✅ В БД baseline: ' + db.prepare('SELECT COUNT(*) AS n FROM baseline').get().n + ' строк');
}

// ==================== PARAMETERS ====================
console.log('\n⚙️  Загрузка parameters.csv...');
const params = readCsv('parameters.csv');
if (params.length > 0) {
    const insertParam = db.prepare(`INSERT OR REPLACE INTO parameters VALUES (@parameter,@value,@unit,@kind,@source_id,@locator,@applicability)`);
    db.transaction(() => {
        params.forEach(p => insertParam.run({
            parameter: p.parameter, value: p.value, unit: p.unit, kind: p.kind,
            source_id: p.source_id, locator: p.locator, applicability: p.applicability
        }));
    })();
}
console.log('   ✅ Parameters: ' + db.prepare('SELECT COUNT(*) AS n FROM parameters').get().n + ' строк');

// ==================== SCENES ====================
console.log('\n🛰️  Загрузка scenes.csv...');
const scenes = readCsv('scenes.csv');
if (scenes.length > 0) {
    const insertScene = db.prepare(`INSERT OR REPLACE INTO scenes VALUES (@scene_key,@aoi_id,@item_id,@datetime_utc,@year,@collection,@processing_baseline,@source_scene_cloud_percent,@scl_4_5_6_7_fraction_crop,@selection_role,@reflectance_path,@scl_path)`);
    db.transaction(() => {
        scenes.forEach(s => insertScene.run({
            scene_key: s.scene_key, aoi_id: s.aoi_id, item_id: s.item_id,
            datetime_utc: s.datetime_utc, year: parseInt(s.year),
            collection: s.collection, processing_baseline: s.processing_baseline,
            source_scene_cloud_percent: parseFloat(s.source_scene_cloud_percent) || 0,
            scl_4_5_6_7_fraction_crop: parseFloat(s.scl_4_5_6_7_fraction_crop) || 0,
            selection_role: s.selection_role,
            reflectance_path: s.reflectance_path, scl_path: s.scl_path
        }));
    })();
}
console.log('   ✅ Scenes: ' + db.prepare('SELECT COUNT(*) AS n FROM scenes').get().n + ' строк');

// ==================== EVENTS ====================
console.log('\n🔥 Загрузка events.csv...');
const events = readCsv('events.csv');
if (events.length > 0) {
    const insertEvent = db.prepare(`INSERT OR REPLACE INTO events VALUES (@event_id,@aoi_id,@evidence_type,@cause_supported,@date_min_product,@date_max_product,@burned_pixel_centers_in_aoi,@all_pixel_centers_in_aoi,@date_uncertainty_days_min,@date_uncertainty_days_max,@source_id,@context_url,@limitations)`);
    db.transaction(() => {
        events.forEach(e => insertEvent.run({
            event_id: e.event_id, aoi_id: e.aoi_id,
            evidence_type: e.evidence_type, cause_supported: e.cause_supported,
            date_min_product: e.date_min_product, date_max_product: e.date_max_product,
            burned_pixel_centers_in_aoi: parseInt(e.burned_pixel_centers_in_aoi),
            all_pixel_centers_in_aoi: parseInt(e.all_pixel_centers_in_aoi),
            date_uncertainty_days_min: parseInt(e.date_uncertainty_days_min),
            date_uncertainty_days_max: parseInt(e.date_uncertainty_days_max),
            source_id: e.source_id, context_url: e.context_url,
            limitations: e.limitations
        }));
    })();
}
console.log('   ✅ Events: ' + db.prepare('SELECT COUNT(*) AS n FROM events').get().n + ' строк');

// ==================== SOURCES ====================
console.log('\n📚 Загрузка sources.csv...');
const sources = readCsv('sources.csv');
if (sources.length > 0) {
    const insertSource = db.prepare(`INSERT OR REPLACE INTO sources VALUES (@source_id,@product,@version,@kind,@primary_url,@doi,@license_url,@redistribution_basis,@required_attribution,@access_date,@limitations)`);
    db.transaction(() => {
        sources.forEach(s => insertSource.run({
            source_id: s.source_id, product: s.product, version: s.version,
            kind: s.kind, primary_url: s.primary_url, doi: s.doi,
            license_url: s.license_url,
            redistribution_basis: s.redistribution_basis || '',
            required_attribution: s.required_attribution,
            access_date: s.access_date || '',
            limitations: s.limitations
        }));
    })();
}
console.log('   ✅ Sources: ' + db.prepare('SELECT COUNT(*) AS n FROM sources').get().n + ' строк');

// ==================== ИТОГ ====================
console.log('\n═══════════════════════════════════');
console.log('🎉 ИТОГО:');
console.log('   aoi:        ' + db.prepare('SELECT COUNT(*) AS n FROM aoi').get().n);
console.log('   baseline:   ' + db.prepare('SELECT COUNT(*) AS n FROM baseline').get().n);
console.log('   parameters: ' + db.prepare('SELECT COUNT(*) AS n FROM parameters').get().n);
console.log('   scenes:     ' + db.prepare('SELECT COUNT(*) AS n FROM scenes').get().n);
console.log('   events:     ' + db.prepare('SELECT COUNT(*) AS n FROM events').get().n);
console.log('   sources:    ' + db.prepare('SELECT COUNT(*) AS n FROM sources').get().n);
console.log('═══════════════════════════════════\n');
