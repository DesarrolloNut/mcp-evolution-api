# MCP WhatsApp Gateway

Gateway multicanal de WhatsApp para agentes de Inteligencia Artificial (Claude Desktop, Cursor, Claude Code) basado en el protocolo [MCP](https://modelcontextprotocol.io) (Model Context Protocol).

Permite conectar agentes IA a múltiples proveedores de WhatsApp (**Evolution API v2**, **Meta Cloud API**, **Twilio**) y gestionar dinámicamente múltiples líneas telefónicas (**canales**) desde un panel de administración web, con almacenamiento persistente local en disco.

---

## Características Principales

- **Abstracción Agnóstica de Proveedores:** Conecta tu infraestructura a Evolution API v2, Meta Cloud API o Twilio bajo una interfaz unificada.
- **Gestión Multicanal:** Configura múltiples números o líneas telefónicas (ej. *trabajo*, *personal*, *soporte*, *ventas*) y designa una **línea por defecto** global.
- **Panel Web de Administración (`/panel`):** Interfaz SPA moderna (tema oscuro inspirado en WhatsApp) para registrar proveedores, añadir líneas, probar conectividad y monitorear el estado del servicio en tiempo real.
- **Servidor MCP HTTP/SSE:** Transporte moderno `Streamable HTTP / SSE` con autenticación mediante Bearer token (`MCP_API_TOKEN`).
- **Persistencia Montada en Disco (SQLite):** Configuración resguardada en `./data/mcp-whatsapp.db` con modo WAL (Write-Ahead Logging), garantizando **cero pérdida de datos** tras reinicios o despliegues Docker.
- **Copias de Seguridad en Caliente:** Script integrado `npm run db:backup` para generar snapshots sin detener el servicio.
- **Seguridad Robusta:** Aislamiento activo contra Prompt Injection (`<untrusted_whatsapp_data>`), cifrado AES-256-GCM para API keys en reposo y mitigación de SSRF.
- **Retrocompatibilidad Total:** Mantiene compatibilidad con clientes existentes mediante alias automáticos `evolution_*` y modo legacy `stdio`.

---

## Inicio Rápido

### Opción A — Docker Compose (Recomendada para Producción)

El repositorio incluye un archivo [docker-compose.yml](docker-compose.yml) listo para producción con volumen montado para la base de datos:

```bash
# 1. Clona el repositorio
git clone https://github.com/DesarrolloNut/mcp-whatsapp.git
cd mcp-whatsapp

# 2. Configura las variables en tu entorno o en un archivo .env
cp .env.example .env

# 3. Inicia el gateway
docker compose up -d
```

El servicio estará disponible en:
- **Panel de Administración:** `http://localhost:3000/panel` (Usuario: `admin`, Clave: `admin` por defecto)
- **Endpoint MCP para Agentes IA:** `http://localhost:3000/mcp`

---

### Opción B — Docker CLI Directo

```bash
docker run -d \
  --name mcp-whatsapp \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e MCP_API_TOKEN=tu-token-agentes-secreto \
  -e ADMIN_PASSWORD=tu-clave-admin-segura \
  ghcr.io/desarrollonut/mcp-whatsapp:latest
```

> ⚠️ **Importante sobre el volumen persistente:**  
> El flag `-v $(pwd)/data:/app/data` es indispensable. La imagen de Docker corre bajo el usuario no-privilegiado `node` y escribe la base de datos en `/app/data/mcp-whatsapp.db`. Montar este volumen evita perder la configuración al reiniciar el contenedor.

---

### Opción C — Ejecución Local (Node.js 18+)

```bash
# 1. Instalar dependencias y compilar
npm install
npm run build

# 2. Iniciar el servidor
npm start
```

---

## Configuración (.env)

| Variable | Por Defecto | Descripción |
|:---|:---:|:---|
| `WHATSAPP_MODE` | `server` | `server` para servidor HTTP/SSE con panel web; `stdio` para modo CLI clásico. |
| `HTTP_PORT` | `3000` | Puerto HTTP del gateway. |
| `HTTP_HOST` | `0.0.0.0` | Host de enlace de red. |
| `MCP_API_TOKEN` | *(vacío)* | Token Bearer requerido por los clientes MCP (`Authorization: Bearer <token>`). Vacío deshabilita auth en desarrollo. |
| `ADMIN_USERNAME` | `admin` | Usuario del panel de administración web. |
| `ADMIN_PASSWORD` | `admin` | Contraseña del panel de administración web. |
| `ADMIN_JWT_SECRET` | *(auto)* | Clave secreta HMAC-SHA256 para firmar tokens JWT de sesión. |
| `ENCRYPTION_KEY` | *(auto)* | Clave de 32 bytes para cifrar las API keys de proveedores en SQLite (AES-256-GCM). |
| `SQLITE_PATH` | `./data/mcp-whatsapp.db` | Ruta del archivo de base de datos SQLite montado en disco. |

---

## Conexión de Clientes MCP

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "whatsapp": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer tu-token-agentes-secreto"
      }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

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
        "Authorization": "Bearer tu-token-agentes-secreto"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add whatsapp http://localhost:3000/mcp --header "Authorization: Bearer tu-token-agentes-secreto"
