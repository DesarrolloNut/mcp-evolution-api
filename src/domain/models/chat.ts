import { DomainMessage } from './message.js';

export interface DomainChat {
  id: string; // JID or phone number
  name?: string;
  phoneNumber?: string;
  lid?: string;
  isGroup: boolean;
  unreadCount?: number;
  timestamp?: number;
  lastMessage?: DomainMessage;
  raw?: unknown;
}

export interface FindMessagesFilter {
  chatId?: string;
  count?: number;
  page?: number;
}

export interface CheckNumberResult {
  exists: boolean;
  jid?: string;
  number: string;
}
