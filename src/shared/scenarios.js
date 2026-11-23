import Config from './config.js';

const Scenarios = {
  hourlyCounts: (people) => {
    const hours = Config.HOURLY_SHARE.map((share, hour) => ({ hour, count: Math.floor((share * people) / 100), remainder: (share * people) % 100 }));
    const assigned = hours.reduce((total, hour) => total + hour.count, 0);
    const byRemainder = [...hours].sort((first, second) => second.remainder - first.remainder || first.hour - second.hour);
    for (const hour of byRemainder.slice(0, people - assigned)) hour.count += 1;
    return hours.map((hour) => hour.count);
  },

  walkers: (people) => {
    const counts = Scenarios.hourlyCounts(people);
    const startTimes = counts.flatMap((count, hour) => Array.from({ length: count }, (_, index) => hour * 3600 + ((index + 0.5) * 3600) / count));
    return startTimes.map((startTime, index) => ({ startTime, route: Config.ROUTES[index % Config.ROUTES.length] }));
  },
};

export default Scenarios;
