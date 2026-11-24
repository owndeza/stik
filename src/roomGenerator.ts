import {
  ArenaBounds,
  EnemyType,
  GameMode,
  MinorEnemy,
  RoomKind,
  RoomLayout,
  WallObstacle,
  WaterLake,
} from './types';

interface RoomTemplate {
  name: string;
  walls: Array<{ x: number; y: number; w: number; h: number }>;
  lakes: Array<{ x: number; y: number; rx: number; ry: number }>;
}

const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    name: 'Бастион Звёзд',
    walls: [
      { x: 220, y: 310, w: 120, h: 36 },
      { x: 860, y: 310, w: 120, h: 36 },
      { x: 310, y: 470, w: 46, h: 96 },
      { x: 844, y: 470, w: 46, h: 96 },
    ],
    lakes: [
      { x: 600, y: 410, rx: 88, ry: 54 },
      { x: 165, y: 495, rx: 56, ry: 44 },
      { x: 1035, y: 495, rx: 56, ry: 44 },
    ],
  },
  {
    name: 'Двойной Оазис',
    walls: [
      { x: 525, y: 360, w: 150, h: 36 },
      { x: 190, y: 245, w: 48, h: 120 },
      { x: 962, y: 245, w: 48, h: 120 },
    ],
    lakes: [
      { x: 345, y: 445, rx: 92, ry: 58 },
      { x: 855, y: 445, rx: 92, ry: 58 },
    ],
  },
  {
    name: 'Колоннада Затмения',
    walls: [
      { x: 260, y: 290, w: 58, h: 58 },
      { x: 882, y: 290, w: 58, h: 58 },
      { x: 260, y: 485, w: 58, h: 58 },
      { x: 882, y: 485, w: 58, h: 58 },
      { x: 568, y: 430, w: 64, h: 64 },
    ],
    lakes: [
      { x: 430, y: 365, rx: 64, ry: 46 },
      { x: 770, y: 365, rx: 64, ry: 46 },
    ],
  },
  {
    name: 'Разлом Прилива',
    walls: [
      { x: 165, y: 390, w: 135, h: 34 },
      { x: 900, y: 390, w: 135, h: 34 },
      { x: 425, y: 285, w: 42, h: 90 },
      { x: 733, y: 285, w: 42, h: 90 },
    ],
    lakes: [
      { x: 600, y: 455, rx: 112, ry: 56 },
      { x: 250, y: 220, rx: 62, ry: 44 },
      { x: 950, y: 220, rx: 62, ry: 44 },
    ],
  },
  {
    name: 'Руины Навигатора',
    walls: [
      { x: 340, y: 345, w: 120, h: 34 },
      { x: 740, y: 455, w: 120, h: 34 },
      { x: 210, y: 500, w: 46, h: 90 },
      { x: 944, y: 255, w: 46, h: 90 },
    ],
    lakes: [
      { x: 790, y: 315, rx: 86, ry: 52 },
      { x: 410, y: 485, rx: 84, ry: 52 },
    ],
  },
  {
    name: 'Зеркальные Залы',
    walls: [
      { x: 410, y: 400, w: 44, h: 125 },
      { x: 746, y: 400, w: 44, h: 125 },
      { x: 215, y: 270, w: 96, h: 36 },
      { x: 889, y: 270, w: 96, h: 36 },
    ],
    lakes: [
      { x: 600, y: 350, rx: 76, ry: 50 },
      { x: 245, y: 450, rx: 66, ry: 58 },
      { x: 955, y: 450, rx: 66, ry: 58 },
    ],
  },
];

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function getRoomKindForNumber(roomNumber: number, mode: GameMode = 'NORMAL'): RoomKind {
  if (mode === 'HARDMODE') return 'BOSS';
  const step = ((roomNumber - 1) % 5) + 1;
  if (step === 3) return 'SWARM';
  if (step === 5) return 'BOSS';
  return 'ENEMIES';
}

export function isPointInsideWall(
  x: number,
  y: number,
  radius: number,
  wall: WallObstacle
): boolean {
  const closestX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
  const closestY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy < radius * radius;
}

export function isPointInsideLake(
  x: number,
  y: number,
  radius: number,
  lake: WaterLake
): boolean {
  const nx = (x - lake.x) / (lake.rx + radius);
  const ny = (y - lake.y) / (lake.ry + radius);
  return nx * nx + ny * ny < 1;
}

