/**
 * Profile Settings Controller — /chat/* (profile-related endpoints)
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../types.js";
import { instanceField, numberField } from "../schemas/common.js";

const tools: ToolDef[] = [
  {
    name: "evolution_profile_fetch_business",
    description: "Fetch the business profile of a number.",
    inputSchema: z.object({ instance: instanceField, number: numberField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.post(`/chat/fetchBusinessProfile/${inst}`, { body: { number: args.number } });
    },
  },
  {
    name: "evolution_profile_fetch",
    description: "Fetch the profile (name, status, picture) of a number.",
    inputSchema: z.object({ instance: instanceField, number: numberField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.post(`/chat/fetchProfile/${inst}`, { body: { number: args.number } });
    },
  },
  {
    name: "evolution_profile_update_name",
    description: "Update the instance's own profile name.",
    inputSchema: z.object({ instance: instanceField, name: z.string().describe("New profile name.") }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.post(`/chat/updateProfileName/${inst}`, { body: { name: args.name } });
    },
  },
  {
    name: "evolution_profile_update_status",
    description: "Update the instance's own profile status/about text.",
    inputSchema: z.object({
      instance: instanceField,
      status: z.string().describe("New status text."),
    }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.post(`/chat/updateProfileStatus/${inst}`, { body: { status: args.status } });
    },
  },
  {
    name: "evolution_profile_update_picture",
    description: "Update the instance's own profile picture by URL.",
    inputSchema: z.object({
      instance: instanceField,
      picture: z.string().describe("Image URL for the new profile picture."),
    }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.post(`/chat/updateProfilePicture/${inst}`, { body: { picture: args.picture } });
    },
  },
  {
    name: "evolution_profile_remove_picture",
    description: "Remove the instance's own profile picture.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.delete(`/chat/removeProfilePicture/${inst}`);
    },
  },
  {
    name: "evolution_profile_fetch_privacy",
    description: "Fetch the instance's privacy settings.",
    inputSchema: z.object({ instance: instanceField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.get(`/chat/fetchPrivacySettings/${inst}`);
    },
  },
  {
    name: "evolution_profile_update_privacy",
    description: "Update the instance's privacy settings.",
    inputSchema: z.object({
      instance: instanceField,
      readreceipts: z.enum(["all", "none"]).optional().describe("Read receipts visibility."),
      profile: z
        .enum(["all", "contacts", "contact_blacklist", "none"])
        .optional()
        .describe("Profile photo visibility."),
      status: z
        .enum(["all", "contacts", "contact_blacklist", "none"])
        .optional()
        .describe("Status visibility."),
      online: z.enum(["all", "match_last_seen"]).optional().describe("Online visibility."),
      last: z
        .enum(["all", "contacts", "contact_blacklist", "none"])
        .optional()
        .describe("Last seen visibility."),
      groupadd: z
        .enum(["all", "contacts", "contact_blacklist", "none"])
        .optional()
        .describe("Who can add the instance to groups."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/chat/updatePrivacySettings/${inst}`, { body });
    },
  },
];

export const profileGroup: ToolGroup = {
  group: "profile",
  core: true,
  label: "Profile settings",
  tools,
};
