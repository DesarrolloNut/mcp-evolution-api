/**
 * Send Message Controller — /message/*
 */

import { z } from "zod";
import type { ToolDef, ToolGroup } from "../types.js";
import {
  instanceField,
  numberField,
  messageKey,
  sendOptionsShape,
  safeMediaField,
} from "../schemas/common.js";

/** Helper: POST /message/<action>/<instance> with the args (minus instance) as body. */
function sendHandler(action: string): ToolDef["handler"] {
  return async (client, args) => {
    const { instance, ...body } = args;
    const inst = client.resolveInstance(instance as string | undefined);
    return client.post(`/message/${action}/${inst}`, { body });
  };
}

const tools: ToolDef[] = [
  {
    name: "evolution_message_send_text",
    description: "Send a text message to a WhatsApp number.",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      text: z.string().max(4096, "Message text exceeds maximum length of 4096 characters.").describe("Message text."),
      linkPreview: z.boolean().optional().describe("Enable link preview for URLs."),
      ...sendOptionsShape,
    }),
    handler: sendHandler("sendText"),
  },
  {
    name: "evolution_message_send_media",
    description: "Send an image, video, or document by URL or base64.",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      mediatype: z.enum(["image", "video", "document"]).describe("Type of media."),
      media: safeMediaField,
      mimetype: z.string().optional().describe("MIME type, e.g. image/png, application/pdf."),
      caption: z.string().optional().describe("Caption text."),
      fileName: z.string().optional().describe("File name (recommended for documents)."),
      ...sendOptionsShape,
    }),
    handler: sendHandler("sendMedia"),
  },
  {
    name: "evolution_message_send_ptv",
    description: "Send a PTV (round/instant) video message.",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      video: safeMediaField.describe("Video URL or base64."),
      ...sendOptionsShape,
    }),
    handler: sendHandler("sendPtv"),
  },
  {
    name: "evolution_message_send_audio",
    description: "Send a WhatsApp voice/audio message (PTT) by URL or base64.",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      audio: safeMediaField.describe("Audio URL or base64."),
      ...sendOptionsShape,
    }),
    handler: sendHandler("sendWhatsAppAudio"),
  },
  {
    name: "evolution_message_send_sticker",
    description: "Send a sticker by URL or base64.",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      sticker: safeMediaField.describe("Sticker image URL or base64 (webp recommended)."),
      ...sendOptionsShape,
    }),
    handler: sendHandler("sendSticker"),
  },
  {
    name: "evolution_message_send_location",
    description: "Send a location (latitude/longitude).",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      name: z.string().describe("Location name."),
      address: z.string().describe("Location address."),
      latitude: z.number().describe("Latitude."),
      longitude: z.number().describe("Longitude."),
      ...sendOptionsShape,
    }),
    handler: sendHandler("sendLocation"),
  },
  {
    name: "evolution_message_send_contact",
    description: "Send one or more contact cards.",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      contact: z
        .array(
          z.object({
            fullName: z.string().describe("Contact full name."),
            wuid: z.string().describe("WhatsApp user id (number)."),
            phoneNumber: z.string().describe("Phone number."),
            organization: z.string().optional(),
            email: z.string().optional(),
            url: z.string().optional(),
          }),
        )
        .describe("Contacts to send."),
    }),
    handler: sendHandler("sendContact"),
  },
  {
    name: "evolution_message_send_reaction",
    description: "React to a message with an emoji.",
    inputSchema: z.object({
      instance: instanceField,
      key: messageKey,
      reaction: z.string().describe("Emoji reaction, e.g. '👍'. Empty string removes the reaction."),
    }),
    handler: sendHandler("sendReaction"),
  },
  {
    name: "evolution_message_send_poll",
    description: "Send a poll with selectable options.",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      name: z.string().describe("Poll question/title."),
      selectableCount: z.number().int().positive().describe("How many options a user can pick."),
      values: z.array(z.string()).min(2).describe("Poll options."),
      ...sendOptionsShape,
    }),
    handler: sendHandler("sendPoll"),
  },
  {
    name: "evolution_message_send_list",
    description: "Send an interactive list message.",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      title: z.string().describe("List title."),
      description: z.string().describe("List description."),
      buttonText: z.string().describe("Text on the button that opens the list."),
      footerText: z.string().optional().describe("Footer text."),
      values: z
        .array(
          z.object({
            title: z.string().describe("Section title."),
            rows: z.array(
              z.object({
                title: z.string(),
                description: z.string().optional(),
                rowId: z.string(),
              }),
            ),
          }),
        )
        .describe("List sections and rows."),
      ...sendOptionsShape,
    }),
    handler: sendHandler("sendList"),
  },
  {
    name: "evolution_message_send_buttons",
    description: "Send a message with interactive buttons.",
    inputSchema: z.object({
      instance: instanceField,
      number: numberField,
      title: z.string().describe("Message title."),
      description: z.string().describe("Message body/description."),
      footer: z.string().optional().describe("Footer text."),
      buttons: z
        .array(z.record(z.any()))
        .describe(
          "Button definitions (Evolution button objects, e.g. { type, displayText, id } or url/copy/call variants).",
        ),
      ...sendOptionsShape,
    }),
    handler: sendHandler("sendButtons"),
  },
  {
    name: "evolution_message_send_status",
    description: "Post a WhatsApp status (story): text, image, video, or audio.",
    inputSchema: z.object({
      instance: instanceField,
      type: z.enum(["text", "image", "video", "audio"]).describe("Status type."),
      content: z.string().describe("Text content, or media URL/base64 depending on type."),
      caption: z.string().optional().describe("Caption (for media)."),
      backgroundColor: z.string().optional().describe("Background color (text status), e.g. #008000."),
      font: z.number().int().optional().describe("Font index (text status)."),
      allContacts: z.boolean().optional().describe("Send to all contacts."),
      statusJidList: z
        .array(z.string())
        .optional()
        .describe("Specific recipient JIDs (when allContacts is false)."),
    }),
    handler: sendHandler("sendStatus"),
  },
];

export const messageGroup: ToolGroup = {
  group: "message",
  core: true,
  label: "Send messages",
  tools,
};
