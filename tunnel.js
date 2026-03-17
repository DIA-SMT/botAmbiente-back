const localtunnel = require('localtunnel');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const SUBDOMAIN = process.env.LOCALTUNNEL_SUBDOMAIN || `bot-ambiente-${Math.floor(Math.random() * 10000)}`;

let tunnel = null;

const createTunnel = async () => {
    try {
        tunnel = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });

        console.log(`=================================================`);
        console.log(`🌍 Túnel creado exitosamente!`);
        console.log(`🔗 URL: ${tunnel.url}`);
        console.log(`📌 Configura esta URL en el Webhook de ManyChat:`);
        console.log(`   ${tunnel.url}/api/webhook/manychat`);
        console.log(`=================================================`);

        tunnel.on('close', () => {
            console.log('❌ El túnel se ha cerrado. Reiniciando en 5 segundos...');
            setTimeout(createTunnel, 5000);
        });

        tunnel.on('error', (err) => {
            console.error('⚠️ Error en el túnel:', err);
        });

    } catch (error) {
        console.error('❌ Error al crear el túnel:', error);
        setTimeout(createTunnel, 5000);
    }
};

// Heartbeat para mantener vivo el túnel (evita que localtunnel lo cierre por inactividad)
setInterval(() => {
    if (tunnel && tunnel.url) {
        const urlObj = new URL(tunnel.url);
        const requestModule = urlObj.protocol === 'https:' ? require('https') : require('http');

        requestModule.get(tunnel.url, (res) => {
            // Ignoramos la respuesta, solo queremos hacer ping
            res.resume();
        }).on('error', () => {
            // Ignoramos errores del ping
        });
    }
}, 60000); // Ping cada 60 segundos

createTunnel();

// Manejo de cierre seguro
process.on('SIGINT', () => {
    if (tunnel) tunnel.close();
    process.exit();
});
