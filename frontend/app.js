// ============================================================
// app.js — Geoportal Interactivo con OpenLayers + GeoServer
// ============================================================

// ---- CONFIGURACIÓN (editar aquí antes del examen) ----
let CONFIG = {
  geoserverUrl: 'http://localhost:8080/geoserver',
  workspace: 'geoportal',
  portalTitle: 'Geoportal Temático',
  // Centro del mapa: [lon, lat] en EPSG:4326
  mapCenter: [-77.03, -12.05],
  mapZoom: 12,
};

// ---- Estado de la app ----
let layers = [];           // { id, label, layerName, olLayer, visible, opacity }
let identifyActive = true;
let activeFilters = {};

// ============================================================
// MAPA BASE
// ============================================================
const BASEMAPS = {
  'osm': new ol.layer.Tile({
    source: new ol.source.OSM(),
    className: 'basemap-layer',
  }),
  'carto-light': new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      attributions: '© CartoDB'
    }),
    className: 'basemap-layer',
  }),
  'carto-dark': new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      attributions: '© CartoDB'
    }),
    className: 'basemap-layer',
  }),
  'esri-topo': new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attributions: '© ESRI'
    }),
    className: 'basemap-layer',
  }),
};

let currentBasemap = BASEMAPS['osm'];

const map = new ol.Map({
  target: 'map',
  layers: [currentBasemap],
  view: new ol.View({
    center: ol.proj.fromLonLat(CONFIG.mapCenter),
    zoom: CONFIG.mapZoom,
    constrainResolution: true,
  }),
  controls: ol.control.defaults.defaults({
    zoom: false,
    attribution: true,
  }).extend([
    new ol.control.ScaleLine({ units: 'metric', bar: false }),
  ]),
});

// ============================================================
// FUNCIONES PRINCIPALES
// ============================================================

/**
 * Agrega una capa WMS desde GeoServer
 */
function addWMSLayer(layerName, label, opacity = 0.8) {
  const fullLayerName = `${CONFIG.workspace}:${layerName}`;

  const wmsSource = new ol.source.TileWMS({
    url: `${CONFIG.geoserverUrl}/${CONFIG.workspace}/wms`,
    params: {
      'LAYERS': fullLayerName,
      'TILED': true,
      'FORMAT': 'image/png',
      'TRANSPARENT': true,
    },
    serverType: 'geoserver',
    crossOrigin: 'anonymous',
  });

  const olLayer = new ol.layer.Tile({
    source: wmsSource,
    opacity: opacity,
  });

  map.addLayer(olLayer);

  const layerId = `layer_${Date.now()}`;
  const layerObj = { id: layerId, label, layerName, fullLayerName, olLayer, visible: true, opacity };
  layers.push(layerObj);

  renderLayersList();
  renderLegend();
  updateFilterLayerSelect();

  showToast(`Capa "${label}" agregada`, 'success');
  return layerObj;
}

/**
 * Elimina una capa del mapa
 */
function removeLayer(layerId) {
  const idx = layers.findIndex(l => l.id === layerId);
  if (idx === -1) return;
  map.removeLayer(layers[idx].olLayer);
  layers.splice(idx, 1);
  renderLayersList();
  renderLegend();
  updateFilterLayerSelect();
}

/**
 * Renderiza la lista de capas en el sidebar
 */
function renderLayersList() {
  const container = document.getElementById('layers-list');
  if (layers.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-map"></i><p>Agrega capas desde GeoServer</p></div>`;
    return;
  }

  container.innerHTML = layers.slice().reverse().map(l => `
    <div class="layer-item" id="li-${l.id}">
      <input class="layer-checkbox" type="checkbox" id="chk-${l.id}" ${l.visible ? 'checked' : ''}
        onchange="toggleLayerVisibility('${l.id}', this.checked)" />
      <div class="layer-info">
        <div class="layer-name">${l.label}</div>
        <div class="layer-status">${l.layerName} · op: ${Math.round(l.opacity * 100)}%</div>
      </div>
      <button class="layer-remove" onclick="removeLayer('${l.id}')" title="Eliminar">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `).join('');
}

/**
 * Toggle visibilidad de capa
 */
function toggleLayerVisibility(layerId, visible) {
  const layer = layers.find(l => l.id === layerId);
  if (!layer) return;
  layer.visible = visible;
  layer.olLayer.setVisible(visible);
}

/**
 * Renderiza las leyendas en el sidebar
 */
function renderLegend() {
  const container = document.getElementById('legend-container');
  const visibleLayers = layers.filter(l => l.visible);

  if (visibleLayers.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-image"></i><p>Sin capas activas</p></div>`;
    return;
  }

  container.innerHTML = visibleLayers.map(l => {
    const legendUrl = `${CONFIG.geoserverUrl}/${CONFIG.workspace}/wms?` +
      `REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&` +
      `LAYER=${l.fullLayerName}&TRANSPARENT=true&BGCOLOR=0x161b22`;
    return `
      <div class="legend-item">
        <div class="legend-layer-name">${l.label}</div>
        <img class="legend-img" src="${legendUrl}" alt="Leyenda ${l.label}"
          onerror="this.style.display='none'" />
      </div>
    `;
  }).join('');
}

