#!/usr/bin/env node
/**
 * Minimalist CLI Explorer for MCP WhatsApp Gateway.
 * Explore chats, message history, live tailing and channel stats from console.
 */

import { loadGatewayConfig } from './config.js';
import { getDatabase, closeDatabase } from './infrastructure/database/connection.js';
import { runMigrations } from './infrastructure/database/migrations.js';
import { SqliteChannelRepository } from './infrastructure/database/repositories/channelRepo.js';
import { SqliteProviderRepository } from './infrastructure/database/repositories/providerRepo.js';
import { SqliteMessageRepository } from './infrastructure/database/repositories/messageRepo.js';
import { BaileysSessionManager } from './infrastructure/providers/baileys/sessionManager.js';

// ANSI Colors for clean terminal UI (Native without dependencies)
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${day}/${month} ${hours}:${minutes}:${seconds}`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

async function showStats(): Promise<void> {
  const config = loadGatewayConfig();
  const db = getDatabase(config.sqlitePath);
  runMigrations(db);

  const providerRepo = new SqliteProviderRepository(db, config.encryptionKey);
  const channelRepo = new SqliteChannelRepository(db);

  const providers = await providerRepo.findAll();
  const channels = await channelRepo.findAll();

  const chatCountRow = db.prepare('SELECT COUNT(*) as count FROM chats').get() as { count: number };
  const msgCountRow = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };

  console.log(`\n${colors.bold}${colors.cyan}=== ESTADO DEL GATEWAY WHATSAPP ===${colors.reset}`);
  console.log(`  ${colors.bold}Base de Datos:${colors.reset}   ${config.sqlitePath} (WAL)`);
  console.log(`  ${colors.bold}Proveedores:${colors.reset}     ${providers.length} registrado(s)`);
  console.log(`  ${colors.bold}Líneas/Canales:${colors.reset}  ${channels.length} activo(s)`);
  console.log(`  ${colors.bold}Conversaciones:${colors.reset}  ${chatCountRow.count} chats almacenados`);
  console.log(`  ${colors.bold}Mensajes Totales:${colors.reset}${msgCountRow.count} mensajes registrados`);

  const sessionManager = BaileysSessionManager.getInstance();
  console.log(`\n${colors.bold}Líneas Configuradas:${colors.reset}`);
  for (const ch of channels) {
    const status = sessionManager.getStatus(ch.id);
    const badge = status.isConnected
      ? `${colors.green}● Conectado${colors.reset}`
      : `${colors.red}○ Desconectado (${status.status})${colors.reset}`;
    console.log(
      `  - [${ch.name}] ${ch.phoneNumber || 'Sin número'} | Proveedor: ${ch.providerId} | ${badge} ${ch.isDefault ? colors.yellow + '(Predeterminado)' + colors.reset : ''}`
    );
  }
  console.log('');
}

async function listChats(targetChannel?: string): Promise<void> {
  const config = loadGatewayConfig();
  const db = getDatabase(config.sqlitePath);
  runMigrations(db);

  const channelRepo = new SqliteChannelRepository(db);
  const messageRepo = new SqliteMessageRepository(db);
  const channels = await channelRepo.findAll();

  const selectedChannels = targetChannel
    ? channels.filter((c) => c.name.toLowerCase() === targetChannel.toLowerCase() || c.id === targetChannel)
    : channels;

  if (selectedChannels.length === 0) {
    console.log(`${colors.red}No se encontraron canales que coincidan con '${targetChannel}'.${colors.reset}`);
    return;
  }

  for (const ch of selectedChannels) {
    console.log(`\n${colors.bold}${colors.cyan}--- Conversaciones en Línea: ${ch.name} (${ch.phoneNumber || ch.id}) ---${colors.reset}`);
    const chats = messageRepo.getChats(ch.id, 50);

    if (chats.length === 0) {
      console.log(`  ${colors.gray}(No hay conversaciones registradas en esta línea aún)${colors.reset}`);
      continue;
    }

    console.log(
      `${colors.gray}┌──────────────────────┬────────────────────────┬──────────────────────────────────────────┬──────────────────┐${colors.reset}`
    );
    console.log(
      `${colors.gray}│${colors.bold} Identificador / JID   ${colors.gray}│${colors.bold} Nombre / Tipo          ${colors.gray}│${colors.bold} Último Mensaje                            ${colors.gray}│${colors.bold} Fecha / Hora     ${colors.gray}│${colors.reset}`
    );
    console.log(
      `${colors.gray}├──────────────────────┼────────────────────────┼──────────────────────────────────────────┼──────────────────┤${colors.reset}`
    );

    for (const chat of chats) {
      const jid = truncate(chat.id.replace('@s.whatsapp.net', ''), 20).padEnd(20);
      const name = truncate(chat.name || (chat.isGroup ? '👥 Grupo' : '👤 Directo'), 22).padEnd(22);
      const lastMsg = truncate(chat.lastMessage?.text || '(vacío)', 40).padEnd(40);
      const dateStr = chat.timestamp ? formatTimestamp(chat.timestamp).padEnd(16) : 'N/A             ';

      console.log(`${colors.gray}│${colors.reset} ${colors.green}${jid}${colors.reset} ${colors.gray}│${colors.reset} ${name} ${colors.gray}│${colors.reset} ${lastMsg} ${colors.gray}│${colors.reset} ${colors.gray}${dateStr}${colors.reset} ${colors.gray}│${colors.reset}`);
    }

    console.log(
      `${colors.gray}└──────────────────────┴────────────────────────┴──────────────────────────────────────────┴──────────────────┘${colors.reset}`
    );
    console.log(`  ${colors.dim}Total: ${chats.length} conversación(es) activa(s)${colors.reset}`);
  }
  console.log('');
}

async function showMessages(targetRecipient: string, limit: number = 25, targetChannel?: string): Promise<void> {
  const config = loadGatewayConfig();
  const db = getDatabase(config.sqlitePath);
  runMigrations(db);

  const channelRepo = new SqliteChannelRepository(db);
  const messageRepo = new SqliteMessageRepository(db);
  const channels = await channelRepo.findAll();

  const channel = targetChannel
    ? channels.find((c) => c.name.toLowerCase() === targetChannel.toLowerCase() || c.id === targetChannel)
    : channels.find((c) => c.isDefault) || channels[0];

  if (!channel) {
    console.log(`${colors.red}No hay canales registrados en el gateway.${colors.reset}`);
    return;
  }

  console.log(`\n${colors.bold}${colors.cyan}=== HISTORIAL DE CHAT: ${targetRecipient} (Línea: ${channel.name}) ===${colors.reset}`);

  const messages = messageRepo.getMessages(channel.id, targetRecipient, limit);

  if (messages.length === 0) {
    console.log(`\n  ${colors.yellow}No se encontraron mensajes registrados para '${targetRecipient}' en la línea '${channel.name}'.${colors.reset}\n`);
    return;
  }

  // Display chronologically (oldest to newest)
  const sorted = [...messages].reverse();

  console.log(`${colors.gray}--------------------------------------------------------------------------------${colors.reset}`);
  for (const m of sorted) {
    const time = formatTimestamp(m.timestamp);
    const typeTag = m.type !== 'text' ? ` ${colors.magenta}[${m.type.toUpperCase()}]${colors.reset}` : '';

    if (m.fromMe) {
      console.log(
        `  ${colors.gray}[${time}]${colors.reset} ${colors.blue}${colors.bold}Yo (Saliente):${colors.reset}${typeTag} ${m.text || ''}`
      );
    } else {
      const sender = m.from.replace('@s.whatsapp.net', '');
      console.log(
        `  ${colors.gray}[${time}]${colors.reset} ${colors.green}${colors.bold}${sender} (Entrante):${colors.reset}${typeTag} ${m.text || ''}`
      );
    }
  }
  console.log(`${colors.gray}--------------------------------------------------------------------------------${colors.reset}`);
  console.log(`  ${colors.dim}Mostrando ${messages.length} mensaje(s)${colors.reset}\n`);
}

async function tailMessages(targetRecipient?: string, targetChannel?: string): Promise<void> {
  const config = loadGatewayConfig();
  const db = getDatabase(config.sqlitePath);
  runMigrations(db);

  const channelRepo = new SqliteChannelRepository(db);
  const messageRepo = new SqliteMessageRepository(db);
  const channels = await channelRepo.findAll();

  const channel = targetChannel
    ? channels.find((c) => c.name.toLowerCase() === targetChannel.toLowerCase() || c.id === targetChannel)
    : channels.find((c) => c.isDefault) || channels[0];

  if (!channel) {
    console.log(`${colors.red}No hay canales registrados en el gateway.${colors.reset}`);
    return;
  }

  console.log(`\n${colors.bold}${colors.green}📡 MODO STREAMING EN VIVO (TAIL)${colors.reset}`);
  console.log(`  Línea:    ${colors.cyan}${channel.name}${colors.reset}`);
  console.log(`  Filtro:   ${targetRecipient ? colors.yellow + targetRecipient + colors.reset : 'Todos los chats'}`);
  console.log(`  ${colors.dim}(Presiona Ctrl+C para salir)${colors.reset}\n`);

  let lastTimestamp = Date.now() - 60000; // start 1 minute ago
  const seenIds = new Set<string>();

  // Fetch recent once
  const initial = messageRepo.getMessages(channel.id, targetRecipient, 10);
  for (const m of initial.reverse()) {
    seenIds.add(m.id);
    const time = formatTimestamp(m.timestamp);
    const sender = m.fromMe ? `${colors.blue}Yo${colors.reset}` : `${colors.green}${m.from.replace('@s.whatsapp.net', '')}${colors.reset}`;
    console.log(`  ${colors.gray}[${time}]${colors.reset} ${sender}: ${m.text || `[${m.type}]`}`);
    if (m.timestamp > lastTimestamp) lastTimestamp = m.timestamp;
  }

  console.log(`\n${colors.dim}--- Esperando nuevos mensajes en tiempo real... ---${colors.reset}\n`);

  setInterval(() => {
    const recent = messageRepo.getMessages(channel.id, targetRecipient, 10);
    for (const m of recent.reverse()) {
      if (!seenIds.has(m.id) && m.timestamp >= lastTimestamp) {
        seenIds.add(m.id);
        lastTimestamp = Math.max(lastTimestamp, m.timestamp);
        const time = formatTimestamp(m.timestamp);
        const sender = m.fromMe
          ? `${colors.blue}${colors.bold}Yo (Saliente)${colors.reset}`
          : `${colors.green}${colors.bold}${m.from.replace('@s.whatsapp.net', '')} (Entrante)${colors.reset}`;
        console.log(`  ${colors.yellow}🔔 [NUEVO ${time}]${colors.reset} ${sender}: ${m.text || `[${m.type}]`}`);
      }
    }
  }, 1000);
}

function printHelp(): void {
  console.log(`
