const RECONNECT_MS = 2000;

const listeners = new Set();
let socket = null;

function notify(message) {
  for (const listener of listeners) {
    listener(message);
  }
}

function onMessage(event) {
  notify(JSON.parse(event.data));
}

function onClose() {
  notify({ type: 'status', boardOnline: false });
  setTimeout(start, RECONNECT_MS);
}

function start() {
  socket = new WebSocket(`ws://${location.host}/app`);
  socket.addEventListener('message', onMessage);
  socket.addEventListener('close', onClose);
}

function subscribe(listener) {
  listeners.add(listener);
}

function send(name, details = {}) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'command', name, ...details }));
}

const Connection = { start, subscribe, send };

export default Connection;
