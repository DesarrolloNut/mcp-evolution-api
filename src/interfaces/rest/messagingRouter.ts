import { Router, Request, Response } from 'express';
import { ChannelResolver } from '../../application/services/channelResolver.js';
import { createApiAuthMiddleware } from './middleware/apiAuth.js';
import { IGroupProvider } from '../../domain/ports/IGroupProvider.js';
import { ProviderCapabilityError } from '../../domain/errors.js';

function assertGroupProvider(adapter: unknown, providerType: string): asserts adapter is IGroupProvider {
  if (
    !adapter ||
    typeof (adapter as IGroupProvider).createGroup !== 'function' ||
    typeof (adapter as IGroupProvider).getGroupInfo !== 'function'
  ) {
    throw new ProviderCapabilityError(providerType, 'groups');
  }
}

export function createMessagingRestRouter(resolver: ChannelResolver, apiToken?: string): Router {
  const router = Router();
  const authMiddleware = createApiAuthMiddleware(apiToken);

  // Apply API authentication to all messaging endpoints
  router.use(authMiddleware);

  // ── MESSAGES ───────────────────────────────────────────────────────────────

  // Send Text Message
  router.post('/messages/text', async (req: Request, res: Response) => {
    try {
      const { recipient, text, channel, delay, linkPreview, mentions, quotedMessageId } = req.body || {};
      if (!recipient || !text) {
        res.status(400).json({ error: 'Missing required fields: recipient, text' });
        return;
      }

      const { channel: resolvedChannel, adapter } = await resolver.resolve(channel);
      const result = await adapter.sendText(
        {
          recipient: String(recipient).trim(),
          text: String(text),
          delay: typeof delay === 'number' ? delay : undefined,
          linkPreview: typeof linkPreview === 'boolean' ? linkPreview : undefined,
          mentions: Array.isArray(mentions) ? mentions : undefined,
          quotedMessageId: quotedMessageId ? String(quotedMessageId) : undefined,
        },
        resolvedChannel
      );

      res.status(200).json({
        success: true,
        channel: resolvedChannel.name,
        result,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Send Media Message
  router.post('/messages/media', async (req: Request, res: Response) => {
    try {
      const { recipient, mediaType, mediaUrl, mediaBase64, caption, fileName, mimetype, channel } = req.body || {};
      if (!recipient || !mediaType || (!mediaUrl && !mediaBase64)) {
        res.status(400).json({ error: 'Missing required fields: recipient, mediaType, and mediaUrl or mediaBase64' });
        return;
      }

      const { channel: resolvedChannel, adapter } = await resolver.resolve(channel);
      const result = await adapter.sendMedia(
        {
          recipient: String(recipient).trim(),
          mediaType,
          mediaUrl: mediaUrl ? String(mediaUrl).trim() : undefined,
          mediaBase64: mediaBase64 ? String(mediaBase64).trim() : undefined,
          caption: caption ? String(caption) : undefined,
          fileName: fileName ? String(fileName) : undefined,
          mimetype: mimetype ? String(mimetype) : undefined,
        },
        resolvedChannel
      );

      res.status(200).json({
        success: true,
        channel: resolvedChannel.name,
        result,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Send Location
  router.post('/messages/location', async (req: Request, res: Response) => {
    try {
      const { recipient, latitude, longitude, name, address, channel } = req.body || {};
      if (!recipient || typeof latitude !== 'number' || typeof longitude !== 'number') {
        res.status(400).json({ error: 'Missing required fields: recipient, latitude (number), longitude (number)' });
        return;
      }

      const { channel: resolvedChannel, adapter } = await resolver.resolve(channel);
      const result = await adapter.sendLocation(
        {
          recipient: String(recipient).trim(),
          latitude,
          longitude,
          name: name ? String(name) : undefined,
          address: address ? String(address) : undefined,
        },
        resolvedChannel
      );

      res.status(200).json({
        success: true,
        channel: resolvedChannel.name,
        result,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Send Contact Card
  router.post('/messages/contact', async (req: Request, res: Response) => {
    try {
      const { recipient, contactName, contactPhone, channel } = req.body || {};
      if (!recipient || !contactName || !contactPhone) {
        res.status(400).json({ error: 'Missing required fields: recipient, contactName, contactPhone' });
        return;
      }

      const { channel: resolvedChannel, adapter } = await resolver.resolve(channel);
      const result = await adapter.sendContact(
        {
          recipient: String(recipient).trim(),
          contactName: String(contactName).trim(),
          contactPhone: String(contactPhone).trim(),
        },
        resolvedChannel
      );

      res.status(200).json({
        success: true,
        channel: resolvedChannel.name,
        result,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Send Reaction
  router.post('/messages/reaction', async (req: Request, res: Response) => {
    try {
      const { recipient, messageId, reaction, channel } = req.body || {};
      if (!recipient || !messageId || reaction === undefined) {
        res.status(400).json({ error: 'Missing required fields: recipient, messageId, reaction' });
        return;
      }

      const { channel: resolvedChannel, adapter } = await resolver.resolve(channel);
      const result = await adapter.sendReaction(
        {
          recipient: String(recipient).trim(),
          messageId: String(messageId).trim(),
          reaction: String(reaction),
        },
        resolvedChannel
      );

      res.status(200).json({
        success: true,
        channel: resolvedChannel.name,
        result,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Query Messages
  router.get('/messages', async (req: Request, res: Response) => {
    try {
      const chatId = req.query.chatId ? String(req.query.chatId) : undefined;
      const count = req.query.count ? parseInt(String(req.query.count), 10) : 20;
      const channel = req.query.channel ? String(req.query.channel) : undefined;

      const { channel: resolvedChannel, adapter } = await resolver.resolve(channel);
      const messages = await adapter.findMessages({ chatId, count }, resolvedChannel);

      res.json({
        channel: resolvedChannel.name,
        count: messages.length,
        messages,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // ── CHATS ──────────────────────────────────────────────────────────────────

  // List Active Chats
  router.get('/chats', async (req: Request, res: Response) => {
    try {
      const channel = req.query.channel ? String(req.query.channel) : undefined;
      const { channel: resolvedChannel, adapter } = await resolver.resolve(channel);
      const chats = await adapter.findChats(resolvedChannel);

      res.json({
        channel: resolvedChannel.name,
        count: chats.length,
        chats,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Check Number on WhatsApp
  router.get('/chats/check-number/:phone', async (req: Request, res: Response) => {
    try {
      const phoneNumber = String(req.params.phone).trim();
      const channel = req.query.channel ? String(req.query.channel) : undefined;

      const { channel: resolvedChannel, adapter } = await resolver.resolve(channel);
      const result = await adapter.checkNumber(phoneNumber, resolvedChannel);

      res.json({
        channel: resolvedChannel.name,
        result,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // ── GROUPS ─────────────────────────────────────────────────────────────────

  // Create Group
  router.post('/groups', async (req: Request, res: Response) => {
    try {
      const { subject, participants, description, channel } = req.body || {};
      if (!subject || !Array.isArray(participants) || participants.length === 0) {
        res.status(400).json({ error: 'Missing required fields: subject, participants (array)' });
        return;
      }

      const { channel: resolvedChannel, provider, adapter } = await resolver.resolve(channel);
      assertGroupProvider(adapter, provider.type);

      const group = await adapter.createGroup(
        {
          subject: String(subject).trim(),
          participants,
          description: description ? String(description) : undefined,
        },
        resolvedChannel
      );

      res.status(201).json({
        channel: resolvedChannel.name,
        group,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Get Group Info
  router.get('/groups/:jid', async (req: Request, res: Response) => {
    try {
      const groupJid = String(req.params.jid).trim();
      const channel = req.query.channel ? String(req.query.channel) : undefined;

      const { channel: resolvedChannel, provider, adapter } = await resolver.resolve(channel);
      assertGroupProvider(adapter, provider.type);

      const group = await adapter.getGroupInfo(groupJid, resolvedChannel);
      res.json({
        channel: resolvedChannel.name,
        group,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Update Group Participants
  router.post('/groups/:jid/participants', async (req: Request, res: Response) => {
    try {
      const groupJid = String(req.params.jid).trim();
      const { action, participants, channel } = req.body || {};

      if (!action || !Array.isArray(participants) || participants.length === 0) {
        res.status(400).json({ error: 'Missing required fields: action (add|remove|promote|demote), participants (array)' });
        return;
      }

      const { channel: resolvedChannel, provider, adapter } = await resolver.resolve(channel);
      assertGroupProvider(adapter, provider.type);

      await adapter.updateGroupParticipants(groupJid, action, participants, resolvedChannel);
      res.json({
        success: true,
        channel: resolvedChannel.name,
        groupJid,
        action,
        participants,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Leave Group
  router.delete('/groups/:jid', async (req: Request, res: Response) => {
    try {
      const groupJid = String(req.params.jid).trim();
      const channel = req.query.channel ? String(req.query.channel) : undefined;

      const { channel: resolvedChannel, provider, adapter } = await resolver.resolve(channel);
      assertGroupProvider(adapter, provider.type);

      await adapter.leaveGroup(groupJid, resolvedChannel);
      res.json({
        success: true,
        message: `Left group ${groupJid}`,
        channel: resolvedChannel.name,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  return router;
}
