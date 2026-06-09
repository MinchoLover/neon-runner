const TIER_REWARDS = {
  easy: 400,
  medium: 700,
  hard: 1100,
  elite: 1800,
};

const REPLACE_DELAY = 4.2;
const ACTIVE_MISSION_COUNT = 3;
const MISSION_HINTS = {
  'near-8': { focus: 'near', hint: 'GRAZE CLOSE' },
  'timed-near-6': { focus: 'near', hint: 'CHAIN NEAR' },
  'no-boost-300': { focus: 'noBoost', hint: 'SAVE BOOST' },
  'hyper-pass-8': { focus: 'hyper', hint: 'PASS IN HYPER' },
  'combo-20': { focus: 'combo', hint: 'HOLD COMBO' },
  'no-hit-500': { focus: 'noHit', hint: 'NO HIT' },
  'low-shield-250': { focus: 'critical', hint: 'CRITICAL RUN' },
};

const MISSION_DEFS = [
  {
    id: 'distance-900',
    label: 'Reach 900M',
    tier: 'easy',
    target: 900,
    read: (mission, stats) => Math.floor(stats.distance),
  },
  {
    id: 'score-14000',
    label: 'Score 14,000',
    tier: 'medium',
    target: 14000,
    read: (mission, stats) => Math.floor(stats.score),
  },
  {
    id: 'near-8',
    label: 'Near Miss 8',
    tier: 'medium',
    target: 8,
    read: (mission, stats) => stats.nearMisses,
  },
  {
    id: 'hyper-pass-8',
    label: 'Pass 8 In Hyper',
    tier: 'hard',
    target: 8,
    read: (mission) => mission.progress.hyperPasses,
  },
  {
    id: 'timed-near-6',
    label: '6 Near Miss In 20s',
    tier: 'hard',
    target: 6,
    timeLimit: 20,
    read: (mission) => mission.progress.nearMisses,
  },
  {
    id: 'no-hit-500',
    label: 'No Hit 500M',
    tier: 'hard',
    target: 500,
    failOn: ['hit'],
    read: (mission, stats) => Math.floor(stats.distance - mission.startDistance),
  },
  {
    id: 'no-boost-300',
    label: 'No Boost 300M',
    tier: 'medium',
    target: 300,
    failOn: ['boost'],
    read: (mission, stats) => Math.floor(stats.distance - mission.startDistance),
  },
  {
    id: 'combo-20',
    label: 'Hold X20 Combo',
    tier: 'elite',
    target: 20,
    failOn: ['hit'],
    read: (mission, stats) => stats.combo,
  },
  {
    id: 'low-shield-250',
    label: 'Critical 250M',
    tier: 'elite',
    target: 250,
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
        mission.value = Math.min(Math.max(0, Math.floor(mission.read(mission, stats))), mission.target);
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
    };

    for (const mission of this.active) {
      if (mission.status !== 'active') continue;
      const tierWeight = mission.tier === 'elite' ? 0.5 : mission.tier === 'hard' ? 0.28 : 0;
      const progress = mission.target > 0 ? mission.value / mission.target : 0;
      intensity = Math.max(intensity, tierWeight + progress * tierWeight);
      eliteActive ||= mission.tier === 'elite';
      if (mission.timeLimit && mission.timeLeft <= Math.min(6, mission.timeLimit * 0.35)) urgent = true;
      if (mission.focus && Object.prototype.hasOwnProperty.call(focus, mission.focus)) focus[mission.focus] = true;
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
      progress: {
        nearMisses: 0,
        hyperPasses: 0,
        lowShieldDistance: 0,
      },
    };
  }

  _pickDefinition(stats, slotIndex = 0) {
    const unlocked = MISSION_DEFS.filter((definition) => {
      if (stats.distance < 350 && definition.tier === 'elite') return false;
      if (stats.distance < 180 && definition.tier === 'hard') return false;
      return !this.active.some((mission) => mission.id === definition.id && mission.status === 'active');
    });
    const candidates = unlocked.length > 0 ? unlocked : MISSION_DEFS;
    const fresh = candidates.filter((definition) => !this.usedIds.has(definition.id));
    const pool = fresh.length > 0 ? fresh : candidates;
    const tierOrder = slotIndex === 0 ? ['easy', 'medium'] : slotIndex === 1 ? ['medium', 'hard'] : ['hard', 'elite', 'medium'];
    const preferred = pool.filter((definition) => tierOrder.includes(definition.tier));
    const finalPool = preferred.length > 0 ? preferred : pool;
    return finalPool[Math.floor(Math.random() * finalPool.length)];
  }
}
