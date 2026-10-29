/**
 * Network Telemetry, WebSocket Events & TCP Packet Models for VGARSS
 */

export interface NetworkTelemetryEvent {
  seq?: number;
  type: string;
  group_id?: string;
  simulation_id?: string;
  timestamp: string;
  payload?: any;
  event?: string;
}

export interface RawTcpLogEntry {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'SERVER';
  action: string;
  length: number;
  headerHex: string;
  payload: any;
  timestamp: string;
}

export type ConnectionStatus = 'checking' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

