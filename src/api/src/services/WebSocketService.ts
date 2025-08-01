import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export interface RepositoryEvent {
  guid: string;
  pipeline_name: string;
  repo_url: string;
  branch: string;
  project_path: string;
  repo_status: string;
  validation_info: any;
  timestamp: string;
  event_type: 'repository_success' | 'repository_failure';
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.initialize();
  }

  private initialize(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected');
      this.clients.add(ws);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to repository events WebSocket',
        timestamp: new Date().toISOString()
      }));

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    console.log('WebSocket server initialized');
  }

  public broadcastRepositoryEvent(event: RepositoryEvent): void {
    const message = JSON.stringify({
      type: 'repository_event',
      data: event,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    console.log(`Broadcasted repository event to ${this.clients.size} clients:`, event.guid);
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public close(): void {
    this.wss.close();
  }
} 