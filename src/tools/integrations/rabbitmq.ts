/**
 * RabbitMQ integration — /rabbitmq/*  (Evolution v2.2+ nested body format)
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../../types.js";
import { instanceField } from "../../schemas/common.js";

const tools: ToolDef[] = [
  {
    name: "evolution_rabbitmq_set",
    description: "Configure RabbitMQ event publishing for an instance.",
    inputSchema: z.object({
      instance: instanceField,
      enabled: z.boolean().describe("Enable or disable RabbitMQ events."),
      events: z
        .array(z.string())
        .optional()
        .describe("Events to publish, e.g. ['MESSAGES_UPSERT','SEND_MESSAGE']. Omit for all."),
    }),
    handler: async (client, args) => {
      const { instance, ...rabbitmq } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/rabbitmq/set/${inst}`, { body: { rabbitmq } });
    },
  },
  {
    name: "evolution_rabbitmq_find",
    description: "Get the RabbitMQ configuration for an instance.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.get(`/rabbitmq/find/${inst}`);
    },
  },
];

export const rabbitmqGroup: ToolGroup = {
  group: "rabbitmq",
  core: false,
  label: "RabbitMQ",
  tools,
};
