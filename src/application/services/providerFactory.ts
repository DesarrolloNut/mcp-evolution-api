import { Provider } from '../../domain/entities/provider.js';
import { IWhatsAppProvider } from '../../domain/ports/IWhatsAppProvider.js';
import { decrypt } from '../security/encryption.js';
import { EvolutionClient } from '../../infrastructure/providers/evolution/client.js';
import { EvolutionAdapter } from '../../infrastructure/providers/evolution/adapter.js';
import { MetaCloudAdapter } from '../../infrastructure/providers/meta/adapter.js';
import { TwilioAdapter } from '../../infrastructure/providers/twilio/adapter.js';
import { BaileysAdapter } from '../../infrastructure/providers/baileys/adapter.js';
import { BaileysSessionManager } from '../../infrastructure/providers/baileys/sessionManager.js';
import { ProviderCapabilityError } from '../../domain/errors.js';

export class ProviderFactory {
  constructor(
    private readonly encryptionKey: string,
    private readonly sessionManager: BaileysSessionManager = BaileysSessionManager.getInstance()
  ) {}

  create(provider: Provider): IWhatsAppProvider {
    const plainApiKey = provider.apiKeyEncrypted ? decrypt(provider.apiKeyEncrypted, this.encryptionKey) : '';

    switch (provider.type) {
      case 'baileys':
        return new BaileysAdapter(this.sessionManager);

      case 'evolution': {
        const client = new EvolutionClient({
          baseUrl: provider.baseUrl,
          apiKey: plainApiKey,
          timeoutMs: (provider.config.timeoutMs as number) || 30000,
        });
        return new EvolutionAdapter(client);
      }

      case 'meta':
        return new MetaCloudAdapter();

      case 'twilio':
        return new TwilioAdapter();

      default:
        throw new ProviderCapabilityError(provider.type, `Unknown provider type: ${provider.type}`);
    }
  }
}
