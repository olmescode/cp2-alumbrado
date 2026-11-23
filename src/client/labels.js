import NightSimulator from '/shared/nightSimulator.js';

const Labels = {
  states: { Off: 'Apagada', Base: 'Base', Active: 'Activa', Hold: 'Retención', Fixed: 'Fija' },
  strategies: { permanent: 'Permanente', scheduled: 'Programada', adaptive: 'Adaptativa' },
  scenarios: { quiet: 'Tranquila', normal: 'Normal', busy: 'Concurrida' },
  colors: { permanent: '#8e8e93', scheduled: '#5e5ce6', adaptive: '#ffb340' },
  number: (amount, decimals = 0) => amount.toLocaleString('es-EC', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  clock: NightSimulator.clock,
};

export default Labels;
