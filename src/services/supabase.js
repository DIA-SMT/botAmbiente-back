const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Inicialización segura
const supabase = (supabaseUrl && supabaseKey) 
    ? createClient(supabaseUrl, supabaseKey) 
    : null;

if (!supabase) {
    console.warn("⚠️ Advertencia: No se han configurado las credenciales de Supabase en el .env");
}

/**
 * Guarda un ticket de reclamo o retiro en Supabase
 */
exports.saveTicket = async (data) => {
    if (!supabase) return null;
    try {
        const { error } = await supabase.from('tickets').insert([data]);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("❌ Error al guardar ticket en Supabase:", error);
        throw error;
    }
};

/**
 * Guarda un registro de programa (E-DU-CA, etc) en Supabase
 */
exports.saveProgramRequest = async (data) => {
    if (!supabase) return null;
    try {
        const { error } = await supabase.from('program_requests').insert([data]);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("❌ Error al guardar programa en Supabase:", error);
        throw error;
    }
};

/**
 * Consulta todos los tickets y programas del teléfono dado
 * Retorna array unificado para el agente
 */
exports.getRecordsByChatId = async (chatId) => {
    if (!supabase) return [];
    try {
        const [ticketsRes, programsRes] = await Promise.all([
            supabase.from('tickets').select('*').eq('chat_id', chatId),
            supabase.from('program_requests').select('*').eq('chat_id', chatId)
        ]);

        const tickets = ticketsRes.data || [];
        const programs = programsRes.data || [];

        // Combinar y ordenar por fecha descendente
        const allRecords = [...tickets, ...programs];
        allRecords.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
            const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
            return dateB - dateA;
        });

        return allRecords;
    } catch (error) {
        console.error("❌ Error consultando registros en Supabase:", error);
        return [];
    }
};

/**
 * Las funciones de historial de chat se han movido a la memoria RAM (en agent.js)
 * según el requerimiento del usuario para evitar errores de tabla inexistente.
 */

