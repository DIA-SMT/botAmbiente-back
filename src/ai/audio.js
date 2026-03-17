const axios = require('axios');
const FormData = require('form-data');
// Requiere tener ffmpeg o procesar el buffer en memoria

/**
 * Función para descargar un audio de una URL (ej: WhatsApp/Manychat) 
 * y enviarlo a Whisper (OpenAI) para transcripción.
 * 
 * @param {string} audioUrl URL pública o accesible del audio
 * @returns {Promise<string>} Texto transcrito
 */
exports.transcribeAudio = async (audioUrl) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            console.warn("⚠️ No se configuró OPENAI_API_KEY. No se puede transcribir audio.");
            return "[Audio recibido pero no se pudo transcribir - API Key faltante]";
        }

        console.log(`🎙️ Descargando audio desde: ${audioUrl}`);
        
        // 1. Descargamos el archivo como stream o buffer
        const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
        const audioBuffer = Buffer.from(response.data, 'binary');

        // 2. Preparamos el FormData para la API de Whisper
        const formData = new FormData();
        // Whisper requiere un nombre de archivo con extensión válida (.mp3, .ogg, .wav, etc)
        // ManyChat de WhatsApp suele mandar .ogg u .oga
        formData.append('file', audioBuffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
        formData.append('model', 'whisper-1');
        formData.append('language', 'es'); // Optimizamos forzando español

        // 3. Llamada directa a la API de OpenAI (no a través de LangChain para audios puros)
        const transcriptionResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
        });

        const transcribedText = transcriptionResponse.data.text;
        console.log(`📝 Audio transcrito: "${transcribedText}"`);
        return transcribedText;

    } catch (error) {
        console.error("❌ Error transcribiendo audio:", error.response?.data || error.message);
        throw new Error("No se pudo procesar el audio.");
    }
};
