#!/bin/bash
#
# Script de inicio para Pterodactyl.
# Inicia únicamente el servidor de Minecraft.
# El AI Server se aloja externamente (ej. Railway).
#

set -e

# Configuración
SERVER_JAR="${SERVER_JAR:-server.jar}"
JAVA_ARGS="${JAVA_ARGS:--Xmx4G -jar}"

cd "$(dirname "$0")"

echo "[MineBot] Iniciando servidor Minecraft..."
echo "[MineBot] El AI Server debe estar disponible en la URL configurada."

# Ejecutar el servidor de Minecraft.
java $JAVA_ARGS "$SERVER_JAR" "$@"
