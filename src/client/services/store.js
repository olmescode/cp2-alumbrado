const listeners = new Set();

const Store = {
  state: {
    mode: 'simulation',
    source: 'simulation',
    deviceOnline: false,
    clock: '18:00',
    strategy: 'adaptive',
    scenario: 'normal',
    playing: false,
    speed: 60,
    isNight: true,
    ldrPercent: 10,
    ldrRaw: 0,
    pirA: 0,
    pirB: 0,
    poles: [],
    walkers: [],
    unit: 'W',
    power: 0,
    energy: 0,
    samples: [],
    sweep: {},
    observed: {},
  },

  set: (changes) => {
    Object.assign(Store.state, changes);
    for (const listener of listeners) listener(Store.state);
  },

  subscribe: (listener) => {
    listeners.add(listener);
    listener(Store.state);
  },
};

export default Store;
