#!/bin/bash
# ============================================================
# load_data.sh — Carga shapefiles o GeoJSON a PostGIS
# Uso: bash scripts/load_data.sh <archivo> [nombre_tabla] [db] [usuario]
# ============================================================

ARCHIVO="${1}"
TABLA="${2:-$(basename "$1" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]' | tr ' -' '_')}"
DB_NAME="${3:-geoportal}"
PG_USER="${4:-postgres}"
SRID="${5:-4326}"

if [ -z "$ARCHIVO" ]; then
  echo "❌ Uso: bash scripts/load_data.sh <archivo.shp|archivo.geojson> [tabla] [bd] [usuario]"
  exit 1
fi

EXT="${ARCHIVO##*.}"
EXT=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

echo "📥 Cargando: $ARCHIVO → tabla '$TABLA' en BD '$DB_NAME'"

if [ "$EXT" = "shp" ]; then
  shp2pgsql -s "$SRID" -I "$ARCHIVO" "public.$TABLA" | psql -U "$PG_USER" -d "$DB_NAME"
elif [ "$EXT" = "geojson" ] || [ "$EXT" = "json" ]; then
  ogr2ogr -f "PostgreSQL" PG:"dbname=$DB_NAME user=$PG_USER" \
    "$ARCHIVO" \
    -nln "$TABLA" \
    -overwrite \
    -t_srs EPSG:4326
else
  echo "❌ Formato no soportado: $EXT (usa .shp o .geojson)"
  exit 1
fi

echo "✅ Cargado '$TABLA' en '$DB_NAME'"
echo "   Verificar: psql -U $PG_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM $TABLA;\""