export function generateRoomLayout(
  roomNumber: number,
  arena: ArenaBounds,
  mode: GameMode = 'NORMAL'
): RoomLayout {
  const roomKind = getRoomKindForNumber(roomNumber, mode);
  const templateIndex = Math.floor(Math.random() * ROOM_TEMPLATES.length);
  const tpl = ROOM_TEMPLATES[templateIndex];
  const mirrorX = roomNumber > 1 && Math.random() < 0.5;

  // Dynamic difficulty scaling across rooms (faster ramp in Hardmode)
  const speedStep = mode === 'HARDMODE' ? 0.1 : 0.07;
  const speedMultiplier = Math.min(2.25, Number((1 + (roomNumber - 1) * speedStep).toFixed(2)));
  const spawnInterval = Math.max(0.72, Number((2.1 - (roomNumber - 1) * 0.1).toFixed(2)));

  let nextId = 1;
  const walls: WallObstacle[] = tpl.walls.map((w) => {
    const jitterX = roomNumber === 1 ? 0 : Math.round(randRange(-16, 16));
    const jitterY = roomNumber === 1 ? 0 : Math.round(randRange(-12, 12));
    const baseX = mirrorX ? arena.width - (w.x + w.w) : w.x;
    return {
      id: nextId++,
      x: Math.max(arena.innerLeft + 55, Math.min(arena.innerRight - w.w - 55, baseX + jitterX)),
      y: Math.max(arena.innerTop + 145, Math.min(arena.innerBottom - w.h - 95, w.y + jitterY)),
      w: w.w,
      h: w.h,
    };
  });

  const lakes: WaterLake[] = tpl.lakes.map((l) => {
    const jitterX = roomNumber === 1 ? 0 : Math.round(randRange(-18, 18));
    const jitterY = roomNumber === 1 ? 0 : Math.round(randRange(-14, 14));
    const baseX = mirrorX ? arena.width - l.x : l.x;
    return {
      id: nextId++,
      x: Math.max(arena.innerLeft + l.rx + 40, Math.min(arena.innerRight - l.rx - 40, baseX + jitterX)),
      y: Math.max(arena.innerTop + l.ry + 120, Math.min(arena.innerBottom - l.ry - 90, l.y + jitterY)),
      rx: l.rx,
      ry: l.ry,
      phase: Math.random() * Math.PI * 2,
    };
  });

  return {
    roomNumber,
    roomKind,
    archetypeName: tpl.name,
    speedMultiplier,
    spawnInterval,
    walls,
    lakes,
    portal: {
      x: arena.width * 0.5 - 64,
      y: arena.innerTop - 6,
      width: 128,
      height: 28,
      open: false,
    },
  };
}

export function createMinorEnemy(
  id: number,
  type: EnemyType,
  roomNumber: number,
  arena: ArenaBounds,
  layout: RoomLayout,
  existingEnemies: MinorEnemy[]
): MinorEnemy {
  const hpScale = 1 + (roomNumber - 1) * 0.22;
  const speedScale = layout.speedMultiplier;
  const attackRateScale = Math.max(0.55, 1 - (roomNumber - 1) * 0.04);

  const isMiniBoss = type === 'MINI_BOSS';
  const radius = isMiniBoss ? 25 : type === 'TURRET' ? 16 : type === 'ORBITER' ? 15 : 14;
  const baseHp = isMiniBoss
    ? 3400
    : type === 'TURRET'
      ? 1100
      : type === 'ORBITER'
        ? 950
        : 780;
  const maxHp = Math.round(baseHp * hpScale);

  let spawnX = arena.width * 0.5;
  let spawnY = arena.innerTop + 175;
  for (let attempt = 0; attempt < 45; attempt++) {
    const candidateX = randRange(arena.innerLeft + 75, arena.innerRight - 75);
    const candidateY = isMiniBoss
      ? randRange(arena.innerTop + 125, arena.innerTop + 260)
      : randRange(arena.innerTop + 95, arena.innerBottom - 250);
    const hitsWall = layout.walls.some((w) => isPointInsideWall(candidateX, candidateY, radius + 12, w));
    const hitsLake =
      type !== 'ORBITER' &&
      type !== 'MINI_BOSS' &&
      layout.lakes.some((l) => isPointInsideLake(candidateX, candidateY, radius + 10, l));
    const tooCloseToOther = existingEnemies.some(
      (e) => Math.hypot(e.x - candidateX, e.y - candidateY) < 70
    );
    if (!hitsWall && !hitsLake && !tooCloseToOther) {
      spawnX = candidateX;
      spawnY = candidateY;
      break;
    }
  }

  const baseSpeed = isMiniBoss
    ? 115
    : type === 'CHASER'
      ? 138
      : type === 'ORBITER'
        ? 92
        : 48;

  const baseAttackInterval = isMiniBoss
    ? 2.2
    : type === 'TURRET'
      ? 2.6
      : type === 'ORBITER'
        ? 3.1
        : 1.6;

  return {
    id,
    type,
    name: isMiniBoss ? 'АРХОНТ ОСКОЛКОВ · МИНИ-БОСС' : undefined,
    x: spawnX,
    y: spawnY,
    vx: 0,
    vy: 0,
    radius,
    speed: Math.round(baseSpeed * speedScale),
    hp: maxHp,
    maxHp,
    xpReward: isMiniBoss ? 90 : type === 'TURRET' ? 35 : type === 'ORBITER' ? 30 : 25,
    attackCooldown: isMiniBoss ? 1.4 : randRange(0.9, 2.1),
    attackInterval: Number((baseAttackInterval * attackRateScale).toFixed(2)),
    attackPatternStep: 0,
    telegraphTimer: 0,
    hitFlashTimer: 0,
    phaseAngle: Math.random() * Math.PI * 2,
    anchorX: spawnX,
    anchorY: spawnY,
    burnTimer: 0,
    burnTickTimer: 0,
    burnDamagePerTick: 0,
    alive: true,
  };
}

