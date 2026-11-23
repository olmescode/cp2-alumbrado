import express from 'express';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import Recorder from './recorder.js';

const PORT = 8080;
const OFFLINE_AFTER_MS = 3000;

const boardSockets = new WebSocketServer({ noServer: true });
const appSockets = new WebSocketServer({ noServer: true });
const routes = { '/esp32': boardSockets, '/app': appSockets };
let lastReadingAt = 0;
let boardOnline = false;

function projectPath(path) {
  return fileURLToPath(new URL(`../../${path}`, import.meta.url));
}

function parse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function broadcast(sockets, message) {
  const payload = JSON.stringify(message);
  for (const socket of sockets.clients) {
    socket.send(payload);
  }
}

function onUpgrade(request, socket, head) {
  const route = routes[request.url];
  if (!route) {
    socket.destroy();
    return;
  }
  route.handleUpgrade(request, socket, head, function connect(client) {
    route.emit('connection', client);
  });
}

function onBoardMessage(raw) {
  const reading = parse(raw);
  if (reading.type !== 'reading') return;
  lastReadingAt = Date.now();
  const night = Recorder.record(reading);
  broadcast(appSockets, { ...reading, night });
}

function onAppMessage(raw) {
  const command = parse(raw);
  if (command.type === 'command') broadcast(boardSockets, command);
}

function onBoardConnection(board) {
  board.on('message', onBoardMessage);
}

function onAppConnection(client) {
  client.send(JSON.stringify({ type: 'status', boardOnline }));
  client.on('message', onAppMessage);
}

function checkBoard() {
  const online = Date.now() - lastReadingAt < OFFLINE_AFTER_MS;
  if (online === boardOnline) return;
  boardOnline = online;
  broadcast(appSockets, { type: 'status', boardOnline });
  console.log(online ? 'ESP32 conectado' : 'ESP32 sin datos por más de 3 s');
}

function printAddresses() {
  console.log(`Dashboard: http://localhost:${PORT}`);
  for (const networks of Object.values(networkInterfaces())) {
    for (const network of networks) {
      if (network.family === 'IPv4' && !network.internal) console.log(`Celular y ESP32 (SERVER_IP): ${network.address}  ->  http://${network.address}:${PORT}`);
    }
  }
}

function sendNights(request, response) {
  response.json(Recorder.nights());
}

function sendCalibration(request, response) {
  response.json(Recorder.calibration());
}

const app = express();
app.use(express.static(projectPath('src/client')));
app.use('/shared', express.static(projectPath('src/shared')));
app.use('/vendor', express.static(projectPath('node_modules/chart.js/dist')));
app.use('/data', express.static(projectPath('data')));
app.get('/api/nights', sendNights);
app.get('/api/calibration', sendCalibration);

const server = createServer(app);
server.on('upgrade', onUpgrade);
boardSockets.on('connection', onBoardConnection);
appSockets.on('connection', onAppConnection);
setInterval(checkBoard, 500);
server.listen(PORT, printAddresses);
