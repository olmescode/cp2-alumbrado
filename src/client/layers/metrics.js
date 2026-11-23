import Labels from '../labels.js';
import Store from '../services/store.js';

const Metrics = {
  start: () => Store.subscribe(Metrics.render),

  render: (state) => {
    const lit = state.poles.filter((pole) => pole.brightness >= 1).length;
    const elapsedHours = (state.progress || 0) * 12;
    const permanentEnergy = 600 * elapsedHours;
    const savings = permanentEnergy > 0 ? 100 * (1 - state.energy / permanentEnergy) : 0;
    const energyUnit = state.unit === 'W' ? 'Wh' : 'mWh';
    const fourth = state.mode === 'simulation'
      ? [`${Labels.number(savings, 1)} %`, 'Ahorro frente a la permanente']
      : [`${Labels.number(state.ldrPercent, 1)} %`, 'Luz ambiente (LDR)'];
    const metrics = [
      [`${Labels.number(state.power, state.unit === 'W' ? 0 : 1)} ${state.unit}`, 'Potencia ahora'],
      [`${Labels.number(state.energy, 1)} ${energyUnit}`, 'Energía acumulada'],
      [`${lit} de 6`, 'Postes al 100 %'],
      fourth,
    ];
    const cells = metrics.map(([figure, label]) => `<div class="metric"><strong>${figure}</strong><span>${label}</span></div>`);
    document.getElementById('metrics').innerHTML = cells.join('');
  },
};

export default Metrics;
