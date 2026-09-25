import { WAMessage } from '@whiskeysockets/baileys';
import { DomainMessage } from '../../../domain/models/message.js';
import { DomainChat, CheckNumberResult } from '../../../domain/models/chat.js';
import { GroupInfo, GroupParticipant } from '../../../domain/models/group.js';

export function toDomainMessage(msg: WAMessage): DomainMessage {
  const key = msg.key;
  const id = key.id || 'unknown';
  const remoteJid = key.remoteJid || '';
  const fromMe = Boolean(key.fromMe);

  let text: string | undefined;
  let type = 'text';
  let mediaUrl: string | undefined;

  const message = msg.message;
  if (message) {
    if (message.conversation) {
      text = message.conversation;
    } else if (message.extendedTextMessage) {
      text = message.extendedTextMessage.text || undefined;
    } else if (message.imageMessage) {
      type = 'image';
      text = message.imageMessage.caption || undefined;
      mediaUrl = message.imageMessage.url || undefined;
    } else if (message.videoMessage) {
      type = 'video';
      text = message.videoMessage.caption || undefined;
      mediaUrl = message.videoMessage.url || undefined;
    } else if (message.audioMessage) {
      type = 'audio';
      mediaUrl = message.audioMessage.url || undefined;
    } else if (message.documentMessage) {
      type = 'document';
      text = message.documentMessage.caption || undefined;
      mediaUrl = message.documentMessage.url || undefined;
    }
  }

  const rawTimestamp = msg.messageTimestamp;
  const timestamp = typeof rawTimestamp === 'number'
    ? (rawTimestamp > 1e11 ? rawTimestamp : rawTimestamp * 1000)
    : Date.now();

  return {
    id,
    from: fromMe ? 'me' : remoteJid,
    to: fromMe ? remoteJid : 'me',
    fromMe,
    timestamp,
    type,
    text,
    mediaUrl,
    raw: msg,
  };
}

export function toDomainChat(jid: string, name?: string, unreadCount: number = 0): DomainChat {
  const isGroup = jid.endsWith('@g.us');
  return {
    id: jid,
    name: name || undefined,
    isGroup,
    unreadCount,
  };
}

export function toCheckNumberResult(exists: boolean, jid?: string, number: string = ''): CheckNumberResult {
  return {
    exists,
    jid: exists ? (jid || `${number}@s.whatsapp.net`) : undefined,
    number,
  };
}

export function toGroupInfo(groupMetadata: {
  id: string;
  subject: string;
  desc?: string;
  owner?: string;
  creation?: number;
  participants: { id: string; admin?: 'admin' | 'superadmin' | null }[];
}): GroupInfo {
  const participants: GroupParticipant[] = groupMetadata.participants.map((p) => ({
    id: p.id,
    admin: p.admin || null,
  }));

  return {
    id: groupMetadata.id,
    subject: groupMetadata.subject,
    description: groupMetadata.desc || undefined,
    owner: groupMetadata.owner || undefined,
    creation: groupMetadata.creation ? groupMetadata.creation * 1000 : undefined,
    participants,
    raw: groupMetadata,
  };
}
