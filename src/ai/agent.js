const { ChatOpenAI } = require("@langchain/openai");
const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const supabaseService = require('../services/supabase');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Memoria en RAM: subscriberId -> array de mensajes
const inMemoryHistory = new Map();

// OpenRouter compatibility: the underlying OpenAI SDK often looks for OPENAI_API_KEY.
if (process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = process.env.OPENROUTER_API_KEY;
}

// Prompt base portado del JSON de n8n
const SYSTEM_PROMPT = `Eres el asistente virtual oficial de la Secretaría de Ambiente de San Miguel de Tucumán.
Tu canal de comunicación es WhatsApp.
Usa un tono cordial, directo y resolutivo. Emojis moderados 🌿🚛.
Tu función es RECEPCIONAR PEDIDOS Y CONSULTAS.

🎯 PRINCIPIO FUNDAMENTAL
SIEMPRE responde primero con la información concreta que el vecino necesita.
NO hagas interrogatorios innecesarios.
NO des vueltas.
Si luego hace falta un dato adicional, pregúntalo después de brindar la información principal.

Si el usuario solo pide información, responde y finaliza. No repreguntes cosas irrelevantes.

🚫 REGLAS DE ORO

NO GEOLOCALIZACIÓN NI CERCANÍA:
No calcules distancias.
No valides zonas.
No preguntes barrio.
No ofrezcas "el punto más cercano".
Entrega la lista fija y el mapa.

MODO CONSULTA vs REGISTRO:
Si el usuario solo pide información -> responde y usa intent: "consultando_datos".
Solo genera intent final cuando realmente quiere iniciar un trámite y tengas todos los datos obligatorios.

FOTOS SIN TEXTO:
Cuando pidas una foto, SIEMPRE aclara:
"Por favor envía la foto SOLA, sin escribir texto en el mismo mensaje".

🛑 REGLA DE CIERRE OBLIGATORIO

Si el usuario solo realiza una consulta informativa y la respuesta ya fue brindada correctamente, DEBES finalizar la respuesta ahí.
NO ofrezcas seguir ayudando.
NO agregues: "Si querés..."
NO propongas pasos adicionales.
NO vuelvas a pedir datos.
NO sugieras describir mejor el problema.

Solo responde la información y termina el mensaje.

SI VES EN EL HISTORIAL "[SISTEMA: TRÁMITE_FINALIZADO]", significa que el pedido ya se guardó. 
NO sigas pidiendo datos, NO vuelvas a preguntar la dirección ni pidas fotos. 
Si el usuario dice "gracias" o "chau", simplemente responde con un saludo final corto y usa intent: "saludo".

--------------------------------------------------
📘 INFORMACIÓN OFICIAL DE PROGRAMAS MUNICIPALES
--------------------------------------------------

SE-PA-RÁ (Recolección diferenciada):
- Programa de separación en origen.
- Solo residuos reciclables LIMPIOS y SECOS.
- Días: Miércoles y Sábados.
- Sacar antes de las 9:00 hs.
- Pasa un camión específico del programa.
- Basado en Ordenanza 5079.
- Forma parte del sistema GIRSU y economía circular.

E-DU-CÁ (Educación Ambiental):
- Programa municipal de educación ambiental.
- Destinado a instituciones públicas y privadas.
- Basado en Ley Nacional 27.621.
- Objetivo: generar conciencia ambiental y formación ciudadana.
- Para inscribirse se necesita:
  INSTITUCIÓN, DIRECCIÓN, RESPONSABLE, CANTIDAD DE ALUMNOS.

CONTROLÁ:
- Programa municipal de control ambiental.
- Controla:
   • Gestión de residuos (GIRSU)
   • Ruidos molestos (más de 60 decibeles)
   • Control bromatológico (seguridad alimentaria)
- Recibe reclamos y denuncias ambientales.

--------------------------------------------------
📍 PUNTOS VERDES (INFORMACIÓN DIRECTA)
--------------------------------------------------

Si el usuario pregunta por puntos verdes:
Responde directamente con:
Lamadrid 3700  
Viamonte e Italia  
Miguel Lillo e Inca Garcilaso  

Mapa de todos los puntos verdes:
https://www.google.com/maps/d/u/0/viewer?mid=1vyRrLsGdDi63Z7VJsOJoTMrHtkW2wVY&ll=-26.816268242965943%2C-65.20796133535157&z=13
- Los contenedores están disponibles las 24 horas.
- No preguntes si va hoy.
- No preguntes cantidad salvo que el caso lo requiera.
- Los neumáticos NO tienen retiro domiciliario. Deben llevarse allí.
Este caso normalmente queda en intent: "consultando_datos".

--------------------------------------------------
FLUJOS DE ATENCIÓN
--------------------------------------------------

CONSULTA DE ESTADO (Intent: consultar_estado)
Si el usuario pregunta por su pedido:
NO pidas DNI ni número.
Genera inmediatamente el intent consultar_estado.

A. RETIRO DE RESIDUOS NO HABITUALES (Intent: retiro_especial)
Consulta informativa: Ofrece opciones claras: Escombros/construcción, Restos de poda, Otros (muebles, chatarra).
Acción: Si solicita retiro, exige FOTO y DIRECCIÓN. (Avisa: NO saques los residuos todavía).

B. RECLAMO RECOLECCIÓN (Intent: reclamo_recoleccion)
Pedir: Dirección exacta y Desde cuándo no pasa.

C. PROGRAMAS AMBIENTALES (Intent: programas_ambientales)
Solo usar cuando quiere inscribirse y tengas todos los datos. Si solo consulta -> consultando_datos.

--------------------------------------------------
FORMATO DE SALIDA (Aplica a Tools)
--------------------------------------------------
Retorna siempre una invocación al Output Tool o la estructura requerida, evaluando si la foto fue o no adjuntada.`;

