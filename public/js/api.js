const API_BASE = '/api';
async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + url);
    return r.json();
}
const API = {
    getAoiList: () => fetchJSON(API_BASE + '/aoi'),
    getMetrics: (aoiId, y1, y2) => fetchJSON(API_BASE + '/metrics/' + aoiId + '?yearStart=' + y1 + '&yearEnd=' + y2),
    getAllMetrics: (y1, y2) => fetchJSON(API_BASE + '/metrics?yearStart=' + y1 + '&yearEnd=' + y2),
    getSeries: (aoiId) => fetchJSON(API_BASE + '/series/' + aoiId),
    getScenes: (aoiId) => fetchJSON(API_BASE + '/scenes/' + aoiId),
    getEvents: (aoiId) => fetchJSON(API_BASE + '/events/' + aoiId),
    getSources: () => fetchJSON(API_BASE + '/sources'),
    getParameters: () => fetchJSON(API_BASE + '/parameters'),
    health: () => fetchJSON(API_BASE + '/health')
};
