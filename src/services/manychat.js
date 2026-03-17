const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Retorna la instancia de Axios configurada para ManyChat
 */
const getManyChatClient = () => {
    const token = process.env.MANYCHAT_API_TOKEN;
    if (!token) {
        console.warn("⚠️ MANYCHAT_API_TOKEN no está definido en el .env.");
    }
    
    return axios.create({
        baseURL: 'https://api.manychat.com/fb/sending',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Usualmente ManyChat API espera Bearer
        }
    });
};

/**
 * Envía un mensaje de texto al subscriberId provisto.
 * Simula el comportamiento del nodo HTTP de n8n.
 * 
 * @param {string|number} subscriberId - ID de ManyChat
 * @param {string} text - Texto a enviar por WhatsApp
 */
exports.sendMessage = async (subscriberId, text) => {
    try {
        const client = getManyChatClient();
        
        const payload = {
            subscriber_id: subscriberId,
            data: {
                version: "v2",
                content: {
                    type: "whatsapp",
                    messages: [
                        {
                            type: "text",
                            text: text
                        }
                    ]
                }
            }
        };

        const response = await client.post('/sendContent', payload);
        return response.data;
    } catch (error) {
        console.error(`❌ Error enviando mensaje por ManyChat al ID [${subscriberId}]:`, error.response?.data || error.message);
        throw error;
    }
};
