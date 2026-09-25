import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { IProviderRepository } from '../../../domain/ports/IProviderRepository.js';
import { Provider, CreateProviderDTO, UpdateProviderDTO, ProviderType } from '../../../domain/entities/provider.js';
import { encrypt } from '../../../application/security/encryption.js';

interface ProviderRow {
  id: string;
  name: string;
  type: string;
  base_url: string;
  api_key_encrypted: string;
  config_json: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapRowToEntity(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ProviderType,
    baseUrl: row.base_url,
    apiKeyEncrypted: row.api_key_encrypted,
    config: JSON.parse(row.config_json || '{}'),
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteProviderRepository implements IProviderRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly encryptionKey: string
  ) {}

  async findAll(options?: { activeOnly?: boolean }): Promise<Provider[]> {
    let query = 'SELECT * FROM providers';
    if (options?.activeOnly) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY name ASC';

    const rows = this.db.prepare(query).all() as ProviderRow[];
    return rows.map(mapRowToEntity);
  }

  async findById(id: string): Promise<Provider | null> {
    const row = this.db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as ProviderRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  async findByName(name: string): Promise<Provider | null> {
    const row = this.db.prepare('SELECT * FROM providers WHERE name = ?').get(name) as ProviderRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  async create(dto: CreateProviderDTO): Promise<Provider> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const apiKeyEncrypted = encrypt(dto.apiKey, this.encryptionKey);
    const configJson = JSON.stringify(dto.config || {});
    const isActive = dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : 1;

    const stmt = this.db.prepare(`
      INSERT INTO providers (id, name, type, base_url, api_key_encrypted, config_json, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, dto.name, dto.type, dto.baseUrl, apiKeyEncrypted, configJson, isActive, now, now);

    const created = await this.findById(id);
    if (!created) {
      throw new Error(`Failed to create provider: ${dto.name}`);
    }
    return created;
  }

  async update(id: string, dto: UpdateProviderDTO): Promise<Provider> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Provider not found: ${id}`);
    }

    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const values: (string | number)[] = [now];

    if (dto.name !== undefined) {
      updates.push('name = ?');
      values.push(dto.name);
    }
    if (dto.baseUrl !== undefined) {
      updates.push('base_url = ?');
      values.push(dto.baseUrl);
    }
    if (dto.apiKey !== undefined) {
      updates.push('api_key_encrypted = ?');
      values.push(encrypt(dto.apiKey, this.encryptionKey));
    }
    if (dto.config !== undefined) {
      updates.push('config_json = ?');
      values.push(JSON.stringify(dto.config));
    }
    if (dto.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(dto.isActive ? 1 : 0);
    }

    values.push(id);
    const sql = `UPDATE providers SET ${updates.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);

    const updated = await this.findById(id);
    return updated!;
  }

  async delete(id: string): Promise<void> {
    // Soft delete to preserve historical integrity
    const now = new Date().toISOString();
    this.db.prepare('UPDATE providers SET is_active = 0, updated_at = ? WHERE id = ?').run(now, id);
  }
}
