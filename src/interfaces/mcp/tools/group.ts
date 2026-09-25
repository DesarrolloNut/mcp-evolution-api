import { z } from 'zod';
import { UnifiedToolDef } from '../types.js';
import { ProviderCapabilityError } from '../../../domain/errors.js';
import { IGroupProvider } from '../../../domain/ports/IGroupProvider.js';

function assertGroupProvider(adapter: unknown, providerType: string): asserts adapter is IGroupProvider {
  if (
    !adapter ||
    typeof (adapter as IGroupProvider).createGroup !== 'function' ||
    typeof (adapter as IGroupProvider).getGroupInfo !== 'function'
  ) {
    throw new ProviderCapabilityError(providerType, 'groups');
  }
}

export const groupTools: UnifiedToolDef[] = [
  {
    name: 'whatsapp_create_group',
    description: 'Create a new WhatsApp group chat with subject and initial participants.',
    inputSchema: z.object({
      subject: z.string().min(1).max(100).describe('Group title/subject'),
      participants: z.array(z.string()).min(1).describe('Array of phone numbers to invite as initial participants'),
      description: z.string().optional().describe('Group description text'),
      channel: z.string().optional().describe('Channel/line name'),
      instance: z.string().optional().describe('Legacy alias for channel'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        subject: string;
        participants: string[];
        description?: string;
        channel?: string;
        instance?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, provider, adapter } = await resolver.resolve(channelName);
      assertGroupProvider(adapter, provider.type);

      return adapter.createGroup(
        {
          subject: args.subject,
          participants: args.participants,
          description: args.description,
        },
        channel
      );
    },
  },

  {
    name: 'whatsapp_get_group_info',
    description: 'Get details, participant list, and metadata of a WhatsApp group.',
    inputSchema: z.object({
      groupJid: z.string().min(1).describe('Group JID (e.g. 12345-67890@g.us)'),
      channel: z.string().optional().describe('Channel/line name'),
      instance: z.string().optional().describe('Legacy alias for channel'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        groupJid: string;
        channel?: string;
        instance?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, provider, adapter } = await resolver.resolve(channelName);
      assertGroupProvider(adapter, provider.type);

      return adapter.getGroupInfo(args.groupJid, channel);
    },
  },

  {
    name: 'whatsapp_update_group_participants',
    description: 'Add, remove, promote or demote members in a WhatsApp group.',
    inputSchema: z.object({
      groupJid: z.string().min(1).describe('Group JID'),
      action: z.enum(['add', 'remove', 'promote', 'demote']).describe('Action to perform on participants'),
      participants: z.array(z.string()).min(1).describe('Array of participant phone numbers / JIDs'),
      channel: z.string().optional().describe('Channel/line name'),
      instance: z.string().optional().describe('Legacy alias for channel'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        groupJid: string;
        action: 'add' | 'remove' | 'promote' | 'demote';
        participants: string[];
        channel?: string;
        instance?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, provider, adapter } = await resolver.resolve(channelName);
      assertGroupProvider(adapter, provider.type);

      await adapter.updateGroupParticipants(args.groupJid, args.action, args.participants, channel);
      return { success: true, action: args.action, participants: args.participants };
    },
  },

  {
    name: 'whatsapp_leave_group',
    description: 'Leave/exit a WhatsApp group chat.',
    inputSchema: z.object({
      groupJid: z.string().min(1).describe('Group JID to leave'),
      channel: z.string().optional().describe('Channel/line name'),
      instance: z.string().optional().describe('Legacy alias for channel'),
    }),
    handler: async (resolver, rawArgs) => {
      const args = rawArgs as {
        groupJid: string;
        channel?: string;
        instance?: string;
      };
      const channelName = args.channel || args.instance;
      const { channel, provider, adapter } = await resolver.resolve(channelName);
      assertGroupProvider(adapter, provider.type);

      await adapter.leaveGroup(args.groupJid, channel);
      return { success: true, message: `Left group ${args.groupJid}` };
    },
  },
];
