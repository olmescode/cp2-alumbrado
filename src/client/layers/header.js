import Store from '../services/store.js';

const BADGES = {
  simulation: ['Simulación local', ''],
  emulator: ['Datos emulados', 'emulated'],
  esp32: ['ESP32 real', 'live'],
};

const Header = {
  start: () => {
    const modeSwitch = document.getElementById('mode-switch');
    modeSwitch.addEventListener('click', (event) => {
      const mode = event.target.dataset.mode;
      const offPoles = Array.from({ length: 6 }, () => ({ state: 'Off', brightness: 0 }));
      if (mode && mode !== Store.state.mode) Store.set({ mode, playing: false, samples: [], energy: 0, power: 0, observed: {}, sweep: {}, walkers: [], poles: offPoles, lastReadingAt: 0, source: mode, clock: '--:--' });
    });
    Store.subscribe(Header.render);
  },

  render: (state) => {
    document.body.dataset.mode = state.mode;
    for (const button of document.querySelectorAll('#mode-switch button')) button.setAttribute('aria-selected', String(button.dataset.mode === state.mode));
    const badge = document.getElementById('source-badge');
    const [label, tone] = state.mode === 'live' && !state.deviceOnline ? ['Sin conexión con la placa', 'offline'] : BADGES[state.source] || BADGES.simulation;
    badge.textContent = label;
    badge.dataset.tone = tone;
  },
};

export default Header;
