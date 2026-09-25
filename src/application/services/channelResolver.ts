import { IChannelRepository } from '../../domain/ports/IChannelRepository.js';
import { IProviderRepository } from '../../domain/ports/IProviderRepository.js';
import { ProviderFactory } from './providerFactory.js';
import { Channel } from '../../domain/entities/channel.js';
import { Provider } from '../../domain/entities/provider.js';
import { IWhatsAppProvider } from '../../domain/ports/IWhatsAppProvider.js';
import { ChannelNotFoundError, NoDefaultChannelError, ProviderNotFoundError } from '../../domain/errors.js';

export interface ResolvedContext {
  channel: Channel;
  provider: Provider;
  adapter: IWhatsAppProvider;
}

export class ChannelResolver {
  constructor(
    private readonly channelRepo: IChannelRepository,
    private readonly providerRepo: IProviderRepository,
    private readonly providerFactory: ProviderFactory
  ) {}

  async resolve(channelNameOrId?: string): Promise<ResolvedContext> {
    let channel: Channel | null = null;

    if (channelNameOrId && channelNameOrId.trim()) {
      const query = channelNameOrId.trim();
      // Try by name first, then by ID
      channel = await this.channelRepo.findByName(query);
      if (!channel) {
        channel = await this.channelRepo.findById(query);
      }
      if (!channel || !channel.isActive) {
        throw new ChannelNotFoundError(query);
      }
    } else {
      // Find the configured default channel
      channel = await this.channelRepo.findDefault();
      if (!channel) {
        throw new NoDefaultChannelError();
      }
    }

    const provider = await this.providerRepo.findById(channel.providerId);
    if (!provider || !provider.isActive) {
      throw new ProviderNotFoundError(channel.providerId);
    }

    const adapter = this.providerFactory.create(provider);

    return {
      channel,
      provider,
      adapter,
    };
  }
}
