#!/bin/bash
# ============================================================
# DIA_DEL_EXAMEN.sh — Script maestro para el día de la evaluación
# Ejecutar: bash DIA_DEL_EXAMEN.sh
# ============================================================

TEMA="${1:-mi_tema}"        # Ej: bash DIA_DEL_EXAMEN.sh movilidad
DB_NAME="geoportal"
PG_USER="postgres"
WORKSPACE="geoportal"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "╔══════════════════════════════════════╗"
echo "║    🗺️  GEOPORTAL — DÍA DEL EXAMEN    ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Tema: $TEMA"
echo ""

# PASO 1: Verificar PostgreSQL
echo "━━━ PASO 1: PostgreSQL ━━━"
if psql -U "$PG_USER" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✅ PostgreSQL conectado"
else
  echo "❌ PostgreSQL no responde. Iniciando..."
  brew services start postgresql@18 || brew services start postgresql
  sleep 2
fi

# PASO 2: Base de datos
echo ""
echo "━━━ PASO 2: Base de Datos ━━━"
bash "$SCRIPT_DIR/scripts/setup_db.sh" "$DB_NAME" "$PG_USER"

# PASO 3: Cargar datos (si hay archivos en la carpeta data/)
echo ""
echo "━━━ PASO 3: Cargar datos ━━━"
DATA_DIR="$SCRIPT_DIR/data"
SHAPEFILES=$(find "$DATA_DIR" -name "*.shp" 2>/dev/null)
GEOJSONS=$(find "$DATA_DIR" -name "*.geojson" -o -name "*.json" 2>/dev/null | grep -v "package")

if [ -n "$SHAPEFILES" ]; then
  for SHP in $SHAPEFILES; do
    TABLE=$(basename "$SHP" .shp | tr '[:upper:]' '[:lower:]' | tr ' -' '_')
    echo "📥 Cargando shapefile: $SHP → $TABLE"
    shp2pgsql -s 4326 -I "$SHP" "public.$TABLE" | psql -U "$PG_USER" -d "$DB_NAME" -q
    echo "   ✅ Tabla '$TABLE' creada"
  done
fi

if [ -n "$GEOJSONS" ]; then
  for GJ in $GEOJSONS; do
    TABLE=$(basename "$GJ" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]' | tr ' -' '_')
    echo "📥 Cargando GeoJSON: $GJ → $TABLE"
    ogr2ogr -f "PostgreSQL" PG:"dbname=$DB_NAME user=$PG_USER" \
      "$GJ" -nln "$TABLE" -overwrite -t_srs EPSG:4326 -q
    echo "   ✅ Tabla '$TABLE' creada"
  done
fi

if [ -z "$SHAPEFILES" ] && [ -z "$GEOJSONS" ]; then
  echo "⚠️  No hay archivos en /data. Copia los datos ahí y vuelve a ejecutar."
  echo "    O carga manualmente: bash scripts/load_data.sh <archivo> [tabla]"
fi

# PASO 4: GeoServer
echo ""
echo "━━━ PASO 4: GeoServer ━━━"
GEOSERVER_DIR="$SCRIPT_DIR/geoserver"
if [ -f "$GEOSERVER_DIR/bin/startup.sh" ]; then
  echo "▶️  Iniciando GeoServer en background..."
  cd "$GEOSERVER_DIR"
  JAVA_OPTS="-Xms256m -Xmx1g" bash bin/startup.sh > /tmp/geoserver.log 2>&1 &
  GS_PID=$!
  echo "   PID: $GS_PID"
  echo "   Esperando que inicie (15 segundos)..."
  sleep 15
  if curl -s http://localhost:8080/geoserver/web/ > /dev/null 2>&1; then
    echo "✅ GeoServer corriendo en http://localhost:8080/geoserver"
    echo "   Usuario: admin | Contraseña: geoserver"
  else
    echo "⚠️  GeoServer aún iniciando... abre http://localhost:8080/geoserver en 1 min"
  fi
else
  echo "❌ GeoServer no encontrado. Ejecuta: bash scripts/download_geoserver.sh"
fi

# PASO 5: Frontend
echo ""
echo "━━━ PASO 5: Frontend ━━━"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
echo "▶️  Iniciando servidor web en http://localhost:3000"
cd "$FRONTEND_DIR"
# Usar Python como servidor web simple
python3 -m http.server 3000 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ENTORNO LISTO"
echo ""
echo "  🐘 PostgreSQL: localhost:5432 / BD: $DB_NAME"
echo "  🗺️  GeoServer:  http://localhost:8080/geoserver"
echo "  🌐 Frontend:   http://localhost:3000"
echo ""
echo "Próximos pasos:"
echo "  1. Abre GeoServer → crea Workspace '$WORKSPACE'"
echo "  2. Crea Store → PostGIS → conectar a BD '$DB_NAME'"
echo "  3. Publica las capas cargadas"
echo "  4. En el frontend: configura workspace '$WORKSPACE' y agrega capas"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Para detener todo: kill $GS_PID $FRONTEND_PID"
