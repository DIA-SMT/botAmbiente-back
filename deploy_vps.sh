#!/bash
# Script de despliegue para Bot Ambiente en VPS
# Ejecutar este script DENTRO de la VPS

REPO_URL="https://github.com/DIA-SMT/botAmbiente-back.git"
DEST_DIR="/var/www/bots/bot-ambiente"

echo "🌿 Iniciando despliegue de Bot Ambiente..."

# 1. Crear directorio si no existe
mkdir -p /var/www/bots

# 2. Clonar o actualizar repositorio
if [ -d "$DEST_DIR" ]; then
    echo "🔄 Actualizando repositorio existente..."
    cd "$DEST_DIR"
    git pull origin main
else
    echo "📥 Clonando repositorio..."
    git clone "$REPO_URL" "$DEST_DIR"
    cd "$DEST_DIR"
fi

# 3. Instalar dependencias
echo "📦 Instalando dependencias..."
npm install --production

# 4. El archivo .env debe ser configurado manualmente o copiado
echo "⚠️  Recuerda configurar el archivo .env en $DEST_DIR/.env con PORT=3001"

# 5. Iniciar con PM2
echo "🚀 Iniciando proceso en PM2..."
pm2 delete bot-ambiente 2>/dev/null || true
pm2 start ecosystem.config.js --name bot-ambiente

echo "✅ Despliegue de código completado."
echo "Pendiente: Configurar Nginx para el puerto 3001."
