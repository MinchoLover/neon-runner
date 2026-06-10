export const LANE_COUNT = 3;
export const LANE_X = [-3, 0, 3];
export const START_LANE_INDEX = 1;
export const PLAYER_HIT_Z_RANGE = 0.72;
export const NEAR_MISS_Z_WINDOW = 1.6;
export const NEAR_MISS_TIME_WINDOW = 0.55;
export const NEAR_MISS_DANGER_DISTANCE = 12;

export const OPENING_SEQUENCE_DURATION = 10;
export const OPENING_MIN_SAFE_GAP = 0.35;
export const OPENING_TRANSITION_DURATION = 5;
export const OPENING_TRANSITION_SPAWN_Z = -24;
export const OPENING_PATTERNS = [
  {
    id: 'move',
    triggerTime: 0.55,
    cueTime: 0.2,
    type: 'easyGate',
    blockedLanes: [1],
    targetArrivalTime: 3.8,
    tutorialText: 'MOVE: A / D',
  },
  {
    id: 'open-gate',
    triggerTime: 2.15,
    cueTime: 4.35,
    type: 'securityGate',
    openLane: 1,
    targetArrivalTime: 5.55,
    tutorialText: 'DODGE THE GATES',
  },
  {
    id: 'near-miss',
    triggerTime: 4.25,
    cueTime: 6.15,
    type: 'nearMissOpportunity',
    blockedLanes: [1],
    targetArrivalTime: 7.25,
    tutorialText: 'LATE DODGE = NEAR MISS',
    isNearMissOpportunity: true,
  },
  {
    id: 'hyper-charge',
    triggerTime: 6.25,
    cueTime: 8.15,
    type: 'hyperChargeGate',
    openLane: 1,
    targetArrivalTime: 9.35,
    tutorialText: 'NEAR MISS BUILDS HYPER',
  },
];

export const SOLAR_CORE = {
  chargeGain: 24,
  scoreGain: 300,
  comboGain: 1,
  collectZRange: 1.15,
  collectXRange: 0.95,
  minObstacleGap: 5.5,
  maxActive: 4,
};

export const SOLAR_CORE_PATTERNS = [
  {
    id: 'safe-core',
    type: 'safeCore',
    riskLevel: 'safe',
    chargeGain: 24,
    scoreGain: 300,
    comboGain: 1,
    minElapsed: 8,
    coreZOffset: 3.5,
    obstacleZOffset: -4,
    cooldown: 6.2,
    tutorialText: 'SOLAR CORE: COLLECT FOR SURGE',
  },
  {
    id: 'risk-core',
    type: 'riskCore',
    riskLevel: 'risk',
    chargeGain: 34,
    scoreGain: 480,
    comboGain: 2,
    minElapsed: 14,
    coreZOffset: -5.5,
    obstacleZOffset: 6.5,
    cooldown: 7.2,
    tutorialText: 'RISK CORE: WAIT, THEN COMMIT',
  },
  {
    id: 'late-dodge-core',
    type: 'lateDodgeCore',
    riskLevel: 'lateDodge',
    chargeGain: 42,
    scoreGain: 680,
    comboGain: 3,
    minElapsed: 20,
    coreZOffset: -1.2,
    obstacleZOffset: 5.4,
    cooldown: 8.2,
    tutorialText: 'LATE DODGE CORE: BIG SURGE',
  },
];

export const COLORS = {
  cyan: 0x00e5ff,
  solarGold: 0xffb700,
  solarOrange: 0xff6200,
  amber: 0xff8c00,
  magenta: 0xff31f7,
  purple: 0x8a35ff,
  blue: 0x0055ff,
  white: 0xffffff,
  dark: 0x020308,
};

