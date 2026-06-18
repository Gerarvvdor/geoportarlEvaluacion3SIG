#!/bin/bash
# ============================================================
# start_geoserver.sh — Inicia GeoServer
# ============================================================

GEOSERVER_DIR="$(cd "$(dirname "$0")/.." && pwd)/geoserver"

# Buscar el directorio de GeoServer
if [ -d "$GEOSERVER_DIR/bin" ]; then
  echo "🗺️  Iniciando GeoServer desde: $GEOSERVER_DIR"
  cd "$GEOSERVER_DIR"
  bash bin/startup.sh
else
  echo "❌ GeoServer no encontrado en: $GEOSERVER_DIR"
  echo ""
  echo "Descarga GeoServer desde: https://geoserver.org/download/"
  echo "Luego descomprime el archivo ZIP en la carpeta: $(dirname "$GEOSERVER_DIR")/geoserver/"
  echo ""
  echo "O ejecuta: bash scripts/download_geoserver.sh"
fi
