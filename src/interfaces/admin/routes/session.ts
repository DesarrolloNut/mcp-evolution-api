import { Router, Request, Response } from 'express';
import { IChannelRepository } from '../../../domain/ports/IChannelRepository.js';
import { IProviderRepository } from '../../../domain/ports/IProviderRepository.js';
import { BaileysSessionManager } from '../../../infrastructure/providers/baileys/sessionManager.js';

export function createSessionRouter(
  channelRepo: IChannelRepository,
  providerRepo: IProviderRepository,
  sessionManager: BaileysSessionManager = BaileysSessionManager.getInstance()
): Router {
  const router = Router();

  // Helper to validate channel and ensure it belongs to a baileys provider
  async function resolveBaileysChannel(channelId: string) {
    const channel = await channelRepo.findById(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const provider = await providerRepo.findById(channel.providerId);
    if (!provider) {
      throw new Error(`Provider not found for channel: ${channel.providerId}`);
    }

    if (provider.type !== 'baileys') {
      throw new Error(
        `Channel '${channel.name}' belongs to a '${provider.type}' provider, not an embedded Baileys provider.`
      );
    }

    return { channel, provider };
  }

  // Start or get Baileys session for a channel
  router.post('/:id/session/start', async (req: Request, res: Response) => {
    try {
      const channelId = String(req.params.id);
      await resolveBaileysChannel(channelId);

      const session = await sessionManager.startSession(channelId);
      res.json({
        success: true,
        channelId,
        status: session.status,
        qrDataUrl: session.qrDataUrl,
        userPhone: session.userPhone,
        isConnected: session.status === 'connected',
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Get current QR Code and status
  router.get('/:id/session/qr', async (req: Request, res: Response) => {
    try {
      const channelId = String(req.params.id);
      await resolveBaileysChannel(channelId);

      // If session isn't running, start it
      let session = sessionManager.getSession(channelId);
      if (!session || session.status === 'disconnected') {
        session = await sessionManager.startSession(channelId);
      }

      const status = sessionManager.getStatus(channelId);
      res.json({
        channelId,
        status: status.status,
        qrDataUrl: status.qrDataUrl,
        userPhone: status.userPhone,
        isConnected: status.isConnected,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Get connection status
  router.get('/:id/session/status', async (req: Request, res: Response) => {
    try {
      const channelId = String(req.params.id);
      await resolveBaileysChannel(channelId);

      const status = sessionManager.getStatus(channelId);
      res.json({
        channelId,
        ...status,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Logout / Disconnect session
  router.post('/:id/session/logout', async (req: Request, res: Response) => {
    try {
      const channelId = String(req.params.id);
      await resolveBaileysChannel(channelId);

      await sessionManager.logoutSession(channelId);
      res.json({
        success: true,
        channelId,
        message: 'Session disconnected and credentials cleared from storage.',
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  return router;
}
