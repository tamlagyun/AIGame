import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createApp } from '../src/app.js';
import { defaultServerConfig } from '../src/config/server-config.js';

test('websocket client joins room and receives snapshot', async () => {
  const { app } = createApp({ ...defaultServerConfig, httpPort: 0 });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const register = await app.inject({ method: 'POST', url: '/auth/register', payload: { username: 'socket-user', password: 'password' } });
  const token = register.json().token as string;
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws?token=${token}`);
  const snapshot = await new Promise<any>((resolve, reject) => {
    socket.once('error', reject);
    socket.once('open', () => socket.send(JSON.stringify({ protocolVersion: 1, type: 'joinRoom', payload: {} })));
    socket.on('message', (value) => { const message = JSON.parse(value.toString()); if (message.type === 'roomSnapshot') resolve(message); });
  });
  assert.equal(snapshot.payload.players.length, 1);
  socket.close();
  await app.close();
});

test('two websocket players receive authoritative combat damage', async () => {
  const { app } = createApp({ ...defaultServerConfig, httpPort: 0 });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address(); assert.ok(address && typeof address !== 'string');
  const first = (await app.inject({ method: 'POST', url: '/auth/test-login', payload: { username: 'combat-a' } })).json().token as string;
  const second = (await app.inject({ method: 'POST', url: '/auth/test-login', payload: { username: 'combat-b' } })).json().token as string;
  const connect = (token: string) => new Promise<{ socket: WebSocket; messages: any[] }>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws?token=${token}`); const messages: any[] = [];
    socket.once('error', reject); socket.once('open', () => socket.send(JSON.stringify({ protocolVersion: 1, type: 'joinRoom', payload: {} }))); socket.on('message', (raw) => { const value = JSON.parse(raw.toString()); messages.push(value); if (value.type === 'roomSnapshot') resolve({ socket, messages }); });
  });
  const a = await connect(first); const b = await connect(second);
  await new Promise((resolve) => setTimeout(resolve, 20));
  a.socket.send(JSON.stringify({ protocolVersion: 1, type: 'skill', payload: { skillId: 'skill-basic-bite', clientTick: 1, x: 0, y: 0, rotation: 0 } }));
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(b.messages.some((message) => message.type === 'skillEffect' && message.payload.actionSequence === 1), true);
  assert.equal(b.messages.some((message) => message.type === 'hitConfirmed'), true);
  assert.equal(b.messages.some((message) => message.type === 'playerDamaged' && message.payload.damage === 15), true);
  a.socket.close(); b.socket.close(); await app.close();
});
