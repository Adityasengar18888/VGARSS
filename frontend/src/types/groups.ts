/**
 * Virtual Group & RBAC Membership Models for VGARSS
 */

export interface VirtualGroup {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  user_role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface GroupMember {
  user_id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  created_at?: string;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
}

export interface AddMemberPayload {
  username: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

