import { IWhatsAppProvider, ProviderCapabilities } from '../../../domain/ports/IWhatsAppProvider.js';
import { Channel } from '../../../domain/entities/channel.js';
import { ProviderCapabilityError } from '../../../domain/errors.js';
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

export class MetaCloudAdapter implements IWhatsAppProvider {
  readonly providerType = 'meta';

  readonly capabilities: ProviderCapabilities = {
    supportsGroups: false,
    supportsMedia: true,
    supportsReactions: true,
    supportsLocation: true,
    supportsContacts: true,
  };

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Meta Cloud API stub ready for configuration' };
  }

  async sendText(_params: SendTextParams, _channel: Channel): Promise<SendResult> {
    throw new ProviderCapabilityError('meta', 'Meta Cloud API driver not yet implemented in this preview');
  }

  async sendMedia(_params: SendMediaParams, _channel: Channel): Promise<SendResult> {
    throw new ProviderCapabilityError('meta', 'sendMedia');
  }

  async sendLocation(_params: SendLocationParams, _channel: Channel): Promise<SendResult> {
    throw new ProviderCapabilityError('meta', 'sendLocation');
  }

  async sendContact(_params: SendContactParams, _channel: Channel): Promise<SendResult> {
    throw new ProviderCapabilityError('meta', 'sendContact');
  }

  async sendReaction(_params: SendReactionParams, _channel: Channel): Promise<SendResult> {
    throw new ProviderCapabilityError('meta', 'sendReaction');
  }

  async findMessages(_filter: FindMessagesFilter, _channel: Channel): Promise<DomainMessage[]> {
    throw new ProviderCapabilityError('meta', 'findMessages (Meta Cloud uses webhooks for inbound messages)');
  }

  async findChats(_channel: Channel): Promise<DomainChat[]> {
    throw new ProviderCapabilityError('meta', 'findChats');
  }

  async checkNumber(phoneNumber: string, _channel: Channel): Promise<CheckNumberResult> {
    return { exists: true, number: phoneNumber };
  }
}
