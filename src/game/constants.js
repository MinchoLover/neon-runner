export const LANE_COUNT = 3;
export const LANE_X = [-3, 0, 3];
export const START_LANE_INDEX = 1;
export const PLAYER_HIT_Z_RANGE = 0.72;

export const COLORS = {
  cyan: 0x00e5ff,
  magenta: 0xff31f7,
  purple: 0x8a35ff,
  blue: 0x3c7bff,
  white: 0xeaf7ff,
  dark: 0x03010c,
};

export const TUNNEL_PALETTES = [
  {
    name: 'CYBER PINK',
    primary: 0x00f5ff,
    secondary: 0xff2bd6,
    accent: 0x8b5cff,
    obstacle: 0xff31f7,
    light: 0x00e5ff,
    fog: 0x04000f,
    background: 0x03010c,
    bias: 'balanced',
  },
  {
    name: 'VOID ORANGE',
    primary: 0x8b5cff,
    secondary: 0xff8a00,
    accent: 0xffffff,
    obstacle: 0xff8a00,
    light: 0xff8a00,
    fog: 0x100408,
    background: 0x05020b,
    bias: 'bar',
  },
  {
    name: 'BLUE GRID',
    primary: 0x3c7bff,
    secondary: 0x18ff9e,
    accent: 0x00e5ff,
    obstacle: 0x18ff9e,
    light: 0x3c7bff,
    fog: 0x020814,
    background: 0x010511,
    bias: 'gate',
  },
  {
    name: 'RED CORE',
    primary: 0xff274f,
    secondary: 0x8a35ff,
    accent: 0xffffff,
    obstacle: 0xff274f,
    light: 0xff274f,
    fog: 0x140208,
    background: 0x070106,
    bias: 'fast',
  },
  {
    name: 'ELECTRIC WHITE',
    primary: 0xeaf7ff,
    secondary: 0x00a6ff,
    accent: 0x00f5ff,
    obstacle: 0x00a6ff,
    light: 0xeaf7ff,
    fog: 0x050914,
    background: 0x02040b,
    bias: 'balanced',
  },
];

export const HYPER_PALETTE = {
  name: 'HYPER RIFT',
  primary: 0xff274f,
  secondary: 0x8a35ff,
  accent: 0xffffff,
  obstacle: 0xffffff,
  light: 0xff31f7,
  fog: 0x100018,
  background: 0x050006,
  bias: 'hyper',
};

export const GAME = {
  startSpeed: 16,
  maxSpeed: 36,
  boostSpeed: 10,
  boostDuration: 0.55,
  boostCooldown: 1.25,
  laneWidth: 3,
  playerZ: 5.4,
  playerY: -2.15,
  spawnZ: -104,
  removeZ: 9,
  shield: 3,
  hyperDuration: 10,
  hyperCombo: 10,
  turnGateInterval: 4,
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
