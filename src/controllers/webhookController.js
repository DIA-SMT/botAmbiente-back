const agent = require('../ai/agent');
const manychatService = require('../services/manychat');
const supabaseService = require('../services/supabase');

exports.handleWebhook = async (req, res) => {
    try {
        // En ManyChat los webhooks suelen venir en req.body
        const body = req.body;

        // Validaciones robustas
        const subscriberId = body.id; // ManyChat pasa el ID del suscriptor
        const phone = body.whatsapp_phone || body.phone;
        const userName = body.name || 'Vecino';
        const rawInput = body.last_input_text || '';
        const liveChatUrl = body.live_chat_url || '';

        // Si no hay subscriberId no podemos responder
        if (!subscriberId) {
            console.error('❌ Error: El payload de ManyChat no contiene un subscriberId.', JSON.stringify(body));
            return res.status(400).send('No subscriberId provided');
        }

        // Responder temprano a ManyChat para evitar timeouts (200 OK)
        res.status(200).send('EVENT_RECEIVED');

        // Analizar si el input contiene una imagen (basado en la lógica del n8n original)
        const hasPhoto = rawInput.toLowerCase().endsWith('jpeg') || 
                         /^https?:\/\/.*\.(jpeg|jpg|png|gif|webp|bmp)((\?|#).*)?$/i.test(rawInput);

        console.log(`📩 Recibido mensaje de ${userName} (${phone}): "${rawInput}" [Foto: ${hasPhoto ? 'SI' : 'NO'}]`);

        // ==========================================
        // 1. Procesar mediante IA (LangChain Agent)
        // ==========================================
        const sessionId = body.key || subscriberId; // Key de sesión para la memoria
        
        const aiResponse = await agent.processMessage(rawInput, hasPhoto, sessionId);

        if (!aiResponse) {
            throw new Error("El agente no devolvió ninguna respuesta válida.");
        }

        // ==========================================
        // 2. Ejecutar acciones basadas en el Intent
        // ==========================================
        const intent = aiResponse.intent;
        let finalMessage = aiResponse.additional_info; // Mensaje default dictado por el LLM

        switch (intent) {
            case 'retiro_especial':
                // Validación para Retiro Especial: Requiere dirección y haber recibido una foto
                if (aiResponse.address && (hasPhoto || aiResponse.has_photo)) {
                    await supabaseService.saveTicket({
                        ticket_type: 'Pedido No Habitual',
                        waste_type: aiResponse.waste_type,
                        quantity: aiResponse.quantity_description,
                        address: aiResponse.address,
                        chat_id: phone,
                        user_name: userName,
                        status: 'Pendiente Validación Imagen',
                        days_without_service: aiResponse.days_without_service,
                        live_chat_url: liveChatUrl
                    });
                    console.log(`✅ Ticket de Retiro Especial creado para ${userName}`);
                    finalMessage = `✅ ¡Listo ${userName}! Tu pedido de retiro de residuos ha sido registrado correctamente. Un equipo pasará por ${aiResponse.address} en las próximas 72 horas. Por favor NO saques los residuos a la calle todavía. 🌿`;
                    await agent.addChatMessage(sessionId, 'system', 'TRÁMITE_FINALIZADO: El ticket de retiro especial ya fue creado.');
                } else {
                    console.log(`ℹ️ Retiro Especial en curso, pero faltan datos (Dirección: ${!!aiResponse.address}, Foto: ${hasPhoto || aiResponse.has_photo}). No se guarda aún.`);
                }
                break;

            case 'reclamo_recoleccion':
                // Validación para Reclamo: Requiere dirección
                if (aiResponse.address) {
                    await supabaseService.saveTicket({
                        ticket_type: 'Falta de Recolección',
                        address: aiResponse.address,
                        chat_id: phone,
                        user_name: userName,
                        status: 'Pendiente Verificación GPS',
                        days_without_service: aiResponse.days_without_service,
                        live_chat_url: liveChatUrl
                    });
                    console.log(`✅ Ticket de Reclamo creado para ${userName}`);
                    finalMessage = `✅ He registrado tu reclamo por falta de recolección en ${aiResponse.address}. Estaremos verificando el recorrido del camión por GPS y te avisaremos ante cualquier novedad. 🚛`;
                    await agent.addChatMessage(sessionId, 'system', 'TRÁMITE_FINALIZADO: El reclamo por recolección ya fue creado.');
                } else {
                    console.log(`ℹ️ Reclamo en curso, pero falta dirección. No se guarda aún.`);
                }
                break;

            case 'programas_ambientales':
                // Validación para Programas: Requiere tipo de programa y dirección (o datos básicos de inscripción)
                if (aiResponse.program_type && aiResponse.address) {
                    await supabaseService.saveProgramRequest({
                        program_type: aiResponse.program_type,
                        institution_name: aiResponse.institution_name,
                        address: aiResponse.address,
                        responsible_person: aiResponse.responsible_person,
                        student_count: aiResponse.student_count,
                        chat_id: phone,
                        user_name: userName,
                        live_chat_url: liveChatUrl
                    });
                    console.log(`✅ Solicitud de Programa ${aiResponse.program_type} creada para ${userName}`);
                    finalMessage = `✅ ¡Perfecto! He registrado la solicitud para el programa ${aiResponse.program_type.toUpperCase()}. Nos pondremos en contacto con ${aiResponse.responsible_person || 'vos'} a la brevedad para coordinar la visita a ${aiResponse.institution_name || 'la institución'}. 🌿`;
                    await agent.addChatMessage(sessionId, 'system', `TRÁMITE_FINALIZADO: La solicitud de programa ${aiResponse.program_type} ya fue creada.`);
                } else {
                    console.log(`ℹ️ Inscripción a programa en curso, faltan datos obligatorios. No se guarda aún.`);
                }
                break;

            case 'consultar_estado':
                // Consultar en la base de datos
                const records = await supabaseService.getRecordsByChatId(phone);
                finalMessage = formatStatusMessage(records);
                break;

            case 'derivaciones':
            case 'saludo':
            case 'consultando_datos':
            default:
                // Solo envían el texto generado por la IA (information desk)
                break;
        }

        // ==========================================
        // 3. Enviar Respuesta de vuelta por ManyChat
        // ==========================================
        if (finalMessage) {
            await manychatService.sendMessage(subscriberId, finalMessage);
            console.log(`✅ Respuesta enviada a ${userName}`);
        }

    } catch (error) {
        console.error('❌ Error general en handleWebhook:', error);
        
        // Manejo de fallos: intentar enviar disculpa amigable si tenemos el subscriberId
        const subscriberId = req.body?.id;
        if (subscriberId) {
            try {
                await manychatService.sendMessage(
                    subscriberId, 
                    "Disculpá, en este momento estoy experimentando un problema técnico. 🌿 Por favor intentá nuevamente en unos minutos."
                );
            } catch (fallbackError) {
                console.error('❌ Falló el envío del mensaje de error:', fallbackError.message);
            }
        }
        
        // Si no se había respondido, responder con error
        if (!res.headersSent) {
            return res.status(500).send('Internal Server Error');
        }
    }
};

// ==========================================
// Funciones Helper
// ==========================================
function formatStatusMessage(records) {
    if (!records || records.length === 0) {
        return "No encontré trámites registrados con tu número en nuestro sistema. 🌱";
    }

    let message = "📋 *Tus Trámites Registrados:*\n\n";

    records.forEach((record, index) => {
        const dateObj = record.created_at ? new Date(record.created_at) : new Date();
        const dateStr = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        
        const isTicket = record.ticket_type !== undefined;

        let statusIcon = "⚪";
        const status = record.status || "Pendiente";
        const statusLow = status.toLowerCase();
        
        if (statusLow.includes("pendiente")) statusIcon = "🟡";
        if (statusLow.includes("proceso") || statusLow.includes("contactado")) statusIcon = "🔵";
        if (statusLow.includes("resuelto") || statusLow.includes("cerrado")) statusIcon = "🟢";
        if (statusLow.includes("rechazado")) statusIcon = "🔴";

        message += `*${index + 1}.* `;
        
        if (isTicket) {
            message += `*${record.ticket_type}* (${dateStr})\n`;
            message += `   📍 ${record.address || 'Sin dirección'}\n`;
        } else {
            const programType = record.program_type ? record.program_type.toUpperCase() : "PROGRAMA";
            message += `*Solicitud ${programType}* (${dateStr})\n`;
        }
        
        message += `   Estado: ${statusIcon} _${status}_\n\n`;
    });

    return message;
}
