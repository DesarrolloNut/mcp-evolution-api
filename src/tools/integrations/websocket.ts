/**
 * Websocket integration — /websocket/*  (Evolution v2.2+ nested body format)
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../../types.js";
import { instanceField } from "../../schemas/common.js";

const tools: ToolDef[] = [
  {
    name: "evolution_websocket_set",
    description: "Configure the websocket event stream for an instance.",
    inputSchema: z.object({
      instance: instanceField,
      enabled: z.boolean().describe("Enable or disable websocket events."),
      events: z
        .array(z.string())
        .optional()
        .describe("Events to emit, e.g. ['MESSAGES_UPSERT','CONNECTION_UPDATE']. Omit for all."),
    }),
    handler: async (client, args) => {
      const { instance, ...websocket } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/websocket/set/${inst}`, { body: { websocket } });
    },
  },
  {
    name: "evolution_websocket_find",
    description: "Get the websocket configuration for an instance.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.get(`/websocket/find/${inst}`);
    },
  },
];

export const websocketGroup: ToolGroup = {
  group: "websocket",
  core: false,
  label: "Websocket",
  tools,
};
