import Energy from '/shared/energy.js';
import Charts from '../charts.js';
import CityMap from '../cityMap.js';
import Connection from '../connection.js';
import Labels from '../labels.js';

const SAMPLE_LIMIT = 120;
const LED_NOMINAL_MW = 90;
const OFF_POLES = [0, 0, 0, 0, 0, 0].map(function offPole() {
  return { brightness: 0, state: 'Off' };
});

const view = { element: null, map: null, chart: null, reading: null, online: false, samples: [], fit: null };

function template() {
  return `
    <div class="columns">
      <div class="stack">
        <article class="card glass">
          <div class="hero">
            <div><span class="phase" data-bind="phase">Esperando datos</span><strong data-bind="clock">--:--</strong></div>
            <span data-bind="ldr"></span>
          </div>
          <div data-bind="map"></div>
        </article>
        <article class="card glass">
          <h2>Potencia medida</h2>
          <p class="hint">Lo que mide el INA219 en la línea de los LEDs, en los últimos 60 segundos.</p>
          <div class="chart"><canvas data-bind="chart"></canvas></div>
        </article>
      </div>
      <div class="stack">
        <article class="card glass">
          <h2>Esta noche</h2>
          <div class="stats">
            <div class="stat"><strong data-bind="power">0 mW</strong><span>Potencia ahora</span></div>
            <div class="stat"><strong data-bind="energy">0 mWh</strong><span>Energía de la noche</span></div>
            <div class="stat"><strong data-bind="people">0</strong><span>Personas detectadas</span></div>
            <div class="stat"><strong data-bind="lit">0 de 6</strong><span>Postes al 100 %</span></div>
          </div>
          <div class="stack" data-bind="alerts"></div>
        </article>
        <article class="card glass">
          <h2>Control de la placa</h2>
          <div class="control"><span>Estrategia</span>${Labels.segmented('strategy', Labels.STRATEGIES, 'adaptive')}</div>
          <div class="control">
            <span>Mantenimiento</span>
            <div class="actions">
              <button class="button" data-action="lampTest">Probar luminarias</button>
              <button class="button" data-action="calibrate">Calibrar consumo</button>
            </div>
          </div>
          <p class="hint" data-bind="mode">Probar luminarias enciende los 6 LEDs durante 5 s para revisar que todos funcionen. Calibrar consumo sube el brillo de 0 a 100 % en 33 s y mide la potencia de cada nivel para el análisis.</p>
        </article>
      </div>
    </div>`;
}

function bind(name) {
  return view.element.querySelector(`[data-bind="${name}"]`);
}

function alertsFor(reading) {
  const alerts = [];
  let average = 0;
  for (const level of reading.brightness) {
    average += level / reading.brightness.length;
  }
  const expected = view.fit ? view.fit.intercept + view.fit.slope * average : (LED_NOMINAL_MW * average * reading.brightness.length) / 100;
  if (expected > 100 && reading.powerMw < expected * 0.5) {
    alerts.push(['warning', `Los LEDs deberían consumir unos ${Math.round(expected)} mW y se miden ${Math.round(reading.powerMw)} mW. Puede haber un LED dañado o desconectado.`]);
  }
  if (reading.ldrRaw <= 10 || reading.ldrRaw >= 4085) {
    alerts.push(['warning', `El LDR marca ${reading.ldrRaw} de 4095, en el límite de su rango. Revisa su conexión al pin 34.`]);
  }
  return alerts;
}

function renderAlerts(alerts) {
  let markup = '';
  for (const [tone, message] of alerts) {
    markup += `<div class="alert" data-tone="${tone}">${message}</div>`;
  }
  bind('alerts').innerHTML = markup;
}

function renderModeHint(reading) {
  if (reading.mode === 'lampTest') bind('mode').textContent = 'Probando luminarias: los 6 LEDs deberían estar encendidos.';
  if (reading.mode === 'calibration') bind('mode').textContent = `Calibrando consumo: brillo al ${reading.brightness[0]} %.`;
}

function renderReading(reading) {
  const night = reading.night || { energyMwh: 0, people: 0 };
  let lit = 0;
  const poles = [];
  for (let index = 0; index < reading.brightness.length; index++) {
    if (reading.brightness[index] >= 100) lit += 1;
    poles.push({ brightness: reading.brightness[index] / 100, state: reading.states[index] });
  }
  view.map.update({ isNight: reading.isNight, poles, walkers: [], sensors: { pirA: reading.pirA, pirB: reading.pirB } });
  bind('phase').textContent = reading.isNight ? 'Noche' : 'Día';
  bind('clock').textContent = reading.clock;
  bind('ldr').textContent = `Luz ambiente ${Labels.number(reading.ldrPercent, 1)} %`;
  bind('power').textContent = `${Labels.number(reading.powerMw, 0)} mW`;
  bind('energy').textContent = `${Labels.number(night.energyMwh, 2)} mWh`;
  bind('people').textContent = String(night.people);
  bind('lit').textContent = `${lit} de 6`;
  Labels.markSelected(view.element, 'strategy', reading.strategy);
  renderAlerts(alertsFor(reading));
  renderModeHint(reading);
}

function renderChart(reading) {
  view.samples.push(reading.powerMw);
  if (view.samples.length > SAMPLE_LIMIT) view.samples.shift();
  const labels = [];
  for (let index = 0; index < view.samples.length; index++) {
    labels.push(`${Math.round((index - view.samples.length + 1) / 2)} s`);
  }
  view.chart.data.labels = labels;
  view.chart.data.datasets = [Charts.series('Potencia', view.samples, '#ffb340', { fill: 'origin', backgroundColor: 'rgb(255 179 64 / 0.18)' })];
  view.chart.update();
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
  view.map.update({ isNight: false, poles: OFF_POLES, walkers: [], sensors: { pirA: 0, pirB: 0 } });
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

async function loadCalibration() {
  const response = await fetch('/api/calibration');
  const calibration = await response.json();
  view.fit = calibration.points.length >= 3 ? Energy.linearRegression(calibration.points) : null;
}

function start() {
  view.element = document.getElementById('monitor');
  view.element.innerHTML = template();
  view.map = new CityMap(bind('map'));
  view.chart = Charts.lineChart(bind('chart'), 'mW');
  view.element.addEventListener('click', onClick);
  setOnline(false);
  Connection.subscribe(onMessage);
  loadCalibration();
}

const Monitor = { start, show: loadCalibration };

export default Monitor;
