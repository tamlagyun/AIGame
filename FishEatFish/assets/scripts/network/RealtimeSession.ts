import { NetworkClient } from './NetworkClient.ts';
import type { NetworkMessage, RoomSnapshot, SkillId } from './NetworkProtocol.ts';

export class RealtimeSession {
  readonly client = new NetworkClient();
  room: RoomSnapshot | null = null;
  onMessage?: (message: NetworkMessage) => void;
  onStatus?: (status: 'open' | 'closed' | 'error') => void;
  onDiagnostic?: (detail: string) => void;
  connect(websocketUrl: string, token: string) {
    this.client.onMessage = (message) => { if (message.type === 'roomSnapshot') this.room = message.payload as RoomSnapshot; this.onMessage?.(message); };
    this.client.onStatus = (status) => this.onStatus?.(status);
    this.client.onDiagnostic = (detail) => this.onDiagnostic?.(detail);
    this.client.connect(`${websocketUrl}?token=${encodeURIComponent(token)}`);
  }
  join() { this.client.send('joinRoom', {}); }
  sendInput(input: { clientTick: number; moveX: number; moveY: number; rotation: number }) { this.client.send('input', input); }
  sendSkill(skill: { skillId: SkillId; clientTick: number; x: number; y: number; rotation: number }) { this.client.send('skill', skill); }
  close() { this.client.send('leaveRoom', {}); this.client.close(); }
}
