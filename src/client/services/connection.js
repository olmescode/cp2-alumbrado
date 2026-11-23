import Store from './store.js';

const RECONNECT_MS = 2000;
const SAMPLE_LIMIT = 240;
const MAX_STEP_SECONDS = 2;

const accumulate = (reading) => {
  const state = Store.state;
  const seconds = state.lastReadingAt ? Math.min((Date.now() - state.lastReadingAt) / 1000, MAX_STEP_SECONDS) : 0;
  const energy = state.energy + (reading.powerMw * seconds) / 3600;
  const observed = { ...state.observed };
  const strategyTotals = observed[reading.strategy] || { energy: 0, seconds: 0 };
  if (reading.mode !== 'sweep') observed[reading.strategy] = { energy: strategyTotals.energy + (reading.powerMw * seconds) / 3600, seconds: strategyTotals.seconds + seconds };
  const sweep = { ...state.sweep };
  if (reading.mode === 'sweep') {
    const level = reading.brightness[0];
    const point = sweep[level] || { total: 0, count: 0 };
    sweep[level] = { total: point.total + reading.powerMw, count: point.count + 1 };
  }
  const samples = [...state.samples, { label: reading.clock, power: reading.powerMw, energy }];
  return { energy, observed, sweep, samples: samples.slice(-SAMPLE_LIMIT) };
};

const Connection = {
  socket: null,

  start: () => {
    const socket = new WebSocket(`ws://${location.host}/app`);
    Connection.socket = socket;
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'status') Store.set({ deviceOnline: message.deviceOnline });
      if (message.type === 'reading' && Store.state.mode === 'live') Connection.apply(message);
    });
    socket.addEventListener('close', () => {
      Store.set({ deviceOnline: false });
      setTimeout(Connection.start, RECONNECT_MS);
    });
  },

  apply: (reading) => {
    Store.set({
      ...accumulate(reading),
      source: reading.source,
      deviceOnline: true,
      lastReadingAt: Date.now(),
      clock: reading.clock,
      strategy: reading.strategy,
      liveMode: reading.mode,
      isNight: reading.isNight,
      ldrPercent: reading.ldrPercent,
      ldrRaw: reading.ldrRaw,
      pirA: reading.pirA,
      pirB: reading.pirB,
      poles: reading.brightness.map((level, index) => ({ brightness: level / 100, state: reading.states[index] })),
      walkers: [],
      unit: 'mW',
      power: reading.powerMw,
    });
  },

  send: (name, details = {}) => {
    if (Connection.socket && Connection.socket.readyState === WebSocket.OPEN) Connection.socket.send(JSON.stringify({ type: 'command', name, ...details }));
  },
};

export default Connection;
