import { z } from 'zod';
import { UnifiedToolDef } from '../types.js';

export const messagingTools: UnifiedToolDef[] = [
  {
    name: 'whatsapp_send_text',
    description: 'Send a plain text message to a WhatsApp number or group. Channel defaults to the active default line.',
    inputSchema: z.object({
      recipient: z.string().min(1).describe('Recipient phone number (e.g. 18095551234) or JID'),
      text: z.string().min(1).describe('Text content to send'),
      channel: z.string().optional().describe('Channel/line name to send from (e.g. "trabajo", "personal"). Defaults to active default line if omitted.'),
      instance: z.string().optional().describe('Legacy alias for channel'),
      delay: z.number().int().min(0).max(60000).optional().describe('Simulated typing delay in milliseconds'),
      linkPreview: z.boolean().optional().describe('Whether to fetch rich link preview metadata'),
      mentions: z.array(z.string()).optional().describe('Phone numbers of participants mentioned in text'),
      quotedMessageId: z.string().optional().describe('ID of message to reply to / quote'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        recipient: string;
        text: string;
        channel?: string;
        instance?: string;
        delay?: number;
        linkPreview?: boolean;
        mentions?: string[];
        quotedMessageId?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, adapter } = await resolver.resolve(channelName);
      return adapter.sendText(
        {
          recipient: args.recipient,
          text: args.text,
          delay: args.delay,
          linkPreview: args.linkPreview,
          mentions: args.mentions,
          quotedMessageId: args.quotedMessageId,
        },
        channel
      );
    },
  },

  {
    name: 'whatsapp_send_media',
    description: 'Send media (image, video, audio, document) via WhatsApp.',
    inputSchema: z.object({
      recipient: z.string().min(1).describe('Recipient phone number or JID'),
      mediaType: z.enum(['image', 'video', 'audio', 'document', 'sticker']).describe('Type of media'),
      mediaUrl: z.string().url().optional().describe('Public HTTP/HTTPS URL of the media'),
      mediaBase64: z.string().optional().describe('Base64 data or data URI of the media'),
      caption: z.string().optional().describe('Optional caption text'),
      fileName: z.string().optional().describe('File name for document attachments'),
      mimetype: z.string().optional().describe('MIME type (e.g. application/pdf, image/png)'),
      channel: z.string().optional().describe('Channel/line to send from'),
      instance: z.string().optional().describe('Legacy alias for channel'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        recipient: string;
        mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker';
        mediaUrl?: string;
        mediaBase64?: string;
        caption?: string;
        fileName?: string;
        mimetype?: string;
        channel?: string;
        instance?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, adapter } = await resolver.resolve(channelName);
      return adapter.sendMedia(
        {
          recipient: args.recipient,
          mediaType: args.mediaType,
          mediaUrl: args.mediaUrl,
          mediaBase64: args.mediaBase64,
          caption: args.caption,
          fileName: args.fileName,
          mimetype: args.mimetype,
        },
        channel
      );
    },
  },

  {
    name: 'whatsapp_send_location',
    description: 'Send GPS location coordinates to a recipient.',
    inputSchema: z.object({
      recipient: z.string().min(1).describe('Recipient phone number or JID'),
      latitude: z.number().describe('Latitude (-90 to 90)'),
      longitude: z.number().describe('Longitude (-180 to 180)'),
      name: z.string().optional().describe('Location title or business name'),
      address: z.string().optional().describe('Address or street description'),
      channel: z.string().optional().describe('Channel/line to send from'),
      instance: z.string().optional().describe('Legacy alias for channel'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        recipient: string;
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
        channel?: string;
        instance?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, adapter } = await resolver.resolve(channelName);
      return adapter.sendLocation(
        {
          recipient: args.recipient,
          latitude: args.latitude,
          longitude: args.longitude,
          name: args.name,
          address: args.address,
        },
        channel
      );
    },
  },

  {
    name: 'whatsapp_send_contact',
    description: 'Send a contact card (vCard) to a recipient.',
    inputSchema: z.object({
      recipient: z.string().min(1).describe('Recipient phone number or JID'),
      contactName: z.string().min(1).describe('Display name of the contact'),
      contactPhone: z.string().min(1).describe('Phone number of the contact'),
      channel: z.string().optional().describe('Channel/line to send from'),
      instance: z.string().optional().describe('Legacy alias for channel'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        recipient: string;
        contactName: string;
        contactPhone: string;
        channel?: string;
        instance?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, adapter } = await resolver.resolve(channelName);
      return adapter.sendContact(
        {
          recipient: args.recipient,
          contactName: args.contactName,
          contactPhone: args.contactPhone,
        },
        channel
      );
    },
  },

  {
    name: 'whatsapp_send_reaction',
    description: 'React to an existing message with an emoji.',
    inputSchema: z.object({
      recipient: z.string().min(1).describe('Recipient phone number or JID containing the target message'),
      messageId: z.string().min(1).describe('ID of the target message to react to'),
      reaction: z.string().describe('Emoji to react with, or empty string to remove existing reaction'),
      channel: z.string().optional().describe('Channel/line to send from'),
      instance: z.string().optional().describe('Legacy alias for channel'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        recipient: string;
        messageId: string;
        reaction: string;
        channel?: string;
        instance?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, adapter } = await resolver.resolve(channelName);
      return adapter.sendReaction(
        {
          recipient: args.recipient,
          messageId: args.messageId,
          reaction: args.reaction,
        },
        channel
      );
    },
  },
];
