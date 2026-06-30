/**
 * Reusable zod fragments shared across tool definitions.
 */

import { z } from "zod";

/** Optional instance override; falls back to EVOLUTION_DEFAULT_INSTANCE. */
export const instanceField = z
  .string()
  .optional()
  .describe(
    "WhatsApp instance name. Optional if EVOLUTION_DEFAULT_INSTANCE is configured.",
  );

/** A recipient number or full JID (e.g. 5215550123 or 5215550123@s.whatsapp.net). */
export const numberField = z
  .string()
  .describe("Recipient phone number (digits, country code) or full WhatsApp JID.");

/** A WhatsApp message key, used to reference an existing message. */
export const messageKey = z
  .object({
    remoteJid: z.string().describe("Chat JID, e.g. 5215550123@s.whatsapp.net"),
    fromMe: z.boolean().describe("Whether the referenced message was sent by this instance."),
    id: z.string().describe("Message ID."),
    participant: z
      .string()
      .optional()
      .describe("Participant JID (for group messages)."),
  })
  .describe("WhatsApp message key.");

/** Optional send-time options common to most message endpoints. */
export const sendOptionsShape = {
  delay: z.number().int().nonnegative().optional().describe("Delay in milliseconds before sending."),
  quoted: z
    .object({ key: messageKey, message: z.record(z.any()).optional() })
    .optional()
    .describe("Message to quote/reply to."),
  mentionsEveryOne: z.boolean().optional().describe("Mention all group participants."),
  mentioned: z
    .array(z.string())
    .optional()
    .describe("List of JIDs to mention, e.g. ['5215550123@s.whatsapp.net']."),
};
