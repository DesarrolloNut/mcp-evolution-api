# Proveedores y Canales en MCP WhatsApp

Este documento describe la arquitectura multicanal introducida en `mcp-whatsapp` v2.0 y cómo unifica múltiples líneas y servicios de mensajería bajo una interfaz consistente.

---

## 1. Conceptos Fundamentales

### 1.1 Proveedor (Provider)
Un **Proveedor** representa el backend o servicio de mensajería que gestiona la conexión con WhatsApp.  
Cada proveedor tiene:
- `name`: Identificador único (ej. `evolution-servidor-1`, `meta-oficial`).
- `type`: El tipo de adaptador (`evolution`, `meta`, `twilio`).
- `baseUrl`: Dirección del servidor o API del proveedor.
- `apiKey`: Credencial de acceso (almacenada cifrada con AES-256-GCM en disco).

### 1.2 Canal / Línea Telefónica (Channel)
Un **Canal** representa una línea telefónica específica conectada a través de un proveedor.  
Cada canal tiene:
- `name`: Nombre descriptivo de la línea (ej. `trabajo`, `personal`, `soporte`, `ventas`).
- `phoneNumber`: Número internacional en formato E.164 (ej. `+18095551234`).
- `instanceId`: Identificador técnico específico de la plataforma proveedora (por ejemplo, el nombre de la instancia en Evolution API).
- `isDefault`: Indicador booleano (1 o 0). Solo un canal activo puede ser el canal predeterminado global a la vez.

---

## 2. Resolución de Canales y Línea por Defecto

Cuando un agente IA (como Claude Desktop, Cursor o Claude Code) ejecuta una herramienta de mensajería (ej. `whatsapp_send_text`):

1. **Si el agente especifica el parámetro `channel`:**
   ```json
   {
     "recipient": "18095559999",
     "text": "Hola desde la línea de soporte",
     "channel": "soporte"
   }
   ```
   El sistema busca el canal con nombre `soporte`, localiza su proveedor asociado y despacha el mensaje a través de su adaptador correspondiente.

2. **Si el agente omite el parámetro `channel`:**
   ```json
   {
     "recipient": "18095559999",
     "text": "Hola desde la línea predeterminada"
   }
   ```
   El sistema resuelve automáticamente el canal marcado como `is_default = true`. No es necesario que el agente conozca los nombres internos de las instancias o números a menos que desee enviar desde una línea específica.

---

## 3. Matriz de Compatibilidad Terminológica (Cero Contradicciones)

Para mantener retrocompatibilidad con integraciones previas de Evolution API v2:

| Término Legacy (v1.x) | Concepto Gateway (v2.0) | Mapeo / Funcionamiento |
|:---|:---|:---|
| `instance` | `channel` | Si se pasa el parámetro legacy `instance`, el sistema busca un canal cuyo nombre o `instanceId` coincida. |
| `EVOLUTION_DEFAULT_INSTANCE` | `is_default` en SQLite | Administrado **dinámicamente** desde el panel web. No requiere variables de entorno. |
| `EVOLUTION_BASE_URL` / `API_KEY` | Registrado en `/panel` | Se crea y actualiza dinámicamente en tiempo de ejecución. Permite múltiples proveedores simultáneos. |
| `EvolutionClient` directo | `IWhatsAppProvider` | El adaptador `EvolutionAdapter` traduce las peticiones de dominio agnósticas al formato que espera Evolution API v2. |
