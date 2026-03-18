const { Client } = require('ssh2');

const conn = new Client();
const cmds = [
    'mkdir -p /var/www/bots',
    'cd /var/www/bots',
    'if [ -d "bot-ambiente" ]; then rm -rf bot-ambiente; fi',
    'git clone https://github.com/DIA-SMT/botAmbiente-back.git bot-ambiente',
    'cd bot-ambiente',
    'npm install --production',
    // Crear el .env dinámicamente
    'echo "PORT=3001" > .env',
    'echo "NODE_ENV=production" >> .env',
    // Detener y reiniciar PM2
    'pm2 delete bot-ambiente 2>/dev/null || true',
    'pm2 start ecosystem.config.js --name bot-ambiente',
    // Configurar Nginx para el bloque /ambiente/ en el archivo existente
    `if ! grep -q "location /ambiente/" /etc/nginx/sites-available/servidoria.smt.gob.ar; then
        sed -i '/location \\/turismo\\/ {/i \\
    location /ambiente/ {\\
        proxy_pass http://localhost:3001/;\\
        proxy_http_version 1.1;\\
        proxy_set_header Upgrade $http_upgrade;\\
        proxy_set_header Connection '"'"'upgrade'"'"';\\
        proxy_set_header Host $host;\\
        proxy_cache_bypass $http_upgrade;\\
    }\\
' /etc/nginx/sites-available/servidoria.smt.gob.ar
        systemctl restart nginx
    fi`
];

conn.on('ready', () => {
  console.log('Cliente SSH conectado exitosamente ✓');
  const fullCmd = cmds.join(' && ');
  
  conn.exec(fullCmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '77.37.126.249',
  port: 22,
  username: 'root',
  password: 'mF@-qImm1AS7;M(m0;H4'
});

conn.on('error', (err) => {
    console.error('Error de conexión SSH:', err);
});
