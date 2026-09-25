# Guía del Panel de Administración Web

`mcp-whatsapp` v2.0 incorpora un panel web liviano y moderno (SPA sin frameworks) servido directamente por la aplicación en `/panel`.

---

## 1. Acceso al Panel

- **URL Local:** `http://localhost:3000/panel` (o el puerto configurado en `HTTP_PORT`).
- **Credenciales por Defecto:**
  - **Usuario:** `admin`
  - **Contraseña:** `admin`

> [!WARNING]  
> **Seguridad en Producción:**  
> Las credenciales predeterminadas (`admin`/`admin`) son exclusivamente para desarrollo inicial. En entornos productivos debes definir en las variables de entorno:
> ```bash
> ADMIN_USERNAME=tu_usuario_personalizado
> ADMIN_PASSWORD=tu_clave_de_alta_entropia
> ```
> Si el servidor arranca con las credenciales por defecto, emitirá una advertencia explícita en `stderr`.

---

## 2. Funcionalidades del Panel

### 2.1 Panel General (Dashboard)
- Muestra el total de proveedores conectados.
- Muestra el número de líneas/canales activos y la línea actualmente designada como **predeterminada** (`Default`).
- Muestra el tiempo de actividad del servicio (uptime).

### 2.2 Gestión de Proveedores (Providers)
- **Registrar Proveedor:** Permite configurar un nuevo backend WhatsApp:
  - **WhatsApp Web Directo (Baileys / Embebido):** Conexión nativa sin necesidad de servidores externos. No requiere URL ni API Key externa.
  - **Evolution API v2:** Conexión con servidor Evolution API autohospedado.
  - **Meta Cloud API / Twilio:** Integraciones oficiales de Meta y Twilio.
- **Probar Conectividad:** Botón `⚡ Probar` que ejecuta una verificación en tiempo real de las credenciales y estado del proveedor.
- **Desactivar:** Permite deshabilitar temporalmente un proveedor sin eliminar su historial.

### 2.3 Gestión de Canales / Líneas Telefónicas (Channels)
- **Registrar Línea:** Asocia un número telefónico o instancia al proveedor configurado.
- **Vincular WhatsApp Web (Código QR):** Para canales asociados al proveedor `baileys`, el panel muestra el botón `📱 Vincular QR`. Al hacer clic:
  1. Se inicializa el socket directo de Baileys.
  2. Se renderiza un código QR de alta resolución en tiempo real.
  3. Escaneas el código desde WhatsApp en tu teléfono (*Dispositivos vinculados > Vincular un dispositivo*).
  4. La sesión se autentica, almacena las credenciales en `./data/sessions/<channel_id>/` de forma permanente y detecta el número telefónico automáticamente.
- **Definir Línea por Defecto:** Al presionar `Hacer Default`, ese canal se convierte en la línea predeterminada global. Los agentes IA que envíen mensajes sin especificar el parámetro `channel` utilizarán automáticamente esta línea.
- **Desactivar Línea:** Da de baja la línea del enrutador de mensajes.

---

## 3. Endpoints de Sesión y Emparejamiento (Baileys)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/admin/channels/:id/session/start` | Inicia el socket Baileys para el canal si no está corriendo. |
| `GET` | `/api/admin/channels/:id/session/qr` | Obtiene el estado actual de la sesión y el Data URL del código QR (`image/png`). |
| `GET` | `/api/admin/channels/:id/session/status` | Consulta el estado (`idle`, `connecting`, `qr_ready`, `connected`, `disconnected`). |
| `POST` | `/api/admin/channels/:id/session/logout` | Cierra la sesión activa y elimina las credenciales del almacenamiento persistente. |

---

## 4. Arquitectura de Sesión y Persistencia
- La autenticación en el panel web utiliza un token JWT firmado mediante HMAC-SHA256 (`node:crypto`) emitido por `/api/admin/auth/login`.
- El token se conserva en el almacenamiento local del navegador (`localStorage`) durante 7 días.
- Todas las operaciones de creación, edición o borrado en la base de datos SQLite se ejecutan bajo transacciones seguras con modo WAL (`./data/mcp-whatsapp.db`).
- Las credenciales de WhatsApp Web se persisten en `./data/sessions/<channel_id>/creds.json`, sobreviviendo a reinicios del servidor o contenedor Docker.