export const TUNNEL_PALETTES = [
  {
    name: 'SOLAR SECTOR Alpha',
    primary: 0x00e5ff,
    secondary: 0xffb700,
    accent: 0xff6200,
    obstacle: 0xffb700,
    light: 0x00e5ff,
    fog: 0x010206,
    background: 0x020308,
    bias: 'balanced',
  },
  {
    name: 'SOLAR SECTOR Beta',
    primary: 0xffb700,
    secondary: 0xff6200,
    accent: 0xffffff,
    obstacle: 0xff6200,
    light: 0xffb700,
    fog: 0x030201,
    background: 0x040301,
    bias: 'bar',
  },
  {
    name: 'MAGNETIC GRID',
    primary: 0x0055ff,
    secondary: 0x00e5ff,
    accent: 0xffb700,
    obstacle: 0x00e5ff,
    light: 0x0055ff,
    fog: 0x010208,
    background: 0x02030a,
    bias: 'gate',
  },
  {
    name: 'REACTOR CORE',
    primary: 0xff6200,
    secondary: 0xff2700,
    accent: 0xffffff,
    obstacle: 0xff6200,
    light: 0xff6200,
    fog: 0x080101,
    background: 0x0a0101,
    bias: 'fast',
  },
  {
    name: 'PLASMA WHITE',
    primary: 0xffffff,
    secondary: 0x00e5ff,
    accent: 0xffb700,
    obstacle: 0x00e5ff,
    light: 0xffffff,
    fog: 0x020305,
    background: 0x030408,
    bias: 'balanced',
  },
];

export const HYPER_PALETTE = {
  name: 'SOLAR SURGE',
  primary: 0x9af7ff,
  secondary: 0xffb700,
  accent: 0xff7a18,
  obstacle: 0xffb700,
  light: 0xffd36a,
  fog: 0x030704,
  background: 0x030804,
  bias: 'hyper',
};

export const GAME = {
  startSpeed: 15.5,
  maxSpeed: 38,
  boostSpeed: 11,
  boostDuration: 0.58,
  boostCooldown: 1.05,
  laneWidth: 3,
  playerZ: 5.4,
  playerY: -2.15,
  spawnZ: -104,
  removeZ: 9,
  shield: 3,
  hyperDuration: 9.5,
  hyperChargeMax: 100,
  hyperNearMissGain: 16,
  hyperPassGain: 4,
  hyperComboMilestone: 4,
  hyperComboMilestoneGain: 6,
  hyperHitLoss: 24,
  hyperReadyDelay: 0.65,
  openingPassChargeGain: 12,
  surgeBreakScore: 650,
  surgeBreakComboGain: 2,
};

export function getWrappedLaneIndex(index) {
  return Math.max(0, Math.min(LANE_COUNT - 1, index));
}

export function getLaneAngle(laneIndex) {
  return (getWrappedLaneIndex(laneIndex) - START_LANE_INDEX) * 0.08;
}

export function getLanePosition(laneIndex, z = GAME.playerZ) {
  return {
    x: LANE_X[getWrappedLaneIndex(laneIndex)],
    y: GAME.playerY,
    z,
  };
}

// Feedback / Game Feel Tuning Constants
export const NEAR_MISS_FEEDBACK_DURATION = 0.35;
export const HYPER_READY_PULSE_DURATION = 0.8;
export const HYPER_START_FOV_PULSE = 0.4;
export const HITSTOP_DURATION = 0.06;
export const HITSTOP_COOLDOWN = 0.5;
export const HIT_SHAKE_INTENSITY = 0.2;
export const GAME_OVER_SHAKE_INTENSITY = 0.6;
export const NEAR_MISS_SHAKE_INTENSITY = 0.04;
export const HYPER_SHAKE_INTENSITY = 0.15;
export const AUDIO_EVENT_COOLDOWN = 0.1;
export const SOLAR_CORE_BASE_INTENSITY = 0.6;
export const SOLAR_CORE_SURGE_INTENSITY = 1.2;

export const TUNNEL_VISUALS = {
  ringCount: 24,
  ringSpacing: 4.6,
  radius: 5.55,
  wallLength: 132,
  wallSegmentCount: 12,
  streakCount: 180,
  streakRecycleZ: 9,
  solarCoreZ: -112,
};
