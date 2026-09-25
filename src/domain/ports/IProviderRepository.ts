import { Provider, CreateProviderDTO, UpdateProviderDTO } from '../entities/provider.js';

export interface IProviderRepository {
  findAll(options?: { activeOnly?: boolean }): Promise<Provider[]>;
  findById(id: string): Promise<Provider | null>;
  findByName(name: string): Promise<Provider | null>;
  create(dto: CreateProviderDTO): Promise<Provider>;
  update(id: string, dto: UpdateProviderDTO): Promise<Provider>;
  delete(id: string): Promise<void>;
}