export function spawnRoomWavePlan(
  roomNumber: number,
  arena: ArenaBounds,
  layout: RoomLayout,
  startingId: number,
  mode: GameMode = 'NORMAL'
): {
  initialEnemies: MinorEnemy[];
  reinforcementQueue: EnemyType[];
  nextId: number;
} {
  const pool: EnemyType[] = ['CHASER', 'TURRET', 'ORBITER'];
  const cycle = Math.floor((roomNumber - 1) / 5);
  const initialEnemies: MinorEnemy[] = [];
  const reinforcementQueue: EnemyType[] = [];
  let nextId = startingId;

  if (layout.roomKind === 'BOSS') {
    // Boss Room spawns unique Mini-Boss alongside THE STAR WARDEN
    const miniBoss = createMinorEnemy(
      nextId++,
      'MINI_BOSS',
      roomNumber,
      arena,
      layout,
      initialEnemies
    );
    initialEnemies.push(miniBoss);

    // Escorts scale with room number in Hardmode or higher cycles in Normal
    const escortCount =
      mode === 'HARDMODE' ? Math.min(4, Math.floor(roomNumber / 2)) : Math.min(3, cycle);
    for (let i = 0; i < escortCount; i++) {
      const t = pool[(i + roomNumber) % pool.length];
      initialEnemies.push(createMinorEnemy(nextId++, t, roomNumber, arena, layout, initialEnemies));
    }

    return { initialEnemies, reinforcementQueue, nextId };
  }

  if (layout.roomKind === 'SWARM') {
    // Room 3, 8, 13...: Massive horde ("дохуя врагов")
    const totalSwarm = 13 + cycle * 4;
    const immediateCount = 8;
    for (let i = 0; i < immediateCount; i++) {
      const t = i % 3 === 0 ? 'CHASER' : pool[(i + roomNumber) % pool.length];
      initialEnemies.push(createMinorEnemy(nextId++, t, roomNumber, arena, layout, initialEnemies));
    }
    for (let i = immediateCount; i < totalSwarm; i++) {
      reinforcementQueue.push(i % 2 === 0 ? 'CHASER' : pool[i % pool.length]);
    }
    return { initialEnemies, reinforcementQueue, nextId };
  }

  // Standard Enemy Rooms (1, 2, 4, 6, 7, 9...)
  const step = ((roomNumber - 1) % 5) + 1;
  const totalCount = 3 + step + cycle * 2;
  const immediateCount = Math.min(totalCount, 4 + Math.floor(step / 2));

  for (let i = 0; i < immediateCount; i++) {
    const t = i === 0 ? 'CHASER' : pool[(i + roomNumber) % pool.length];
    initialEnemies.push(createMinorEnemy(nextId++, t, roomNumber, arena, layout, initialEnemies));
  }
  for (let i = immediateCount; i < totalCount; i++) {
    reinforcementQueue.push(pool[(i + roomNumber) % pool.length]);
  }

  return { initialEnemies, reinforcementQueue, nextId };
}
