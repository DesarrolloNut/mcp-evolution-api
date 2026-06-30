/**
 * Settings Controller — /settings/*
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../types.js";
import { instanceField } from "../schemas/common.js";

const tools: ToolDef[] = [
  {
    name: "evolution_settings_set",
    description: "Update behavior settings for an instance.",
    inputSchema: z.object({
      instance: instanceField,
      rejectCall: z.boolean().optional().describe("Automatically reject incoming calls."),
      msgCall: z.string().optional().describe("Message to send when rejecting a call."),
      groupsIgnore: z.boolean().optional().describe("Ignore group messages."),
      alwaysOnline: z.boolean().optional().describe("Keep the instance always online."),
      readMessages: z.boolean().optional().describe("Mark received messages as read."),
      readStatus: z.boolean().optional().describe("Mark statuses as read."),
      syncFullHistory: z.boolean().optional().describe("Sync full chat history on connect."),
      wavoipToken: z.string().optional().describe("WAVoIP token (calls)."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/settings/set/${inst}`, { body });
    },
  },
  {
    name: "evolution_settings_find",
    description: "Get the current settings of an instance.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.get(`/settings/find/${inst}`);
    },
  },
];

export const settingsGroup: ToolGroup = {
  group: "settings",
  core: true,
  label: "Instance settings",
  tools,
};
