import Energy from '/shared/energy.js';
import Store from '../services/store.js';

const LED_NOMINAL_MW = 90;

const expectedPower = (state) => {
  const levels = state.poles.map((pole) => pole.brightness * 100);
  const points = Object.entries(state.sweep).map(([level, point]) => [Number(level), point.total / point.count]);
  const average = levels.reduce((total, level) => total + level, 0) / Math.max(levels.length, 1);
  if (points.length < 3) return (LED_NOMINAL_MW * average * levels.length) / 100;
  const fit = Energy.linearRegression(points);
  return fit.intercept + fit.slope * average;
};

const Alerts = {
  start: () => Store.subscribe(Alerts.render),

  render: (state) => {
    if (state.mode !== 'live') return;
    const alerts = [];
    const expected = expectedPower(state);
    if (!state.deviceOnline) alerts.push(['danger', 'La placa no envía datos desde hace más de 3 s. Revisa que esté encendida y conectada al mismo WiFi que esta computadora.']);
    if (state.deviceOnline && expected > 100 && state.power < expected * 0.5) {
      alerts.push(['warning', `Los LEDs deberían consumir unos ${Math.round(expected)} mW y el INA219 mide ${Math.round(state.power)} mW. Puede haber un LED dañado o desconectado.`]);
    }
    if (state.deviceOnline && (state.ldrRaw <= 10 || state.ldrRaw >= 4085)) {
      alerts.push(['warning', `El LDR marca ${state.ldrRaw} de 4095, en el límite de su rango. Revisa su conexión al pin 34 y la resistencia de 10 kΩ.`]);
    }
    if (alerts.length === 0) alerts.push(['success', 'Todo en orden: la placa envía datos y las lecturas están dentro de lo esperado.']);
    const items = alerts.map(([tone, message]) => `<div class="alert" data-tone="${tone}">${message}</div>`);
    document.getElementById('alerts').innerHTML = `<h2>Alertas</h2>${items.join('')}`;
  },
};

export default Alerts;
