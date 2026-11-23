import assert from 'node:assert/strict';
import test from 'node:test';
import Energy from '../src/shared/energy.js';
import NightSimulator from '../src/shared/nightSimulator.js';
import Scenarios from '../src/shared/scenarios.js';
import StateMachine from '../src/shared/stateMachine.js';
import StreetGraph from '../src/shared/streetGraph.js';

const byStrategy = (people) => Object.fromEntries(NightSimulator.compare(people).map((run) => [run.strategy, run]));
const runs = { empty: byStrategy(0), quiet: byStrategy(5), normal: byStrategy(20), busy: byStrategy(60) };

test('control energy values', () => {
  assert.equal(runs.normal.permanent.energyWh, 7200);
  assert.equal(runs.normal.scheduled.energyWh, 5400);
  assert.equal(runs.normal.scheduled.savingsPercent, 25);
  assert.ok(Math.abs(runs.empty.adaptive.energyWh - 1440) < 1e-9);
  for (const scenario of ['quiet', 'normal', 'busy']) {
    assert.ok(runs[scenario].adaptive.energyWh > 1440 && runs[scenario].adaptive.energyWh < 7200);
  }
});

test('service level', () => {
  for (const scenario of ['quiet', 'normal', 'busy']) {
    assert.equal(runs[scenario].permanent.serviceLevel, 100);
    assert.equal(runs[scenario].adaptive.serviceLevel, 100);
  }
  assert.equal(runs.quiet.scheduled.serviceLevel, 100);
  assert.ok(runs.normal.scheduled.serviceLevel < 100);
  assert.ok(runs.busy.scheduled.serviceLevel < 100);
});

test('switch-ons', () => {
  assert.equal(runs.normal.permanent.switchOns, 6);
  assert.equal(runs.normal.scheduled.switchOns, 12);
  assert.equal(runs.empty.adaptive.switchOns, 0);
});

test('hourly share by largest remainder', () => {
  assert.deepEqual(Scenarios.hourlyCounts(5), [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(Scenarios.hourlyCounts(20), [4, 4, 3, 3, 2, 1, 1, 1, 0, 0, 0, 1]);
  assert.deepEqual(Scenarios.hourlyCounts(60), [12, 12, 9, 9, 6, 4, 2, 1, 1, 1, 1, 2]);
});

test('dijkstra distances from each entrance', () => {
  const fromA1 = StreetGraph.dijkstra(StreetGraph.graph, 'A1');
  assert.deepEqual(fromA1.distances, { A1: 0, A2: 30, A3: 60, B1: 60, B2: 90, B3: 120 });
  assert.equal(fromA1.predecessors.B3, 'B2');
  assert.equal(fromA1.iterations.length, 6);
  assert.deepEqual(StreetGraph.dijkstra(StreetGraph.graph, 'B3').distances, { A1: 120, A2: 90, A3: 120, B1: 60, B2: 30, B3: 0 });
});

test('light wave plan', () => {
  const plan = StreetGraph.lightWavePlan('A1', 100);
  assert.deepEqual(plan.A1, { activeFrom: 100, holdFrom: 100, baseAt: 130 });
  assert.ok(Math.abs(plan.A2.holdFrom - (100 + 30 / 1.4)) < 1e-9);
  assert.ok(Math.abs(plan.A2.activeFrom - (plan.A2.holdFrom - 10)) < 1e-9);
});

test('state machine', () => {
  const plan = StreetGraph.lightWavePlan('A1', 0);
  assert.equal(StateMachine.stateAt([plan.A2], 15, true), 'Active');
  assert.equal(StateMachine.stateAt([plan.A2], 30, true), 'Hold');
  assert.equal(StateMachine.stateAt([plan.A2], 60, true), 'Base');
  assert.equal(StateMachine.stateAt([plan.A2], 15, false), 'Off');
  assert.equal(StateMachine.isNight(35, false), false);
  assert.equal(StateMachine.isNight(35, true), true);
});

test('linear regression matches class practice 7, example 1', () => {
  const x = [2, 4, 6, 7, 10, 11, 14, 17, 20];
  const y = [1, 2, 5, 2, 8, 7, 6, 9, 12];
  const fit = Energy.linearRegression(x.map((value, index) => [value, y[index]]));
  assert.ok(Math.abs(fit.intercept - 0.13903743315508) < 1e-9);
  assert.ok(Math.abs(fit.slope - 0.55767761650115) < 1e-9);
  assert.ok(Math.abs(fit.r2 - 0.84112533067322) < 1e-9);
});
