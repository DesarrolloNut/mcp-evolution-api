/**
 * AWS SQS integration — /sqs/*  (Evolution v2.2+ nested body format)
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../../types.js";
import { instanceField } from "../../schemas/common.js";

const tools: ToolDef[] = [
  {
    name: "evolution_sqs_set",
    description: "Configure AWS SQS event publishing for an instance.",
    inputSchema: z.object({
      instance: instanceField,
      enabled: z.boolean().describe("Enable or disable SQS events."),
      events: z
        .array(z.string())
        .optional()
        .describe("Events to publish, e.g. ['MESSAGES_UPSERT','SEND_MESSAGE']. Omit for all."),
    }),
    handler: async (client, args) => {
      const { instance, ...sqs } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/sqs/set/${inst}`, { body: { sqs } });
    },
  },
  {
    name: "evolution_sqs_find",
    description: "Get the SQS configuration for an instance.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.get(`/sqs/find/${inst}`);
    },
  },
];

export const sqsGroup: ToolGroup = {
  group: "sqs",
  core: false,
  label: "AWS SQS",
  tools,
};
