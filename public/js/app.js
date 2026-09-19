let yearStart = 2019, yearEnd = 2024;

function setStatus(text, cls) {
    const el = document.getElementById('status-indicator');
    el.className = 'status-indicator ' + (cls || '');
    document.getElementById('status-text').textContent = text;
}
function fmt(n, d) { return Number(n).toLocaleString('ru-RU', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
function rub(n) { return Number(n).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }); }

async function loadAll() {
    setStatus('Загрузка...');
    try {
        const data = await API.getAllMetrics(yearStart, yearEnd);
        window.metricsData = data;

        // Hero — крупные цифры
        document.getElementById('stat-aoi').textContent = data.results.length;
        document.getElementById('stat-area').textContent = fmt(Math.round(data.total.area_ha));
        document.getElementById('stat-units').textContent = fmt(data.total.units_Q);
        document.getElementById('stat-value').textContent = (data.total.value_mid_rub/1000000).toFixed(1) + ' млн ₽';

        renderPolygons(currentLayer);
        renderMetricCards(data);
        renderTable(data);
        Charts.renderCharts(data);
        setStatus('Данные актуальны', 'ok');
    } catch (e) {
        console.error(e);
        setStatus('Ошибка: ' + e.message, 'error');
    }
}

function renderMetricCards(data) {
    const groups = { buy: [], hold: [], create: [] };
    data.results.forEach(function(r) { groups[r.status].push(r); });
    function sum(arr, key) { return arr.reduce(function(s, r) { return s + key(r); }, 0); }

    const totalUnits = data.total.units_Q || 1;

    const cards = [
        { cls: 'buy', icon: '🛒', title: 'Покупать',
          desc: 'Для промышленных предприятий, которые хотят минимизировать эко-последствия',
          value: sum(groups.buy, function(r) { return r.carbon.units_Q; }),
          sub: groups.buy.length + ' участков • ' + rub(sum(groups.buy, function(r) { return r.value.price_mid_rub; })) },
        { cls: 'hold', icon: '📦', title: 'Держать',
          desc: 'Для заповедников, ООПТ и частных владельцев — заработок без вырубок',
          value: sum(groups.hold, function(r) { return r.carbon.units_Q; }),
          sub: groups.hold.length + ' участков • ' + rub(sum(groups.hold, function(r) { return r.value.price_mid_rub; })) },
        { cls: 'create', icon: '🌳', title: 'Создать ферму',
          desc: 'Подобрать бесхозный лес или вырастить свой — долгосрочная инвестиция',
          value: sum(groups.create, function(r) { return r.carbon.units_Q; }),
          sub: groups.create.length + ' участков • ' + rub(sum(groups.create, function(r) { return r.value.price_mid_rub; })) }
    ];

    document.getElementById('metrics-cards').innerHTML = cards.map(function(c) {
        const pct = Math.max(3, Math.round((c.value / totalUnits) * 100));
        return '<div class="metric-card ' + c.cls + '">' +
            '<div class="metric-icon">' + c.icon + '</div>' +
            '<h3>' + c.title + '</h3>' +
            '<p>' + c.desc + '</p>' +
            '<div class="metric-value">' + fmt(c.value) +
              '<span class="metric-value-unit">ед.</span>' +
            '</div>' +
            '<div class="metric-bar"><div class="metric-bar-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="metric-sub">' + c.sub + '</div>' +
        '</div>';
    }).join('');
}

function renderTable(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = data.results.map(function(r) {
        const statusText = ({ buy: 'Покупать', hold: 'Держать', create: 'Создать ферму' })[r.status];
        return '<tr data-aoi="' + r.aoi.aoi_id + '" style="cursor:pointer">' +
            '<td><b>' + r.aoi.name + '</b></td>' +
            '<td>' + r.aoi.region + '</td>' +
            '<td class="col-area">' + fmt(r.aoi.area_ha, 2) + '</td>' +
            '<td>' + r.stocks.c_t0_tCha + '</td>' +
            '<td>' + r.stocks.c_t1_tCha + '</td>' +
            '<td class="col-dc">' + fmt(r.stocks.deltaC_tC) + '</td>' +
            '<td>' + fmt(r.carbon.E_proj_tCO2e) + '</td>' +
            '<td class="col-q">' + fmt(r.carbon.units_Q) + '</td>' +
            '<td class="col-value">' + rub(r.value.price_mid_rub) + '</td>' +
            '<td><span class="status-badge ' + r.status + '">' + statusText + '</span></td>' +
        '</tr>';
    }).join('');
    tbody.querySelectorAll('tr').forEach(function(tr) {
        tr.addEventListener('click', function() { selectAoi(tr.dataset.aoi); });
    });
}

function renderSources() {
    const wanted = ['CCI_V7', 'S2_L2A', 'GFC_2025_V113', 'MODIS_MCD64A1_061'];
    API.getSources().then(function(sources) {
        document.getElementById('sources-list').innerHTML = sources
            .filter(function(s) { return wanted.indexOf(s.source_id) >= 0; })
            .map(function(s) { return '<li><b>' + s.source_id + '</b>: ' + s.product + '</li>'; }).join('');
    });
}

function bindControls() {
    document.querySelectorAll('.map-controls .btn[data-layer]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.map-controls .btn[data-layer]').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            renderPolygons(btn.dataset.layer);
        });
    });
    document.getElementById('btn-recalc').addEventListener('click', function() {
        yearStart = parseInt(document.getElementById('year-start').value);
        yearEnd   = parseInt(document.getElementById('year-end').value);
        if (yearEnd <= yearStart) { alert('Год конца должен быть больше года начала'); return; }
        loadAll();
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    initMap();
    Charts.initCharts();
    bindControls();
    renderSources();
    await loadAll();
});
