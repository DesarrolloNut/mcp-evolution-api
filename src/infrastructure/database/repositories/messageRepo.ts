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

export interface JidMappingDto {
  lid: string;
  pnJid: string;
  phoneNumber?: string;
  name?: string;
}

export class SqliteMessageRepository {
  constructor(private readonly db: Database.Database) {}

  recordJidMapping(channelId: string, mapping: JidMappingDto): void {
    if (!mapping.lid || !mapping.pnJid) return;
    const now = new Date().toISOString();
    const cleanPhone = mapping.phoneNumber || mapping.pnJid.replace(/[^0-9]/g, '');

    const stmt = this.db.prepare(`
      INSERT INTO jid_mappings (channel_id, lid, pn_jid, phone_number, name, updated_at)
      VALUES (@channelId, @lid, @pnJid, @phoneNumber, @name, @now)
      ON CONFLICT(channel_id, lid) DO UPDATE SET
        pn_jid = @pnJid,
        phone_number = COALESCE(@phoneNumber, jid_mappings.phone_number),
        name = COALESCE(@name, jid_mappings.name),
        updated_at = @now
    `);

    stmt.run({
      channelId,
      lid: mapping.lid,
      pnJid: mapping.pnJid,
      phoneNumber: cleanPhone || null,
      name: mapping.name || null,
      now,
    });

    // Also update existing chats
    try {
      this.db.prepare(`
        UPDATE chats
        SET phone_number = COALESCE(?, phone_number),
            lid = COALESCE(?, lid),
            name = COALESCE(?, name)
        WHERE channel_id = ? AND (jid = ? OR jid = ?)
      `).run(cleanPhone || null, mapping.lid, mapping.name || null, channelId, mapping.lid, mapping.pnJid);
    } catch {}
  }

  findRelatedJids(channelId: string, inputJid: string): string[] {
    const related = new Set<string>();
    related.add(inputJid);

    const cleanNumber = inputJid.replace(/[^0-9]/g, '');
    if (cleanNumber.length >= 7) {
      related.add(`${cleanNumber}@s.whatsapp.net`);
    }

    try {
      const mappingRows = this.db.prepare(`
        SELECT lid, pn_jid, phone_number
        FROM jid_mappings
        WHERE channel_id = ? AND (lid = ? OR pn_jid = ? OR phone_number = ?)
      `).all(channelId, inputJid, inputJid, cleanNumber) as Array<{
        lid: string;
        pn_jid: string;
        phone_number: string | null;
      }>;

      for (const r of mappingRows) {
        if (r.lid) related.add(r.lid);
        if (r.pn_jid) related.add(r.pn_jid);
        if (r.phone_number) related.add(`${r.phone_number}@s.whatsapp.net`);
      }
    } catch {}

    return Array.from(related);
  }

  upsertChat(channelId: string, chat: ChatUpsertDto): void {
    const isGroupVal = chat.isGroup ? 1 : 0;
    const now = new Date().toISOString();
    const ts = chat.timestamp || Date.now();
    const cleanPhone = chat.jid.includes('@s.whatsapp.net') ? chat.jid.replace(/[^0-9]/g, '') : null;
    const lidVal = chat.jid.endsWith('@lid') ? chat.jid : null;

    const stmt = this.db.prepare(`
      INSERT INTO chats (jid, channel_id, name, unread_count, last_message_text, last_message_timestamp, is_group, phone_number, lid, updated_at)
      VALUES (@jid, @channelId, @name, @unreadCount, @lastMessageText, @ts, @isGroup, @phone, @lid, @now)
      ON CONFLICT(channel_id, jid) DO UPDATE SET
        name = COALESCE(@name, chats.name),
        unread_count = COALESCE(@unreadCount, chats.unread_count),
        last_message_text = COALESCE(@lastMessageText, chats.last_message_text),
        last_message_timestamp = MAX(chats.last_message_timestamp, @ts),
        phone_number = COALESCE(@phone, chats.phone_number),
        lid = COALESCE(@lid, chats.lid),
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
      phone: cleanPhone,
      lid: lidVal,
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
    let rows: Array<{
      jid: string;
      name: string | null;
      unread_count: number;
      last_message_text: string | null;
      last_message_timestamp: number;
      is_group: number;
      phone_number?: string | null;
      lid?: string | null;
      map_phone?: string | null;
      map_lid?: string | null;
      map_name?: string | null;
    }> = [];

    try {
      rows = this.db.prepare(`
        SELECT c.jid, c.name, c.unread_count, c.last_message_text, c.last_message_timestamp, c.is_group, c.phone_number, c.lid,
               m.phone_number as map_phone, m.lid as map_lid, m.name as map_name
        FROM chats c
        LEFT JOIN jid_mappings m ON m.channel_id = c.channel_id AND (m.lid = c.jid OR m.pn_jid = c.jid)
        WHERE c.channel_id = ?
        ORDER BY c.last_message_timestamp DESC
        LIMIT ?
      `).all(channelId, limit * 2) as any;
    } catch {
      rows = this.db.prepare(`
        SELECT jid, name, unread_count, last_message_text, last_message_timestamp, is_group
        FROM chats
        WHERE channel_id = ?
        ORDER BY last_message_timestamp DESC
        LIMIT ?
      `).all(channelId, limit) as any;
    }

    const unifiedMap = new Map<string, DomainChat>();

    for (const r of rows) {
      const isGroup = r.is_group === 1 || r.jid.endsWith('@g.us');
      const resolvedPhone = r.phone_number || r.map_phone || (r.jid.includes('@s.whatsapp.net') ? r.jid.replace(/[^0-9]/g, '') : undefined);
      const unifiedKey = isGroup ? r.jid : (resolvedPhone || r.lid || r.map_lid || r.jid);
      const name = r.name || r.map_name || (resolvedPhone ? `+${resolvedPhone}` : undefined);

      const chatItem: DomainChat = {
        id: r.jid,
        name: name || undefined,
        phoneNumber: resolvedPhone,
        isGroup,
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
      };

      const existing = unifiedMap.get(unifiedKey);
      if (!existing) {
        unifiedMap.set(unifiedKey, chatItem);
      } else {
        if ((chatItem.timestamp || 0) > (existing.timestamp || 0)) {
          existing.lastMessage = chatItem.lastMessage;
          existing.timestamp = chatItem.timestamp;
          existing.id = chatItem.id;
        }
        if (!existing.name && chatItem.name) {
          existing.name = chatItem.name;
        }
        if (!existing.phoneNumber && chatItem.phoneNumber) {
          existing.phoneNumber = chatItem.phoneNumber;
        }
        existing.unreadCount = (existing.unreadCount || 0) + (chatItem.unreadCount || 0);
      }
    }

    return Array.from(unifiedMap.values()).slice(0, limit);
  }

  getMessages(channelId: string, chatJid?: string, limit: number = 20): DomainMessage[] {
    if (chatJid) {
      const relatedJids = this.findRelatedJids(channelId, chatJid);
      const placeholders = relatedJids.map(() => '?').join(',');
      const cleanDigits = chatJid.replace(/[^0-9]/g, '');
      const queryLike = cleanDigits.length >= 7 ? `%${cleanDigits}%` : `%${chatJid}%`;

      const rows = this.db.prepare(`
        SELECT id, chat_jid, sender_jid, from_me, message_type, text_content, media_url, timestamp
        FROM messages
        WHERE channel_id = ? AND (chat_jid IN (${placeholders}) OR sender_jid IN (${placeholders}) OR chat_jid LIKE ?)
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(channelId, ...relatedJids, ...relatedJids, queryLike, limit) as Array<{
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
