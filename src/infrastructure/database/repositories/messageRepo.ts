import Database from 'better-sqlite3';
import { DomainChat } from '../../../domain/models/chat.js';
import { DomainMessage } from '../../../domain/models/message.js';

export interface ChatUpsertDto {
  jid: string;
  name?: string;
  unreadCount?: number;
  lastMessageText?: string;
  timestamp?: number;
  isGroup?: boolean;
}

export interface MessageUpsertDto {
  id: string;
  chatJid: string;
  senderJid: string;
  fromMe: boolean;
  messageType: string;
  textContent?: string;
  mediaUrl?: string;
  status?: string;
  timestamp: number;
  raw?: unknown;
}

export class SqliteMessageRepository {
  constructor(private readonly db: Database.Database) {}

  upsertChat(channelId: string, chat: ChatUpsertDto): void {
    const isGroupVal = chat.isGroup ? 1 : 0;
    const now = new Date().toISOString();
    const ts = chat.timestamp || Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO chats (jid, channel_id, name, unread_count, last_message_text, last_message_timestamp, is_group, updated_at)
      VALUES (@jid, @channelId, @name, @unreadCount, @lastMessageText, @ts, @isGroup, @now)
      ON CONFLICT(channel_id, jid) DO UPDATE SET
        name = COALESCE(@name, chats.name),
        unread_count = COALESCE(@unreadCount, chats.unread_count),
        last_message_text = COALESCE(@lastMessageText, chats.last_message_text),
        last_message_timestamp = MAX(chats.last_message_timestamp, @ts),
        updated_at = @now
    `);

    stmt.run({
      jid: chat.jid,
      channelId,
      name: chat.name || null,
      unreadCount: chat.unreadCount ?? 0,
      lastMessageText: chat.lastMessageText || null,
      ts,
      isGroup: isGroupVal,
      now,
    });
  }

  upsertMessage(channelId: string, msg: MessageUpsertDto): void {
    const fromMeVal = msg.fromMe ? 1 : 0;
    const rawJson = msg.raw ? JSON.stringify(msg.raw) : null;

    const stmt = this.db.prepare(`
      INSERT INTO messages (id, channel_id, chat_jid, sender_jid, from_me, message_type, text_content, media_url, status, timestamp, raw_json)
      VALUES (@id, @channelId, @chatJid, @senderJid, @fromMe, @messageType, @textContent, @mediaUrl, @status, @timestamp, @rawJson)
      ON CONFLICT(channel_id, id) DO UPDATE SET
        status = @status,
        text_content = COALESCE(@textContent, messages.text_content)
    `);

    stmt.run({
      id: msg.id,
      channelId,
      chatJid: msg.chatJid,
      senderJid: msg.senderJid,
      fromMe: fromMeVal,
      messageType: msg.messageType,
      textContent: msg.textContent || null,
      mediaUrl: msg.mediaUrl || null,
      status: msg.status || 'sent',
      timestamp: msg.timestamp,
      rawJson,
    });

    // Also update parent chat
    this.upsertChat(channelId, {
      jid: msg.chatJid,
      lastMessageText: msg.textContent || `[${msg.messageType}]`,
      timestamp: msg.timestamp,
      isGroup: msg.chatJid.endsWith('@g.us'),
    });
  }

  getChats(channelId: string, limit: number = 50): DomainChat[] {
    const rows = this.db.prepare(`
      SELECT jid, name, unread_count, last_message_text, last_message_timestamp, is_group
      FROM chats
      WHERE channel_id = ?
      ORDER BY last_message_timestamp DESC
      LIMIT ?
    `).all(channelId, limit) as Array<{
      jid: string;
      name: string | null;
      unread_count: number;
      last_message_text: string | null;
      last_message_timestamp: number;
      is_group: number;
    }>;

    return rows.map((r) => ({
      id: r.jid,
      name: r.name || undefined,
      isGroup: r.is_group === 1,
      unreadCount: r.unread_count,
      timestamp: r.last_message_timestamp,
      lastMessage: r.last_message_text
        ? {
            id: '',
            from: '',
            to: r.jid,
            fromMe: false,
            timestamp: r.last_message_timestamp,
            type: 'text',
            text: r.last_message_text,
          }
        : undefined,
    }));
  }

  getMessages(channelId: string, chatJid?: string, limit: number = 20): DomainMessage[] {
    if (chatJid) {
      const cleanDigits = chatJid.replace(/[^0-9]/g, '');
      const queryParam = cleanDigits.length >= 7 ? `%${cleanDigits}%` : `%${chatJid}%`;

      const rows = this.db.prepare(`
        SELECT id, chat_jid, sender_jid, from_me, message_type, text_content, media_url, timestamp
        FROM messages
        WHERE channel_id = ? AND (chat_jid = ? OR chat_jid LIKE ? OR sender_jid LIKE ?)
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(channelId, chatJid, queryParam, queryParam, limit) as Array<{
        id: string;
        chat_jid: string;
        sender_jid: string;
        from_me: number;
        message_type: string;
        text_content: string | null;
        media_url: string | null;
        timestamp: number;
      }>;

      return rows.map((r) => ({
        id: r.id,
        from: r.sender_jid,
        to: r.chat_jid,
        fromMe: r.from_me === 1,
        timestamp: r.timestamp,
        type: r.message_type,
        text: r.text_content || undefined,
        mediaUrl: r.media_url || undefined,
      }));
    }

    const rows = this.db.prepare(`
      SELECT id, chat_jid, sender_jid, from_me, message_type, text_content, media_url, timestamp
      FROM messages
      WHERE channel_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(channelId, limit) as Array<{
      id: string;
      chat_jid: string;
      sender_jid: string;
      from_me: number;
      message_type: string;
      text_content: string | null;
      media_url: string | null;
      timestamp: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      from: r.sender_jid,
      to: r.chat_jid,
      fromMe: r.from_me === 1,
      timestamp: r.timestamp,
      type: r.message_type,
      text: r.text_content || undefined,
      mediaUrl: r.media_url || undefined,
    }));
  }
}
