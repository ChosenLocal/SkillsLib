import type { SSEEventHandler, SSEEventType } from '@/types/events';

export interface SSEClientOptions {
  url: string;
  onEvent: SSEEventHandler;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * Simple SSE (Server-Sent Events) client with automatic reconnection
 */
export class SSEClient {
  private eventSource: EventSource | null = null;
  private url: string;
  private onEvent: SSEEventHandler;
  private onError?: (error: Event) => void;
  private onOpen?: () => void;
  private reconnect: boolean;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isClosed = false;

  constructor(options: SSEClientOptions) {
    this.url = options.url;
    this.onEvent = options.onEvent;
    this.onError = options.onError;
    this.onOpen = options.onOpen;
    this.reconnect = options.reconnect ?? true;
    this.reconnectInterval = options.reconnectInterval ?? 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  }

  connect() {
    if (this.isClosed) {
      console.warn('SSE client is closed, cannot reconnect');
      return;
    }

    try {
      this.eventSource = new EventSource(this.url);

      // Connection opened
      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
        this.onOpen?.();
      };

      // Generic message handler
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onEvent({
            type: event.type as SSEEventType,
            data,
          });
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      // Listen for specific event types
      const eventTypes: SSEEventType[] = [
        'connected',
        'workflow.progress',
        'agent.pending',
        'agent.running',
        'agent.completed',
        'agent.failed',
        'agent.cancelled',
      ];

      eventTypes.forEach((eventType) => {
        this.eventSource!.addEventListener(eventType, (event: any) => {
          try {
            const data = JSON.parse(event.data);
            this.onEvent({
              type: eventType,
              data,
            });
          } catch (error) {
            console.error(`Failed to parse SSE event ${eventType}:`, error);
          }
        });
      });

      // Error handler
      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        this.onError?.(error);

        // Attempt to reconnect if enabled
        if (this.reconnect && !this.isClosed) {
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      if (this.reconnect && !this.isClosed) {
        this.attemptReconnect();
      }
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`
    );

    this.close();

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  close() {
    this.isClosed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
