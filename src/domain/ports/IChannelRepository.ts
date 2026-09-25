import { Channel, CreateChannelDTO, UpdateChannelDTO } from '../entities/channel.js';

export interface IChannelRepository {
  findAll(options?: { activeOnly?: boolean; providerId?: string }): Promise<Channel[]>;
  findById(id: string): Promise<Channel | null>;
  findByName(name: string): Promise<Channel | null>;
  findDefault(): Promise<Channel | null>;
  create(dto: CreateChannelDTO): Promise<Channel>;
  update(id: string, dto: UpdateChannelDTO): Promise<Channel>;
  setDefault(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}
