# Referencia de la REST API Directa de Mensajería

Además de actuar como servidor para agentes IA mediante el protocolo MCP (`/mcp`), `mcp-whatsapp` expone una **REST API tradicional** en `/api` para enviar y consultar mensajes directamente desde cualquier backend, script, webhook o aplicación cliente con peticiones HTTP estándar.
 
> [!TIP]
> **Explorador Interactivo Swagger UI:** Puedes probar todas las rutas interactivamente en tu navegador accediendo a [`http://localhost:3000/docs`](http://localhost:3000/docs). El archivo de esquema OpenAPI 3.1 en formato JSON está disponible en [`http://localhost:3000/openapi.json`](http://localhost:3000/openapi.json).

---

## 1. Autenticación

Todas las peticiones a `/api/*` (excepto en modo desarrollo si `MCP_API_TOKEN` está vacío) requieren autenticación.  
Puedes utilizar cualquiera de las dos cabeceras:

- **Bearer Token:** `Authorization: Bearer tu-token-mcp`
- **API Key:** `x-api-key: tu-token-mcp`

---

## 2. Enrutamiento Multicanal y Línea por Defecto

En todos los endpoints de envío y consulta:
- **Si especificas `"channel": "nombre"`:** La acción se ejecuta a través del proveedor configurado para esa línea telefónica específica (ej. `trabajo`, `personal`, `ventas`).
- **Si omites el parámetro `"channel"`:** El sistema resuelve y utiliza automáticamente la línea marcada como **Default** en la base de datos.

---

## 3. Endpoints de Mensajería

### 3.1 Enviar Mensaje de Texto
- **Método:** `POST`
- **Ruta:** `/api/messages/text`
- **Cuerpo (JSON):**
  ```json
  {
    "recipient": "18095551234",
    "text": "Hola, este es un mensaje desde la REST API",
    "channel": "ventas",
    "delay": 1200,
    "linkPreview": true
  }
  ```
- **Ejemplo con curl:**
  ```bash
  curl -X POST http://localhost:3000/api/messages/text \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer tu-token-mcp" \
    -d '{
      "recipient": "18095551234",
      "text": "Hola mundo!"
    }'
  ```
- **Respuesta (200 OK):**
  ```json
  {
    "success": true,
    "channel": "ventas",
    "result": {
      "success": true,
      "messageId": "3EB0ABC123456789",
      "timestamp": 1774487200000
    }
  }
  ```

---

### 3.2 Enviar Archivo Multimedia
- **Método:** `POST`
- **Ruta:** `/api/messages/media`
- **Cuerpo (JSON):**
  ```json
  {
    "recipient": "18095551234",
    "mediaType": "image",
    "mediaUrl": "https://ejemplo.com/comprobante.png",
    "caption": "Adjunto tu comprobante de pago",
    "channel": "soporte"
  }
  ```
  *(Nota: `mediaType` acepta `image`, `video`, `audio`, `document`, `sticker`. Puedes enviar `mediaUrl` o `mediaBase64`).*

---

### 3.3 Enviar Coordenadas GPS
- **Método:** `POST`
- **Ruta:** `/api/messages/location`
- **Cuerpo (JSON):**
  ```json
  {
    "recipient": "18095551234",
    "latitude": 18.4861,
    "longitude": -69.9312,
    "name": "Oficina Central",
    "address": "Av. Principal 123"
  }
  ```

---

### 3.4 Enviar Tarjeta de Contacto
- **Método:** `POST`
- **Ruta:** `/api/messages/contact`
- **Cuerpo (JSON):**
  ```json
  {
    "recipient": "18095551234",
    "contactName": "Juan Pérez",
    "contactPhone": "+18095559999"
  }
  ```

---

### 3.5 Reaccionar a un Mensaje con Emoji
- **Método:** `POST`
- **Ruta:** `/api/messages/reaction`
- **Cuerpo (JSON):**
  ```json
  {
    "recipient": "18095551234",
    "messageId": "3EB0ABC123456789",
    "reaction": "👍"
  }
  ```

---

### 3.6 Consultar Historial de Mensajes
- **Método:** `GET`
- **Ruta:** `/api/messages?chatId=18095551234@s.whatsapp.net&count=20`
- **Respuesta (200 OK):**
  ```json
  {
    "channel": "trabajo",
    "count": 2,
    "messages": [
      {
        "id": "MSG001",
        "from": "18095551234@s.whatsapp.net",
        "to": "me",
        "fromMe": false,
        "timestamp": 1774487000000,
        "type": "text",
        "text": "Hola, ¿cómo estás?"
      }
    ]
  }
  ```

---

## 4. Endpoints de Chats y Verificación

### 4.1 Listar Chats Recientes
- **Método:** `GET`
- **Ruta:** `/api/chats?channel=ventas`
- **Respuesta:**
  ```json
  {
    "channel": "ventas",
    "count": 1,
    "chats": [
      {
        "id": "18095551234@s.whatsapp.net",
        "name": "Cliente VIP",
        "isGroup": false,
        "unreadCount": 0
      }
    ]
  }
  ```

### 4.2 Verificar si un Número está en WhatsApp
- **Método:** `GET`
- **Ruta:** `/api/chats/check-number/18095551234`
- **Respuesta:**
  ```json
  {
    "channel": "trabajo",
    "result": {
      "exists": true,
      "jid": "18095551234@s.whatsapp.net",
      "number": "18095551234"
    }
  }
  ```

---

## 5. Endpoints de Grupos

- **Crear Grupo:** `POST /api/groups` con `{ "subject": "Mi Grupo", "participants": ["18095551234", "18095555678"] }`
- **Obtener Información de Grupo:** `GET /api/groups/:jid`
- **Modificar Participantes:** `POST /api/groups/:jid/participants` con `{ "action": "add|remove|promote|demote", "participants": ["..."] }`
- **Abandonar Grupo:** `DELETE /api/groups/:jid`