// ============================================================
// IDENTIFICACIÓN (click en mapa)
// ============================================================
map.on('singleclick', async function (evt) {
  if (!identifyActive) return;
  if (layers.filter(l => l.visible).length === 0) return;

  const infoPanel = document.getElementById('info-panel');
  const infoContent = document.getElementById('info-content');
  infoPanel.classList.remove('hidden');
  infoContent.innerHTML = `<p class="loading-text"><i class="fa-solid fa-spinner fa-spin"></i> Consultando...</p>`;

  const viewResolution = map.getView().getResolution();
  let allFeatures = [];

  for (const layer of layers.filter(l => l.visible)) {
    const url = layer.olLayer.getSource().getFeatureInfoUrl(
      evt.coordinate,
      viewResolution,
      'EPSG:3857',
      { 'INFO_FORMAT': 'application/json', 'FEATURE_COUNT': 5 }
    );
    if (!url) continue;

    try {
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.features && data.features.length > 0) {
        allFeatures.push({ layer: layer.label, features: data.features });
      }
    } catch (e) {
      console.warn('GetFeatureInfo error:', e);
    }
  }

  if (allFeatures.length === 0) {
    infoContent.innerHTML = `<p style="color:var(--text-muted);font-size:12px">Sin elementos en este punto.</p>`;
    return;
  }

  let html = '';
  for (const { layer, features } of allFeatures) {
    html += `<div style="font-weight:600;color:var(--accent);margin-bottom:6px;margin-top:10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em">${layer}</div>`;
    for (const feat of features) {
      const props = feat.properties || {};
      const rows = Object.entries(props)
        .filter(([k]) => !k.toLowerCase().includes('geom'))
        .map(([k, v]) => `<tr><td>${k}</td><td>${v ?? '—'}</td></tr>`)
        .join('');
      html += `<table class="info-table">${rows}</table>`;
    }
  }
  infoContent.innerHTML = html;
});

// ============================================================
// BÚSQUEDA / FILTRO CQL
// ============================================================
function updateFilterLayerSelect() {
  const sel = document.getElementById('filter-layer-select');
  sel.innerHTML = `<option value="">— Seleccionar capa —</option>` +
    layers.map(l => `<option value="${l.id}">${l.label}</option>`).join('');
}

document.getElementById('filter-layer-select').addEventListener('change', async function () {
  const fieldSel = document.getElementById('filter-field-select');
  fieldSel.innerHTML = `<option value="">Cargando campos...</option>`;

  const layer = layers.find(l => l.id === this.value);
  if (!layer) {
    fieldSel.innerHTML = `<option value="">— Primero selecciona capa —</option>`;
    return;
  }

  // WFS DescribeFeatureType para obtener campos
  const url = `${CONFIG.geoserverUrl}/wfs?service=WFS&version=2.0.0&request=DescribeFeatureType&typeName=${layer.fullLayerName}&outputFormat=application/json`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const props = data.featureTypes?.[0]?.properties || [];
    const fields = props.filter(p => !p.type.includes('gml:') && !p.name.toLowerCase().includes('geom'));

    fieldSel.innerHTML = `<option value="">— Seleccionar campo —</option>` +
      fields.map(p => `<option value="${p.name}">${p.name} (${p.localType})</option>`).join('');
  } catch (e) {
    fieldSel.innerHTML = `<option value="">Error cargando campos</option>`;
  }
});

document.getElementById('btn-search').addEventListener('click', function () {
  const layerId = document.getElementById('filter-layer-select').value;
  const field = document.getElementById('filter-field-select').value;
  const value = document.getElementById('search-input').value.trim();

  if (!layerId || !field || !value) {
    showToast('Completa todos los campos de búsqueda', 'error');
    return;
  }

  const layer = layers.find(l => l.id === layerId);
  if (!layer) return;

  // Filtro CQL sobre WMS
  layer.olLayer.getSource().updateParams({ 'CQL_FILTER': `${field} ILIKE '%${value}%'` });
  activeFilters[layerId] = `${field} ILIKE '%${value}%'`;
  showToast(`Filtro aplicado: ${field} contiene "${value}"`, 'info');
});

document.getElementById('btn-clear-filter').addEventListener('click', function () {
  for (const layer of layers) {
    layer.olLayer.getSource().updateParams({ 'CQL_FILTER': undefined });
  }
  activeFilters = {};
  document.getElementById('search-input').value = '';
  showToast('Filtros eliminados', 'success');
});

