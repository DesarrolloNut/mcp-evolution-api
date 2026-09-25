import { Router, Request, Response } from 'express';
import { IProviderRepository } from '../../../domain/ports/IProviderRepository.js';
import { IChannelRepository } from '../../../domain/ports/IChannelRepository.js';

export function createDashboardRouter(
  providerRepo: IProviderRepository,
  channelRepo: IChannelRepository
): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const providers = await providerRepo.findAll({ activeOnly: true });
      const channels = await channelRepo.findAll({ activeOnly: true });
      const defaultChannel = await channelRepo.findDefault();

      res.json({
        activeProvidersCount: providers.length,
        activeChannelsCount: channels.length,
        defaultChannel: defaultChannel
          ? {
              id: defaultChannel.id,
              name: defaultChannel.name,
              phoneNumber: defaultChannel.phoneNumber,
            }
          : null,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
