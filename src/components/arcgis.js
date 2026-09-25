/**
 * Lazy loader for the ArcGIS Maps SDK for JavaScript (@arcgis/core 5.x).
 *
 * The SDK is bundled from npm, not injected from a CDN <script> tag as in the
 * original app. The original used the AMD `require()` loader and SDK widgets;
 * Esri deprecated both at version 5.0 and plans to remove them at 6.0
 * (early 2027). This app uses only the core API (Map, MapView, layers,
 * graphics), which is not deprecated, and draws its own controls.
 *
 * The modules are imported dynamically, so the top bar and menu paint before
 * the multi-megabyte SDK has finished downloading. Calling this more than once
 * reuses the same promise.
 *
 * Map data: OpenStreetMap raster tiles, requested directly from
 * tile.openstreetmap.org. No Esri API key and no ArcGIS login are needed.
 */
let modules = null;

export function loadArcgis() {
  if (!modules) {
    modules = Promise.all([
      import('@arcgis/core/config.js'),
      import('@arcgis/core/Map.js'),
      import('@arcgis/core/Basemap.js'),
      import('@arcgis/core/views/MapView.js'),
      import('@arcgis/core/layers/WebTileLayer.js'),
      import('@arcgis/core/layers/GraphicsLayer.js'),
      import('@arcgis/core/Graphic.js'),
      import('@arcgis/core/geometry/Point.js'),
      import('@arcgis/core/geometry/Circle.js'),
      import('@arcgis/core/core/reactiveUtils.js'),
      import('@arcgis/core/assets/esri/themes/light/view.css'),
    ]).then(([config, Map, Basemap, MapView, WebTileLayer, GraphicsLayer, Graphic, Point, Circle, reactiveUtils]) => {
      // No premium Esri services are used; make sure none are requested.
      config.default.apiKey = null;
      return {
        Map: Map.default,
        Basemap: Basemap.default,
        MapView: MapView.default,
        WebTileLayer: WebTileLayer.default,
        GraphicsLayer: GraphicsLayer.default,
        Graphic: Graphic.default,
        Point: Point.default,
        Circle: Circle.default,
        reactiveUtils,
      };
    }).catch((err) => {
      modules = null;           // allow a retry
      throw err;
    });
  }
  return modules;
}

export function createBasemap(m) {
  return new m.Basemap({
    id: 'osm',
    title: 'OpenStreetMap',
    baseLayers: [
      new m.WebTileLayer({
        urlTemplate: 'https://tile.openstreetmap.org/{level}/{col}/{row}.png',
        copyright: '© OpenStreetMap contributors',
        title: 'OpenStreetMap',
      }),
    ],
  });
}
