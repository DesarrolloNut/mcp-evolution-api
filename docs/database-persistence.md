# Persistencia de Datos y Montaje de Base de Datos (SQLite)

Este documento detalla la estrategia de almacenamiento persistente de `mcp-whatsapp` v2.0 para garantizar que **nunca se pierdan datos** durante reinicios, actualizaciones o migraciones de contenedores.

---

## 1. Por qué la persistencia debe estar montada

En entornos con contenedores Docker, Kubernetes o VPS:
- El sistema de archivos interno del contenedor es **efímero**.
- Si la base de datos SQLite se crea en el directorio raíz del contenedor sin un volumen montado, **cualquier reinicio, recreación de contenedor (`docker-compose down && up`) o actualización de imagen destruirá permanentemente**:
  - Los proveedores registrados (Evolution API, Meta, Twilio) y sus credenciales cifradas.
  - Los canales configurados y la asignación del canal por defecto.
  - La auditoría histórica de operaciones.

---

## 2. Arquitectura de Almacenamiento

- **Ruta de base de datos:** `./data/mcp-whatsapp.db` (configurable vía `SQLITE_PATH`).
- **Directorio de credenciales de WhatsApp Web (Baileys):** `./data/sessions/<channel_id>/` (almacena `creds.json` y llaves criptográficas de emparejamiento).
- **Directorio de respaldos:** `./data/backups/`.
- **Motor:** SQLite a través de `better-sqlite3`.
- **Modo WAL (Write-Ahead Logging):**
  - Activo con `PRAGMA journal_mode = WAL;`.
  - Permite lecturas simultáneas mientras se realizan escrituras sin bloqueos.
  - Asegura que las transacciones se sincronicen de manera confiable con `PRAGMA synchronous = NORMAL;`.
  - Genera archivos temporales asociados: `mcp-whatsapp.db-wal` y `mcp-whatsapp.db-shm` en el mismo directorio montado.

---

## 3. Montaje en Docker

### 3.1 Permisos del Contenedor (`USER node`)
El contenedor se ejecuta bajo el usuario no privilegiado `node` (UID 1000). Para evitar errores de permisos (`EACCES` o `SQLITE_CANTOPEN`), el `Dockerfile` asegura la propiedad del directorio:
```dockerfile
RUN mkdir -p /app/data /app/data/sessions && chown -R node:node /app/data
VOLUME ["/app/data"]
```

### 3.2 Ejecución con Docker CLI
Al iniciar el contenedor, se debe montar un volumen del host apuntando a `/app/data`:
```bash
docker run -d \
  --name mcp-whatsapp \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e MCP_API_TOKEN=mi-token-secreto \
  -e ADMIN_PASSWORD=mi-clave-admin \
  ghcr.io/desarrollonut/mcp-whatsapp:latest
```

### 3.3 Docker Compose
Ejemplo de servicio con volumen persistente:
```yaml
services:
  mcp-whatsapp:
    image: ghcr.io/desarrollonut/mcp-whatsapp:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - WHATSAPP_MODE=server
      - HTTP_PORT=3000
      - SQLITE_PATH=/app/data/mcp-whatsapp.db
      - MCP_API_TOKEN=mi-token-secreto
      - ADMIN_PASSWORD=mi-clave-admin
    restart: unless-stopped
```

---

## 4. Control de Versiones (.gitignore)

La base de datos local, las sesiones de WhatsApp y sus archivos temporales están excluidos de Git:
```gitignore
data/*
!data/.gitkeep
!data/sessions/.gitkeep
*.db
*.db-wal
*.db-shm
*.db-journal
```
Los archivos `.gitkeep` preservan la estructura de carpetas al clonar el repositorio en un nuevo entorno.

---

## 5. Copias de Seguridad (Backups)

Para realizar un respaldo en caliente de la base de datos sin detener el servidor:
```bash
npm run db:backup
```
Los respaldos se generan de manera atómica y se almacenan automáticamente con marca de tiempo en `data/backups/`.
