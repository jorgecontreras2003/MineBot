#!/bin/bash
#
# Script de inicio para Pterodactyl.
# Inicia el AI Server en segundo plano y luego el servidor de Minecraft.
#

set -e

# Configuración
AI_SERVER_DIR="ai-server"
AI_URL="http://localhost:3000/health"
AI_TIMEOUT=30
SERVER_JAR="${SERVER_JAR:-server.jar}"
JAVA_ARGS="${JAVA_ARGS:--Xmx4G -jar}"

cd "$(dirname "$0")"

echo "[MineBot] Iniciando AI Server..."
cd "$AI_SERVER_DIR"
npm install --silent
npm start > ../ai-server.log 2>&1 &
AI_PID=$!
cd ..

echo "[MineBot] AI Server PID: $AI_PID"

# Esperar a que el AI Server esté saludable.
for i in $(seq 1 $AI_TIMEOUT); do
    if curl -fs "$AI_URL" > /dev/null 2>&1; then
        echo "[MineBot] AI Server listo."
        break
    fi
    sleep 1
done

if ! curl -fs "$AI_URL" > /dev/null 2>&1; then
    echo "[MineBot] AI Server no respondió a tiempo. Iniciando Minecraft de todos modos..."
fi

echo "[MineBot] Iniciando servidor Minecraft..."

# Ejecutar el servidor de Minecraft. Cuando termine, se detiene el AI Server.
trap 'echo "[MineBot] Deteniendo AI Server..."; kill $AI_PID 2>/dev/null || true; exit 0' INT TERM EXIT

java $JAVA_ARGS "$SERVER_JAR" "$@"
