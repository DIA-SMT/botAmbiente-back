# Bot Ambiente - Backend Node.js 🌱

Este es el backend del Chatbot de la Secretaría de Ambiente de San Miguel de Tucumán, migrado desde n8n a Node.js puro.

## 🚀 Tecnologías
- **Entorno:** Node.js (v20+)
- **Servidor:** Express.js
- **IA/LLM:** LangChain (+ OpenAI/OpenRouter)
- **Base de Datos:** Supabase (PostgreSQL)
- **Mensajería:** ManyChat API

## 🛠️ Estructura del Proyecto
- `src/index.js`: Punto de entrada del servidor Express.
- `src/controllers/`: Lógica de manejo de webhooks y orquestación.
- `src/ai/`: Lógica del agente de IA, prompts y configuración del modelo.
- `src/services/`: Clientes para servicios externos (Supabase, ManyChat).
- `tunnel.js`: Script para exponer el servidor local durante el desarrollo.
- `schema.sql`: Definición de tablas para Supabase.

## ⚙️ Configuración
1. Clona el repositorio.
2. Crea un archivo `.env` basado en `.env.example`.
3. Instala las dependencias:
   ```bash
   npm install
   ```
4. Aplica el esquema de base de datos en Supabase usando `schema.sql`.

## 🏃 Ejecución
### Desarrollo Local
Para levantar el servidor y el túnel de localtunnel:
```bash
# Terminal 1: Servidor
npm start

# Terminal 2: Túnel
npm run tunnel
```

### Producción (VPS)
Se recomienda el uso de PM2 para gestionar el proceso:
```bash
pm2 start ecosystem.config.js
```

## 📝 Notas
- El bot utiliza memoria RAM para el historial de mensajes de la sesión actual.
- Las tablas de `tickets` y `program_requests` deben existir en Supabase para el correcto funcionamiento del registro de datos.
