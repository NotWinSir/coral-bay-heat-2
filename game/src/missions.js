// missions.js — Vera Castellan's five jobs: the story of Marco Reyes paying
// off his brother's debt one envelope at a time. A chain of errands, thefts
// and one reckoning, with ranks from Nobody to Coral Bay Legend, a chop shop
// that buys hot cars, and two hideouts where the heat dies.

import { poiById } from './city.js';
import { blockOrigin } from './roads.js';
import { spawnThug } from './combat.js';
import { makePed } from './pedestrians.js';
import { makeCar } from './vehicles.js';
import { playerPos, exitCar } from './player.js';
import { addHeat } from './police.js';
import { sfx } from './audio.js';

export const RANKS = [
  { respect: 0, title: 'Nobody' },
  { respect: 25, title: 'Runner' },
  { respect: 55, title: 'Wheelman' },
  { respect: 90, title: "Fixer's Hand" },
  { respect: 130, title: 'Made Man' },
  { respect: 170, title: 'Coral Bay Legend' },
];

export function rankFor(respect) {
  let title = RANKS[0].title;
  for (const r of RANKS) if (respect >= r.respect) title = r.title;
  return title;
}

export const MISSION_DEFS = [
  { id: 'm1', name: 'First Collection', pay: 150, respect: 12 },
  { id: 'm2', name: 'Vulture Tax', pay: 300, respect: 18 },
  { id: 'm3', name: 'Hot Property', pay: 450, respect: 24 },
  { id: 'm4', name: 'The Marina Heist', pay: 700, respect: 30 },
  { id: 'm5', name: 'The Reckoning', pay: 900, respect: 45 },
];

const INTROS = [
  [
    { who: 'Vera Castellan', text: 'Marco Reyes. Your brother Nico owed me four thousand when he ran. Family debt, family collector — that is you now.' },
    { who: 'Marco Reyes', text: 'I drive, Vera. I do not shake people down.' },
    { who: 'Vera Castellan', text: 'Today you do both. Nico the debtor — no relation — runs a stall in Old Town and owes me for protection he begged for. Collect it. WASD to move, E to talk, F to take a car, mouse to aim. Go.' },
  ],
  [
    { who: 'Vera Castellan', text: 'The Vultures taxed three of my shops on Palm Row last night. Their club sits behind the Palms Court. Take the tax back — they will not hand it over politely.' },
    { who: 'Marco Reyes', text: 'Two birds with one debt. Fine.' },
  ],
  [
    { who: 'Vera Castellan', text: 'A Vireo GT sleeps at Hillside Villa, bought with money skimmed from my marina. Bring it to your cousin at Reyes Auto. The villa has a guard; the car has an alarm. You have a gift for both.' },
  ],
  [
    { who: 'Vera Castellan', text: 'The Marina Cash Office holds the Vultures\u2019 weekend take in a bag by the desk. Four of their boys guard it. Take the bag, lose the heat at a hideout — Motel Brisa, the villa — then come home.' },
    { who: 'Marco Reyes', text: 'That is not a job, Vera. That is a war.' },
    { who: 'Vera Castellan', text: 'That is the last big one. Then only Dario remains.' },
  ],
  [
    { who: 'Vera Castellan', text: 'Dario Vane is at Hillside Villa with his guard, counting money that should have buried your brother\u2019s debt twice over. End him, Marco, and the ledger closes.' },
    { who: 'Marco Reyes', text: 'For Nico. And then I am done.' },
    { who: 'Vera Castellan', text: 'Then you are done. Legend of Coral Bay, or a cautionary tale. Drive safe.' },
  ],
];

const OUTROS = [
  [
    { who: 'Vera Castellan', text: 'Counted and correct. You have your brother\u2019s hands after all — careful ones. There will be more work. There always is.' },
  ],
  [
    { who: 'Vera Castellan', text: 'The Row breathes easier tonight. The Vultures will answer this, Marco. Let them come to us.' },
  ],
  [
    { who: 'Vera Castellan', text: 'Reyes Auto sings your praises; the GT is already three cars in a warehouse across the bay. Beautiful work.' },
  ],
  [
    { who: 'Vera Castellan', text: 'The bag, the whole bag. Dario will feel this one in his sleep. One name left in the ledger, wheelman.' },
  ],
  [
    { who: 'Vera Castellan', text: 'It is done. The debt is ash, Marco — yours and your brother\u2019s. Coral Bay is yours now. Try not to spend it all on cars you do not own.' },
    { who: 'Marco Reyes', text: 'No promises, Vera. No promises.' },
  ],
];

