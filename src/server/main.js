import express from 'express';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import CsvLogger from './csvLogger.js';

const PORT = 8080;
const OFFLINE_AFTER_MS = 3000;
const root = (path) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

const app = express();
app.use(express.static(root('src/client')));
app.use('/shared', express.static(root('src/shared')));
app.use('/vendor', express.static(root('node_modules/chart.js/dist')));
app.use('/logs', express.static(root('data/logs')));
app.get('/api/logs', (request, response) => response.json(CsvLogger.list()));

const server = createServer(app);
const deviceSockets = new WebSocketServer({ noServer: true });
const appSockets = new WebSocketServer({ noServer: true });
const routes = { '/esp32': deviceSockets, '/app': appSockets };
let lastReadingAt = 0;
let deviceOnline = false;

const parse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const broadcast = (sockets, message) => {
  const payload = JSON.stringify(message);
  for (const socket of sockets.clients) socket.send(payload);
};

server.on('upgrade', (request, socket, head) => {
  const route = routes[request.url];
  if (!route) return socket.destroy();
  route.handleUpgrade(request, socket, head, (client) => route.emit('connection', client));
});

deviceSockets.on('connection', (device) =>
  device.on('message', (raw) => {
    const reading = parse(raw);
    if (reading.type !== 'reading') return;
    lastReadingAt = Date.now();
    CsvLogger.write(reading);
    broadcast(appSockets, reading);
  }),
);

appSockets.on('connection', (client) => {
  client.send(JSON.stringify({ type: 'status', deviceOnline }));
  client.on('message', (raw) => {
    const command = parse(raw);
    if (command.type !== 'command') return;
    if (command.name === 'startNight' || command.name === 'brightnessSweep') CsvLogger.reset();
    broadcast(deviceSockets, command);
  });
});

setInterval(() => {
  const online = Date.now() - lastReadingAt < OFFLINE_AFTER_MS;
  if (online === deviceOnline) return;
  deviceOnline = online;
  broadcast(appSockets, { type: 'status', deviceOnline });
  console.log(online ? 'Device connected' : 'Device offline for more than 3 s');
}, 500);

server.listen(PORT, () => {
  const interfaces = Object.values(networkInterfaces());
  const networks = interfaces.flat();
  const addresses = networks.filter((network) => network.family === 'IPv4' && !network.internal);
  console.log(`Dashboard: http://localhost:${PORT}`);
  for (const network of addresses) console.log(`Phone / ESP32 (SERVER_IP): ${network.address}  ->  http://${network.address}:${PORT}`);
});
