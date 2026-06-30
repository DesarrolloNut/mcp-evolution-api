/**
 * Webhook integration — /webhook/*  (Evolution v2.2+ nested body format)
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../../types.js";
import { instanceField } from "../../schemas/common.js";

const eventsField = z
  .array(z.string())
  .optional()
  .describe(
    "Events to subscribe to, e.g. ['MESSAGES_UPSERT','MESSAGES_UPDATE','CONNECTION_UPDATE','QRCODE_UPDATED','SEND_MESSAGE','CONTACTS_UPSERT','GROUPS_UPSERT']. Omit for all.",
  );

const tools: ToolDef[] = [
  {
    name: "evolution_webhook_set",
    description: "Configure the HTTP webhook for an instance.",
    inputSchema: z.object({
      instance: instanceField,
      enabled: z.boolean().describe("Enable or disable the webhook."),
      url: z.string().describe("Webhook URL."),
      headers: z.record(z.string()).optional().describe("Extra HTTP headers."),
      byEvents: z.boolean().optional().describe("Append the event name to the URL path."),
      base64: z.boolean().optional().describe("Send media as base64 in webhook payloads."),
      events: eventsField,
    }),
    handler: async (client, args) => {
      const { instance, ...webhook } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/webhook/set/${inst}`, { body: { webhook } });
    },
  },
  {
    name: "evolution_webhook_find",
    description: "Get the webhook configuration for an instance.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.get(`/webhook/find/${inst}`);
    },
  },
];

export const webhookGroup: ToolGroup = {
  group: "webhook",
  core: true,
  label: "Webhook",
  tools,
};
