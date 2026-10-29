/**
 * VGARSS 2.0 Frontend Runtime Configuration
 *
 * Configurable API and WebSocket endpoints supporting:
 * - Dynamic runtime environment variables (VITE_API_URL, VITE_WS_URL)
 * - Automatic protocol detection (https -> wss, http -> ws)
 * - Hostname inheritance for multi-device local network & production access
 * - Zero hardcoded localhost in production builds
 */

export function getApiBaseUrl(): string {
  // 1. Explicit user/admin override in browser storage
  const stored = typeof window !== 'undefined' ? localStorage.getItem('vgarss_api_url') : null;
  if (stored) return stored.replace(/\/+$/, '');

  // 2. Vite environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }

  // 3. Dynamic browser origin & cloud deployment detection
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    // In local development with Vite dev server on port 5173, point to backend default 8000
    if (port === '5173') {
      return `${protocol}//${hostname}:8000`;
    }
    // When running on Vercel preview or production without explicit VITE_API_URL, route to Render backend
    if (hostname.endsWith('vercel.app')) {
      return 'https://vgarss.onrender.com';
    }
    // In production or reverse proxy deployments, use window.location.origin
    return window.location.origin;
  }

  return 'http://127.0.0.1:8000';
}

export function getWebSocketBaseUrl(): string {
  // 1. Explicit user/admin override in browser storage
  const stored = typeof window !== 'undefined' ? localStorage.getItem('vgarss_ws_url') : null;
  if (stored) return stored;

  // 2. Vite environment variable
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // 3. Cloud deployment detection
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('vercel.app')) {
    return 'wss://vgarss.onrender.com';
  }

  // 4. Derive directly from API Base URL
  const apiUrl = getApiBaseUrl();
  try {
    const parsed = new URL(apiUrl);
    const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${parsed.host}`;
  } catch {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    return isHttps ? 'wss://127.0.0.1:8000' : 'ws://127.0.0.1:8000';
  }
}