export function initMissions(saved) {
  return {
    index: saved ? saved.missionIndex : 0,
    done: saved ? saved.missionsDone : false,
    active: null,
    objective: null,
    vera: null,
  };
}

export function startDialog(G, lines, onDone) {
  G.dialog = { lines, i: 0, onDone: onDone || null };
  sfx.talk();
}

/** Vera waits outside her cafe for the whole story. */
export function initStory(G) {
  const cafe = poiById(G.city, 'cafe');
  const vera = makePed(G.rng, cafe.markerX + 16, cafe.markerY + 6);
  vera.role = 'vera';
  vera.name = 'Vera Castellan';
  vera.shirt = '#6e1423';
  vera.pants = '#1d1d22';
  vera.state = 'stand';
  G.peds.push(vera);
  G.missions.vera = vera;
}

function setObjective(G, x, y, text, radius) {
  G.missions.objective = { x, y, text, radius: radius || 30 };
}

function veraObjective(G, text) {
  const cafe = poiById(G.city, 'cafe');
  setObjective(G, cafe.markerX, cafe.markerY, text || 'Return to Vera at Cafe Castellan', 36);
}

function finishMission(G) {
  const M = G.missions;
  const def = MISSION_DEFS[M.index];
  const p = G.player;
  p.cash += def.pay;
  p.respect += def.respect;
  M.index += 1;
  M.active = null;
  M.objective = null;
  if (M.index >= MISSION_DEFS.length) M.done = true;
  sfx.missionDone();
  G.fx.floater(p.x, p.y - 26, def.name + ' complete  +$' + def.pay, '#8fe388');
  G.toast = { title: 'MISSION COMPLETE', text: def.name + '  ·  +$' + def.pay + '  ·  Respect ' + p.respect + ' — ' + rankFor(p.respect), t: 4.2 };
  G.saveGame();
}

function beginMission(G) {
  const M = G.missions;
  const def = MISSION_DEFS[M.index];
  M.active = { def, stage: 0, data: {} };
  sfx.missionStart();
  G.toast = { title: 'MISSION', text: def.name, t: 3 };
  setupStage(G);
}

function setupStage(G) {
  const M = G.missions;
  const A = M.active;
  if (!A) return;
  const idx = M.index;
  const stage = A.stage;
  if (idx === 0) {
    if (stage === 0) {
      const spot = blockOrigin(2, 2);
      A.data.nicoX = spot.x + 80;
      A.data.nicoY = spot.y + 178;
      if (!A.data.nico) {
        const nico = makePed(G.rng, A.data.nicoX, A.data.nicoY);
        nico.role = 'debtor';
        nico.name = 'Nico the debtor';
        nico.state = 'stand';
        G.peds.push(nico);
        A.data.nico = nico;
      }
      setObjective(G, A.data.nicoX, A.data.nicoY, 'Collect the debt from Nico in Old Town', 34);
    } else veraObjective(G);
  } else if (idx === 1) {
    if (stage === 0) {
      const spot = blockOrigin(6, 8);
      A.data.clubX = spot.x + 80;
      A.data.clubY = spot.y + 178;
      if (!A.data.guards) {
        A.data.guards = [
          spawnThug(G, A.data.clubX - 34, A.data.clubY - 26, { group: 'm2' }),
          spawnThug(G, A.data.clubX + 38, A.data.clubY - 30, { group: 'm2' }),
        ];
      }
      setObjective(G, A.data.clubX, A.data.clubY, 'Take back the tax at the Palms Court club', 40);
    } else if (stage === 1) {
      setObjective(G, A.data.clubX, A.data.clubY, 'Collect the tax money at the club door', 30);
    } else veraObjective(G);
  } else if (idx === 2) {
    if (stage === 0) {
      const villa = poiById(G.city, 'villa');
      if (!A.data.gt) {
        A.data.gt = makeCar('sport', villa.markerX + 30, villa.markerY + 44, Math.PI, '#d92338');
        A.data.gt.driver = null;
        A.data.gt.parked = true;
        G.cars.push(A.data.gt);
        spawnThug(G, villa.markerX - 40, villa.markerY + 20, { group: 'm3' });
      }
      setObjective(G, A.data.gt.x, A.data.gt.y, 'Steal the Vireo GT at Hillside Villa', 40);
    } else {
      const shop = poiById(G.city, 'chopshop');
      setObjective(G, shop.markerX, shop.markerY, 'Deliver the Vireo GT to Reyes Auto', 46);
    }
  } else if (idx === 3) {
    if (stage === 0) {
      const marina = poiById(G.city, 'marina');
      if (!A.data.guards) {
        A.data.guards = [
          spawnThug(G, marina.markerX - 52, marina.markerY - 10, { group: 'm4' }),
          spawnThug(G, marina.markerX + 54, marina.markerY - 14, { group: 'm4' }),
          spawnThug(G, marina.markerX - 20, marina.markerY + 34, { group: 'm4' }),
          spawnThug(G, marina.markerX + 24, marina.markerY + 38, { group: 'm4' }),
        ];
      }
      setObjective(G, marina.markerX, marina.markerY, 'Clear out the Marina Cash Office guards', 46);
    } else if (stage === 1) {
      const marina = poiById(G.city, 'marina');
      setObjective(G, marina.doorX, marina.doorY + 16, 'Grab the cash bag from the office', 28);
    } else if (stage === 2) {
      setObjective(G, 0, 0, 'Lose the heat — reach a hideout or stay unseen', 1);
    } else veraObjective(G);
  } else if (idx === 4) {
    if (stage === 0) {
      const villa = poiById(G.city, 'villa');
      if (!A.data.boss) {
        A.data.boss = spawnThug(G, villa.markerX, villa.markerY + 26, { boss: true, name: 'Dario Vane', group: 'm5' });
        A.data.guards = [
          spawnThug(G, villa.markerX - 56, villa.markerY + 8, { group: 'm5' }),
          spawnThug(G, villa.markerX + 58, villa.markerY + 4, { group: 'm5' }),
          spawnThug(G, villa.markerX + 6, villa.markerY + 64, { group: 'm5' }),
        ];
      }
      setObjective(G, villa.markerX, villa.markerY, 'End Dario Vane at Hillside Villa', 52);
    } else veraObjective(G);
  }
}

