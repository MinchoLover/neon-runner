const TIER_REWARDS = {
  easy: 350,
  medium: 650,
  hard: 1000,
  elite: 1600,
};

const REPLACE_DELAY = 3.2;
const ACTIVE_MISSION_COUNT = 3;

const MISSION_HINTS = {
  'distance-350': { focus: 'score', hint: 'KEEP FLOW' },
  'score-3500': { focus: 'score', hint: 'BUILD SCORE' },
  'core-3': { focus: 'hyper', hint: 'COLLECT CORES' },
  'near-3': { focus: 'near', hint: 'GRAZE CLOSE' },
  'timed-near-4': { focus: 'near', hint: 'CHAIN NEAR' },
  'boost-3': { focus: 'boost', hint: 'USE BOOST' },
  'surge-1': { focus: 'hyper', hint: 'ACTIVATE SURGE' },
  'surge-break-3': { focus: 'hyper', hint: 'BREAK GATES' },
  'combo-10': { focus: 'combo', hint: 'HOLD COMBO' },
  'combo-18': { focus: 'combo', hint: 'ELITE COMBO' },
  'no-hit-250': { focus: 'noHit', hint: 'NO HIT' },
  'no-boost-220': { focus: 'noBoost', hint: 'SAVE BOOST' },
  'low-shield-180': { focus: 'critical', hint: 'CRITICAL RUN' },
};

const MISSION_DEFS = [
  {
    id: 'distance-350',
    label: 'Run 350M',
    tier: 'easy',
    target: 350,
    read: (mission, stats) => Math.floor(stats.distance - mission.startDistance),
  },
  {
    id: 'score-3500',
    label: 'Earn 3,500',
    tier: 'easy',
    target: 3500,
    read: (mission, stats) => Math.floor(stats.score - mission.startScore),
  },
  {
    id: 'core-3',
    label: 'Collect 3 Cores',
    tier: 'easy',
    target: 3,
    read: (mission, stats) => (stats.solarCores ?? 0) - mission.startCores,
  },
  {
    id: 'near-3',
    label: 'Near Miss 3',
    tier: 'medium',
    target: 3,
    read: (mission) => mission.progress.nearMisses,
  },
  {
    id: 'boost-3',
    label: 'Boost 3 Times',
    tier: 'medium',
    target: 3,
    read: (mission, stats) => (stats.boostsUsed ?? 0) - mission.startBoosts,
  },
  {
    id: 'combo-10',
    label: 'Hold X10 Combo',
    tier: 'medium',
    target: 10,
    failOn: ['hit'],
    read: (mission, stats) => stats.combo,
  },
  {
    id: 'surge-1',
    label: 'Activate Surge',
    tier: 'hard',
    target: 1,
    unlock: (stats) => stats.distance >= 160 || stats.hyperCharge >= 50 || stats.solarCores >= 2,
    read: (mission, stats) => (stats.hyperCount ?? 0) - mission.startHyperCount,
  },
  {
    id: 'surge-break-3',
    label: 'Surge Break 3',
    tier: 'hard',
    target: 3,
    unlock: (stats) => stats.distance >= 220 || stats.hyperCount >= 1,
    read: (mission, stats) => (stats.surgeBreaks ?? 0) - mission.startSurgeBreaks,
  },
  {
    id: 'timed-near-4',
    label: '4 Near Miss In 18s',
    tier: 'hard',
    target: 4,
    timeLimit: 18,
    read: (mission) => mission.progress.nearMisses,
  },
  {
    id: 'no-hit-250',
    label: 'No Hit 250M',
    tier: 'hard',
    target: 250,
    failOn: ['hit'],
    read: (mission, stats) => Math.floor(stats.distance - mission.startDistance),
  },
  {
    id: 'no-boost-220',
    label: 'No Boost 220M',
    tier: 'medium',
    target: 220,
    failOn: ['boost'],
    read: (mission, stats) => Math.floor(stats.distance - mission.startDistance),
  },
  {
    id: 'combo-18',
    label: 'Hold X18 Combo',
    tier: 'elite',
    target: 18,
    failOn: ['hit'],
    unlock: (stats) => stats.distance >= 300,
    read: (mission, stats) => stats.combo,
  },
  {
    id: 'low-shield-180',
    label: 'Critical 180M',
    tier: 'elite',
    target: 180,
    unlock: (stats) => stats.distance >= 300 || stats.shield <= 1,
    read: (mission) => Math.floor(mission.progress.lowShieldDistance),
  },
];

export class MissionManager {
  constructor() {
    this.active = [];
    this.completedTotal = 0;
    this.usedIds = new Set();
    this.lastDistance = 0;
  }

  reset(stats) {
    this.active = [];
    this.completedTotal = 0;
    this.usedIds.clear();
    this.lastDistance = stats.distance;

    for (let i = 0; i < ACTIVE_MISSION_COUNT; i += 1) {
      this.active.push(this._createMission(this._pickDefinition(stats, i), stats));
    }

    return this.getState();
  }

  record(eventName, stats) {
    const events = [];

    for (const mission of this.active) {
      if (mission.status !== 'active') continue;

      if (eventName === 'nearMiss') mission.progress.nearMisses += 1;
      if (eventName === 'passed' && stats.hyperActive) mission.progress.hyperPasses += 1;

      if (mission.failOn.includes(eventName)) {
        events.push(this._failMission(mission));
      }
    }

