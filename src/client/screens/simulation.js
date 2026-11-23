import Config from '/shared/config.js';
import NightSimulator from '/shared/nightSimulator.js';
import Scenarios from '/shared/scenarios.js';
import StreetGraph from '/shared/streetGraph.js';
import Charts from '../charts.js';
import CityMap from '../cityMap.js';
import Labels from '../labels.js';

const SPEEDS = { 60: '×60', 300: '×300', 1200: '×1200' };
const MANUAL_ROUTES = { A1: [Config.ROUTES[0], Config.ROUTES[2]], B3: [Config.ROUTES[1], Config.ROUTES[3]] };
const RENDER_EVERY_MS = 100;

const view = { element: null, map: null, chart: null, comparisons: {}, origin: 'A1' };
const night = { time: 0, energy: 0, playing: false, speed: 60, strategy: 'adaptive', scenario: 'normal', walkers: [], spans: [], manualCount: 0, lastFrame: 0, lastRender: 0 };

function template() {
  return `
    <div class="columns">
      <article class="card glass">
        <div class="hero">
          <div><span class="phase">Noche simulada</span><strong data-bind="clock">18:00</strong></div>
          <span data-bind="people"></span>
        </div>
        <div data-bind="map"></div>
      </article>
      <div class="stack">
        <article class="card glass">
          <div class="actions">
            <button class="button primary" data-action="toggle">Reproducir</button>
            <button class="button" data-action="restart">Reiniciar</button>
          </div>
          <div class="control"><span>Velocidad</span>${Labels.segmented('speed', SPEEDS, '60')}</div>
          <div class="control"><span>Estrategia</span>${Labels.segmented('strategy', Labels.STRATEGIES, 'adaptive')}</div>
          <div class="control"><span>Noche (5, 20 o 60 personas)</span>${Labels.segmented('scenario', Labels.SCENARIOS, 'normal')}</div>
          <div class="control"><span>Hacer pasar a una persona</span><div class="actions">
            <button class="button" data-action="person" data-entrance="A1">Por PIR A</button>
            <button class="button" data-action="person" data-entrance="B3">Por PIR B</button>
          </div></div>
        </article>
        <article class="card glass">
          <div class="stats">
            <div class="stat"><strong data-bind="power">0 W</strong><span>Potencia ahora</span></div>
            <div class="stat"><strong data-bind="energy">0 Wh</strong><span>Energía acumulada</span></div>
            <div class="stat"><strong data-bind="lit">0 de 6</strong><span>Postes al 100 %</span></div>
            <div class="stat"><strong data-bind="savings">0 %</strong><span>Ahorro frente a permanente</span></div>
          </div>
          <p class="hint">Escala real: 100 W por luminaria al 100 %. La energía se acumula segundo a segundo con E = Σ P · Δt.</p>
        </article>
      </div>
    </div>
    <article class="card glass">
      <h2>Comparación de las 3 estrategias</h2>
      <p class="hint" data-bind="comparison-hint"></p>
      <div class="table-scroll"><table data-bind="comparison"></table></div>
      <div class="chart"><canvas data-bind="chart"></canvas></div>
    </article>
    <article class="card glass" data-bind="dijkstra"></article>`;
}

function bind(name) {
  return view.element.querySelector(`[data-bind="${name}"]`);
}

function routeLength(route) {
  const arrivals = StreetGraph.routeArrivals(route, 0);
  return arrivals[arrivals.length - 1].time;
}

function addWalker(walker) {
  night.walkers.push({ ...walker, endTime: walker.startTime + routeLength(walker.route) });
  night.spans.push(NightSimulator.planSpan(StreetGraph.lightWavePlan(walker.route[0], walker.startTime)));
}

function restart() {
  Object.assign(night, { time: 0, energy: 0, playing: false, walkers: [], spans: [], manualCount: 0 });
  for (const walker of Scenarios.walkers(Config.SCENARIOS[night.scenario])) {
    addWalker(walker);
  }
  render();
}

function addPerson(entrance) {
  const routes = MANUAL_ROUTES[entrance];
  night.manualCount += 1;
  addWalker({ startTime: night.time, route: routes[night.manualCount % routes.length] });
  render();
}

function polesAt(time) {
  return NightSimulator.snapshot(night.strategy, NightSimulator.activePlans(night.spans, time), time);
}

function advance(seconds) {
  const target = Math.min(night.time + seconds, Config.NIGHT_SECONDS);
  while (night.time < target) {
    const step = Math.min(1, target - night.time);
    night.energy += (NightSimulator.totalPower(polesAt(night.time)) * step) / 3600;
    night.time += step;
  }
  if (night.time >= Config.NIGHT_SECONDS) night.playing = false;
}

function walkingNow() {
  const walking = [];
  for (const walker of night.walkers) {
    if (walker.startTime <= night.time && night.time < walker.endTime) walking.push({ route: walker.route, meters: (night.time - walker.startTime) * Config.WALKING_SPEED });
  }
  return walking;
}

