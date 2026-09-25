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

export class TwilioAdapter implements IWhatsAppProvider {
  readonly providerType = 'twilio';

  readonly capabilities: ProviderCapabilities = {
    supportsGroups: false,
    supportsMedia: true,
    supportsReactions: false,
    supportsLocation: false,
    supportsContacts: false,
  };

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Twilio provider stub ready for configuration' };
  }

  async sendText(_params: SendTextParams, _channel: Channel): Promise<SendResult> {
    throw new ProviderCapabilityError('twilio', 'Twilio driver not yet implemented in this preview');
  }

  async sendMedia(_params: SendMediaParams, _channel: Channel): Promise<SendResult> {
    throw new ProviderCapabilityError('twilio', 'sendMedia');
  }

  async sendLocation(_params: SendLocationParams, _channel: Channel): Promise<SendResult> {
    throw new ProviderCapabilityError('twilio', 'sendLocation');
  }

  async sendContact(_params: SendContactParams, _channel: Channel): Promise<SendResult> {
    throw new ProviderCapabilityError('twilio', 'sendContact');
  }

  async sendReaction(_params: SendReactionParams, _channel: Channel): Promise<SendResult> {
    throw new ProviderCapabilityError('twilio', 'sendReaction');
  }

  async findMessages(_filter: FindMessagesFilter, _channel: Channel): Promise<DomainMessage[]> {
    throw new ProviderCapabilityError('twilio', 'findMessages');
  }

  async findChats(_channel: Channel): Promise<DomainChat[]> {
    throw new ProviderCapabilityError('twilio', 'findChats');
  }

  async checkNumber(phoneNumber: string, _channel: Channel): Promise<CheckNumberResult> {
    return { exists: true, number: phoneNumber };
  }
}
