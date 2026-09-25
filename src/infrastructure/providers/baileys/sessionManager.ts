import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import { Boom } from '@hapi/boom';

export type SessionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

export interface SessionInstance {
  channelId: string;
  socket: WASocket | null;
  status: SessionStatus;
  qrRaw: string | null;
  qrDataUrl: string | null;
  userPhone: string | null;
  lastError?: string;
  reconnectAttempts: number;
}

export class BaileysSessionManager {
  private static instance: BaileysSessionManager;
  private readonly sessions = new Map<string, SessionInstance>();
  private readonly baseSessionPath: string;
  private readonly logger = pino({ level: 'warn' });

  constructor(baseSessionPath: string = './data/sessions') {
    this.baseSessionPath = path.resolve(baseSessionPath);
    if (!fs.existsSync(this.baseSessionPath)) {
      fs.mkdirSync(this.baseSessionPath, { recursive: true });
    }
  }

  public static getInstance(baseSessionPath?: string): BaileysSessionManager {
    if (!BaileysSessionManager.instance) {
      BaileysSessionManager.instance = new BaileysSessionManager(baseSessionPath);
    }
    return BaileysSessionManager.instance;
  }

  public getSession(channelId: string): SessionInstance | undefined {
    return this.sessions.get(channelId);
  }

  public getSocket(channelId: string): WASocket | null {
    return this.sessions.get(channelId)?.socket || null;
  }

  public getStatus(channelId: string): {
    status: SessionStatus;
    qrDataUrl: string | null;
    userPhone: string | null;
    isConnected: boolean;
  } {
    const session = this.sessions.get(channelId);
    if (!session) {
      return {
        status: 'disconnected',
        qrDataUrl: null,
        userPhone: null,
        isConnected: false,
      };
    }
    return {
      status: session.status,
      qrDataUrl: session.qrDataUrl,
      userPhone: session.userPhone,
      isConnected: session.status === 'connected',
    };
  }

  public async startSession(channelId: string): Promise<SessionInstance> {
    const existing = this.sessions.get(channelId);
    if (existing && (existing.status === 'connected' || existing.status === 'connecting' || existing.status === 'qr_ready')) {
      return existing;
    }

    const sessionDir = path.join(this.baseSessionPath, channelId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const sessionState: SessionInstance = {
      channelId,
      socket: null,
      status: 'connecting',
      qrRaw: null,
      qrDataUrl: null,
      userPhone: null,
      reconnectAttempts: 0,
    };
    this.sessions.set(channelId, sessionState);

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      logger: this.logger,
      printQRInTerminal: false,
      browser: ['MCP WhatsApp Gateway', 'Chrome', '1.0.0'],
    });

    sessionState.socket = socket;

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        sessionState.qrRaw = qr;
        try {
          sessionState.qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          sessionState.status = 'qr_ready';
        } catch (err) {
          this.logger.error({ err }, 'Error generating QR Code data URL');
        }
      }

      if (connection === 'open') {
        sessionState.status = 'connected';
        sessionState.qrRaw = null;
        sessionState.qrDataUrl = null;
        sessionState.reconnectAttempts = 0;

        const userJid = socket.user?.id || '';
        const phone = userJid.split(':')[0] || userJid.split('@')[0];
        sessionState.userPhone = phone;
        this.logger.info(`[Baileys] Channel ${channelId} connected as ${phone}`);
      }

      if (connection === 'close') {
        const boomError = lastDisconnect?.error as Boom | undefined;
        const statusCode = boomError?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        sessionState.lastError = boomError?.message;

        if (statusCode === DisconnectReason.loggedOut) {
          sessionState.status = 'disconnected';
          sessionState.socket = null;
          sessionState.userPhone = null;
          // Wipe stored session credentials
          try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          } catch (e) {
            this.logger.error({ err: e }, 'Failed to remove session directory on logout');
          }
          this.logger.warn(`[Baileys] Channel ${channelId} logged out from phone.`);
        } else if (shouldReconnect) {
          sessionState.status = 'connecting';
          const delay = Math.min(1000 * Math.pow(2, sessionState.reconnectAttempts), 15000);
          sessionState.reconnectAttempts++;
          this.logger.info(`[Baileys] Channel ${channelId} reconnecting in ${delay}ms...`);
          setTimeout(() => {
            this.startSession(channelId).catch((err) => {
              this.logger.error({ err }, `Failed to reconnect channel ${channelId}`);
            });
          }, delay);
        } else {
          sessionState.status = 'disconnected';
          sessionState.socket = null;
        }
      }
    });

    return sessionState;
  }

  public async logoutSession(channelId: string): Promise<void> {
    const session = this.sessions.get(channelId);
    if (session?.socket) {
      try {
        await session.socket.logout();
      } catch {
        // Socket might already be closed
      }
    }

    const sessionDir = path.join(this.baseSessionPath, channelId);
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // Ignore if dir doesn't exist
    }

    this.sessions.delete(channelId);
  }

  /**
   * Rehydrates all active sessions found in storage on server startup.
   */
  public async hydrateExistingSessions(activeChannelIds: string[]): Promise<void> {
    if (!fs.existsSync(this.baseSessionPath)) return;

    const dirs = fs.readdirSync(this.baseSessionPath, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory() && activeChannelIds.includes(dir.name)) {
        const credsFile = path.join(this.baseSessionPath, dir.name, 'creds.json');
        if (fs.existsSync(credsFile)) {
          this.logger.info(`[Baileys] Restoring session for channel: ${dir.name}`);
          this.startSession(dir.name).catch((err) => {
            this.logger.error({ err }, `Failed to restore session for ${dir.name}`);
          });
        }
      }
    }
  }
}
