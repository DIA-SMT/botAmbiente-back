const { spawn } = require('child_process');

const password = process.argv[2];
const command = process.argv[3];
const host = 'root@77.37.126.249';

console.log(`🚀 Intentando ejecutar comando en ${host}...`);

const ssh = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', host, command], {
    stdio: ['pipe', 'inherit', 'inherit']
});

// Nota: Muchas versiones de SSH no leen el password de stdin.
// Esto es un intento de "best effort".
if (password) {
    setTimeout(() => {
        try {
            ssh.stdin.write(password + '\n');
        } catch (e) {
            console.error("No se pudo escribir en stdin:", e.message);
        }
    }, 2000);
}

ssh.on('close', (code) => {
    console.log(`🏁 Proceso SSH finalizado con código ${code}`);
    process.exit(code);
});
