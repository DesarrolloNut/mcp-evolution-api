export type ProviderType = 'evolution' | 'meta' | 'twilio' | 'baileys';

export interface ProviderConfig {
  timeoutMs?: number;
  [key: string]: unknown;
}

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyEncrypted: string;
  config: ProviderConfig;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderDTO {
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string; // Plaintext when input, will be encrypted in repository
  config?: ProviderConfig;
  isActive?: boolean;
}

export interface UpdateProviderDTO {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  config?: ProviderConfig;
  isActive?: boolean;
}
