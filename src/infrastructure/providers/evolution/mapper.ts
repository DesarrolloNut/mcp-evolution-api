import { DomainMessage, SendResult } from '../../../domain/models/message.js';
import { DomainChat, CheckNumberResult } from '../../../domain/models/chat.js';
import { GroupInfo, GroupParticipant } from '../../../domain/models/group.js';

export function toSendResult(response: unknown): SendResult {
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    const key = obj.key as Record<string, unknown> | undefined;
    const messageId = (key?.id as string) || (obj.id as string) || (obj.messageId as string);
    const timestamp = (obj.messageTimestamp as number) || Date.now();

    return {
      success: true,
      messageId,
      timestamp,
      raw: response,
    };
  }

  return {
    success: true,
    raw: response,
  };
}

export function toDomainMessage(item: unknown): DomainMessage {
  if (!item || typeof item !== 'object') {
    return {
      id: 'unknown',
      from: '',
      to: '',
      fromMe: false,
      timestamp: Date.now(),
      type: 'text',
      raw: item,
    };
  }

  const obj = item as Record<string, unknown>;
  const key = (obj.key || {}) as Record<string, unknown>;
  const id = (key.id || obj.id || '') as string;
  const remoteJid = (key.remoteJid || obj.remoteJid || '') as string;
  const fromMe = Boolean(key.fromMe ?? obj.fromMe);

  let text: string | undefined;
  let mediaUrl: string | undefined;
  let type = 'text';

  const message = obj.message as Record<string, unknown> | undefined;
  if (message) {
    if (message.conversation) {
      text = String(message.conversation);
    } else if (message.extendedTextMessage) {
      text = String((message.extendedTextMessage as Record<string, unknown>).text || '');
    } else if (message.imageMessage) {
      type = 'image';
      text = String((message.imageMessage as Record<string, unknown>).caption || '');
      mediaUrl = (message.imageMessage as Record<string, unknown>).url as string;
    } else if (message.videoMessage) {
      type = 'video';
      text = String((message.videoMessage as Record<string, unknown>).caption || '');
      mediaUrl = (message.videoMessage as Record<string, unknown>).url as string;
    } else if (message.audioMessage) {
      type = 'audio';
    } else if (message.documentMessage) {
      type = 'document';
      text = String((message.documentMessage as Record<string, unknown>).caption || '');
    }
  }

  const rawTimestamp = obj.messageTimestamp;
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
    raw: item,
  };
}

export function toDomainChat(item: unknown): DomainChat {
  if (!item || typeof item !== 'object') {
    return {
      id: 'unknown',
      isGroup: false,
      raw: item,
    };
  }

  const obj = item as Record<string, unknown>;
  const id = (obj.id || obj.remoteJid || '') as string;
  const name = (obj.name || obj.pushName || obj.subject || '') as string;
  const isGroup = id.endsWith('@g.us');
  const unreadCount = typeof obj.unreadCount === 'number' ? obj.unreadCount : 0;

  return {
    id,
    name: name || undefined,
    isGroup,
    unreadCount,
    raw: item,
  };
}

export function toCheckNumberResult(item: unknown, requestedNumber: string): CheckNumberResult {
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const exists = Boolean(obj.exists);
    const jid = (obj.jid as string) || (exists ? `${requestedNumber}@s.whatsapp.net` : undefined);
    return {
      exists,
      jid,
      number: requestedNumber,
    };
  }

  return {
    exists: false,
    number: requestedNumber,
  };
}

export function toGroupInfo(raw: unknown): GroupInfo {
  const obj = (raw || {}) as Record<string, unknown>;
  const id = (obj.id || '') as string;
  const subject = (obj.subject || '') as string;
  const description = (obj.desc || obj.description || '') as string;
  const owner = (obj.owner || '') as string;
  const creation = (obj.creation as number) || undefined;

  const participantsRaw = Array.isArray(obj.participants) ? obj.participants : [];
  const participants: GroupParticipant[] = participantsRaw.map((p: unknown) => {
    const pObj = (p || {}) as Record<string, unknown>;
    return {
      id: (pObj.id || '') as string,
      admin: (pObj.admin as 'admin' | 'superadmin') || null,
    };
  });

  return {
    id,
    subject,
    description: description || undefined,
    owner: owner || undefined,
    creation,
    participants,
    raw,
  };
}
