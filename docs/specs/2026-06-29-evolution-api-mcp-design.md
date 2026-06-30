# Evolution API MCP Server — Diseño

Fecha: 2026-06-29
Estado: Aprobado (vía /goal, enfoque C)

## Objetivo

Servidor MCP en TypeScript que expone la API de Evolution API v2 (WhatsApp) como
herramientas para clientes MCP (Claude Desktop/Code, Cursor). Cobertura completa
de endpoints, transporte stdio local, instancia como parámetro por herramienta.

## Contexto de la instancia de referencia

- Base URL: `https://your-evolution-instance.com`
- Versión: Evolution API `2.3.7` (API v2)
- Auth: header `apikey` (401 sin él)
- Formato de ruta: `/{controlador}/{acción}/{instancia}`
- Respuestas JSON directas
- Integración: WHATSAPP-BAILEYS

## Decisiones

1. **Lenguaje/runtime**: TypeScript + Node 18+ (`fetch` nativo).
2. **SDK**: `@modelcontextprotocol/sdk` con transporte **stdio**.
3. **Validación**: `zod` por herramienta.
4. **Alcance**: cobertura completa (~120 endpoints).
5. **Multi-instancia**: cada herramienta recibe `instance`; `EVOLUTION_DEFAULT_INSTANCE`
   opcional como fallback.
6. **Arquitectura (Enfoque C)**: una herramienta por endpoint, organizadas en grupos
   activables vía `EVOLUTION_TOOLS` (allowlist). Cobertura completa en código; el
   usuario controla cuántas herramientas se exponen para no saturar el contexto.

## Configuración (variables de entorno)

| Var | Requerida | Descripción |
|---|---|---|
| `EVOLUTION_BASE_URL` | sí | URL base, ej. `https://your-evolution-instance.com` |
| `EVOLUTION_API_KEY` | sí | apikey global de la instancia |
| `EVOLUTION_DEFAULT_INSTANCE` | no | instancia por defecto si no se pasa `instance` |
| `EVOLUTION_TOOLS` | no | allowlist de grupos separada por comas; vacío = grupos núcleo |

Grupos núcleo (default): `instance, settings, message, chat, profile, label, group, webhook`.
Opt-in: `websocket, rabbitmq, sqs, chatwoot, typebot, openai, dify, evolutionbot, flowise`.
Valor especial `all` activa todos.

## Estructura

```
src/
  index.ts            entrypoint: server + registro de tools + stdio
  config.ts           lee/valida env
  client.ts           EvolutionClient: request() con apikey y manejo de errores
  registry.ts         filtra grupos según EVOLUTION_TOOLS
  schemas/common.ts   zod reutilizable (instance, jid/number)
  tools/
    instance.ts settings.ts message.ts chat.ts profile.ts label.ts group.ts
    integrations/
      webhook.ts websocket.ts rabbitmq.ts sqs.ts
      chatwoot.ts typebot.ts openai.ts dify.ts evolutionBot.ts flowise.ts
README.md  .env.example  .gitignore  package.json  tsconfig.json
```

## Patrón de herramienta

Cada archivo de grupo exporta `{ group: string, tools: ToolDef[] }` donde
`ToolDef = { name, description, inputSchema (zod), handler(client, args) }`.
Nombres prefijados: `evolution_<grupo>_<acción>` (ej. `evolution_message_send_text`).

## Cliente HTTP

`EvolutionClient.request(method, path, { body, query })`:
- Inyecta header `apikey` y `Content-Type: application/json`.
- Construye URL desde `baseUrl`.
- Parsea JSON; si `!res.ok`, traduce a error legible con `status` + `message` de Evolution.
- Nunca registra la apikey.

## Manejo de errores

- Validación zod antes de la llamada.
- Error del API → contenido de error del tool (`isError: true`) con status + message.
- Timeout/red → mensaje claro.

## Testing

- Unit: `client` (mock de fetch), `registry` (allowlist).
- Smoke: script contra la instancia real usando solo lecturas
  (`connectionState`, `fetchInstances`, `settings/find`). Sin enviar mensajes.

## Seguridad

- apikey solo por env; `.gitignore` + `.env.example`.
- README advierte que la apikey global da control total de la instancia.

## Inventario de grupos (resumen)

- instance (8), settings (2), message (12), chat (14), profile (8), label (2),
  group (16), webhook/websocket/rabbitmq/sqs (2 c/u), chatwoot (2),
  typebot/openai/dify/evolutionbot/flowise (CRUD de bots IA, ~7-10 c/u).
```
