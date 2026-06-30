/**
 * Typebot integration — /typebot/*
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../../types.js";
import { instanceField } from "../../schemas/common.js";
import { makeBotCrudTools, makeFetchSessionsTool } from "./botFactory.js";

const startTool: ToolDef = {
  name: "evolution_typebot_start",
  description: "Start a Typebot flow for a specific chat.",
  inputSchema: z.object({
    instance: instanceField,
    url: z.string().describe("Typebot base URL."),
    typebot: z.string().describe("Typebot public id."),
    remoteJid: z.string().describe("Target chat JID."),
    startSession: z.boolean().optional().describe("Persist the session."),
    variables: z
      .array(z.object({ name: z.string(), value: z.string() }))
      .optional()
      .describe("Initial variables."),
  }),
  handler: async (client, args) => {
    const { instance, ...body } = args;
    const inst = client.resolveInstance(instance as string | undefined);
    return client.post(`/typebot/start/${inst}`, { body });
  },
};

const tools: ToolDef[] = [
  ...makeBotCrudTools({ group: "typebot", base: "typebot", label: "Typebot" }),
  startTool,
  makeFetchSessionsTool("typebot", "typebot", "Typebot"),
];

export const typebotGroup: ToolGroup = {
  group: "typebot",
  core: false,
  label: "Typebot",
  tools,
};
