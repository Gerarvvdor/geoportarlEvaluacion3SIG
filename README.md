# 🗺️ Geoportal Interactivo — Guía de Uso

## Estructura del proyecto

```
geoportal/
├── DIA_DEL_EXAMEN.sh       ← 🚨 Ejecutar esto el día del examen
├── data/                   ← Poner aquí los datos que den (shapefiles, geojson)
├── geoserver/              ← Aquí va GeoServer descomprimido
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── scripts/
    ├── setup_db.sh         ← Crear base de datos
    ├── load_data.sh        ← Cargar un archivo de datos
    ├── start_geoserver.sh  ← Iniciar GeoServer
    └── download_geoserver.sh ← Descargar GeoServer (hacer HOY)
```

---

## ✅ Lista de preparación (HACER HOY)

### 1. Descargar GeoServer

```bash
bash /Users/tato/geoportal/scripts/download_geoserver.sh
```

O manualmente:
1. Ir a https://geoserver.org/download/
2. Descargar **GeoServer 2.26.x — Platform Independent Binary (ZIP)**
3. Descomprimir el ZIP dentro de `/Users/tato/geoportal/geoserver/`

Verificar que existe: `/Users/tato/geoportal/geoserver/bin/startup.sh`

### 2. Crear la base de datos

```bash
bash /Users/tato/geoportal/scripts/setup_db.sh geoportal postgres
```

### 3. Probar el frontend

```bash
cd /Users/tato/geoportal/frontend
python3 -m http.server 3000
# Abrir: http://localhost:3000
```

### 4. Probar GeoServer

```bash
bash /Users/tato/geoportal/scripts/start_geoserver.sh
# Abrir: http://localhost:8080/geoserver
# Usuario: admin / Contraseña: geoserver
```

---

## 🚨 Día del examen — Flujo completo

### Paso 1: Copia los datos a la carpeta `data/`
```bash
cp /ruta/a/los/datos/* /Users/tato/geoportal/data/
```

### Paso 2: Ejecuta el script maestro
```bash
bash /Users/tato/geoportal/DIA_DEL_EXAMEN.sh movilidad
```
Esto:
- Inicia PostgreSQL
- Crea la base de datos con PostGIS
- Carga automáticamente todos los .shp y .geojson de la carpeta `data/`
- Inicia GeoServer
- Inicia el servidor web del frontend

### Paso 3: Configura GeoServer (interfaz web)

1. Abre http://localhost:8080/geoserver → admin / geoserver
2. **Workspaces** → Nuevo → Nombre: `geoportal`, URI: `http://geoportal.local`
3. **Stores** → Nuevo Store → PostGIS
   - Host: `localhost`, Puerto: `5432`
   - Base de datos: `geoportal`, Usuario: `postgres`
4. **Layers** → Publicar cada tabla que cargaste
5. En **Publishing** → asignar SRS: `EPSG:4326` → Calcular extensión

### Paso 4: Configura el frontend

1. Abre http://localhost:3000
2. En el panel izquierdo → **Configuración**:
   - GeoServer URL: `http://localhost:8080/geoserver`
   - Workspace: `geoportal`
   - Tema: (el que te asignen, ej: "Movilidad Urbana")
3. Clic en **Aplicar**
4. **Capas** → ➕ → ingresa el nombre de cada capa publicada

---

## 🎨 Funcionalidades del frontend

| Funcionalidad | Descripción |
|---|---|
| **Visualización WMS** | Capas desde GeoServer con transparencia |
| **Capas base** | OSM, CartoDB Claro/Oscuro, ESRI Topo |
| **Leyenda** | Automática desde GeoServer GetLegendGraphic |
| **Identificación** | Click en el mapa → muestra atributos de la feature |
| **Búsqueda/Filtro** | Filtro CQL por campo y valor sobre cualquier capa |
| **Zoom/Navegación** | Zoom +/-, Home, Extensión completa |
| **Coordenadas** | Muestra Lon/Lat en tiempo real al mover el cursor |
| **Toggle capas** | Activar/desactivar visibilidad de cada capa |

---

## 🐛 Solución de problemas

**GeoServer no inicia:**
```bash
# Verificar Java
java -version  # Necesita Java 11+

# Iniciar manualmente
cd /Users/tato/geoportal/geoserver
bash bin/startup.sh
```

**Error de CORS en el frontend:**
En GeoServer → Services → WMS → habilitar CORS:
Editar `webapps/geoserver/WEB-INF/web.xml` y descomentar el filtro CORS.

**PostGIS no disponible:**
```bash
psql -U postgres -d geoportal -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

**Shapefile con encoding incorrecto:**
```bash
shp2pgsql -s 4326 -W LATIN1 archivo.shp tabla | psql -U postgres -d geoportal
```

---

## 📞 Comandos de emergencia

```bash
# Ver tablas en la BD
psql -U postgres -d geoportal -c "\dt"

# Ver columnas de una tabla
psql -U postgres -d geoportal -c "\d nombre_tabla"

# Contar registros
psql -U postgres -d geoportal -c "SELECT COUNT(*) FROM nombre_tabla;"

# Ver SRID de una capa
psql -U postgres -d geoportal -c "SELECT ST_SRID(geom) FROM nombre_tabla LIMIT 1;"

# Cargar datos manualmente
bash /Users/tato/geoportal/scripts/load_data.sh data/archivo.shp nombre_tabla
```
# geoportarlEvaluacion3SIG
