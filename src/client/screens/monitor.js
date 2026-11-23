import Energy from '/shared/energy.js';
import Charts from '../charts.js';
import CityMap from '../cityMap.js';
import Connection from '../connection.js';
import Labels from '../labels.js';
import ScreenLayout from '../screenLayout.js';

const LED_NOMINAL_MW = 90;
const SAMPLE_LIMIT = 2400;

const view = { element: null, map: null, chart: null, online: false, wasNight: false, samples: [], fit: null };

function controls() {
  return `
    <div class="control"><span>Estrategia</span>${Labels.segmented('strategy', Labels.STRATEGIES, 'adaptive')}</div>
    <div class="actions">
      <button class="button" data-action="lampTest">Probar luminarias</button>
      <button class="button" data-action="calibrate">Calibrar consumo</button>
    </div>`;
}

function bind(name) {
  return ScreenLayout.bind(view.element, name);
}

function offPoles() {
  const poles = [];
  for (let index = 0; index < 6; index++) {
    poles.push({ brightness: 0, state: 'Off' });
  }
  return poles;
}

function alertsFor(reading) {
  const alerts = [];
  let average = 0;
  for (const level of reading.brightness) {
    average += level / reading.brightness.length;
  }
  const expected = view.fit ? view.fit.intercept + view.fit.slope * average : (LED_NOMINAL_MW * average * reading.brightness.length) / 100;
  if (expected > 100 && reading.powerMw < expected * 0.5) alerts.push('Posible LED dañado: el consumo medido es menor al esperado.');
  if (reading.ldrRaw <= 10 || reading.ldrRaw >= 4085) alerts.push('Revisa la conexión del LDR.');
  return alerts;
}

function renderAlerts(alerts) {
  let markup = '';
  for (const message of alerts) {
    markup += `<div class="alert" data-tone="warning">${message}</div>`;
  }
  bind('alerts').innerHTML = markup;
}

function renderButtons(reading) {
  const lampTest = view.element.querySelector('[data-action="lampTest"]');
  const calibrate = view.element.querySelector('[data-action="calibrate"]');
  lampTest.textContent = reading.mode === 'lampTest' ? 'Probando…' : 'Probar luminarias';
  calibrate.textContent = reading.mode === 'calibration' ? `Calibrando ${reading.brightness[0]} %` : 'Calibrar consumo';
}

function renderChart(reading) {
  if (reading.isNight && !view.wasNight) view.samples = [];
  view.wasNight = reading.isNight;
  if (!reading.isNight) return;
  view.samples.push({ label: reading.clock, watts: Energy.realScale(reading.powerMw) });
  if (view.samples.length > SAMPLE_LIMIT) view.samples.shift();
  const labels = [];
  const values = [];
  for (const sample of view.samples) {
    labels.push(sample.label);
    values.push(sample.watts);
  }
  view.chart.data.labels = labels;
  view.chart.data.datasets = [Charts.series('Potencia', values, Labels.COLORS[reading.strategy], { fill: 'origin', backgroundColor: 'rgb(255 179 64 / 0.15)' })];
  view.chart.update();
}

function renderReading(reading) {
  const night = reading.night || { energyWh: 0, people: 0 };
  const poles = [];
  for (let index = 0; index < reading.brightness.length; index++) {
    poles.push({ brightness: reading.brightness[index] / 100, state: reading.states[index] });
  }
  view.map.update({ isNight: reading.isNight, poles, walkers: [], sensors: { pirA: reading.pirA, pirB: reading.pirB } });
  bind('phase').textContent = reading.isNight ? 'Noche' : 'Día';
  bind('clock').textContent = reading.clock;
  bind('info').textContent = `Luz ${Labels.number(reading.ldrPercent, 0)} %`;
  ScreenLayout.renderNow(view.element, { watts: Energy.realScale(reading.powerMw), energyWh: night.energyWh, people: night.people, poles });
  Labels.markSelected(view.element, 'strategy', reading.strategy);
  renderAlerts(alertsFor(reading));
  renderButtons(reading);
}

function setOnline(online) {
  view.online = online;
  const status = document.getElementById('board-status');
  status.dataset.online = String(online);
  status.textContent = online ? 'ESP32 conectado' : 'Sin conexión con la placa';
  for (const button of view.element.querySelectorAll('button')) {
    button.disabled = !online;
  }
  if (online) {
    view.map.showMessage('');
    return;
  }
  view.map.update({ isNight: false, poles: offPoles(), walkers: [], sensors: { pirA: 0, pirB: 0 } });
  view.map.showMessage('Esperando a la maqueta');
}

function onMessage(message) {
  if (message.type === 'status') setOnline(message.boardOnline);
  if (message.type !== 'reading') return;
  if (!view.online) setOnline(true);
  renderReading(message);
  renderChart(message);
}

function onClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.group === 'strategy') Connection.send('setStrategy', { value: button.dataset.key });
  if (button.dataset.action) Connection.send(button.dataset.action);
}

async function show() {
  const response = await fetch('/api/calibration');
  const calibration = await response.json();
  view.fit = calibration.points.length >= 3 ? Energy.linearRegression(calibration.points) : null;
}

function start() {
  view.element = document.getElementById('monitor');
  view.element.innerHTML = ScreenLayout.template({ phase: 'Sin datos', controls: controls() });
  view.map = new CityMap(bind('map'));
  view.chart = Charts.lineChart(bind('chart'), 'W');
  view.element.addEventListener('click', onClick);
  setOnline(false);
  Connection.subscribe(onMessage);
  show();
}

const Monitor = { start, show };

export default Monitor;
