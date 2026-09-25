import { z } from 'zod';
import { ChannelResolver } from '../../application/services/channelResolver.js';

export interface UnifiedToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (resolver: ChannelResolver, args: any) => Promise<unknown>;
}
