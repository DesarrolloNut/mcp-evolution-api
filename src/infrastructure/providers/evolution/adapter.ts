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
import { EvolutionClient } from './client.js';
import {
  toSendResult,
  toDomainMessage,
  toDomainChat,
  toCheckNumberResult,
  toGroupInfo,
} from './mapper.js';

export class EvolutionAdapter implements IWhatsAppProvider, IGroupProvider {
  readonly providerType = 'evolution';

  readonly capabilities: ProviderCapabilities = {
    supportsGroups: true,
    supportsMedia: true,
    supportsReactions: true,
    supportsLocation: true,
    supportsContacts: true,
  };

  constructor(private readonly client: EvolutionClient) {}

  private resolveInstance(channel: Channel): string {
    return channel.instanceId?.trim() || channel.name;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return this.client.testConnection();
  }

  async sendText(params: SendTextParams, channel: Channel): Promise<SendResult> {
    const instance = this.resolveInstance(channel);
    const body: Record<string, unknown> = {
      number: params.recipient,
      text: params.text,
      delay: params.delay ?? 1200,
      linkPreview: params.linkPreview ?? true,
    };
    if (params.quotedMessageId) {
      body.quoted = { key: { id: params.quotedMessageId } };
    }
    if (params.mentions && params.mentions.length > 0) {
      body.mentioned = params.mentions;
    }

    const res = await this.client.post(`/message/sendText/${encodeURIComponent(instance)}`, { body });
    return toSendResult(res);
  }

  async sendMedia(params: SendMediaParams, channel: Channel): Promise<SendResult> {
    const instance = this.resolveInstance(channel);
    const body: Record<string, unknown> = {
      number: params.recipient,
      mediatype: params.mediaType,
      media: params.mediaUrl || params.mediaBase64,
      caption: params.caption,
      fileName: params.fileName,
      mimetype: params.mimetype,
    };

    const res = await this.client.post(`/message/sendMedia/${encodeURIComponent(instance)}`, { body });
    return toSendResult(res);
  }

  async sendLocation(params: SendLocationParams, channel: Channel): Promise<SendResult> {
    const instance = this.resolveInstance(channel);
    const body = {
      number: params.recipient,
      name: params.name || '',
      address: params.address || '',
      latitude: params.latitude,
      longitude: params.longitude,
    };

    const res = await this.client.post(`/message/sendLocation/${encodeURIComponent(instance)}`, { body });
    return toSendResult(res);
  }

  async sendContact(params: SendContactParams, channel: Channel): Promise<SendResult> {
    const instance = this.resolveInstance(channel);
    const body = {
      number: params.recipient,
      contact: [
        {
          fullName: params.contactName,
          wuid: params.contactPhone,
          phoneNumber: params.contactPhone,
        },
      ],
    };

    const res = await this.client.post(`/message/sendContact/${encodeURIComponent(instance)}`, { body });
    return toSendResult(res);
  }

  async sendReaction(params: SendReactionParams, channel: Channel): Promise<SendResult> {
    const instance = this.resolveInstance(channel);
    const body = {
      key: {
        remoteJid: params.recipient.includes('@') ? params.recipient : `${params.recipient}@s.whatsapp.net`,
        id: params.messageId,
      },
      reaction: params.reaction,
    };

    const res = await this.client.post(`/message/sendReaction/${encodeURIComponent(instance)}`, { body });
    return toSendResult(res);
  }

  async findMessages(filter: FindMessagesFilter, channel: Channel): Promise<DomainMessage[]> {
    const instance = this.resolveInstance(channel);
    const where: Record<string, unknown> = {};
    if (filter.chatId) {
      where.key = { remoteJid: filter.chatId };
    }

    const body: Record<string, unknown> = {
      where,
      limit: filter.count ?? 20,
    };

    const res = await this.client.post<unknown[]>(`/chat/findMessages/${encodeURIComponent(instance)}`, { body });
    const records = Array.isArray(res) ? res : ((res as Record<string, unknown>)?.records as unknown[]) || [];
    return records.map(toDomainMessage);
  }

  async findChats(channel: Channel): Promise<DomainChat[]> {
    const instance = this.resolveInstance(channel);
    const res = await this.client.get<unknown[]>(`/chat/findChats/${encodeURIComponent(instance)}`);
    const records = Array.isArray(res) ? res : [];
    return records.map(toDomainChat);
  }

  async checkNumber(phoneNumber: string, channel: Channel): Promise<CheckNumberResult> {
    const instance = this.resolveInstance(channel);
    const body = { numbers: [phoneNumber] };
    const res = await this.client.post<unknown[]>(`/chat/whatsappNumbers/${encodeURIComponent(instance)}`, { body });
    const records = Array.isArray(res) ? res : [];
    return toCheckNumberResult(records[0], phoneNumber);
  }

  // Group operations
  async createGroup(params: CreateGroupParams, channel: Channel): Promise<GroupInfo> {
    const instance = this.resolveInstance(channel);
    const body = {
      subject: params.subject,
      description: params.description,
      participants: params.participants,
    };

    const res = await this.client.post(`/group/create/${encodeURIComponent(instance)}`, { body });
    return toGroupInfo(res);
  }

  async getGroupInfo(groupJid: string, channel: Channel): Promise<GroupInfo> {
    const instance = this.resolveInstance(channel);
    const res = await this.client.get(`/group/findGroupInfos/${encodeURIComponent(instance)}`, {
      query: { groupJid },
    });
    return toGroupInfo(res);
  }

  async updateGroupParticipants(
    groupJid: string,
    action: 'add' | 'remove' | 'promote' | 'demote',
    participants: string[],
    channel: Channel
  ): Promise<void> {
    const instance = this.resolveInstance(channel);
    const body = {
      action,
      participants,
    };
    await this.client.post(`/group/updateParticipant/${encodeURIComponent(instance)}`, {
      query: { groupJid },
      body,
    });
  }

  async leaveGroup(groupJid: string, channel: Channel): Promise<void> {
    const instance = this.resolveInstance(channel);
    await this.client.delete(`/group/leaveGroup/${encodeURIComponent(instance)}`, {
      query: { groupJid },
    });
  }
}
