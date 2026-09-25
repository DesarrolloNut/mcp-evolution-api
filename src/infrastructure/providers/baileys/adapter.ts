import { IWhatsAppProvider, ProviderCapabilities } from '../../../domain/ports/IWhatsAppProvider.js';
import { IGroupProvider } from '../../../domain/ports/IGroupProvider.js';
import { Channel } from '../../../domain/entities/channel.js';
import {
  SendTextParams,
  SendMediaParams,
  SendLocationParams,
  SendContactParams,
  SendReactionParams,
  SendResult,
  DomainMessage,
} from '../../../domain/models/message.js';
import { DomainChat, FindMessagesFilter, CheckNumberResult } from '../../../domain/models/chat.js';
import { GroupInfo, CreateGroupParams } from '../../../domain/models/group.js';
import { BaileysSessionManager } from './sessionManager.js';
import { toCheckNumberResult, toGroupInfo } from './mapper.js';
import { WASocket, AnyMessageContent } from '@whiskeysockets/baileys';

function normalizeJid(recipient: string): string {
  let clean = recipient.replace(/[^0-9@.-]/g, '');
  if (clean.includes('@')) {
    return clean;
  }
  // Auto-prepend '1' if a 10-digit Dominican Republic / NANP number is entered (809, 829, 849)
  if (clean.length === 10 && /^(809|829|849)/.test(clean)) {
    clean = '1' + clean;
  }
  return `${clean}@s.whatsapp.net`;
}

export class BaileysAdapter implements IWhatsAppProvider, IGroupProvider {
  readonly providerType = 'baileys';

  readonly capabilities: ProviderCapabilities = {
    supportsGroups: true,
    supportsMedia: true,
    supportsReactions: true,
    supportsLocation: true,
    supportsContacts: true,
  };

  constructor(private readonly sessionManager: BaileysSessionManager) {}

  private getConnectedSocket(channel: Channel): WASocket {
    const socket = this.sessionManager.getSocket(channel.id);
    const status = this.sessionManager.getStatus(channel.id);

    if (!socket || !status.isConnected) {
      throw new Error(
        `Channel '${channel.name}' (ID: ${channel.id}) is not connected. Status: ${status.status}. ` +
        `Please scan the QR code from the Admin Panel to connect.`
      );
    }
    return socket;
  }

