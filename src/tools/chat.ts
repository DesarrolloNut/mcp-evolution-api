/**
 * Chat Controller — /chat/*
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../types.js";
import { instanceField, numberField, messageKey } from "../schemas/common.js";

const tools: ToolDef[] = [
  {
    name: "evolution_chat_check_numbers",
    description: "Check which numbers are registered on WhatsApp.",
    inputSchema: z.object({
      instance: instanceField,
      numbers: z.array(z.string()).min(1).describe("Phone numbers to check (with country code)."),
    }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.post(`/chat/whatsappNumbers/${inst}`, { body: { numbers: args.numbers } });
    },
  },
  {
    name: "evolution_chat_mark_read",
    description: "Mark one or more messages as read.",
    inputSchema: z.object({
      instance: instanceField,
      readMessages: z.array(messageKey).describe("Message keys to mark as read."),
    }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.post(`/chat/markMessageAsRead/${inst}`, {
        body: { readMessages: args.readMessages },
      });
    },
  },
  {
    name: "evolution_chat_mark_unread",
    description: "Mark a chat as unread.",
    inputSchema: z.object({
      instance: instanceField,
      chat: z.string().describe("Chat JID."),
      lastMessage: z.object({ key: messageKey }).describe("Last message in the chat."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/chat/markChatUnread/${inst}`, { body });
    },
  },
  {
    name: "evolution_chat_archive",
    description: "Archive or unarchive a chat.",
    inputSchema: z.object({
      instance: instanceField,
      chat: z.string().describe("Chat JID."),
      archive: z.boolean().describe("true to archive, false to unarchive."),
      lastMessage: z.object({ key: messageKey }).describe("Last message in the chat."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/chat/archiveChat/${inst}`, { body });
    },
  },
  {
    name: "evolution_chat_delete_message",
    description: "Delete a message for everyone.",
    inputSchema: z.object({
      instance: instanceField,
      id: z.string().describe("Message id."),
      remoteJid: z.string().describe("Chat JID."),
      fromMe: z.boolean().describe("Whether the message was sent by this instance."),
      participant: z.string().optional().describe("Participant JID (group messages)."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.delete(`/chat/deleteMessageForEveryone/${inst}`, { body });
    },
  },
  {
    name: "evolution_chat_send_presence",
    description: "Send a presence indicator to a chat (composing/recording/paused).",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      presence: z
        .enum(["composing", "recording", "paused", "available", "unavailable"])
        .describe("Presence to display."),
      delay: z.number().int().nonnegative().optional().describe("How long to show it, in ms."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/chat/sendPresence/${inst}`, { body });
    },
  },
  {
    name: "evolution_chat_update_block",
    description: "Block or unblock a contact.",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      status: z.enum(["block", "unblock"]).describe("Block action."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/chat/updateBlockStatus/${inst}`, { body });
    },
  },
  {
    name: "evolution_chat_profile_picture_url",
    description: "Get the profile picture URL of a number.",
    inputSchema: z.object({ instance: instanceField, number: numberField }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.post(`/chat/fetchProfilePictureUrl/${inst}`, { body: { number: args.number } });
    },
  },
  {
    name: "evolution_chat_media_base64",
    description: "Get the base64 content of a media message.",
    inputSchema: z.object({
      instance: instanceField,
      message: z.record(z.any()).describe("The media message object (must include its key)."),
      convertToMp4: z.boolean().optional().describe("Convert audio/video to mp4."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/chat/getBase64FromMediaMessage/${inst}`, { body });
    },
  },
  {
    name: "evolution_chat_find_contacts",
    description: "Find contacts, optionally filtered.",
    inputSchema: z.object({
      instance: instanceField,
      where: z.record(z.any()).optional().describe("Filter object, e.g. { id: '5215550123@s.whatsapp.net' }."),
    }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.post(`/chat/findContacts/${inst}`, { body: { where: args.where ?? {} } });
    },
  },
  {
    name: "evolution_chat_find_messages",
    description: "Find messages, optionally filtered by chat and paginated.",
    inputSchema: z.object({
      instance: instanceField,
      where: z
        .record(z.any())
        .optional()
        .describe("Filter object, e.g. { key: { remoteJid: '...@s.whatsapp.net' } }."),
      page: z.number().int().positive().optional().describe("Page number."),
      offset: z.number().int().positive().optional().describe("Page size."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/chat/findMessages/${inst}`, { body });
    },
  },
  {
    name: "evolution_chat_find_status",
    description: "Find status (story) messages, optionally filtered.",
    inputSchema: z.object({
      instance: instanceField,
      where: z.record(z.any()).optional().describe("Filter object."),
    }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      return client.post(`/chat/findStatusMessage/${inst}`, { body: { where: args.where ?? {} } });
    },
  },
  {
    name: "evolution_chat_find_chats",
    description: "List chats for the instance.",
    inputSchema: z.object({
      instance: instanceField,
      where: z.record(z.any()).optional().describe("Optional filter object."),
    }),
    handler: async (client, args) => {
      const inst = client.resolveInstance(args.instance as string | undefined);
      const body = args.where ? { where: args.where } : {};
      return client.post(`/chat/findChats/${inst}`, { body });
    },
  },
  {
    name: "evolution_chat_update_message",
    description: "Edit a previously sent text message.",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      key: messageKey.describe("Key of the message to edit."),
      text: z.string().describe("New text content."),
    }),
    handler: async (client, args) => {
      const { instance, ...body } = args;
      const inst = client.resolveInstance(instance as string | undefined);
      return client.post(`/chat/updateMessage/${inst}`, { body });
    },
  },
];

export const chatGroup: ToolGroup = {
  group: "chat",
  core: true,
  label: "Chats and contacts",
  tools,
};
