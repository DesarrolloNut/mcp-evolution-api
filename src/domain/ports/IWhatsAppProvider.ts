import { Channel } from '../entities/channel.js';
import {
  SendTextParams,
  SendMediaParams,
  SendLocationParams,
  SendContactParams,
  SendReactionParams,
  SendResult,
  DomainMessage,
} from '../models/message.js';
import { DomainChat, FindMessagesFilter, CheckNumberResult } from '../models/chat.js';

export interface ProviderCapabilities {
  supportsGroups: boolean;
  supportsMedia: boolean;
  supportsReactions: boolean;
  supportsLocation: boolean;
  supportsContacts: boolean;
}

export interface IWhatsAppProvider {
  readonly providerType: string;
  readonly capabilities: ProviderCapabilities;

  // Health and connectivity check
  testConnection(): Promise<{ success: boolean; message: string }>;

  // Messaging operations
  sendText(params: SendTextParams, channel: Channel): Promise<SendResult>;
  sendMedia(params: SendMediaParams, channel: Channel): Promise<SendResult>;
  sendLocation(params: SendLocationParams, channel: Channel): Promise<SendResult>;
  sendContact(params: SendContactParams, channel: Channel): Promise<SendResult>;
  sendReaction(params: SendReactionParams, channel: Channel): Promise<SendResult>;

  // Chat queries
  findMessages(filter: FindMessagesFilter, channel: Channel): Promise<DomainMessage[]>;
  findChats(channel: Channel): Promise<DomainChat[]>;
  checkNumber(phoneNumber: string, channel: Channel): Promise<CheckNumberResult>;
}
