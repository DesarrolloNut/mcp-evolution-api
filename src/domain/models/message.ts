export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

export interface SendTextParams {
  recipient: string; // Phone number or JID
  text: string;
  delay?: number;
  linkPreview?: boolean;
  mentions?: string[];
  quotedMessageId?: string;
}

export interface SendMediaParams {
  recipient: string;
  mediaType: MediaType;
  mediaUrl?: string;
  mediaBase64?: string;
  caption?: string;
  fileName?: string;
  mimetype?: string;
}

export interface SendLocationParams {
  recipient: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface SendContactParams {
  recipient: string;
  contactName: string;
  contactPhone: string;
}

export interface SendReactionParams {
  recipient: string;
  messageId: string;
  reaction: string; // Emoji, or empty string to remove reaction
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  timestamp?: number;
  raw?: unknown;
}

export interface DomainMessage {
  id: string;
  from: string;
  to: string;
  fromMe: boolean;
  timestamp: number;
  type: string;
  text?: string;
  mediaUrl?: string;
  raw?: unknown;
}
