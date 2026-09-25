import { UnifiedToolDef } from './types.js';
import { messagingTools } from './tools/messaging.js';
import { chatTools } from './tools/chat.js';
import { groupTools } from './tools/group.js';

export interface ToolRegistry {
  tools: UnifiedToolDef[];
  byName: Map<string, UnifiedToolDef>;
}

export function buildUnifiedRegistry(): ToolRegistry {
  const baseTools: UnifiedToolDef[] = [
    ...messagingTools,
    ...chatTools,
    ...groupTools,
  ];

  const tools: UnifiedToolDef[] = [...baseTools];
  const byName = new Map<string, UnifiedToolDef>();

  for (const tool of baseTools) {
    byName.set(tool.name, tool);

    // Register retrocompatible evolution_* alias if name starts with whatsapp_
    if (tool.name.startsWith('whatsapp_')) {
      const aliasName = tool.name.replace('whatsapp_', 'evolution_');
      const aliasTool: UnifiedToolDef = {
        ...tool,
        name: aliasName,
        description: `[Legacy Alias for ${tool.name}] ${tool.description}`,
      };
      tools.push(aliasTool);
      byName.set(aliasName, aliasTool);
    }
  }

  return {
    tools,
    byName,
  };
}
