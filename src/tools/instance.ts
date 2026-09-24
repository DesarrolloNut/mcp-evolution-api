/**
 * Instance Controller — /instance/*
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../types.js";
import { instanceField, safeIdField } from "../schemas/common.js";

const tools: ToolDef[] = [
  {
    name: "evolution_instance_create",
    description: "Create a new WhatsApp instance.",
    inputSchema: z.object({
      instanceName: safeIdField.describe("Name for the new instance (alphanumeric, underscores, dashes, dots)."),
      integration: z
        .enum(["WHATSAPP-BAILEYS", "WHATSAPP-BUSINESS", "EVOLUTION"])
        .default("WHATSAPP-BAILEYS")
        .describe("Integration type."),
      token: z.string().optional().describe("Optional instance API token."),
      number: z.string().optional().describe("Phone number to bind (for pairing-code flow)."),
      qrcode: z.boolean().optional().describe("Return a QR code for connection."),
      webhook: z.record(z.any()).optional().describe("Inline webhook configuration object."),
      settings: z.record(z.any()).optional().describe("Inline settings object."),
    }),
    handler: async (client, args) => client.post(`/instance/create`, { body: args }),
  },
  {
    name: "evolution_instance_fetch",
    description: "List instances (optionally filtered by name or id).",
    inputSchema: z.object({
      instanceName: safeIdField.optional().describe("Filter by instance name."),
      instanceId: z.string().optional().describe("Filter by instance id."),
    }),
    handler: async (client, args) =>
      client.get(`/instance/fetchInstances`, {
        query: {
          instanceName: args.instanceName as string | undefined,
          instanceId: args.instanceId as string | undefined,
        },
      }),
  },
  {
    name: "evolution_instance_connect",
    description: "Connect an instance and get the QR code / pairing code.",
    inputSchema: z.object({
      instance: instanceField,
      number: z.string().optional().describe("Phone number for pairing-code connection."),
    }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.get(`/instance/connect/${inst}`, {
        query: { number: args.number as string | undefined },
      });
    },
  },
  {
    name: "evolution_instance_connection_state",
    description: "Get the connection state of an instance (open/connecting/close).",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.get(`/instance/connectionState/${inst}`);
    },
  },
  {
    name: "evolution_instance_restart",
    description: "Restart an instance.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.put(`/instance/restart/${inst}`);
    },
  },
  {
    name: "evolution_instance_set_presence",
    description: "Set the global presence of an instance (available/unavailable).",
    inputSchema: z.object({
      instance: instanceField,
      presence: z.enum(["available", "unavailable"]).describe("Presence state."),
    }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.post(`/instance/setPresence/${inst}`, { body: { presence: args.presence } });
    },
  },
  {
    name: "evolution_instance_logout",
    description: "Log out (disconnect) an instance without deleting it.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.delete(`/instance/logout/${inst}`);
    },
  },
  {
    name: "evolution_instance_delete",
    description: "Delete an instance permanently.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.delete(`/instance/delete/${inst}`);
    },
  },
];

export const instanceGroup: ToolGroup = {
  group: "instance",
  core: false,
  label: "Instance management",
  tools,
};
