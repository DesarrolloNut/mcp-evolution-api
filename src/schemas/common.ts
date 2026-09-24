/**
 * Reusable zod fragments shared across tool definitions.
 */

import { z } from "zod";
 
/** Regular expression for safe alphanumeric identifiers (no slashes, backslashes, or directory traversal). */
export const safeIdentifierRegex = /^[a-zA-Z0-9_\-\.]+$/;

/** A safe identifier schema preventing path traversal or special URL characters. */
export const safeIdField = z
  .string()
  .min(1)
  .regex(
    safeIdentifierRegex,
    "Identifier contains invalid characters. Only alphanumeric, '_', '-', and '.' are allowed.",
  )
  .refine((val) => !val.includes(".."), "Identifier cannot contain directory traversal '..'");

/** Optional instance override; falls back to EVOLUTION_DEFAULT_INSTANCE. */
export const instanceField = safeIdField
  .optional()
  .describe(
    "WhatsApp instance name. Optional if EVOLUTION_DEFAULT_INSTANCE is configured.",
  );

/** Blocklist of private, link-local, and cloud metadata hostnames / IP ranges to mitigate SSRF. */
export const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // AWS/GCP/Azure instance metadata
  /^::1$/,
  /^0\.0\.0\.0$/,
];

/** Validates that a URL uses http/https and does not target localhost, private IPs, or cloud metadata. */
export const safeUrlField = z
  .string()
  .url("Must be a valid URL.")
  .refine((val) => {
    try {
      const parsed = new URL(val);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }
      return !BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
    } catch {
      return false;
    }
  }, "URL must use http/https and cannot point to localhost, private IP ranges, or cloud metadata endpoints.");

/** Validates media input: allows base64/data URIs or safe public HTTP/HTTPS URLs. */
export const safeMediaField = z
  .string()
  .refine((val) => {
    if (val.startsWith("http://") || val.startsWith("https://")) {
      try {
        const parsed = new URL(val);
        return !BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
      } catch {
        return false;
      }
    }
    return true;
  }, "Media URL cannot point to localhost, private IP ranges, or cloud metadata endpoints.")
  .describe("Media URL (public HTTP/HTTPS) or base64 data string.");

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
