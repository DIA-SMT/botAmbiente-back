const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const webhookController = require('./controllers/webhookController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ruta base
app.get('/', (req, res) => {
    res.send('Bot Ambiente en ejecución 🌱');
});

// Ruta del Webhook de ManyChat
app.post('/api/webhook/manychat', webhookController.handleWebhook);

// Inicialización del servidor
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
    console.log(`=========================================`);
});