```

---

## Herramientas Unificadas MCP

Los agentes pueden interactuar con WhatsApp utilizando las siguientes herramientas. Si se omite el argumento `channel`, la llamada se despacha automáticamente a través de la **línea predeterminada**:

| Herramienta Unificada | Alias Retrocompatible | Descripción |
|:---|:---|:---|
| `whatsapp_send_text` | `evolution_send_text` | Enviar mensaje de texto (con menciones, links o cita). |
| `whatsapp_send_media` | `evolution_send_media` | Enviar imágenes, videos, audios o documentos (vía URL o base64). |
| `whatsapp_send_location` | `evolution_send_location` | Enviar coordenadas GPS y nombre de ubicación. |
| `whatsapp_send_contact` | `evolution_send_contact` | Enviar tarjeta de contacto. |
| `whatsapp_send_reaction` | `evolution_send_reaction` | Reaccionar a un mensaje existente con un emoji. |
| `whatsapp_find_messages` | `evolution_find_messages` | Consultar historial de mensajes de un chat. |
| `whatsapp_find_chats` | `evolution_find_chats` | Listar conversaciones activas. |
| `whatsapp_check_number` | `evolution_check_number` | Comprobar si un número está registrado en WhatsApp. |
| `whatsapp_create_group` | `evolution_create_group` | Crear un nuevo grupo con participantes. |
| `whatsapp_get_group_info` | `evolution_get_group_info` | Obtener participantes y metadata de un grupo. |
| `whatsapp_update_group_participants` | `evolution_update_group_participants` | Añadir, eliminar, promover o degradar miembros en un grupo. |
| `whatsapp_leave_group` | `evolution_leave_group` | Abandonar un grupo de WhatsApp. |

---

## Copias de Seguridad (Backups)

Para realizar una instantánea de la base de datos en caliente sin detener el servidor:

```bash
npm run db:backup
```

Los respaldos se almacenan automáticamente con fecha y hora en `data/backups/`.

---

## Documentación Técnica Adicional

- [docs/database-persistence.md](docs/database-persistence.md): Arquitectura de almacenamiento en disco, modo WAL y volúmenes Docker.
- [docs/providers-and-channels.md](docs/providers-and-channels.md): Modelo conceptual de proveedores, canales/líneas y resolución por defecto.
- [docs/admin-panel-guide.md](docs/admin-panel-guide.md): Guía de uso del panel web SPA y credenciales de acceso.
- [docs/mcp-connection-guide.md](docs/mcp-connection-guide.md): Configuración detallada para cada cliente MCP.

---

## Licencia

MIT © DesarrolloNut
