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
- **Registrar Proveedor:** Permite configurar un nuevo backend WhatsApp (Evolution API v2, Meta Cloud API o Twilio).
- **Probar Conectividad:** Botón `⚡ Probar` que ejecuta una verificación en tiempo real de las credenciales y URL del proveedor.
- **Desactivar:** Permite deshabilitar temporalmente un proveedor sin eliminar su historial.

### 2.3 Gestión de Canales / Líneas Telefónicas (Channels)
- **Registrar Línea:** Asocia un número telefónico o instancia al proveedor configurado.
- **Definir Línea por Defecto:** Al presionar `Hacer Default`, ese canal se convierte en la línea predeterminada global. Los agentes IA que envíen mensajes sin especificar el parámetro `channel` utilizarán automáticamente esta línea.
- **Desactivar Línea:** Da de baja la línea del enrutador de mensajes.

---

## 3. Arquitectura de Sesión
- La autenticación utiliza un token JWT firmado mediante HMAC-SHA256 (`node:crypto`) emitido por `/api/admin/auth/login`.
- El token se conserva en el almacenamiento local del navegador (`localStorage`) durante 7 días.
- Todas las operaciones de creación, edición o borrado en la base de datos SQLite se ejecutan bajo transacciones seguras con modo WAL.
