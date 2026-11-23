import Config from '/shared/config.js';
import NightSimulator from '/shared/nightSimulator.js';
import Scenarios from '/shared/scenarios.js';
import StreetGraph from '/shared/streetGraph.js';
import Charts from '../charts.js';
import CityMap from '../cityMap.js';
import Labels from '../labels.js';
import ScreenLayout from '../screenLayout.js';

const SPEEDS = { 60: '×60 (12 min)', 720: '×720 (1 min)', 3600: '×3600 (12 s)' };
const MANUAL_ROUTES = { A1: [Config.ROUTES[0], Config.ROUTES[2]], B3: [Config.ROUTES[1], Config.ROUTES[3]] };
const RENDER_EVERY_MS = 100;
const READY_STATUS = 'Al llegar a las 06:00 la noche se guarda en Análisis. Calcular al instante resuelve la noche completa sin animación.';

const view = { element: null, map: null, chart: null };
const night = {
  time: 0, energy: 0, minuteEnergy: 0, playing: false, speed: 720, strategy: 'adaptive', scenario: 'normal',
  walkers: [], spans: [], samples: [], manualCount: 0, lastFrame: 0, lastRender: 0,
};

function controls() {
  return `
    <div class="actions">
      <button class="button primary" data-action="toggle">Reproducir</button>
      <button class="button" data-action="restart">Reiniciar</button>
      <button class="button" data-action="instant">Calcular al instante</button>
    </div>
    <div class="control"><span>Velocidad</span>${Labels.segmented('speed', SPEEDS, '720')}</div>
    <div class="control"><span>Estrategia</span>${Labels.segmented('strategy', Labels.STRATEGIES, 'adaptive')}</div>
    <div class="control"><span>Noche (5, 20 o 60 personas)</span>${Labels.segmented('scenario', Labels.SCENARIOS, 'normal')}</div>
    <div class="control"><span>Hacer pasar a una persona</span><div class="actions">
      <button class="button" data-action="person" data-entrance="A1">Por PIR A</button>
      <button class="button" data-action="person" data-entrance="B3">Por PIR B</button>
    </div></div>`;
}

function bind(name) {
  return ScreenLayout.bind(view.element, name);
}

function routeLength(route) {
  const arrivals = StreetGraph.routeArrivals(route, 0);
  return arrivals[arrivals.length - 1].time;
}

function addWalker(walker) {
  night.walkers.push({ startTime: walker.startTime, route: walker.route, endTime: walker.startTime + routeLength(walker.route) });
  night.spans.push(NightSimulator.planSpan(StreetGraph.lightWavePlan(walker.route[0], walker.startTime)));
}

function restart() {
  Object.assign(night, { time: 0, energy: 0, minuteEnergy: 0, playing: false, walkers: [], spans: [], samples: [], manualCount: 0 });
  for (const walker of Scenarios.walkers(Config.SCENARIOS[night.scenario])) {
    addWalker(walker);
  }
  bind('status').textContent = READY_STATUS;
  render();
}

function addPerson(entrance) {
  const routes = MANUAL_ROUTES[entrance];
  night.manualCount += 1;
  addWalker({ startTime: night.time, route: routes[night.manualCount % routes.length] });
}

function polesAt(time) {
  return NightSimulator.snapshot(night.strategy, NightSimulator.activePlans(night.spans, time), time);
}

async function saveNight(run) {
  await fetch('/api/simulations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...run, scenario: night.scenario }),
  });
  bind('status').textContent = `Noche guardada en Análisis: ${Labels.number(run.energyWh, 0)} Wh con ${run.people} personas.`;
}

function finishNight() {
  night.playing = false;
  render();
  saveNight(NightSimulator.simulateWalkers(night.strategy, night.walkers));
}

function advance(seconds) {
  const target = Math.min(night.time + seconds, Config.NIGHT_SECONDS);
  while (night.time < target) {
    const step = Math.min(1, target - night.time);
    const watts = NightSimulator.totalPower(polesAt(night.time));
    const minuteBefore = Math.floor(night.time / 60);
    night.energy += (watts * step) / 3600;
    night.minuteEnergy += watts * step;
    night.time += step;
    if (Math.floor(night.time / 60) > minuteBefore) {
      night.samples.push({ label: NightSimulator.clock(minuteBefore * 60), power: night.minuteEnergy / 60 });
      night.minuteEnergy = 0;
    }
  }
  if (night.time >= Config.NIGHT_SECONDS) finishNight();
}