    return events.filter(Boolean);
  }

  update(delta, stats) {
    const events = [];
    const distanceDelta = Math.max(stats.distance - this.lastDistance, 0);
    this.lastDistance = stats.distance;

    for (let i = 0; i < this.active.length; i += 1) {
      const mission = this.active[i];

      if (mission.status === 'active') {
        if (stats.shield <= 1) mission.progress.lowShieldDistance += distanceDelta;

        mission.value = Math.min(
          Math.max(0, Math.floor(mission.read(mission, stats))),
          mission.target,
        );

        if (mission.value >= mission.target) {
          events.push(this._completeMission(mission));
          continue;
        }

        if (mission.timeLimit) {
          mission.timeLeft = Math.max(mission.timeLeft - delta, 0);
          if (mission.timeLeft <= 0) {
            events.push(this._failMission(mission));
          }
        }
      } else {
        mission.replaceTimer = Math.max(mission.replaceTimer - delta, 0);
        if (mission.replaceTimer <= 0) {
          const replacement = this._createMission(this._pickDefinition(stats, i), stats);
          this.active[i] = replacement;
          events.push({ type: 'replace', mission: replacement });
        }
      }
    }

    return {
      missions: this.getState(),
      events: events.filter(Boolean),
      visual: this.getVisualState(),
    };
  }

  getState() {
    return this.active.map((mission) => ({
      id: mission.id,
      label: mission.label,
      tier: mission.tier,
      target: mission.target,
      value: mission.value,
      reward: mission.reward,
      timeLimit: mission.timeLimit,
      timeLeft: mission.timeLeft,
      focus: mission.focus,
      hint: mission.hint,
      complete: mission.status === 'complete',
      failed: mission.status === 'failed',
      status: mission.status,
    }));
  }

  getVisualState() {
    let intensity = 0;
    let eliteActive = false;
    let urgent = false;

    const focus = {
      near: false,
      noBoost: false,
      hyper: false,
      combo: false,
      noHit: false,
      critical: false,
      boost: false,
      score: false,
    };

    for (const mission of this.active) {
      if (mission.status !== 'active') continue;

      const tierWeight = mission.tier === 'elite' ? 0.5 : mission.tier === 'hard' ? 0.32 : mission.tier === 'medium' ? 0.16 : 0.08;
      const progress = mission.target > 0 ? mission.value / mission.target : 0;

      intensity = Math.max(intensity, tierWeight + progress * tierWeight);
      eliteActive ||= mission.tier === 'elite';

      if (mission.timeLimit && mission.timeLeft <= Math.min(6, mission.timeLimit * 0.35)) {
        urgent = true;
      }

      if (mission.focus && Object.prototype.hasOwnProperty.call(focus, mission.focus)) {
        focus[mission.focus] = true;
      }
    }

    return {
      intensity: Math.min(intensity, 1),
      eliteActive,
      urgent,
      focus,
    };
  }

  _completeMission(mission) {
    mission.status = 'complete';
    mission.value = mission.target;
    mission.replaceTimer = REPLACE_DELAY;
    this.completedTotal += 1;
    return { type: 'complete', mission };
  }

  _failMission(mission) {
    if (mission.status !== 'active') return null;
    mission.status = 'failed';
    mission.replaceTimer = REPLACE_DELAY;
    return { type: 'fail', mission };
  }

  _createMission(definition, stats) {
    this.usedIds.add(definition.id);

    const missionHint = MISSION_HINTS[definition.id] ?? { focus: null, hint: '' };

    return {
      ...definition,
      ...missionHint,
      reward: TIER_REWARDS[definition.tier],
      value: 0,
      status: 'active',
      replaceTimer: 0,
      timeLeft: definition.timeLimit ?? null,
      timeLimit: definition.timeLimit ?? null,
      failOn: definition.failOn ?? [],
      startDistance: stats.distance,
      startScore: stats.score,
      startCores: stats.solarCores ?? 0,
      startBoosts: stats.boostsUsed ?? 0,
      startHyperCount: stats.hyperCount ?? 0,
      startSurgeBreaks: stats.surgeBreaks ?? 0,
      progress: {
        nearMisses: 0,
        hyperPasses: 0,
        lowShieldDistance: 0,
      },
    };
  }

  _pickDefinition(stats, slotIndex = 0) {
    const unlocked = MISSION_DEFS.filter((definition) => {
      if (definition.unlock && !definition.unlock(stats)) return false;
      if (stats.distance < 280 && definition.tier === 'elite') return false;
      if (stats.distance < 120 && definition.tier === 'hard') return false;
      return !this.active.some((mission) => mission.id === definition.id && mission.status === 'active');
    });

    const candidates = unlocked.length > 0 ? unlocked : MISSION_DEFS;
    const fresh = candidates.filter((definition) => !this.usedIds.has(definition.id));
    const pool = fresh.length > 0 ? fresh : candidates;

    const tierOrder =
      slotIndex === 0
        ? ['easy', 'medium']
        : slotIndex === 1
          ? ['medium', 'hard']
          : ['medium', 'hard', 'elite'];

    const preferred = pool.filter((definition) => tierOrder.includes(definition.tier));
    const finalPool = preferred.length > 0 ? preferred : pool;

    return finalPool[Math.floor(Math.random() * finalPool.length)];
  }
}