function render() {
  const poles = polesAt(night.time);
  const walking = walkingNow();
  let lit = 0;
  for (const pole of poles) {
    if (pole.brightness >= 1) lit += 1;
  }
  const permanentEnergy = (600 * night.time) / 3600;
  const savings = permanentEnergy > 0 ? 100 * (1 - night.energy / permanentEnergy) : 0;
  view.map.update({ isNight: true, poles, walkers: walking, sensors: { pirA: 0, pirB: 0 } });
  bind('clock').textContent = NightSimulator.clock(night.time);
  bind('people').textContent = walking.length === 1 ? '1 persona caminando' : `${walking.length} personas caminando`;
  bind('power').textContent = `${Labels.number(NightSimulator.totalPower(poles), 0)} W`;
  bind('energy').textContent = `${Labels.number(night.energy, 1)} Wh`;
  bind('lit').textContent = `${lit} de 6`;
  bind('savings').textContent = `${Labels.number(savings, 1)} %`;
  view.element.querySelector('[data-action="toggle"]').textContent = night.playing ? 'Pausar' : 'Reproducir';
  Labels.markSelected(view.element, 'speed', String(night.speed));
  Labels.markSelected(view.element, 'strategy', night.strategy);
  Labels.markSelected(view.element, 'scenario', night.scenario);
}

function renderComparison() {
  const runs = view.comparisons[night.scenario] || NightSimulator.compare(Config.SCENARIOS[night.scenario]);
  view.comparisons[night.scenario] = runs;
  bind('comparison-hint').textContent = `Noche completa de 18:00 a 06:00 con ${Config.SCENARIOS[night.scenario]} personas. Servicio: personas que encontraron cada poste de su recorrido al 100 %.`;
  let rows = '';
  for (const run of runs) {
    rows += `<tr><td><span class="swatch" style="background:${Labels.COLORS[run.strategy]}"></span>${Labels.STRATEGIES[run.strategy]}</td>
      <td class="number">${Labels.number(run.energyWh, 0)} Wh</td><td class="number">${Labels.number(run.savingsPercent, 1)} %</td>
      <td class="number">${Labels.number(run.serviceLevel, 1)} %</td><td class="number">${run.switchOns}</td></tr>`;
  }
  bind('comparison').innerHTML = `<thead><tr><th>Estrategia</th><th class="number">Energía</th><th class="number">Ahorro</th><th class="number">Servicio</th><th class="number">Encendidos</th></tr></thead><tbody>${rows}</tbody>`;
  const labels = [];
  for (let minute = 0; minute < runs[0].powerPerMinute.length; minute += 5) {
    labels.push(NightSimulator.clock(minute * 60));
  }
  const datasets = [];
  for (const run of runs) {
    const values = [];
    for (let minute = 0; minute < run.powerPerMinute.length; minute += 5) {
      values.push(run.powerPerMinute[minute]);
    }
    datasets.push(Charts.series(Labels.STRATEGIES[run.strategy], values, Labels.COLORS[run.strategy], { stepped: true }));
  }
  view.chart.data.labels = labels;
  view.chart.data.datasets = datasets;
  view.chart.update();
}

function renderDijkstra() {
  const { iterations, distances } = StreetGraph.dijkstra(StreetGraph.graph, view.origin);
  const visited = [];
  let header = '';
  for (const pole of Config.POLES) {
    header += `<th class="number">${pole}</th>`;
  }
  let rows = '';
  for (let step = 0; step < iterations.length; step++) {
    visited.push(iterations[step].visited);
    let cells = '';
    for (const pole of Config.POLES) {
      const distance = iterations[step].distances[pole];
      cells += `<td class="number">${visited.includes(pole) ? '✓ ' : ''}${distance === Infinity ? '∞' : distance}</td>`;
    }
    rows += `<tr><td>${step + 1}</td><td><strong>${iterations[step].visited}</strong></td>${cells}</tr>`;
  }
  let arrivals = '';
  for (const pole of Config.POLES) {
    arrivals += `<td class="number">${Labels.number(distances[pole] / Config.WALKING_SPEED, 1)} s</td>`;
  }
  bind('dijkstra').innerHTML = `
    <h2>Cómo se calcula la ola de luz</h2>
    <p class="hint">Dijkstra da la distancia en metros desde la entrada hasta cada poste. A 1,4 m/s se obtiene cuándo llega la persona, y el poste se enciende ${Config.ANTICIPATION_TIME} s antes.</p>
    ${Labels.segmented('origin', { A1: 'Entra por A1', B3: 'Entra por B3' }, view.origin)}
    <div class="table-scroll"><table>
      <thead><tr><th>Paso</th><th>Visitado</th>${header}</tr></thead>
      <tbody>${rows}<tr><td colspan="2">Llegada</td>${arrivals}</tr></tbody>
    </table></div>`;
}

function onClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const group = button.dataset.group;
  const action = button.dataset.action;
  if (action === 'toggle') night.playing = !night.playing;
  if (action === 'restart') restart();
  if (action === 'person') addPerson(button.dataset.entrance);
  if (group === 'speed') night.speed = Number(button.dataset.key);
  if (group === 'strategy') {
    night.strategy = button.dataset.key;
    restart();
  }
  if (group === 'scenario') {
    night.scenario = button.dataset.key;
    restart();
    renderComparison();
  }
  if (group === 'origin') {
    view.origin = button.dataset.key;
    renderDijkstra();
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
  view.element.innerHTML = template();
  view.map = new CityMap(bind('map'));
  view.chart = Charts.lineChart(bind('chart'), 'W', true);
  view.element.addEventListener('click', onClick);
  restart();
  renderDijkstra();
  requestAnimationFrame(frame);
}

function show() {
  if (!view.comparisons[night.scenario]) renderComparison();
}

const Simulation = { start, show };

export default Simulation;