function advanceStage(G) {
  const M = G.missions;
  M.active.stage += 1;
  setupStage(G);
}

function guardsDead(list) {
  return list.every((t) => t.dead);
}

export function updateMissions(G, dt) {
  const M = G.missions;
  const p = G.player;
  const pp = playerPos(G);
  G.interact = null;

  // Stage progression that does not need a button press.
  if (M.active) {
    const A = M.active;
    const idx = M.index;
    if (idx === 1 && A.stage === 0 && guardsDead(A.data.guards)) advanceStage(G);
    else if (idx === 2 && A.stage === 0 && p.car && p.car === A.data.gt) {
      addHeat(G, 1.2);
      G.toast = { title: 'HOT PROPERTY', text: 'The villa guard saw you. Get the GT to Reyes Auto.', t: 3 };
      advanceStage(G);
    } else if (idx === 3 && A.stage === 0 && guardsDead(A.data.guards)) advanceStage(G);
    else if (idx === 3 && A.stage === 2 && G.wanted.stars === 0) advanceStage(G);
    else if (idx === 4 && A.stage === 0 && A.data.boss && A.data.boss.dead) advanceStage(G);

    // Aggro the guards when Marco closes in on a guarded objective.
    if (M.objective && (idx === 1 || idx === 3 || idx === 4) && A.stage === 0) {
      const d = Math.hypot(pp.x - M.objective.x, pp.y - M.objective.y);
      if (d < 250) G.aggroGroups.add('m' + (idx + 1));
    }
  }

  const near = (x, y, r) => Math.hypot(pp.x - x, pp.y - y) < r;

  // Mission button prompts take priority over the world's standing offers.
  if (!M.active && !M.done && M.vera && near(M.vera.x, M.vera.y, 36)) {
    const def = MISSION_DEFS[M.index];
    G.interact = {
      x: M.vera.x, y: M.vera.y, label: 'Talk to Vera — ' + def.name,
      action: () => startDialog(G, INTROS[M.index], () => beginMission(G)),
    };
    return;
  }
  if (M.active) {
    const A = M.active;
    const idx = M.index;
    if (idx === 0 && A.stage === 0 && near(A.data.nicoX, A.data.nicoY, 36)) {
      G.interact = {
        x: A.data.nicoX, y: A.data.nicoY, label: 'Collect the debt',
        action: () => {
          startDialog(G, [
            { who: 'Nico the debtor', text: 'Marco? Vera sent her brother-in-law? Take it, take it — four hundred, every cent. Tell her the stall pays on time from now on.' },
            { who: 'Marco Reyes', text: 'It pays on time, Nico. For your sake.' },
          ], () => {
            spawnThug(G, A.data.nicoX + 96, A.data.nicoY + 14, { group: 'm1' });
            G.aggroGroups.add('m1');
            G.toast = { title: 'AMBUSH', text: 'A Vulture was watching the stall.', t: 2.6 };
            advanceStage(G);
          });
        },
      };
      return;
    }
    if (idx === 0 && A.stage === 1 && near(M.vera.x, M.vera.y, 38)) {
      G.interact = { x: M.vera.x, y: M.vera.y, label: 'Give Vera the envelope', action: () => startDialog(G, OUTROS[0], () => finishMission(G)) };
      return;
    }
    if (idx === 1 && A.stage === 2 && near(M.vera.x, M.vera.y, 38)) {
      G.interact = { x: M.vera.x, y: M.vera.y, label: 'Give Vera the tax money', action: () => startDialog(G, OUTROS[1], () => finishMission(G)) };
      return;
    }
    if (idx === 1 && A.stage === 1 && M.objective && near(M.objective.x, M.objective.y, 32)) {
      G.interact = {
        x: M.objective.x, y: M.objective.y, label: 'Collect the tax money',
        action: () => { sfx.cash(); G.toast = { title: 'TAX COLLECTED', text: 'Every cent the Vultures took, and interest in bruises.', t: 2.6 }; advanceStage(G); },
      };
      return;
    }
    if (idx === 2 && A.stage === 1 && p.car === A.data.gt && M.objective && near(M.objective.x, M.objective.y, 50)) {
      G.interact = {
        x: M.objective.x, y: M.objective.y, label: 'Hand over the Vireo GT',
        action: () => {
          const gt = A.data.gt;
          exitCar(G);
          G.cars = G.cars.filter((c) => c !== gt);
          startDialog(G, [
            { who: 'Reyes Auto', text: 'Cousin! She is beautiful and she is already sold. Vera gets her cut tonight.' },
          ], () => finishMission(G));
        },
      };
      return;
    }
    if (idx === 3 && A.stage === 1 && M.objective && near(M.objective.x, M.objective.y, 30)) {
      G.interact = {
        x: M.objective.x, y: M.objective.y, label: 'Grab the cash bag',
        action: () => {
          addHeat(G, 2.2);
          sfx.cash();
          G.toast = { title: 'BAG TAKEN', text: 'Sirens already. Lose the heat.', t: 2.8 };
          advanceStage(G);
        },
      };
      return;
    }
    if ((idx === 3 && A.stage === 3) || (idx === 4 && A.stage === 1)) {
      if (near(M.vera.x, M.vera.y, 38)) {
        G.interact = { x: M.vera.x, y: M.vera.y, label: 'Report to Vera', action: () => startDialog(G, OUTROS[idx], () => finishMission(G)) };
        return;
      }
    }
  }

  // Hideouts: rest, and the city forgets your face for a while.
  if (G.wanted.hideoutCd <= 0 && (G.wanted.stars > 0 || p.hp < p.maxHp)) {
    for (const poi of G.city.pois) {
      if (poi.kind !== 'hideout') continue;
      if (near(poi.markerX, poi.markerY, 40)) {
        G.interact = {
          x: poi.markerX, y: poi.markerY, label: 'Rest at ' + poi.name + ' — clear heat, heal',
          action: () => {
            G.clearHeat();
            p.hp = p.maxHp;
            G.wanted.hideoutCd = 20;
            sfx.heal();
            G.toast = { title: poi.name.toUpperCase(), text: 'You sleep it off. Coral Bay forgets, for now.', t: 3 };
            G.saveGame();
            if (M.active && M.index === 3 && M.active.stage === 2) advanceStage(G);
          },
        };
        return;
      }
    }
  }

  // The chop shop buys any car Marco does not own, no questions asked.
  if (p.car && !p.car.ownedByPlayer && p.car.driver === 'player') {
    const shop = poiById(G.city, 'chopshop');
    if (near(shop.markerX, shop.markerY, 52)) {
      const car = p.car;
      const payout = Math.round(car.spec.value * (0.35 + 0.65 * (car.health / 100)));
      G.interact = {
        x: shop.markerX, y: shop.markerY, label: 'Sell the ' + car.spec.label + ' — $' + payout,
        action: () => {
          exitCar(G);
          G.cars = G.cars.filter((c) => c !== car);
          p.cash += payout;
          G.stats.carsSold += 1;
          sfx.cash();
          G.fx.floater(shop.markerX, shop.markerY - 20, '+$' + payout, '#8fe388');
          G.saveGame();
        },
      };
    }
  }
}
