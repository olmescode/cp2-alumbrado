const STATES = { Off: 'Apagada', Base: 'Base', Active: 'Activa', Hold: 'Retención', Fixed: 'Fija' };
const STRATEGIES = { permanent: 'Permanente', scheduled: 'Programada', adaptive: 'Adaptativa' };
const SCENARIOS = { quiet: 'Tranquila', normal: 'Normal', busy: 'Concurrida' };
const COLORS = { permanent: '#8e8e93', scheduled: '#5e5ce6', adaptive: '#ffb340' };

function number(amount, decimals = 0) {
  return amount.toLocaleString('es-EC', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function segmented(group, options, selected) {
  let buttons = '';
  for (const [key, label] of Object.entries(options)) {
    buttons += `<button data-group="${group}" data-key="${key}" aria-pressed="${key === selected}">${label}</button>`;
  }
  return `<div class="segmented">${buttons}</div>`;
}

function markSelected(container, group, selected) {
  for (const button of container.querySelectorAll(`[data-group="${group}"]`)) {
    button.setAttribute('aria-pressed', String(button.dataset.key === selected));
  }
}

const Labels = { STATES, STRATEGIES, SCENARIOS, COLORS, number, segmented, markSelected };

export default Labels;