// Definimos el tool de Structured Output esperado basándonos en el esquema manual de n8n
const agentOutputSchema = {
    name: "generar_respuesta",
    description: "Genera la respuesta y clasifica el intent del mensaje del vecino.",
    parameters: {
        type: "object",
        properties: {
            intent: {
                type: "string",
                enum: ["retiro_especial", "reclamo_recoleccion", "programas_ambientales", "derivaciones", "saludo", "consultando_datos", "consultar_estado"]
            },
            waste_type: { type: "string", enum: ["escombros", "poda", "otros", "null"] },
            quantity_description: { type: "string" },
            address: { type: "string" },
            has_photo: { type: "boolean" },
            program_type: { type: "string", enum: ["separa", "educa", "transforma", "puntos_verdes", "null"] },
            days_without_service: { type: "number" },
            institution_name: { type: "string" },
            responsible_person: { type: "string" },
            student_count: { type: "number" },
            additional_info: { type: "string", description: "Respuesta clara, directa y sin rodeos al vecino que se le enviará por WhatsApp." }
        },
        required: ["intent", "additional_info"]
    }
};

/**
 * Instancia del modelo.
 * Configurado para usar el modelo gpt-5.2 de openai.
 */
const getModel = () => {
    const model = new ChatOpenAI({
        modelName: 'openai/gpt-5.2', // HARDCODED MODEL REQUIRED BY USER
        apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
        openAIApiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
        configuration: {
            baseURL: process.env.OPENAI_API_BASE || 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                "HTTP-Referer": "https://bot-ambiente.local", // OpenRouter lo pide
                "X-Title": "Bot Ambiente"
            }
        },
        temperature: 0.3
    });

    // Definimos el tool explícitamente como espera la API de OpenAI/OpenRouter
    const toolDefinition = {
        type: "function",
        function: agentOutputSchema
    };

    // En versiones recientes de @langchain/openai se usa .bindTools()
    return model.bindTools([toolDefinition], {
        tool_choice: {
            type: "function",
            function: { name: "generar_respuesta" }
        }
    });
};

/**
 * Función para añadir mensajes manualmente al historial (usado por el controlador)
 */
exports.addChatMessage = async (sessionId, role, content) => {
    const currentHistory = inMemoryHistory.get(sessionId) || [];
    if (role === 'user') {
        currentHistory.push(new HumanMessage(content));
    } else if (role === 'assistant') {
        currentHistory.push(new AIMessage(content));
    } else if (role === 'system') {
        // Los mensajes de sistema los guardamos como HumanMessage con un flag especial o similar
        // para que el modelo los vea claramente como instrucciones de contexto
        currentHistory.push(new HumanMessage(`[SISTEMA: ${content}]`));
    }
    inMemoryHistory.set(sessionId, currentHistory.slice(-20));
};

/**
 * Función principal expuesta al controlador
 */
exports.processMessage = async (userInput, hasPhotoAttached, sessionId) => {
    try {
        const model = getModel();

        // 1. Obtener historial desde la RAM
        let historyMessages = inMemoryHistory.get(sessionId) || [];
        
        // Limitar historial para no saturar contextos (ej: últimas 10 mensajes)
        if (historyMessages.length > 10) {
            historyMessages = historyMessages.slice(-10);
        }

        // 2. Armar el context de la petición
        // Emulamos la inyección del hasPhoto adjunta como lo hace el n8n original
        const contextualInput = `==${userInput}\n\n[INFO_SISTEMA: FOTO_ADJUNTA=${hasPhotoAttached ? 'SI' : 'NO'}]`;

        // 3. Crear el prompt template
        const prompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
            new MessagesPlaceholder("history"),
            HumanMessagePromptTemplate.fromTemplate("{input}")
        ]);

        const chain = prompt.pipe(model);

        // 4. Ejecutar el modelo
        const res = await chain.invoke({
            history: historyMessages,
            input: contextualInput
        });

        // 5. Extraer y parsear la respuesta del tool call (Function Calling)
        let parsedResult = null;
        if (res.additional_kwargs && res.additional_kwargs.tool_calls && res.additional_kwargs.tool_calls.length > 0) {
            const toolCall = res.additional_kwargs.tool_calls[0];
            try {
                parsedResult = JSON.parse(toolCall.function.arguments);
                // Ajustar nulos que llegan como "null" string
                Object.keys(parsedResult).forEach(key => {
                    if (parsedResult[key] === "null") parsedResult[key] = null;
                });
            } catch (e) {
                console.error("Error parseando los argumentos del tool:", e);
            }
        }

        // Si falló el tool_calls o el modelo no lo usó correctamente
        if (!parsedResult) {
            console.warn("⚠️ El modelo no devolvió el tool structuring esperado, intentando parsear su texto si es JSON...");
            // Backup por si acaso (poco probable si forzamos tool_choice)
            try {
                parsedResult = JSON.parse(res.content);
            } catch (ignore) {
                throw new Error("Respuesta inválida estructurada desde el LLM.");
            }
        }

        // 6. Guardar la nueva interacción en la RAM
        const currentHistory = inMemoryHistory.get(sessionId) || [];
        currentHistory.push(new HumanMessage(userInput));
        currentHistory.push(new AIMessage(parsedResult.additional_info || "ok"));
        
        // Guardar de vuelta y limitar tamaño (ej 20 msjs totales)
        inMemoryHistory.set(sessionId, currentHistory.slice(-20));

        return parsedResult;

    } catch (error) {
        console.error("❌ Error en LangChain Agent processing:", error);
        throw error;
    }
};
