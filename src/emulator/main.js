import { emitKeypressEvents } from 'node:readline';
import WebSocket from 'ws';
import Config from '../shared/config.js';
import NightSimulator from '../shared/nightSimulator.js';
import Scenarios from '../shared/scenarios.js';
import StateMachine from '../shared/stateMachine.js';
import StreetGraph from '../shared/streetGraph.js';

const SERVER_URL = process.argv[2] || 'ws://localhost:8080/esp32';
const SCENARIO = process.argv[3] || 'normal';
const LED_POWER_MW = 90;
const SWEEP_STEP_MS = 3000;
const READING_INTERVAL_MS = 500;
const PIR_HIGH_MS = 2000;

const Device = {
  strategy: 'adaptive',
  mode: 'live',
  timeFactor: 10,
  startedAt: Date.now(),
  sweepStartedAt: 0,
  isNight: true,
  plans: [],
  walkers: Scenarios.walkers(Config.SCENARIOS[SCENARIO]),
  nextWalker: 0,
  lastTime: 0,
  lastDetection: { pirA: 0, pirB: 0 },
};

const nightTime = () => (((Date.now() - Device.startedAt) / 1000) * Device.timeFactor) % (24 * 3600);

const detect = (sensor) => {
  Device.lastDetection[sensor] = Date.now();
  Device.plans.push(StreetGraph.lightWavePlan(Config.ENTRANCES[sensor], nightTime()));
  console.log(`Person detected at ${Config.ENTRANCES[sensor]} (${sensor})`);
};

const restartNight = (timeFactor) => {
  Object.assign(Device, { mode: 'night', timeFactor, startedAt: Date.now(), plans: [], nextWalker: 0, lastTime: 0 });
};

const COMMANDS = {
  setStrategy: (command) => (Device.strategy = command.value),
  startNight: (command) => restartNight(command.factor || 60),
  brightnessSweep: () => Object.assign(Device, { mode: 'sweep', sweepStartedAt: Date.now() }),
  simulatePerson: (command) => detect(command.entrance === 'B3' ? 'pirB' : 'pirA'),
};

const sweepBrightness = () => {
  const step = Math.floor((Date.now() - Device.sweepStartedAt) / SWEEP_STEP_MS);
  if (step > 10) Device.mode = 'live';
  return Math.min(step, 10) * 10;
};

const reading = () => {
  const time = nightTime();
  if (time < Device.lastTime) Device.nextWalker = 0;
  Device.lastTime = time;
  while (Device.nextWalker < Device.walkers.length && Device.walkers[Device.nextWalker].startTime <= time) {
    const walker = Device.walkers[Device.nextWalker];
    Device.nextWalker += 1;
    detect(walker.route[0] === 'A1' ? 'pirA' : 'pirB');
  }
  const ldrPercent = (time < Config.NIGHT_SECONDS ? 15 : 75) + Math.random() * 4;
  Device.isNight = StateMachine.isNight(ldrPercent, Device.isNight);
  Device.plans = Device.plans.filter((plan) => {
    const windows = Object.values(plan);
    return windows.some((window) => window.baseAt > time);
  });
  const poles = NightSimulator.snapshot(Device.strategy, Device.plans, time, Device.isNight);
  const sweepLevel = Device.mode === 'sweep' ? sweepBrightness() : -1;
  const brightness = poles.map((pole) => (sweepLevel >= 0 ? sweepLevel : Math.round(pole.brightness * 100)));
  const noisyPower = brightness.reduce((total, level) => total + (LED_POWER_MW * level) / 100, 0) + (Math.random() - 0.5) * 8;
  const powerMw = Math.round(Math.max(noisyPower, 0) * 10) / 10;
  const voltage = 5 + (Math.random() - 0.5) * 0.04;
  return {
    type: 'reading',
    source: 'emulator',
    timeMs: Date.now() - Device.startedAt,
    clock: NightSimulator.clock(time),
    strategy: Device.strategy,
    mode: Device.mode,
    ldrRaw: Math.round((ldrPercent * 4095) / 100),
    ldrPercent: Math.round(ldrPercent * 10) / 10,
    isNight: Device.isNight,
    pirA: Date.now() - Device.lastDetection.pirA < PIR_HIGH_MS ? 1 : 0,
    pirB: Date.now() - Device.lastDetection.pirB < PIR_HIGH_MS ? 1 : 0,
    brightness,
    states: poles.map((pole, index) => (sweepLevel >= 0 ? (brightness[index] > 0 ? 'Fixed' : 'Off') : pole.state)),
    currentMa: Math.round((powerMw / voltage) * 10) / 10,
    voltage: Math.round(voltage * 100) / 100,
    powerMw,
  };
};

const connect = () => {
  const socket = new WebSocket(SERVER_URL);
  const timer = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify(reading())), READING_INTERVAL_MS);
  socket.on('open', () => console.log(`Emulator connected to ${SERVER_URL} (scenario: ${SCENARIO}). Keys: a = PIR A, b = PIR B, q = quit`));
  socket.on('message', (raw) => {
    const command = JSON.parse(raw);
    if (command.type === 'command' && COMMANDS[command.name]) COMMANDS[command.name](command);
  });
  socket.on('error', () => {});
  socket.on('close', () => {
    clearInterval(timer);
    setTimeout(connect, 2000);
  });
};

emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on('keypress', (key) => {
  if (key === 'a') detect('pirA');
  if (key === 'b') detect('pirB');
  if (key === 'q' || key === '\u0003') process.exit();
});

connect();
