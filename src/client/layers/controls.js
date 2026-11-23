import Labels from '../labels.js';
import Connection from '../services/connection.js';
import LocalSimulation from '../services/localSimulation.js';
import Store from '../services/store.js';

const SPEEDS = [10, 60, 300, 1200];

const segmented = (group, options) => {
  const buttons = Object.entries(options).map(([key, label]) => `<button data-group="${group}" data-key="${key}">${label}</button>`);
  return `<div class="segmented wide">${buttons.join('')}</div>`;
};

const SIMULATION_PANEL = `
  <div class="clock"><span data-bind="clock"></span><small>Noche simulada de 18:00 a 06:00</small></div>
  <div class="row">
    <button class="button primary" data-action="toggle"></button>
    <button class="button" data-action="restart">Reiniciar</button>
  </div>
  <div class="field"><span>Velocidad (segundos de noche por segundo real)</span>${segmented('speed', Object.fromEntries(SPEEDS.map((speed) => [speed, `×${speed}`])))}</div>
  <div class="field"><span>Estrategia</span>${segmented('strategy', Labels.strategies)}</div>
  <div class="field"><span>Noche</span>${segmented('scenario', { quiet: 'Tranquila (5)', normal: 'Normal (20)', busy: 'Concurrida (60)' })}</div>
  <div class="field"><span>Hacer pasar a una persona</span><div class="row">
    <button class="button" data-action="person" data-entrance="A1">Por PIR A</button>
    <button class="button" data-action="person" data-entrance="B3">Por PIR B</button>
  </div></div>
  <label class="field"><span data-bind="ldr"></span><input type="range" min="0" max="100" data-action="ldr" /></label>`;

const LIVE_PANEL = `
  <div class="clock"><span data-bind="clock"></span><small>Reloj de la maqueta</small></div>
  <div class="field"><span>Estrategia en la placa</span>${segmented('strategy', Labels.strategies)}</div>
  <div class="field"><span>Pruebas</span><div class="row">
    <button class="button primary" data-action="night">Iniciar noche acelerada</button>
    <button class="button" data-action="sweep">Barrido de brillo</button>
  </div></div>
  <div class="field" data-bind="emulated"><span>Solo con el emulador</span><div class="row">
    <button class="button" data-action="person" data-entrance="A1">Persona por PIR A</button>
    <button class="button" data-action="person" data-entrance="B3">Persona por PIR B</button>
  </div></div>
  <p class="hint">La noche acelerada dura 12 minutos: cada segundo real es un minuto de la noche.</p>`;

const ACTIONS = {
  simulation: {
    toggle: () => Store.set({ playing: !Store.state.playing }),
    restart: () => {
      Store.set({ playing: false });
      LocalSimulation.reset();
    },
    person: (button) => LocalSimulation.addPerson(button.dataset.entrance),
    speed: (button) => Store.set({ speed: Number(button.dataset.key) }),
    strategy: (button) => {
      Store.set({ strategy: button.dataset.key });
      LocalSimulation.reset();
    },
    scenario: (button) => {
      Store.set({ scenario: button.dataset.key, playing: false });
      LocalSimulation.reset();
    },
  },
  live: {
    strategy: (button) => Connection.send('setStrategy', { value: button.dataset.key }),
    night: () => Connection.send('startNight', { factor: 60 }),
    sweep: () => Connection.send('brightnessSweep'),
    person: (button) => Connection.send('simulatePerson', { entrance: button.dataset.entrance }),
  },
};

const Controls = {
  element: null,
  mode: '',

  start: () => {
    Controls.element = document.getElementById('controls');
    Controls.element.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      const action = button && ACTIONS[Store.state.mode][button.dataset.group || button.dataset.action];
      if (action) action(button);
    });
    Controls.element.addEventListener('input', (event) => Store.set({ ldrPercent: Number(event.target.value) }));
    Store.subscribe(Controls.render);
  },

  render: (state) => {
    const element = Controls.element;
    if (Controls.mode !== state.mode) {
      Controls.mode = state.mode;
      element.innerHTML = state.mode === 'simulation' ? SIMULATION_PANEL : LIVE_PANEL;
    }
    const selected = { speed: String(state.speed), strategy: state.strategy, scenario: state.scenario };
    for (const button of element.querySelectorAll('[data-group]')) button.setAttribute('aria-selected', String(selected[button.dataset.group] === button.dataset.key));
    element.querySelector('[data-bind="clock"]').textContent = state.clock;
    const toggle = element.querySelector('[data-action="toggle"]');
    if (toggle) toggle.textContent = state.playing ? 'Pausar' : 'Reproducir';
    const slider = element.querySelector('[data-action="ldr"]');
    if (slider) {
      slider.value = String(state.ldrPercent);
      element.querySelector('[data-bind="ldr"]').textContent = `Luz ambiente (LDR): ${state.ldrPercent} %. Es de noche por debajo de 30 % y de día por encima de 40 %.`;
    }
    const emulated = element.querySelector('[data-bind="emulated"]');
    if (emulated) emulated.hidden = state.source !== 'emulator';
    for (const button of element.querySelectorAll('button')) button.disabled = state.mode === 'live' && !state.deviceOnline;
  },
};

export default Controls;
