# Evolution API MCP Server

Servidor [MCP](https://modelcontextprotocol.io) (Model Context Protocol) que expone
la **Evolution API v2** (WhatsApp) como herramientas para clientes MCP como Claude
Desktop, Claude Code o Cursor.

- **121 herramientas** con cobertura completa de la API v2 (instancias, mensajes,
  chats, grupos, perfil, etiquetas, webhooks e integraciones).
- **TypeScript** sobre el SDK oficial, transporte **stdio**.
- **Multi-instancia**: cada herramienta acepta `instance`; opcionalmente una
  instancia por defecto.
- **Grupos activables** vía `EVOLUTION_TOOLS` para no saturar el contexto del modelo.

Probado contra Evolution API `2.3.7`.

## Requisitos

- Node.js 18 o superior.
- Una instancia de Evolution API v2 y su **apikey global**.

## Instalación

```bash
npm install
npm run build
```

## Configuración

Variables de entorno (ver [.env.example](.env.example)):

| Variable | Requerida | Descripción |
|---|:---:|---|
| `EVOLUTION_BASE_URL` | ✅ | URL base, p.ej. `https://your-evolution-instance.com` (sin slash final). |
| `EVOLUTION_API_KEY` | ✅ | apikey global (header `apikey`). |
| `EVOLUTION_DEFAULT_INSTANCE` | — | Instancia usada cuando una herramienta omite `instance`. |
| `EVOLUTION_TOOLS` | — | Allowlist de grupos separada por comas. Ver abajo. |
| `EVOLUTION_TIMEOUT_MS` | — | Timeout por petición (default `30000`). |

> ⚠️ La apikey global da **control total** sobre la instancia (crear/borrar
> instancias, enviar mensajes, leer chats). Trátala como un secreto: nunca la
> subas al repositorio.

### Grupos de herramientas

`EVOLUTION_TOOLS` controla qué grupos se exponen:

- **Sin definir** → grupos núcleo: `instance, settings, message, chat, profile, label, group, webhook` (64 tools).
- `all` → todos los grupos (121 tools).
- Lista explícita, p.ej. `message,chat,group` → solo esos.

| Grupo | Núcleo | Herramientas |
|---|:---:|---|
| `instance` | ✅ | crear, conectar, estado, reiniciar, presencia, logout, borrar, listar |
| `settings` | ✅ | leer/escribir settings del instance |
| `message` | ✅ | texto, media, audio, sticker, ubicación, contacto, reacción, poll, lista, botones, status, ptv |
| `chat` | ✅ | verificar números, marcar leído/no leído, archivar, borrar, presencia, bloquear, foto, base64, buscar chats/mensajes/contactos/status, editar |
| `profile` | ✅ | perfil propio y de negocio, privacidad, nombre/estado/foto |
| `label` | ✅ | listar y asignar etiquetas |
| `group` | ✅ | crear, participantes, invitaciones, ajustes, ephemeral, salir |
| `webhook` | ✅ | configurar/leer webhook |
| `websocket` | — | configurar/leer websocket |
| `rabbitmq` | — | configurar/leer RabbitMQ |
| `sqs` | — | configurar/leer AWS SQS |
| `chatwoot` | — | configurar/leer Chatwoot |
| `typebot` | — | CRUD bots + start/sessions |
| `openai` | — | CRUD bots + credenciales + sessions |
| `dify` | — | CRUD bots + sessions |
| `evolutionbot` | — | CRUD bots + sessions |
| `flowise` | — | CRUD bots + sessions |

## Uso con Claude Code / Claude Desktop / Cursor

Añade el servidor a tu configuración de MCP (`claude_desktop_config.json`,
`.cursor/mcp.json`, o `claude mcp add`):

```json
{
  "mcpServers": {
    "evolution-api": {
      "command": "node",
      "args": ["/ruta/absoluta/a/mcp-evolution-api/dist/index.js"],
      "env": {
        "EVOLUTION_BASE_URL": "https://your-evolution-instance.com",
        "EVOLUTION_API_KEY": "tu-apikey-global",
        "EVOLUTION_DEFAULT_INSTANCE": "myinstance",
        "EVOLUTION_TOOLS": "instance,message,chat,group"
      }
    }
  }
}
```

Con Claude Code por CLI:

```bash
claude mcp add evolution-api \
  --env EVOLUTION_BASE_URL=https://your-evolution-instance.com \
  --env EVOLUTION_API_KEY=tu-apikey-global \
  --env EVOLUTION_DEFAULT_INSTANCE=myinstance \
  -- node /ruta/absoluta/a/mcp-evolution-api/dist/index.js
```

## Verificación

Smoke test de **solo lectura** contra tu instancia (no envía mensajes ni modifica nada):

```bash
EVOLUTION_BASE_URL=https://your-evolution-instance.com \
EVOLUTION_API_KEY=tu-apikey-global \
EVOLUTION_DEFAULT_INSTANCE=myinstance \
node dist/smoke.js
```

Salida esperada: `4/4 checks passed.`

## Ejemplos de uso (lenguaje natural)

Una vez conectado, puedes pedirle a Claude cosas como:

- "Verifica si el número 5215550123 está en WhatsApp."
- "Envía 'Hola 👋' al 5215550123 desde la instancia myinstance."
- "Lista todos los grupos de la instancia myinstance."
- "¿Cuál es el estado de conexión de mis instancias?"

## Convenciones de las herramientas

- Nombre: `evolution_<grupo>_<acción>` (p.ej. `evolution_message_send_text`).
- Cada herramienta acepta `instance` (opcional si hay `EVOLUTION_DEFAULT_INSTANCE`).
- Los `number` aceptan dígitos con código de país o JID completo
  (`5215550123` o `5215550123@s.whatsapp.net`).
- Los errores del API se devuelven como resultado de error con el `status` y el
  mensaje de Evolution (la apikey nunca aparece en logs ni errores).

## Estructura

```
src/
  index.ts            Server MCP (stdio): lista y ejecuta tools
  config.ts           Carga/valida variables de entorno
  client.ts           Cliente HTTP de Evolution (apikey, errores, timeout)
  registry.ts         Filtra grupos según EVOLUTION_TOOLS
  types.ts            Tipos ToolDef / ToolGroup
  schemas/common.ts   Fragmentos zod reutilizables
  tools/              Un archivo por controlador + integrations/
  smoke.ts            Smoke test de solo lectura
```

Las herramientas de bots IA (`typebot`, `openai`, `dify`, `evolutionbot`,
`flowise`) aceptan el objeto de configuración (`config`/`settings`) tal cual lo
documenta Evolution API, por su gran cantidad de campos específicos.

## Desarrollo

```bash
npm run watch    # compila en modo watch
npm run build    # compila a dist/
npm start        # ejecuta el servidor (requiere env)
```

## Licencia

MIT