${colors.bold}${colors.cyan}MCP WhatsApp Gateway - Explorador de Consola (CLI)${colors.reset}

${colors.bold}USO:${colors.reset}
  npm run cli -- <comando> [argumentos]
  node dist/cli.js <comando> [argumentos]

${colors.bold}COMANDOS DISPONIBLES:${colors.reset}
  ${colors.green}chats${colors.reset} [linea]                 Lista las conversaciones recientes y su último mensaje.
  ${colors.green}history${colors.reset} <numero> [limite]     Muestra el historial de mensajes de un contacto en formato chat.
  ${colors.green}tail${colors.reset} [numero]                 Monitorea en tiempo real los mensajes entrantes y salientes.
  ${colors.green}stats${colors.reset}                         Muestra el estado de la base de datos, líneas y sesiones.
  ${colors.green}help${colors.reset}                          Muestra esta ayuda de comandos.

${colors.bold}EJEMPLOS RÁPIDOS:${colors.reset}
  ${colors.gray}# Ver todas las conversaciones activas:${colors.reset}
  npm run cli -- chats

  ${colors.gray}# Ver los últimos 30 mensajes de un cliente:${colors.reset}
  npm run cli -- history 18292571290 30

  ${colors.gray}# Escuchar en vivo los mensajes que llegan:${colors.reset}
  npm run cli -- tail 18292571290

  ${colors.gray}# Ver estadísticas generales:${colors.reset}
  npm run cli -- stats
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase() || 'help';

  try {
    switch (command) {
      case 'chats':
      case 'list':
        await listChats(args[1]);
        break;

      case 'history':
      case 'messages':
      case 'msg':
        if (!args[1]) {
          console.log(`${colors.red}Error: Debes especificar el número o JID a consultar.${colors.reset}`);
          console.log(`Ejemplo: npm run cli -- history 18292571290`);
          process.exit(1);
        }
        await showMessages(args[1], args[2] ? parseInt(args[2], 10) : 25, args[3]);
        break;

      case 'tail':
      case 'live':
      case 'watch':
        await tailMessages(args[1], args[2]);
        break;

      case 'stats':
      case 'status':
        await showStats();
        break;

      case 'help':
      case '--help':
      case '-h':
      default:
        printHelp();
        break;
    }
  } finally {
    if (command !== 'tail' && command !== 'live' && command !== 'watch') {
      closeDatabase();
    }
  }
}

main().catch((err) => {
  console.error(`${colors.red}Error en CLI:${colors.reset}`, err instanceof Error ? err.message : err);
  process.exit(1);
});
