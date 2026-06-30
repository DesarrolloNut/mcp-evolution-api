/**
 * Chatwoot integration — /chatwoot/*  (flat body)
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../../types.js";
import { instanceField } from "../../schemas/common.js";

const tools: ToolDef[] = [
  {
    name: "evolution_chatwoot_set",
    description: "Configure the Chatwoot integration for an instance.",
    inputSchema: z.object({
      instance: instanceField,
      enabled: z.boolean().describe("Enable or disable Chatwoot."),
      accountId: z.string().describe("Chatwoot account id."),
      token: z.string().describe("Chatwoot API token."),
      url: z.string().describe("Chatwoot base URL."),
      signMsg: z.boolean().optional().describe("Sign messages with agent name."),
      signDelimiter: z.string().optional().describe("Delimiter for the signature."),
      nameInbox: z.string().optional().describe("Inbox name."),
      reopenConversation: z.boolean().optional().describe("Reopen conversations on new message."),
      conversationPending: z.boolean().optional().describe("Open conversations as pending."),
      mergeBrazilContacts: z.boolean().optional().describe("Merge Brazilian contact number variants."),
      importContacts: z.boolean().optional().describe("Import existing contacts."),
      importMessages: z.boolean().optional().describe("Import existing messages."),
      daysLimitImportMessages: z.number().int().optional().describe("Days of history to import."),
      organization: z.string().optional().describe("Bot organization name."),
      logo: z.string().optional().describe("Bot logo URL."),
      ignoreJids: z.array(z.string()).optional().describe("JIDs to ignore."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/chatwoot/set/${inst}`, { body });
    },
  },
  {
    name: "evolution_chatwoot_find",
    description: "Get the Chatwoot configuration for an instance.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.get(`/chatwoot/find/${inst}`);
    },
  },
];

export const chatwootGroup: ToolGroup = {
  group: "chatwoot",
  core: false,
  label: "Chatwoot",
  tools,
};
