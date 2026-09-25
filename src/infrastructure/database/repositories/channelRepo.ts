import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { IChannelRepository } from '../../../domain/ports/IChannelRepository.js';
import { Channel, CreateChannelDTO, UpdateChannelDTO } from '../../../domain/entities/channel.js';

interface ChannelRow {
  id: string;
  provider_id: string;
  name: string;
  phone_number: string | null;
  instance_id: string | null;
  config_json: string;
  is_default: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapRowToEntity(row: ChannelRow): Channel {
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    phoneNumber: row.phone_number || undefined,
    instanceId: row.instance_id || undefined,
    config: JSON.parse(row.config_json || '{}'),
    isDefault: row.is_default === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteChannelRepository implements IChannelRepository {
  constructor(private readonly db: Database.Database) {}

  async findAll(options?: { activeOnly?: boolean; providerId?: string }): Promise<Channel[]> {
    let query = 'SELECT * FROM channels WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.activeOnly) {
      query += ' AND is_active = 1';
    }
    if (options?.providerId) {
      query += ' AND provider_id = ?';
      params.push(options.providerId);
    }
    query += ' ORDER BY is_default DESC, name ASC';

    const rows = this.db.prepare(query).all(...params) as ChannelRow[];
    return rows.map(mapRowToEntity);
  }

  async findById(id: string): Promise<Channel | null> {
    const row = this.db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as ChannelRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  async findByName(name: string): Promise<Channel | null> {
    const row = this.db.prepare('SELECT * FROM channels WHERE name = ?').get(name) as ChannelRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  async findDefault(): Promise<Channel | null> {
    const row = this.db.prepare('SELECT * FROM channels WHERE is_default = 1 AND is_active = 1 LIMIT 1').get() as ChannelRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  async create(dto: CreateChannelDTO): Promise<Channel> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const configJson = JSON.stringify(dto.config || {});
    const isActive = dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : 1;

    // Check if this should be default: if requested or if there are no active channels yet
    const existingCountRow = this.db.prepare('SELECT COUNT(*) as count FROM channels WHERE is_active = 1').get() as { count: number };
    const shouldBeDefault = dto.isDefault ?? existingCountRow.count === 0;

    const createTransaction = this.db.transaction(() => {
      if (shouldBeDefault) {
        // Clear previous default
        this.db.prepare('UPDATE channels SET is_default = 0, updated_at = ? WHERE is_default = 1').run(now);
      }

      const stmt = this.db.prepare(`
        INSERT INTO channels (id, provider_id, name, phone_number, instance_id, config_json, is_default, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        dto.providerId,
        dto.name,
        dto.phoneNumber || null,
        dto.instanceId || null,
        configJson,
        shouldBeDefault ? 1 : 0,
        isActive,
        now,
        now
      );
    });

    createTransaction();

    const created = await this.findById(id);
    if (!created) {
      throw new Error(`Failed to create channel: ${dto.name}`);
    }
    return created;
  }

  async update(id: string, dto: UpdateChannelDTO): Promise<Channel> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Channel not found: ${id}`);
    }

    const now = new Date().toISOString();

    const updateTransaction = this.db.transaction(() => {
      if (dto.isDefault) {
        // Unset previous default
        this.db.prepare('UPDATE channels SET is_default = 0, updated_at = ? WHERE is_default = 1').run(now);
      }

      const updates: string[] = ['updated_at = ?'];
      const values: (string | number | null)[] = [now];

      if (dto.providerId !== undefined) {
        updates.push('provider_id = ?');
        values.push(dto.providerId);
      }
      if (dto.name !== undefined) {
        updates.push('name = ?');
        values.push(dto.name);
      }
      if (dto.phoneNumber !== undefined) {
        updates.push('phone_number = ?');
        values.push(dto.phoneNumber);
      }
      if (dto.instanceId !== undefined) {
        updates.push('instance_id = ?');
        values.push(dto.instanceId);
      }
      if (dto.config !== undefined) {
        updates.push('config_json = ?');
        values.push(JSON.stringify(dto.config));
      }
      if (dto.isDefault !== undefined) {
        updates.push('is_default = ?');
        values.push(dto.isDefault ? 1 : 0);
      }
      if (dto.isActive !== undefined) {
        updates.push('is_active = ?');
        values.push(dto.isActive ? 1 : 0);
      }

      values.push(id);
      const sql = `UPDATE channels SET ${updates.join(', ')} WHERE id = ?`;
      this.db.prepare(sql).run(...values);
    });

    updateTransaction();

    const updated = await this.findById(id);
    return updated!;
  }

  async setDefault(id: string): Promise<void> {
    const now = new Date().toISOString();
    const setDefTransaction = this.db.transaction(() => {
      this.db.prepare('UPDATE channels SET is_default = 0, updated_at = ? WHERE is_default = 1').run(now);
      const res = this.db.prepare('UPDATE channels SET is_default = 1, updated_at = ? WHERE id = ?').run(now, id);
      if (res.changes === 0) {
        throw new Error(`Channel not found: ${id}`);
      }
    });

    setDefTransaction();
  }

  async delete(id: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE channels SET is_active = 0, is_default = 0, updated_at = ? WHERE id = ?').run(now, id);
  }
}
