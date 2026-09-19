let chartStock, chartUnits;

function initCharts() {
    chartStock = new Chart(document.getElementById('chart-stock'), {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
    chartUnits = new Chart(document.getElementById('chart-units'), {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function renderCharts(data) {
    chartUnits.data.labels = data.results.map(function(r) { return r.aoi.name; });
    chartUnits.data.datasets = [{
        label: 'Углеродные единицы',
        data: data.results.map(function(r) { return r.carbon.units_Q; }),
        backgroundColor: data.results.map(function(r) {
            return ({ buy: '#1565c0', hold: '#2e7d32', create: '#e65100' })[r.status] || '#999';
        })
    }];
    chartUnits.update();
}

function showFor(aoiId) {
    API.getSeries(aoiId).then(function(series) {
        chartStock.data.labels = series.map(function(s) { return s.year; });
        chartStock.data.datasets = [{
            label: 'Запас углерода, т С',
            data: series.map(function(s) { return s.total_tC; }),
            borderColor: '#2e7d32',
            backgroundColor: 'rgba(46,125,50,.1)',
            fill: true, tension: 0.3, pointRadius: 4
        }];
        chartStock.update();
    });
}

window.Charts = { initCharts: initCharts, renderCharts: renderCharts, showFor: showFor };
