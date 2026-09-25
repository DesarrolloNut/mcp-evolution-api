# Guía de Conexión de Clientes MCP (v2.0)

`mcp-whatsapp` v2.0 opera como un servidor centralizado HTTP/SSE con autenticación por token, manteniendo también retrocompatibilidad con el modo de consola `stdio`.

---

## 1. Conexión HTTP / SSE (Modo Recomendado)

En este modo, el servidor se ejecuta centralizadamente en un contenedor o host (por defecto en el puerto `3000`), y los agentes IA se conectan a él mediante la URL del protocolo MCP (`http://localhost:3000/mcp`).

### 1.1 Configuración en Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/inspector",
        "--sse",
        "http://localhost:3000/mcp"
      ],
      "headers": {
        "Authorization": "Bearer tu-token-mcp-secreto"
      }
    }
  }
}
```

> **Nota:** Si `MCP_API_TOKEN` no está configurado en el servidor (desarrollo local), puedes omitir el header de autorización.

### 1.2 Configuración en Cursor (`.cursor/mcp.json`)

En Cursor, puedes añadir el servidor seleccionando el tipo **SSE / HTTP**:
```json
{
  "mcpServers": {
    "whatsapp": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer tu-token-mcp-secreto"
      }
    }
  }
}
```

### 1.3 Conexión con Claude Code (CLI)

```bash
claude mcp add whatsapp http://localhost:3000/mcp --header "Authorization: Bearer tu-token-mcp-secreto"
```

---

## 2. Herramientas Disponibles

Todas las herramientas unificadas operan con el prefijo `whatsapp_*`. Para compatibilidad con integraciones previas, se registran alias automáticos `evolution_*`:

| Herramienta Unificada | Alias Retrocompatible | Descripción |
|:---|:---|:---|
| `whatsapp_send_text` | `evolution_send_text` | Enviar texto plano con menciones, link preview o citas. |
| `whatsapp_send_media` | `evolution_send_media` | Enviar imágenes, videos, audios o documentos. |
| `whatsapp_send_location` | `evolution_send_location` | Enviar coordenadas GPS y etiquetas de mapa. |
| `whatsapp_send_contact` | `evolution_send_contact` | Enviar ficha de contacto telefónico. |
| `whatsapp_send_reaction` | `evolution_send_reaction` | Reaccionar con emoji a un mensaje existente. |
| `whatsapp_find_messages` | `evolution_find_messages` | Consultar historial de mensajes de un chat. |
| `whatsapp_find_chats` | `evolution_find_chats` | Listar conversaciones activas. |
| `whatsapp_check_number` | `evolution_check_number` | Verificar si un número está registrado en WhatsApp. |
| `whatsapp_create_group` | `evolution_create_group` | Crear un nuevo grupo con participantes iniciales. |
| `whatsapp_get_group_info` | `evolution_get_group_info` | Consultar participantes y ajustes de un grupo. |
| `whatsapp_update_group_participants` | `evolution_update_group_participants` | Añadir, expulsar o promover miembros en un grupo. |
| `whatsapp_leave_group` | `evolution_leave_group` | Abandonar un grupo de WhatsApp. |

---

## 3. Modo Legacy (stdio)

Si necesitas utilizar el modo clásico de consola de la v1.x:
1. Define la variable de entorno `WHATSAPP_MODE=stdio`.
2. Configura las variables `EVOLUTION_BASE_URL` y `EVOLUTION_API_KEY`.
3. El servidor correrá sobre los flujos de entrada/salida estándar sin abrir puertos de red.
