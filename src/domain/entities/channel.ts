export interface ChannelConfig {
  [key: string]: unknown;
}

export interface Channel {
  id: string;
  providerId: string;
  name: string;
  phoneNumber?: string;
  instanceId?: string; // Specific identifier for providers like Evolution API
  config: ChannelConfig;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelDTO {
  providerId: string;
  name: string;
  phoneNumber?: string;
  instanceId?: string;
  config?: ChannelConfig;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateChannelDTO {
  providerId?: string;
  name?: string;
  phoneNumber?: string;
  instanceId?: string;
  config?: ChannelConfig;
  isDefault?: boolean;
  isActive?: boolean;
}
