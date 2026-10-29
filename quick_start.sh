#!/usr/bin/env bash
set -e

echo "============================================================"
echo "🚀 SismoWatch - Asistente de Despliegue Limpio"
echo "============================================================"

# 1. Comprobar conflicto de puerto 5432 con PostgreSQL local
if ss -tuln 2>/dev/null | grep -q ":5432 " || netstat -tuln 2>/dev/null | grep -q ":5432 "; then
    # Verificar si el puerto pertenece a Docker o a un postgres nativo del sistema
    if ! docker ps --format '{{.Ports}}' | grep -q "5432->5432"; then
        echo "⚠️  ALERTA: El puerto 5432 ya está ocupado por un PostgreSQL nativo en este PC."
        echo "   Para liberar el puerto antes de levantar Docker, ejecuta:"
        echo "   sudo systemctl stop postgresql"
        echo ""
    fi
fi

# 2. Asegurar archivo .env
if [ ! -f .env ]; then
    echo "📋 Creando archivo .env a partir de .env.example..."
    cp .env.example .env
fi

# 3. Ajustar UID de Airflow al usuario actual de Linux
CURRENT_UID=$(id -u 2>/dev/null || echo 1000)
CURRENT_GID=$(id -g 2>/dev/null || echo 1000)
sed -i "s/^AIRFLOW_UID=.*/AIRFLOW_UID=${CURRENT_UID}/" .env 2>/dev/null || true
sed -i "s/^AIRFLOW_GID=.*/AIRFLOW_GID=${CURRENT_GID}/" .env 2>/dev/null || true

# 4. Asegurar carpetas con permisos
mkdir -p airflow/logs airflow/dags airflow/include
chmod -R 777 airflow/logs 2>/dev/null || true

echo "✓ Permisos y variables de entorno configuradas con éxito."
echo ""
echo "============================================================"
echo "📦 Pasos para levantar SismoWatch sin errores de PostgreSQL:"
echo "============================================================"
echo "1. Si hubo un intento fallido previo, borra los volúmenes corruptos:"
echo "   docker compose down -v"
echo ""
echo "2. Levanta todos los servicios en segundo plano:"
echo "   docker compose up -d"
echo ""
echo "3. Espera 30-45 segundos a que los servicios completen su healthcheck:"
echo "   docker compose ps"
echo ""
echo "4. URLs disponibles:"
echo "   - Web Dashboard: http://localhost:3000 (admin / admin123)"
echo "   - FastAPI Docs:  http://localhost:8000/docs"
echo "   - Airflow UI:    http://localhost:8080 (sismo_admin / admin123)"
echo "============================================================"
