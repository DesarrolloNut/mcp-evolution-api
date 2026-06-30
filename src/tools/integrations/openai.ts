/**
 * OpenAI integration — /openai/*  (bots + credentials)
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../../types.js";
import { instanceField } from "../../schemas/common.js";
import { makeBotCrudTools, makeFetchSessionsTool } from "./botFactory.js";

const credsTools: ToolDef[] = [
  {
    name: "evolution_openai_creds_set",
    description: "Add an OpenAI API credential to an instance.",
    inputSchema: z.object({
      instance: instanceField,
      name: z.string().describe("Credential name."),
      apiKey: z.string().describe("OpenAI API key."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/openai/creds/${inst}`, { body });
    },
  },
  {
    name: "evolution_openai_creds_find",
    description: "List OpenAI credentials for an instance.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.get(`/openai/creds/${inst}`);
    },
  },
  {
    name: "evolution_openai_creds_delete",
    description: "Delete an OpenAI credential by id.",
    inputSchema: z.object({
      instance: instanceField,
      id: z.string().describe("Credential id."),
    }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.delete(`/openai/creds/${args.id}/${inst}`);
    },
  },
];

const tools: ToolDef[] = [
  ...makeBotCrudTools({ group: "openai", base: "openai", label: "OpenAI" }),
  makeFetchSessionsTool("openai", "openai", "OpenAI"),
  ...credsTools,
];

export const openaiGroup: ToolGroup = {
  group: "openai",
  core: false,
  label: "OpenAI",
  tools,
};
