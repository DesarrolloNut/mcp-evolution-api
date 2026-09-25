import { Router, Request, Response } from 'express';
import { IProviderRepository } from '../../../domain/ports/IProviderRepository.js';
import { IChannelRepository } from '../../../domain/ports/IChannelRepository.js';

export function createDashboardRouter(
  providerRepo: IProviderRepository,
  channelRepo: IChannelRepository,
  mcpApiToken?: string
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
        mcp: {
          endpoint: '/mcp',
          transport: 'Streamable HTTP / SSE',
          authRequired: Boolean(mcpApiToken && mcpApiToken.trim().length > 0),
          tokenPlaceholder: mcpApiToken && mcpApiToken.trim().length > 0 ? 'MCP_API_TOKEN' : null,
        },
        memoryUsage: process.memoryUsage(),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
