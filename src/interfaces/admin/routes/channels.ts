import { Router, Request, Response } from 'express';
import { IChannelRepository } from '../../../domain/ports/IChannelRepository.js';
import { IProviderRepository } from '../../../domain/ports/IProviderRepository.js';

export function createChannelsRouter(
  channelRepo: IChannelRepository,
  providerRepo: IProviderRepository
): Router {
  const router = Router();

  // List all channels
  router.get('/', async (req: Request, res: Response) => {
    try {
      const providerId = req.query.providerId ? String(req.query.providerId) : undefined;
      const activeOnly = req.query.activeOnly === 'true';
      const channels = await channelRepo.findAll({ providerId, activeOnly });
      res.json(channels);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Get channel by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const channel = await channelRepo.findById(id);
      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }
      res.json(channel);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Create channel
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { providerId, name, phoneNumber, instanceId, config, isDefault } = req.body || {};
      if (!providerId || !name) {
        res.status(400).json({ error: 'Missing required fields: providerId, name' });
        return;
      }

      const provider = await providerRepo.findById(providerId);
      if (!provider) {
        res.status(400).json({ error: `Provider ${providerId} does not exist` });
        return;
      }

      const created = await channelRepo.create({
        providerId,
        name: String(name).trim(),
        phoneNumber: phoneNumber ? String(phoneNumber).trim() : undefined,
        instanceId: instanceId ? String(instanceId).trim() : undefined,
        config: typeof config === 'object' ? config : {},
        isDefault: Boolean(isDefault),
      });

      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Update channel
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { providerId, name, phoneNumber, instanceId, config, isDefault, isActive } = req.body || {};
      if (providerId) {
        const provider = await providerRepo.findById(providerId);
        if (!provider) {
          res.status(400).json({ error: `Provider ${providerId} does not exist` });
          return;
        }
      }

      const updated = await channelRepo.update(id, {
        providerId,
        name: name ? String(name).trim() : undefined,
        phoneNumber: phoneNumber ? String(phoneNumber).trim() : undefined,
        instanceId: instanceId ? String(instanceId).trim() : undefined,
        config: typeof config === 'object' ? config : undefined,
        isDefault: typeof isDefault === 'boolean' ? isDefault : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      });

      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Set as default channel
  router.post('/:id/set-default', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      await channelRepo.setDefault(id);
      const updated = await channelRepo.findById(id);
      res.json({ success: true, channel: updated });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Deactivate channel
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      await channelRepo.delete(id);
      res.json({ success: true, message: 'Channel deactivated' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