  private async resolveDestinationJid(sock: WASocket, recipient: string): Promise<string> {
    const rawJid = normalizeJid(recipient);
    // If it's a group, broadcast or already formatted special JID, return as is
    if (rawJid.includes('@g.us') || rawJid.includes('@broadcast') || rawJid.includes('@newsletter')) {
      return rawJid;
    }

    let cleanNumber = recipient.replace(/[^0-9]/g, '');
    if (cleanNumber.length === 10 && /^(809|829|849)/.test(cleanNumber)) {
      cleanNumber = '1' + cleanNumber;
    }

    if (cleanNumber.length >= 7) {
      try {
        const results = await sock.onWhatsApp(cleanNumber);
        const checked = results && results.length > 0 ? results[0] : undefined;
        if (checked && checked.exists && checked.jid) {
          return checked.jid;
        }
        if (checked && checked.exists === false) {
          throw new Error(
            `El número +${cleanNumber} no está registrado en WhatsApp. Verifica si el código de país o el número tiene algún error.`
          );
        }
      } catch (err) {
        if ((err as Error).message.includes('no está registrado en WhatsApp')) {
          throw err;
        }
        // Fallback to normalized JID if check timed out
      }
    }

    return rawJid;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: 'Baileys embedded driver ready. Connect channels individually via QR Code.',
    };
  }

  async sendText(params: SendTextParams, channel: Channel): Promise<SendResult> {
    const sock = this.getConnectedSocket(channel);
    const jid = await this.resolveDestinationJid(sock, params.recipient);

    const messageContent: AnyMessageContent = {
      text: params.text,
    };

    if (params.mentions && params.mentions.length > 0) {
      messageContent.mentions = params.mentions.map(normalizeJid);
    }

    const res = await sock.sendMessage(jid, messageContent);
    return {
      success: true,
      messageId: res?.key.id || undefined,
      timestamp: Date.now(),
      raw: res,
    };
  }

  async sendMedia(params: SendMediaParams, channel: Channel): Promise<SendResult> {
    const sock = this.getConnectedSocket(channel);
    const jid = await this.resolveDestinationJid(sock, params.recipient);

    let mediaBuffer: Buffer | undefined;
    if (params.mediaBase64) {
      const base64Data = params.mediaBase64.replace(/^data:.*?;base64,/, '');
      mediaBuffer = Buffer.from(base64Data, 'base64');
    }

    const payload = mediaBuffer || (params.mediaUrl ? { url: params.mediaUrl } : undefined);
    if (!payload) {
      throw new Error('Either mediaUrl or mediaBase64 must be provided');
    }

    let messageContent: AnyMessageContent;
    switch (params.mediaType) {
      case 'image':
        messageContent = { image: payload, caption: params.caption, mimetype: params.mimetype };
        break;
      case 'video':
        messageContent = { video: payload, caption: params.caption, mimetype: params.mimetype };
        break;
      case 'audio':
        messageContent = { audio: payload, mimetype: params.mimetype || 'audio/mp4' };
        break;
      case 'document':
        messageContent = {
          document: payload,
          fileName: params.fileName || 'document',
          caption: params.caption,
          mimetype: params.mimetype || 'application/octet-stream',
        };
        break;
      case 'sticker':
        messageContent = { sticker: payload };
        break;
      default:
        throw new Error(`Unsupported media type: ${params.mediaType}`);
    }

    const res = await sock.sendMessage(jid, messageContent);
    return {
      success: true,
      messageId: res?.key.id || undefined,
      timestamp: Date.now(),
      raw: res,
    };
  }

  async sendLocation(params: SendLocationParams, channel: Channel): Promise<SendResult> {
    const sock = this.getConnectedSocket(channel);
    const jid = await this.resolveDestinationJid(sock, params.recipient);

    const messageContent: AnyMessageContent = {
      location: {
        degreesLatitude: params.latitude,
        degreesLongitude: params.longitude,
        name: params.name,
        address: params.address,
      },
    };

    const res = await sock.sendMessage(jid, messageContent);
    return {
      success: true,
      messageId: res?.key.id || undefined,
      timestamp: Date.now(),
      raw: res,
    };
  }

  async sendContact(params: SendContactParams, channel: Channel): Promise<SendResult> {
    const sock = this.getConnectedSocket(channel);
    const jid = await this.resolveDestinationJid(sock, params.recipient);

    const vcard =
      'BEGIN:VCARD\n' +
      'VERSION:3.0\n' +
      `FN:${params.contactName}\n` +
      `TEL;type=CELL;type=VOICE;waid=${params.contactPhone}:${params.contactPhone}\n` +
      'END:VCARD';

    const messageContent: AnyMessageContent = {
      contacts: {
        displayName: params.contactName,
        contacts: [{ vcard }],
      },
    };

    const res = await sock.sendMessage(jid, messageContent);
    return {
      success: true,
      messageId: res?.key.id || undefined,
      timestamp: Date.now(),
      raw: res,
    };
  }

  async sendReaction(params: SendReactionParams, channel: Channel): Promise<SendResult> {
    const sock = this.getConnectedSocket(channel);
    const jid = await this.resolveDestinationJid(sock, params.recipient);

    const messageContent: AnyMessageContent = {
      react: {
        text: params.reaction,
        key: {
          remoteJid: jid,
          id: params.messageId,
        },
      },
    };

    const res = await sock.sendMessage(jid, messageContent);
    return {
      success: true,
      messageId: res?.key.id || undefined,
      timestamp: Date.now(),
      raw: res,
    };
  }

  async findMessages(_filter: FindMessagesFilter, _channel: Channel): Promise<DomainMessage[]> {
    // Baileys is an event-driven WebSocket transport; message store queries are serviced from active sessions
    return [];
  }

  async findChats(_channel: Channel): Promise<DomainChat[]> {
    return [];
  }

  async checkNumber(phoneNumber: string, channel: Channel): Promise<CheckNumberResult> {
    const sock = this.getConnectedSocket(channel);
    const results = await sock.onWhatsApp(phoneNumber);
    const result = results && results.length > 0 ? results[0] : undefined;
    if (!result) {
      return toCheckNumberResult(false, undefined, phoneNumber);
    }
    return toCheckNumberResult(result.exists, result.jid, phoneNumber);
  }

  // Group Operations
  async createGroup(params: CreateGroupParams, channel: Channel): Promise<GroupInfo> {
    const sock = this.getConnectedSocket(channel);
    const participantJids = params.participants.map(normalizeJid);
    const result = await sock.groupCreate(params.subject, participantJids);

    return {
      id: result.id,
      subject: params.subject,
      description: params.description,
      creation: Date.now(),
      participants: result.participants.map((p) => ({ id: p.id, admin: null })),
      raw: result,
    };
  }

  async getGroupInfo(groupJid: string, channel: Channel): Promise<GroupInfo> {
    const sock = this.getConnectedSocket(channel);
    const metadata = await sock.groupMetadata(groupJid);
    return toGroupInfo(metadata);
  }

  async updateGroupParticipants(
    groupJid: string,
    action: 'add' | 'remove' | 'promote' | 'demote',
    participants: string[],
    channel: Channel
  ): Promise<void> {
    const sock = this.getConnectedSocket(channel);
    const jids = participants.map(normalizeJid);
    await sock.groupParticipantsUpdate(groupJid, jids, action);
  }

  async leaveGroup(groupJid: string, channel: Channel): Promise<void> {
    const sock = this.getConnectedSocket(channel);
    await sock.groupLeave(groupJid);
  }
}
