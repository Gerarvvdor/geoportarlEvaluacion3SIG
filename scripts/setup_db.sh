#!/bin/bash
# ============================================================
# setup_db.sh — Crea la base de datos del geoportal con PostGIS
# Uso: bash scripts/setup_db.sh [nombre_bd] [usuario_pg]
# ============================================================

DB_NAME="${1:-geoportal}"
PG_USER="${2:-postgres}"

echo "🐘 Configurando base de datos: $DB_NAME (usuario: $PG_USER)"

# Crear base de datos (si no existe)
psql -U "$PG_USER" -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
  psql -U "$PG_USER" -c "CREATE DATABASE $DB_NAME;"

# Habilitar PostGIS
psql -U "$PG_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -U "$PG_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"

echo "✅ Base de datos '$DB_NAME' lista con PostGIS"
echo ""
echo "🔌 Para conectarte: psql -U $PG_USER -d $DB_NAME"
psql -U "$PG_USER" -d "$DB_NAME" -c "SELECT PostGIS_Version();"
