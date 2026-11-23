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
    <div class="control">
      <span>Mantenimiento</span>
      <div class="actions">
        <button class="button" data-action="lampTest">Probar luminarias</button>
        <button class="button" data-action="calibrate">Calibrar consumo</button>
      </div>
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
  if (expected > 100 && reading.powerMw < expected * 0.5) {
    alerts.push(`Los LEDs deberían consumir unos ${Math.round(expected)} mW y se miden ${Math.round(reading.powerMw)} mW. Puede haber un LED dañado o desconectado.`);
  }
  if (reading.ldrRaw <= 10 || reading.ldrRaw >= 4085) {
    alerts.push(`El LDR marca ${reading.ldrRaw} de 4095, en el límite de su rango. Revisa su conexión al pin 34.`);
  }
  return alerts;
}

function renderAlerts(alerts) {
  let markup = '';
  for (const message of alerts) {
    markup += `<div class="alert" data-tone="warning">${message}</div>`;
  }
  bind('alerts').innerHTML = markup;
}

function renderStatus(reading) {
  if (reading.mode === 'lampTest') bind('status').textContent = 'Probando luminarias: los 6 LEDs deberían estar encendidos.';
  if (reading.mode === 'calibration') bind('status').textContent = `Calibrando consumo: brillo al ${reading.brightness[0]} %. El resultado aparece en Análisis.`;
  if (reading.mode === 'auto') bind('status').textContent = 'Probar luminarias enciende los 6 LEDs durante 5 s. Calibrar consumo sube el brillo de 0 a 100 % en 33 s para ajustar el modelo de consumo.';
}

function renderChart(reading) {
  if (reading.isNight && !view.wasNight) view.samples = [];
  view.wasNight = reading.isNight;
  if (!reading.isNight) return;
  view.samples.push({ label: reading.clock, power: reading.powerMw });
  if (view.samples.length > SAMPLE_LIMIT) view.samples.shift();
  const labels = [];
  const values = [];
  for (const sample of view.samples) {
    labels.push(sample.label);
    values.push(sample.power);
  }
  view.chart.data.labels = labels;
  view.chart.data.datasets = [Charts.series('Potencia', values, Labels.COLORS[reading.strategy], { fill: 'origin', backgroundColor: 'rgb(255 179 64 / 0.15)' })];
  view.chart.update();
}

function renderReading(reading) {
  const night = reading.night || { energy: 0, people: 0 };
  const poles = [];
  for (let index = 0; index < reading.brightness.length; index++) {
    poles.push({ brightness: reading.brightness[index] / 100, state: reading.states[index] });
  }
  view.map.update({ isNight: reading.isNight, poles, walkers: [], sensors: { pirA: reading.pirA, pirB: reading.pirB } });
  bind('phase').textContent = reading.isNight ? 'Noche' : 'Día';
  bind('clock').textContent = reading.clock;
  bind('info').textContent = `Luz ambiente ${Labels.number(reading.ldrPercent, 1)} %`;
  ScreenLayout.renderNow(view.element, { power: reading.powerMw, energy: night.energy, people: night.people, poles, unit: 'mW' });
  Labels.markSelected(view.element, 'strategy', reading.strategy);
  renderAlerts(alertsFor(reading));
  renderStatus(reading);
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
    view.map.showMessage('', '');
    return;
  }
  view.map.update({ isNight: false, poles: offPoles(), walkers: [], sensors: { pirA: 0, pirB: 0 } });
  view.map.showMessage('Esperando a la maqueta', 'Enciende el ESP32 y conéctalo al mismo WiFi que esta computadora. Los datos aparecerán aquí en cuanto lleguen.');
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
  view.element.innerHTML = ScreenLayout.template({
    phase: 'Esperando datos',
    nowHint: 'Medido por el INA219 en la línea de los LEDs de la maqueta.',
    controlsTitle: 'Control de la placa',
    controls: controls(),
    status: '',
    chartHint: 'Potencia medida desde que se tapó el LDR. Cada noche queda guardada en Análisis.',
  });
  view.map = new CityMap(bind('map'));
  view.chart = Charts.lineChart(bind('chart'), 'mW');
  view.element.addEventListener('click', onClick);
  setOnline(false);
  Connection.subscribe(onMessage);
  show();
}

const Monitor = { start, show };

export default Monitor;
