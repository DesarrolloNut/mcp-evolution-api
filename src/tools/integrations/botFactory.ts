/**
 * Shared CRUD factory for Evolution's AI-bot integrations (Typebot, OpenAI, Dify,
 * Evolution Bot, Flowise). These all expose the same create/find/fetch/update/
 * delete/changeStatus/settings shape under /<base>/*.
 *
 * Bot configuration objects are large and integration-specific, so create/update/
 * settings accept a free-form `config`/`settings` object passed through verbatim
 * (fill it per the Evolution API docs for the given bot).
 */

import { z } from "zod";
import type { ToolDef } from "../../types.js";
import { instanceField } from "../../schemas/common.js";

export interface BotFactoryOptions {
  /** Group key, used in tool names: evolution_<group>_<action>. */
  group: string;
  /** URL base segment, e.g. "typebot", "openai", "evolutionBot". */
  base: string;
  /** Human label for descriptions, e.g. "Typebot". */
  label: string;
}

export function makeBotCrudTools({ group, base, label }: BotFactoryOptions): ToolDef[] {
  const idField = z.string().describe(`${label} bot id.`);

  return [
    {
      name: `evolution_${group}_create`,
      description: `Create a ${label} bot configuration.`,
      inputSchema: z.object({
        instance: instanceField,
        config: z
          .record(z.any())
          .describe(`${label} bot configuration object (see Evolution API docs).`),
      }),
      handler: async (client, args) => {
        const inst = client.resolveInstance(args.instance as string | undefined);
        return client.post(`/${base}/create/${inst}`, { body: args.config });
      },
    },
    {
      name: `evolution_${group}_find`,
      description: `List all ${label} bots in an instance.`,
      inputSchema: z.object({ instance: instanceField }),
      handler: async (client, args) => {
        const inst = client.resolveInstance(args.instance as string | undefined);
        return client.get(`/${base}/find/${inst}`);
      },
    },
    {
      name: `evolution_${group}_fetch`,
      description: `Fetch a single ${label} bot by id.`,
      inputSchema: z.object({ instance: instanceField, id: idField }),
      handler: async (client, args) => {
        const inst = client.resolveInstance(args.instance as string | undefined);
        return client.get(`/${base}/fetch/${args.id}/${inst}`);
      },
    },
    {
      name: `evolution_${group}_update`,
      description: `Update a ${label} bot configuration.`,
      inputSchema: z.object({
        instance: instanceField,
        id: idField,
        config: z.record(z.any()).describe(`Updated ${label} bot configuration object.`),
      }),
      handler: async (client, args) => {
        const inst = client.resolveInstance(args.instance as string | undefined);
        return client.put(`/${base}/update/${args.id}/${inst}`, { body: args.config });
      },
    },
    {
      name: `evolution_${group}_delete`,
      description: `Delete a ${label} bot by id.`,
      inputSchema: z.object({ instance: instanceField, id: idField }),
      handler: async (client, args) => {
        const inst = client.resolveInstance(args.instance as string | undefined);
        return client.delete(`/${base}/delete/${args.id}/${inst}`);
      },
    },
    {
      name: `evolution_${group}_change_status`,
      description: `Change the ${label} session status for a chat.`,
      inputSchema: z.object({
        instance: instanceField,
        remoteJid: z.string().describe("Chat JID."),
        status: z
          .enum(["opened", "paused", "closed", "delete"])
          .describe("New session status."),
      }),
      handler: async (client, args) => {
        const { instance, ...body } = args;
        const inst = client.resolveInstance(instance as string | undefined);
        return client.post(`/${base}/changeStatus/${inst}`, { body });
      },
    },
    {
      name: `evolution_${group}_settings_set`,
      description: `Set the default ${label} settings for an instance.`,
      inputSchema: z.object({
        instance: instanceField,
        settings: z.record(z.any()).describe(`${label} default settings object.`),
      }),
      handler: async (client, args) => {
        const inst = client.resolveInstance(args.instance as string | undefined);
        return client.post(`/${base}/settings/${inst}`, { body: args.settings });
      },
    },
    {
      name: `evolution_${group}_settings_fetch`,
      description: `Get the default ${label} settings for an instance.`,
      inputSchema: z.object({ instance: instanceField }),
      handler: async (client, args) => {
        const inst = client.resolveInstance(args.instance as string | undefined);
        return client.get(`/${base}/fetchSettings/${inst}`);
      },
    },
  ];
}

/** fetchSessions/{botId}/{instance} — supported by Typebot/Dify/OpenAI/etc. */
export function makeFetchSessionsTool(group: string, base: string, label: string): ToolDef {
  return {
    name: `evolution_${group}_fetch_sessions`,
    description: `List ${label} sessions for a bot.`,
    inputSchema: z.object({
      instance: instanceField,
      id: z.string().describe(`${label} bot id.`),
    }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.get(`/${base}/fetchSessions/${args.id}/${inst}`);
    },
  };
}
