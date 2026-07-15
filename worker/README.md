# Relay del formulario → Telegram

El sitio es estático (GitHub Pages), así que **no puede guardar el token del bot**:
cualquier cosa dentro de `index.html` es pública, tanto en el repo como en el
código fuente que ve cada visitante. Este Worker guarda el token como secreto y
es lo único que habla con Telegram.

## Setup (una sola vez)

### 1. Crear el bot

En Telegram, escríbele a **@BotFather** → `/newbot` → sigue los pasos.
Te devuelve un token con esta forma: `123456789:AAE...`

### 2. Obtener el chat_id

- **Chat personal:** escríbele a **@userinfobot**, te responde con tu ID numérico.
- **Grupo (recomendado si más de una persona atiende los leads):** agrega el bot
  al grupo, manda cualquier mensaje, y abre:
  `https://api.telegram.org/bot<TOKEN>/getUpdates` → busca `"chat":{"id":-100...}`.
  Los IDs de grupo son negativos.

> El bot solo puede escribirte si tú le escribiste primero (o si está en el grupo).
> Manda un `/start` antes de probar.

### 3. Desplegar

```sh
cd worker
npx wrangler login
npx wrangler deploy
```

`deploy` imprime la URL del Worker:
`https://amoroso-nights-form.<TU-SUBDOMINIO>.workers.dev`

### 4. Cargar los secretos

```sh
npx wrangler secret put TELEGRAM_BOT_TOKEN   # pega el token de BotFather
npx wrangler secret put TELEGRAM_CHAT_ID     # pega el chat_id
```

Los valores viajan de tu terminal a Cloudflare. **No los pongas en
`wrangler.toml`** ni en ningún archivo del repo: todo esto es público.

### 5. Conectar el sitio

En `index.html`, en `Component.FORM_ENDPOINT`, reemplaza `<TU-SUBDOMINIO>` con
el subdominio real del paso 3. Luego commit + push.

### 6. Probar

Llena el formulario en amorosonights.com. Debe llegarte el mensaje a Telegram.
Si no llega:

```sh
npx wrangler tail    # logs en vivo del Worker
```

## Qué protege

- **Honeypot** — campo `website` oculto. Si viene lleno, es bot: responde 200
  (para no darle señal) y no manda nada.
- **Rate limit** — 5 envíos por IP cada 10 min, vía Cache API.
  Es por centro de datos, así que una botnet distribuida lo puede esquivar;
  sirve para el caso común de un solo origen. Si empieza a llegar spam real,
  el siguiente paso es Cloudflare Turnstile.
- **CORS** — solo los orígenes en `ALLOWED_ORIGINS` (`wrangler.toml`) pueden
  postear. Cualquier otro recibe 403.

Nada de esto autentica al usuario: el endpoint es público y alguien decidido
puede mandar solicitudes falsas. Para un formulario de leads eso es aceptable —
el costo de un lead falso es bajo. Súbelo a Turnstile si deja de serlo.

## Cambiar los campos

Los campos del mensaje salen de `FIELDS` en `src/index.js`, que hace match con
los `name=` del `<form>` en `index.html`. Si agregas un campo al formulario,
agrégalo también ahí o no aparece en Telegram.
