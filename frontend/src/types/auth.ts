/**
 * User & Authentication Models for VGARSS
 */

export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface AuthSession {
  token: string;
  expires_at: string;
  user: User;
}

export interface LoginPayload {
  username: string;
  password?: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password?: string;
}

