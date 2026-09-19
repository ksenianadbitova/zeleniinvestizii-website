let map, layersGroup, markersFire;
let currentLayer = 'units';
let metricsData = null;
let selectedAoiId = null;
const STATUS_COLORS = { buy: '#1565c0', hold: '#2e7d32', create: '#e65100' };

function initMap() {
    map = L.map('map').setView([57.5, 40.0], 5);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles © Esri', maxZoom: 18 }).addTo(map);
    L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png',
        { opacity: 0.55, maxZoom: 18 }).addTo(map);
    layersGroup = L.layerGroup().addTo(map);
    markersFire = L.layerGroup().addTo(map);
}

function getFillColor(r, layer) {
    if (layer === 'change') return r.carbon.E_proj_tCO2e > 0 ? '#c62828' : '#2e7d32';
    if (layer === 'value') {
        const maxV = Math.max.apply(null, metricsData.results.map(function(x){return x.value.price_mid_rub;}).concat([1]));
        const t = r.value.price_mid_rub / maxV;
        return 'hsl(' + (120 - t * 120) + ', 65%, ' + (55 - t * 10) + '%)';
    }
    return STATUS_COLORS[r.status] || '#666';
}

function renderPolygons(layer) {
    layer = layer || currentLayer;
    currentLayer = layer;
    layersGroup.clearLayers();
    markersFire.clearLayers();
    if (!metricsData) return;

    metricsData.results.forEach(function(r) {
        if (!r.aoi.geometry) return;
        const fill = getFillColor(r, layer);
        const poly = L.geoJSON(r.aoi.geometry, {
            style: { color: '#fff', weight: 2.5, fillColor: fill, fillOpacity: r.carbon.units_Q > 0 ? 0.78 : 0.45 }
        });
        poly.on('click', function() { selectAoi(r.aoi.aoi_id); });
        poly.bindTooltip('<b>' + r.aoi.name + '</b><br>Q: ' + r.carbon.units_Q.toLocaleString('ru-RU') + ' ед.<br>ΔC: ' + r.stocks.deltaC_tC.toLocaleString('ru-RU') + ' т С', { sticky: true });

        const center = poly.getBounds().getCenter();
        // Крупная метка с числом единиц
        L.marker(center, {
            icon: L.divIcon({
                className: 'aoi-label',
                html:
                  '<div style="' +
                    'background:#fff;' +
                    'padding:6px 12px;' +
                    'border-radius:10px;' +
                    'font-weight:800;' +
                    'font-size:.95rem;' +
                    'box-shadow:0 4px 14px rgba(0,0,0,.25);' +
                    'white-space:nowrap;' +
                    'color:' + fill + ';' +
                    'border:2px solid ' + fill + ';' +
                  '">' + r.carbon.units_Q.toLocaleString('ru-RU') + ' ед.</div>',
                iconSize: [0, 0]
            }),
            interactive: false
        }).addTo(layersGroup);
        poly.addTo(layersGroup);

        if (layer === 'fire' && r.events && r.events.length) {
            r.events.forEach(function(ev) {
                L.circleMarker(center, { radius: 14, color: '#c62828', weight: 2, fillColor: '#ff5252', fillOpacity: 0.55 })
                    .bindPopup('<b>🔥 Пожар</b><br>' + ev.date_min_product + ' — ' + ev.date_max_product + '<br>Пикселей: ' + ev.burned_pixel_centers_in_aoi + '/' + ev.all_pixel_centers_in_aoi)
                    .addTo(markersFire);
            });
        }
    });
}

function selectAoi(aoiId) {
    selectedAoiId = aoiId;
    const r = metricsData.results.find(function(x) { return x.aoi.aoi_id === aoiId; });
    if (!r) return;
    const sb = document.getElementById('sidebar');
    const statusText = ({ buy: '🛒 Покупать', hold: '📦 Держать', create: '🌳 Создать ферму' })[r.status] || r.status;
    const fmt = function(n) { return Number(n).toLocaleString('ru-RU'); };
    const rub = function(n) { return Number(n).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }); };

    sb.innerHTML =
      '<div class="sidebar-hero">' +
        '<h3>' + r.aoi.name + '</h3>' +
        '<div class="region">' + r.aoi.region + ' • ' + r.aoi.area_ha.toLocaleString('ru-RU') + ' га</div>' +
        '<div class="sidebar-big-metrics">' +
          '<div class="big-metric">' +
            '<div class="big-metric-value">' + fmt(r.carbon.units_Q) + '</div>' +
            '<div class="big-metric-label">Единиц (Q)</div>' +
          '</div>' +
          '<div class="big-metric">' +
            '<div class="big-metric-value">' + fmt(Math.round(r.value.price_mid_rub/1000)) + 'к</div>' +
            '<div class="big-metric-label">₽ (за 1500)</div>' +
          '</div>' +
        '</div>' +
        '<span class="badge ' + r.status + '">' + statusText + '</span>' +
      '</div>' +

      '<div class="sidebar-body">' +
        '<div class="kv kv-highlight"><span>Единицы Q</span><span>' + fmt(r.carbon.units_Q) + ' т CO₂-экв.</span></div>' +
        '<div class="kv kv-highlight"><span>Стоимость (1500 ₽)</span><span>' + rub(r.value.price_mid_rub) + '</span></div>' +
        '<div class="kv kv-highlight"><span>Стоимость (4000 ₽)</span><span>' + rub(r.value.price_high_rub) + '</span></div>' +
        '<div class="kv"><span>Период</span><span>' + r.period.yearStart + '–' + r.period.yearEnd + '</span></div>' +
        '<div class="kv"><span>Запас t₀</span><span>' + r.stocks.c_t0_tCha + ' т С/га</span></div>' +
        '<div class="kv"><span>Запас t₁</span><span>' + r.stocks.c_t1_tCha + ' т С/га</span></div>' +
        '<div class="kv"><span>ΔC</span><span>' + fmt(r.stocks.deltaC_tC) + ' т С</span></div>' +
        '<div class="kv"><span>CO₂-экв. (E)</span><span>' + fmt(r.carbon.E_proj_tCO2e) + ' т</span></div>' +
        '<div class="kv"><span>Базовая линия</span><span>' + fmt(r.carbon.E_base_tCO2e) + ' т</span></div>' +
        '<div class="kv"><span>Результат R</span><span>' + fmt(r.carbon.R_tCO2e) + ' т</span></div>' +
        '<div class="kv"><span>Неопределённость UNC</span><span>' + (r.carbon.UNC * 100).toFixed(1) + ' %</span></div>' +
        '<div class="kv"><span>Резерв B</span><span>' + fmt(r.carbon.buffer_B_tCO2e) + ' т</span></div>' +
        (r.reason ? '<div class="fire-warning">⚠️ ' + r.reason + '</div>' : '') +
        (r.events.length ? '<div class="fire-warning">🔥 Пожар: ' + r.events[0].date_min_product + ' — ' + r.events[0].date_max_product + '. Пикселей: ' + r.events[0].burned_pixel_centers_in_aoi + '/' + r.events[0].all_pixel_centers_in_aoi + '</div>' : '') +
        '<div style="margin-top:16px;font-size:.75rem;color:#94a3b8">ID: ' + r.aoi.aoi_id + '</div>' +
      '</div>';

    if (window.Charts) window.Charts.showFor(aoiId);
}
