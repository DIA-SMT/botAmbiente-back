# 🚀 Guía de Despliegue — Bot Ambiente Tucumán

## Datos del Servidor
| Campo | Valor |
|-------|-------|
| **IP** | `77.37.126.249` |
| **Dominio** | `servidoria.smt.gob.ar` |
| **Ruta en VPS** | `/var/www/bots/bot-ambiente/` |
| **Puerto** | `3001` |
| **Proceso PM2** | `bot-ambiente-tucuman` |
| **Webhook URL** | `https://servidoria.smt.gob.ar/ambiente/api/webhook/manychat` |
| **SSH Key** | En el repo de `frontBotTurismo/backend/id_rsa_node` |

---

## Desplegar Cambios (Rápido ⚡)

```bash
# 1. Commitear y pushear a GitHub
git add .
git commit -m "descripción del cambio"
git push origin main

# 2. Conectarse a la VPS y actualizar
ssh -i <ruta_a_id_rsa_node> root@77.37.126.249

# 3. Ya en la VPS:
cd /var/www/bots/bot-ambiente
git pull origin main
npm install        # Solo si cambiaste dependencias
pm2 restart bot-ambiente-tucuman
```

> **Nota:** Si el repo en la VPS no tiene Git configurado (se subió por ZIP), hacé el setup una vez:
> ```bash
> cd /var/www/bots/bot-ambiente
> git init
> git remote add origin https://github.com/lucianobonilla2/BotAmbiente-back.git
> git fetch origin
> git reset --hard origin/main
> ```

---

## Estructura Multi-Bot en la VPS

```
/var/www/bots/
├── bot-turismo/backend/    → Puerto 3000 → /turismo/
├── bot-ambiente/           → Puerto 3001 → /ambiente/
└── (futuros bots...)       → Puerto 300X → /nombre/
```

Nginx enruta cada ruta al puerto correspondiente. La config vive en:
`/etc/nginx/sites-available/servidoria.smt.gob.ar`

---

## Comandos Útiles

```bash
# Ver estado de todos los bots
pm2 list

# Ver logs en vivo
pm2 logs bot-ambiente-tucuman

# Reiniciar
pm2 restart bot-ambiente-tucuman

# Probar Nginx
nginx -t && systemctl restart nginx
```

---

## ⚠️ Importante
- El archivo `.env` **no está en Git**. Si lo modificás localmente, copialo manualmente a la VPS.
- El puerto debe ser `3001` (en el `.env`), distinto al de Turismo (`3000`).
- Si modificás la config de Nginx, siempre correr `certbot --nginx -d servidoria.smt.gob.ar` después para restaurar SSL.
