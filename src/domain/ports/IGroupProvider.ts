import { Channel } from '../entities/channel.js';
import { GroupInfo, CreateGroupParams } from '../models/group.js';

export interface IGroupProvider {
  createGroup(params: CreateGroupParams, channel: Channel): Promise<GroupInfo>;
  getGroupInfo(groupJid: string, channel: Channel): Promise<GroupInfo>;
  updateGroupParticipants(
    groupJid: string,
    action: 'add' | 'remove' | 'promote' | 'demote',
    participants: string[],
    channel: Channel
  ): Promise<void>;
  leaveGroup(groupJid: string, channel: Channel): Promise<void>;
}
