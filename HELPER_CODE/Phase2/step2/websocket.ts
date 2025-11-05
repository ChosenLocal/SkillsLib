'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * WebSocket message type
 */
export interface WSMessage {
  type: string;
  projectId?: string;
  payload: any;
  timestamp?: string;
}

/**
 * WebSocket hook options
 */
export interface UseWebSocketOptions {
  url?: string;
  token?: string | null;
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * WebSocket connection status
 */
export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * React hook for WebSocket connection
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
    token = null,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
  } = options;

  const [status, setStatus] = useState<WSStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Send message to WebSocket server
   */
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  /**
   * Subscribe to project updates
   */
  const subscribeToProject = useCallback(
    (projectId: string) => {
      sendMessage({
        type: 'subscribe',
        projectId,
      });
    },
    [sendMessage]
  );

  /**
   * Unsubscribe from project updates
   */
  const unsubscribeFromProject = useCallback(
    (projectId: string) => {
      sendMessage({
        type: 'unsubscribe',
        projectId,
      });
    },
    [sendMessage]
  );

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (!token) {
      console.warn('WebSocket: No auth token available');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setStatus('connecting');
      const wsUrl = `${url}/ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('error');
        onError?.(error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setStatus('disconnected');
        onDisconnect?.();

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(
            `Attempting reconnect ${reconnectAttemptsRef.current}/${maxReconnectAttempts}...`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          console.error('Max reconnection attempts reached');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      setStatus('error');
    }
  }, [
    url,
    token,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
    reconnectInterval,
    maxReconnectAttempts,
  ]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('disconnected');
  }, []);

  /**
   * Auto-connect on mount if token is available
   */
  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token]);

  /**
   * Ping/pong heartbeat to keep connection alive
   */
  useEffect(() => {
    if (status !== 'connected') return;

    const interval = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(interval);
  }, [status, sendMessage]);

  return {
    status,
    sendMessage,
    subscribeToProject,
    unsubscribeFromProject,
    connect,
    disconnect,
  };
}
