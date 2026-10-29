/**
 * VGARSS Neural Network Message Transmission & Delivery Lifecycle Types
 */

export type MessageLifecycleState =
  | 'queued'     // Send initiated, pending network dispatch
  | 'sending'    // Transmitting payload over HTTP/WebSocket
  | 'sent'       // Confirmed persisted by server (single tick/ack)
  | 'delivered'  // Recipient client has received and acknowledged message
  | 'read'       // Recipient client has read/viewed message
  | 'failed'     // Network or server persistence failure
  | 'retrying';  // Retrying transmission with stable client_msg_id

export interface MessageReceiptEvent {
  message_id: string;
  channel_id?: string | null;
  conversation_id?: string | null;
  workspace_id?: string;
  user_id?: string;
  username?: string;
  display_name?: string;
  status: 'delivered' | 'read';
  delivered_count?: number;
  read_count?: number;
  timestamp: string;
}

export interface NeuralNode {
  id: string;
  x: number;
  y: number;
  r: number;
  layer: number;
  isOrigin?: boolean;
  isDestination?: boolean;
  pulseTime?: number;
}

export interface NeuralEdge {
  id: string;
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  weight: number;
}

export interface NeuralGraph {
  nodes: NeuralNode[];
  edges: NeuralEdge[];
  activeRoute: string[]; // Sequence of node IDs for packet traversal
  totalPathLength: number;
}

export interface MessageTransmissionProps {
  messageId: string;
  state: MessageLifecycleState;
  isOutgoing: boolean;
  compact?: boolean;
  theme?: 'light' | 'dark';
  onRetry?: () => void;
  className?: string;
}