// ============================================================
// CONTROLES DEL MAPA
// ============================================================
document.getElementById('btn-zoom-in').addEventListener('click', () => {
  const view = map.getView();
  view.animate({ zoom: view.getZoom() + 1, duration: 250 });
});

document.getElementById('btn-zoom-out').addEventListener('click', () => {
  const view = map.getView();
  view.animate({ zoom: view.getZoom() - 1, duration: 250 });
});

document.getElementById('btn-home').addEventListener('click', () => {
  map.getView().animate({
    center: ol.proj.fromLonLat(CONFIG.mapCenter),
    zoom: CONFIG.mapZoom,
    duration: 600,
  });
});

document.getElementById('btn-full-extent').addEventListener('click', () => {
  if (layers.length === 0) return;
  // Zoom a extensión de todas las capas visibles
  map.getView().animate({ zoom: 10, duration: 500 });
});

document.getElementById('btn-identify').addEventListener('click', function () {
  identifyActive = !identifyActive;
  this.classList.toggle('active', identifyActive);
  this.title = identifyActive ? 'Identificar activado' : 'Identificar desactivado';
});

// Coordenadas del cursor
map.on('pointermove', function (evt) {
  const coords = ol.proj.toLonLat(evt.coordinate);
  document.getElementById('mouse-coords').textContent =
    `Lon: ${coords[0].toFixed(5)}, Lat: ${coords[1].toFixed(5)}`;
});

// ============================================================
// MAPAS BASE
// ============================================================
document.querySelectorAll('.basemap-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const key = this.dataset.basemap;
    map.removeLayer(currentBasemap);
    currentBasemap = BASEMAPS[key];
    map.getLayers().insertAt(0, currentBasemap);
    document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

// ============================================================
// SIDEBAR TOGGLE
// ============================================================
document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
  // Forzar resize del mapa
  setTimeout(() => map.updateSize(), 300);
});

// ============================================================
// MODAL AGREGAR CAPA
// ============================================================
document.getElementById('btn-add-layer').addEventListener('click', () => {
  document.getElementById('modal-add-layer').classList.remove('hidden');
});

['btn-close-modal', 'btn-close-modal-2'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    document.getElementById('modal-add-layer').classList.add('hidden');
  });
});

document.getElementById('btn-confirm-add-layer').addEventListener('click', () => {
  const name = document.getElementById('new-layer-name').value.trim();
  const label = document.getElementById('new-layer-label').value.trim() || name;
  const opacity = parseFloat(document.getElementById('new-layer-opacity').value);

  if (!name) { showToast('Ingresa el nombre de la capa', 'error'); return; }

  addWMSLayer(name, label, opacity);
  document.getElementById('modal-add-layer').classList.add('hidden');
  document.getElementById('new-layer-name').value = '';
  document.getElementById('new-layer-label').value = '';
});

// ============================================================
// PANEL DE INFO — cerrar
// ============================================================
document.getElementById('btn-close-info').addEventListener('click', () => {
  document.getElementById('info-panel').classList.add('hidden');
});

// ============================================================
// CONFIGURACIÓN RÁPIDA
// ============================================================
document.getElementById('btn-apply-config').addEventListener('click', () => {
  CONFIG.geoserverUrl = document.getElementById('cfg-geoserver').value.trim();
  CONFIG.workspace = document.getElementById('cfg-workspace').value.trim();
  const theme = document.getElementById('cfg-theme').value.trim();

  document.getElementById('portal-title').textContent = theme || 'Geoportal';
  document.title = theme || 'Geoportal';

  // Recargar capas existentes con nueva configuración
  for (const layer of layers) {
    layer.fullLayerName = `${CONFIG.workspace}:${layer.layerName}`;
    layer.olLayer.getSource().updateParams({
      'LAYERS': layer.fullLayerName,
    });
    layer.olLayer.getSource().setUrl(`${CONFIG.geoserverUrl}/${CONFIG.workspace}/wms`);
  }

  renderLegend();
  showToast('Configuración aplicada', 'success');
});

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(msg, type = 'info', duration = 3500) {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(40px)'; toast.style.transition = '.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
(function init() {
  // Aplicar título inicial
  document.getElementById('portal-title').textContent = CONFIG.portalTitle;
  document.title = CONFIG.portalTitle;

  // Sincronizar inputs de config
  document.getElementById('cfg-geoserver').value = CONFIG.geoserverUrl;
  document.getElementById('cfg-workspace').value = CONFIG.workspace;
  document.getElementById('cfg-theme').value = CONFIG.portalTitle;

  showToast('Geoportal listo. Configura GeoServer y agrega capas.', 'info', 5000);

  console.log('%c🗺️ Geoportal Interactivo', 'font-size:18px;font-weight:bold;color:#4f9cf9');
  console.log('Config actual:', CONFIG);
  console.log('Funciones disponibles: addWMSLayer(layerName, label, opacity)');
})();