function calculateInstantly() {
  restart();
  const run = NightSimulator.simulateWalkers(night.strategy, night.walkers);
  night.time = Config.NIGHT_SECONDS;
  night.energy = run.energyWh;
  for (let minute = 0; minute < run.powerPerMinute.length; minute++) {
    night.samples.push({ label: NightSimulator.clock(minute * 60), power: run.powerPerMinute[minute] });
  }
  saveNight(run);
}

function walkingNow() {
  const walking = [];
  for (const walker of night.walkers) {
    if (walker.startTime <= night.time && night.time < walker.endTime) walking.push({ route: walker.route, meters: (night.time - walker.startTime) * Config.WALKING_SPEED });
  }
  return walking;
}

function peopleSoFar() {
  let people = 0;
  for (const walker of night.walkers) {
    if (walker.startTime <= night.time) people += 1;
  }
  return people;
}

function renderChart() {
  const labels = [];
  const values = [];
  for (const sample of night.samples) {
    labels.push(sample.label);
    values.push(sample.power);
  }
  view.chart.data.labels = labels;
  view.chart.data.datasets = [Charts.series('Potencia', values, Labels.COLORS[night.strategy], { stepped: true, fill: 'origin', backgroundColor: 'rgb(255 179 64 / 0.15)' })];
  view.chart.update();
}

function render() {
  const poles = polesAt(Math.min(night.time, Config.NIGHT_SECONDS - 1));
  const walking = walkingNow();
  view.map.update({ isNight: true, poles, walkers: walking, sensors: { pirA: 0, pirB: 0 } });
  bind('clock').textContent = NightSimulator.clock(night.time);
  bind('info').textContent = walking.length === 1 ? '1 persona caminando' : `${walking.length} personas caminando`;
  ScreenLayout.renderNow(view.element, { power: NightSimulator.totalPower(poles), energy: night.energy, people: peopleSoFar(), poles, unit: 'W' });
  view.element.querySelector('[data-action="toggle"]').textContent = night.playing ? 'Pausar' : 'Reproducir';
  Labels.markSelected(view.element, 'speed', String(night.speed));
  Labels.markSelected(view.element, 'strategy', night.strategy);
  Labels.markSelected(view.element, 'scenario', night.scenario);
  renderChart();
}

function onClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const group = button.dataset.group;
  const action = button.dataset.action;
  if (action === 'toggle') night.playing = !night.playing && night.time < Config.NIGHT_SECONDS;
  if (action === 'restart') restart();
  if (action === 'instant') calculateInstantly();
  if (action === 'person') addPerson(button.dataset.entrance);
  if (group === 'speed') night.speed = Number(button.dataset.key);
  if (group === 'strategy') {
    night.strategy = button.dataset.key;
    restart();
  }
  if (group === 'scenario') {
    night.scenario = button.dataset.key;
    restart();
  }
  render();
}

function frame(now) {
  const elapsed = Math.min((now - night.lastFrame) / 1000, 0.25);
  night.lastFrame = now;
  const visible = view.element.dataset.active === 'true';
  if (visible && night.playing) advance(elapsed * night.speed);
  if (visible && night.playing && now - night.lastRender > RENDER_EVERY_MS) {
    night.lastRender = now;
    render();
  }
  requestAnimationFrame(frame);
}

function start() {
  view.element = document.getElementById('simulation');
  view.element.innerHTML = ScreenLayout.template({
    phase: 'Noche simulada',
    nowHint: 'Calculado con el modelo de consumo a escala real: 100 W por poste al 100 %.',
    controlsTitle: 'Control de la simulación',
    controls: controls(),
    status: READY_STATUS,
    chartHint: 'Potencia media de cada minuto simulado. A ×720 la noche dura 1 minuto, igual que en la maqueta.',
  });
  view.map = new CityMap(bind('map'));
  view.chart = Charts.lineChart(bind('chart'), 'W');
  view.element.addEventListener('click', onClick);
  restart();
  requestAnimationFrame(frame);
}

function show() {
  render();
}

const Simulation = { start, show };

export default Simulation;
