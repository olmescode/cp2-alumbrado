import Config from './config.js';

function byLargestRemainder(first, second) {
  return second.remainder - first.remainder || first.hour - second.hour;
}

function hourlyCounts(people) {
  const hours = [];
  let assigned = 0;
  for (let hour = 0; hour < Config.HOURLY_SHARE.length; hour++) {
    const share = Config.HOURLY_SHARE[hour] * people;
    hours.push({ hour, count: Math.floor(share / 100), remainder: share % 100 });
    assigned += Math.floor(share / 100);
  }
  const ranking = [...hours].sort(byLargestRemainder);
  for (let index = 0; index < people - assigned; index++) {
    ranking[index].count += 1;
  }
  const counts = [];
  for (const hour of hours) {
    counts.push(hour.count);
  }
  return counts;
}

function walkers(people) {
  const counts = hourlyCounts(people);
  const list = [];
  for (let hour = 0; hour < counts.length; hour++) {
    for (let index = 0; index < counts[hour]; index++) {
      const startTime = hour * 3600 + ((index + 0.5) * 3600) / counts[hour];
      const route = Config.ROUTES[list.length % Config.ROUTES.length];
      list.push({ startTime, route });
    }
  }
  return list;
}

const Scenarios = { hourlyCounts, walkers };

export default Scenarios;
