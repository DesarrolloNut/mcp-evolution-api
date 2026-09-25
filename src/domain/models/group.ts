export interface GroupParticipant {
  id: string; // JID
  admin?: 'admin' | 'superadmin' | null;
}

export interface GroupInfo {
  id: string; // JID
  subject: string;
  description?: string;
  owner?: string;
  creation?: number;
  participants: GroupParticipant[];
  raw?: unknown;
}

export interface CreateGroupParams {
  subject: string;
  participants: string[];
  description?: string;
}
