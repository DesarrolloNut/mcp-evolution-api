import { z } from 'zod';
import { UnifiedToolDef } from '../types.js';

export const chatTools: UnifiedToolDef[] = [
  {
    name: 'whatsapp_find_messages',
    description: 'Retrieve conversation history/messages for a chat. Response data is wrapped for security.',
    inputSchema: z.object({
      chatId: z.string().optional().describe('Chat JID or phone number (e.g. 18095551234@s.whatsapp.net)'),
      count: z.number().int().min(1).max(100).optional().describe('Number of messages to retrieve (default 20)'),
      channel: z.string().optional().describe('Channel/line name to query'),
      instance: z.string().optional().describe('Legacy alias for channel'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        chatId?: string;
        count?: number;
        channel?: string;
        instance?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, adapter } = await resolver.resolve(channelName);
      return adapter.findMessages(
        {
          chatId: args.chatId,
          count: args.count,
        },
        channel
      );
    },
  },

  {
    name: 'whatsapp_find_chats',
    description: 'List recent active chats/conversations on the WhatsApp line.',
    inputSchema: z.object({
      channel: z.string().optional().describe('Channel/line name to query'),
      instance: z.string().optional().describe('Legacy alias for channel'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        channel?: string;
        instance?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, adapter } = await resolver.resolve(channelName);
      return adapter.findChats(channel);
    },
  },

  {
    name: 'whatsapp_check_number',
    description: 'Verify if a phone number is registered on WhatsApp.',
    inputSchema: z.object({
      phoneNumber: z.string().min(1).describe('Phone number to verify (digits only, e.g. 18095551234)'),
      channel: z.string().optional().describe('Channel/line name to use for checking'),
      instance: z.string().optional().describe('Legacy alias for channel'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        phoneNumber: string;
        channel?: string;
        instance?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, adapter } = await resolver.resolve(channelName);
      return adapter.checkNumber(args.phoneNumber, channel);
    },
  },
];
