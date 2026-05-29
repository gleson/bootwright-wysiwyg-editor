#!/bin/bash

# Editor WYSIWYG - Script de inicialização
# Executa o servidor HTTP e a compilação em modo watch

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=${PORT:-8001}
HOST=${HOST:-localhost}

echo "🚀 Iniciando Editor WYSIWYG..."
echo "📁 Diretório: $PROJECT_DIR"
echo "🌐 Servidor: http://$HOST:$PORT"
echo ""

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    echo ""
fi

# Limpar build anterior (opcional)
# npm run clean

echo "👀 Iniciando modo watch (compilação automática)..."
npm run watch &
WATCH_PID=$!

sleep 2

echo "🔌 Iniciando servidor HTTP na porta $PORT..."
echo ""
echo "✅ Editor disponível em: http://$HOST:$PORT"
echo "📝 Abra http://$HOST:$PORT no navegador"
echo ""
echo "💡 Dicas:"
echo "  - Use Ctrl+C para parar"
echo "  - Para colaboração em tempo real: npm run collab (em outro terminal)"
echo "  - Build de produção: npm run build"
echo ""

# Iniciar servidor HTTP
cd "$PROJECT_DIR"
python -m http.server $PORT --bind 127.0.0.1

# Cleanup quando parar
trap "kill $WATCH_PID 2>/dev/null" EXIT
