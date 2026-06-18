#!/bin/bash
# ============================================================
# download_geoserver.sh — Descarga GeoServer 2.26 (estable)
# ============================================================

GEOSERVER_VERSION="2.26.2"
DOWNLOAD_URL="https://sourceforge.net/projects/geoserver/files/GeoServer/${GEOSERVER_VERSION}/geoserver-${GEOSERVER_VERSION}-bin.zip"
DEST_DIR="$(cd "$(dirname "$0")/.." && pwd)/geoserver"
ZIP_FILE="/tmp/geoserver.zip"

echo "⬇️  Descargando GeoServer $GEOSERVER_VERSION..."
curl -L "$DOWNLOAD_URL" -o "$ZIP_FILE"

echo "📦 Descomprimiendo..."
mkdir -p "$DEST_DIR"
unzip -o "$ZIP_FILE" -d /tmp/geoserver_tmp/

# Mover contenido al directorio destino
mv /tmp/geoserver_tmp/geoserver-${GEOSERVER_VERSION}/* "$DEST_DIR/" 2>/dev/null || \
  mv /tmp/geoserver_tmp/*/* "$DEST_DIR/" 2>/dev/null

rm -rf /tmp/geoserver_tmp/ "$ZIP_FILE"
chmod +x "$DEST_DIR/bin/startup.sh"

echo "✅ GeoServer instalado en: $DEST_DIR"
echo ""
echo "▶️  Para iniciarlo: bash scripts/start_geoserver.sh"
echo "🌐 Luego abre: http://localhost:8080/geoserver"
echo "   Usuario: admin | Contraseña: geoserver"
