import {
  AmbientStar,
  ArenaBounds,
  BossArchetype,
  BossAttackType,
  BossSelectOption,
  BossState,
  FloatingText,
  FloorHazard,
  GameMode,
  LaserBeam,
  MinorEnemy,
  NormalStarPalette,
  Particle,
  PlayerProjectileType,
  PlayerState,
  PoisonGasZone,
  Projectile,
  ProjectileVisualStyle,
  RoomLayout,
  Shockwave,
} from './types';

export const ARENA_WIDTH = 1200;
export const ARENA_HEIGHT = 760;
export const WALL_THICKNESS = 36;

export function createArenaBounds(): ArenaBounds {
  return {
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    wallThickness: WALL_THICKNESS,
    innerLeft: WALL_THICKNESS,
    innerTop: WALL_THICKNESS,
    innerRight: ARENA_WIDTH - WALL_THICKNESS,
    innerBottom: ARENA_HEIGHT - WALL_THICKNESS,
  };
}

export function createPlayer(arena: ArenaBounds): PlayerState {
  return {
    x: arena.width * 0.5,
    y: arena.innerBottom - 95,
    vx: 0,
    vy: 0,
    radius: 17,
    speed: 315,
    hp: 1000,
    maxHp: 1000,
    isMoving: false,
    aimAngle: -Math.PI / 2,
    fireCooldown: 0.15,
    fireInterval: 1.0,
    damageMultiplier: 1,
    critChance: 0,
    multishotCount: 1,
    activeProjectile: 'STANDARD',
    unlockedProjectiles: ['STANDARD'],
    level: 1,
    xp: 0,
    xpToNextLevel: 85,
    invulnerableTimer: 0,
    invulnerableDuration: 0.72,
    poisonTickTimer: 0,
    hitFlashTimer: 0,
    squashX: 1,
    squashY: 1,
    stridePhase: 0,
    trail: [],
  };
}

export const BOSS_ROTATION: BossArchetype[] = [
  'STAR',
  'METAPLASM',
  'PHYSICS',
  'METAL',
  'BLACK_HOLE',
  'STAR_WARDEN',
];

export const BOSS_DISPLAY_NAMES: Record<BossArchetype, string> = {
  STAR_WARDEN: 'THE STAR WARDEN',
  STAR: 'СТАР · СОЛНЕЧНЫЙ ТИТАН',
  METAPLASM: 'МЕТАПЛАЗМА · РЕАКТОР',
  PHYSICS: 'ФИЗИКА · ВЕКТОР ХАОСА',
  METAL: 'МЕТАЛ · ЖЕЛЕЗНЫЙ КОЛОСС',
  BLACK_HOLE: 'ЧЕРНАЯ ДЫРА · СИНГУЛЯРНОСТЬ',
};

export function getBossArchetypeForRoom(
  roomNumber: number,
  mode: GameMode,
  selectedOption: BossSelectOption = 'AUTO'
): BossArchetype {
  const encounterIndex =
    mode === 'HARDMODE'
      ? Math.max(0, roomNumber - 1)
      : Math.max(0, Math.floor((roomNumber - 1) / 5));

  if (selectedOption === 'AUTO') {
    return BOSS_ROTATION[encounterIndex % BOSS_ROTATION.length];
  }
  const startIdx = Math.max(0, BOSS_ROTATION.indexOf(selectedOption));
  return BOSS_ROTATION[(startIdx + encounterIndex) % BOSS_ROTATION.length];
}

function getInitialAttackForArchetype(archetype: BossArchetype): BossAttackType {
  switch (archetype) {
    case 'STAR':
      return 'STAR_SUPERNOVA_RING';
    case 'METAPLASM':
      return 'PLASMA_SPLIT_ORBS';
    case 'PHYSICS':
      return 'PHYS_KINETIC_IMPULSE';
    case 'METAL':
      return 'METAL_SAWBLADES';
    case 'BLACK_HOLE':
      return 'BH_ACCRETION_ORBIT';
    case 'STAR_WARDEN':
    default:
      return 'NORMAL_STARS';
  }
}

export function createBoss(
  arena: ArenaBounds,
  roomNumber = 5,
  id = 1,
  mode: GameMode = 'NORMAL',
  selectedOption: BossSelectOption = 'AUTO'
): BossState {
  const anchorX = arena.width * 0.5;
  const anchorY = arena.innerTop + 145;
  const bossCycle = Math.max(0, Math.floor((roomNumber - 1) / 5));
  const archetype = getBossArchetypeForRoom(roomNumber, mode, selectedOption);
  const maxHp =
    mode === 'HARDMODE'
      ? 18500 + (roomNumber - 1) * 3200
      : 20000 + bossCycle * 5000;
  const baseName = BOSS_DISPLAY_NAMES[archetype];
  const label =
    (mode === 'HARDMODE' && roomNumber > 1) || (mode === 'NORMAL' && bossCycle > 0)
      ? `${baseName} · Р${roomNumber}`
      : baseName;
  return {
    id,
    archetype,
    name: label,
    x: anchorX,
    y: anchorY,
    vx: 0,
    vy: 0,
    radius: archetype === 'METAL' ? 46 : archetype === 'BLACK_HOLE' ? 44 : 42,
    hp: maxHp,
    maxHp,
    alive: true,
    behavior: 'IDLE',
    stateTimer: 0.95,
    currentAttack: getInitialAttackForArchetype(archetype),
    lastAttack: null,
    consecutiveSameAttack: 0,
    shotsRemaining: 0,
    shotIntervalTimer: 0,
    sprayAngleOffset: 0,
    laserAimAngle: Math.PI / 2,
    laserChannelTimer: 0,
    activeLasers: [],
    isEnraged: false,
    enragePhaseTriggered: false,
    attackCounter: 0,
    hitFlashTimer: 0,
    ringRotation: 0,
    innerRingRotation: 0,
    patrolAngle: 0,
    anchorX,
    anchorY,
    telegraphProgress: 0,
    deathTimer: 0,
    deathBurstTimer: 0,
    burnTimer: 0,
    burnTickTimer: 0,
    burnDamagePerTick: 0,
    dashTimer: 0,
    dashVx: 0,
    dashVy: 0,
    dashDropsTrail: false,
    dashTrailAccum: 0,
    dashTargetX: anchorX,
    dashTargetY: anchorY,
    dashSlamOnEnd: false,
    pullForceToBoss: 0,
    pulsarAngle: 0,
    waveDir: 1,
  };
}

export function createAmbientStars(arena: ArenaBounds, count = 75): AmbientStar[] {
  const stars: AmbientStar[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: arena.innerLeft + Math.random() * (arena.innerRight - arena.innerLeft),
      y: arena.innerTop + Math.random() * (arena.innerBottom - arena.innerTop),
      radius: 0.8 + Math.random() * 1.6,
      baseAlpha: 0.12 + Math.random() * 0.32,
      twinkleSpeed: 1.2 + Math.random() * 2.4,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return stars;
}

export function spawnPlayerShot(
  id: number,
  player: PlayerState,
  targetX: number,
  targetY: number,
  angleOffset: number = 0
): Projectile {
  const baseAngle = Math.atan2(targetY - player.y, targetX - player.x) + angleOffset;
  const dirX = Math.cos(baseAngle);
  const dirY = Math.sin(baseAngle);
  const spawnOffset = player.radius + 12;
  const isCrit = Math.random() < player.critChance;
  const critMult = isCrit ? 2.0 : 1.0;

  const type: PlayerProjectileType = player.activeProjectile;

  if (type === 'PIERCING') {
    const speed = 940;
    const damage = Math.round(620 * player.damageMultiplier * critMult);
    return {
      id,
      kind: 'PLAYER_PIERCING',
      owner: 'PLAYER',
      x: player.x + dirX * spawnOffset,
      y: player.y + dirY * spawnOffset,
      vx: dirX * speed,
      vy: dirY * speed,
      radius: 8,
      damage,
      rotation: baseAngle,
      spinSpeed: 0,
      age: 0,
      fadeInDuration: 0.05,
      fadingOut: false,
      fadeOutTimer: 0,
      fadeOutDuration: 0.1,
      bouncesRemaining: 0,
      maxBounces: 0,
      pierceRemaining: 10,
      hitEntityIds: [],
      appliesDot: false,
      dotDamagePerTick: 0,
      isCrit,
      palette: 'cyan',
      trail: [],
      alive: true,
    };
  }

  if (type === 'RICOCHET') {
    const speed = 720;
    const damage = Math.round(600 * player.damageMultiplier * critMult);
    return {
      id,
      kind: 'PLAYER_RICOCHET',
      owner: 'PLAYER',
      x: player.x + dirX * spawnOffset,
      y: player.y + dirY * spawnOffset,
      vx: dirX * speed,
      vy: dirY * speed,
      radius: 10,
      damage,
      rotation: baseAngle,
      spinSpeed: 14,
      age: 0,
      fadeInDuration: 0.05,
      fadingOut: false,
      fadeOutTimer: 0,
      fadeOutDuration: 0.12,
      bouncesRemaining: 3,
      maxBounces: 3,
      pierceRemaining: 0,
      hitEntityIds: [],
      appliesDot: false,
      dotDamagePerTick: 0,
      isCrit,
      palette: 'gold',
      trail: [],
      alive: true,
    };
  }

  if (type === 'DOT') {
    const speed = 740;
    const damage = Math.round(450 * player.damageMultiplier * critMult);
    const dotDamage = Math.round(180 * player.damageMultiplier * critMult);
    return {
      id,
      kind: 'PLAYER_DOT',
      owner: 'PLAYER',
      x: player.x + dirX * spawnOffset,
      y: player.y + dirY * spawnOffset,
      vx: dirX * speed,
      vy: dirY * speed,
      radius: 10,
      damage,
      rotation: baseAngle,
      spinSpeed: 6,
      age: 0,
      fadeInDuration: 0.06,
      fadingOut: false,
      fadeOutTimer: 0,
      fadeOutDuration: 0.12,
      bouncesRemaining: 0,
      maxBounces: 0,
      pierceRemaining: 0,
      hitEntityIds: [],
      appliesDot: true,
      dotDamagePerTick: dotDamage,
      isCrit,
      palette: 'violet',
      trail: [],
      alive: true,
    };
  }

  const speed = 840;
  const damage = Math.round(750 * player.damageMultiplier * critMult);
  return {
    id,
    kind: 'PLAYER_STANDARD',
    owner: 'PLAYER',
    x: player.x + dirX * spawnOffset,
    y: player.y + dirY * spawnOffset,
    vx: dirX * speed,
    vy: dirY * speed,
    radius: 8,
    damage,
    rotation: baseAngle,
    spinSpeed: 0,
    age: 0,
    fadeInDuration: 0.05,
    fadingOut: false,
    fadeOutTimer: 0,
    fadeOutDuration: 0.1,
    bouncesRemaining: 0,
    maxBounces: 0,
    pierceRemaining: 0,
    hitEntityIds: [],
    appliesDot: false,
    dotDamagePerTick: 0,
    isCrit,
    palette: 'emerald',
    trail: [],
    alive: true,
  };
}

export function spawnNormalBossStar(
  id: number,
  boss: BossState,
  player: PlayerState,
  palette: NormalStarPalette
): Projectile {
  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const dist = Math.hypot(dx, dy) || 1;
  const speed = 435;
  const spawnOffset = boss.radius + 12;

  return {
    id,
    kind: 'BOSS_NORMAL_STAR',
    owner: 'BOSS',
    x: boss.x + (dx / dist) * spawnOffset,
    y: boss.y + (dy / dist) * spawnOffset,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    radius: 13,
    damage: 110,
    rotation: Math.random() * Math.PI * 2,
    spinSpeed: 4.5,
    age: 0,
    fadeInDuration: 0.12,
    fadingOut: false,
    fadeOutTimer: 0,
    fadeOutDuration: 0.14,
    bouncesRemaining: 0,
    maxBounces: 0,
    pierceRemaining: 0,
    hitEntityIds: [],
    appliesDot: false,
    dotDamagePerTick: 0,
    isCrit: false,
    palette,
    trail: [],
    alive: true,
  };
}

export function spawnRedRicochetStar(
  id: number,
  boss: BossState,
  angle: number,
  maxBounces = 5,
  speed = 385,
  damage = 135
): Projectile {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const spawnOffset = boss.radius + 14;

  return {
    id,
    kind: 'BOSS_RED_STAR',
    owner: 'BOSS',
    x: boss.x + dirX * spawnOffset,
    y: boss.y + dirY * spawnOffset,
    vx: dirX * speed,
    vy: dirY * speed,
    radius: 13,
    damage,
    rotation: Math.random() * Math.PI * 2,
    spinSpeed: -6.2,
    age: 0,
    fadeInDuration: 0.12,
    fadingOut: false,
    fadeOutTimer: 0,
    fadeOutDuration: 0.15,
    bouncesRemaining: maxBounces,
    maxBounces,
    pierceRemaining: 0,
    hitEntityIds: [],
    appliesDot: false,
    dotDamagePerTick: 0,
    isCrit: false,
    palette: 'crimson',
    trail: [],
    alive: true,
  };
}

export function spawnEnemyOrb(
  id: number,
  enemy: MinorEnemy,
  angle: number,
  speed = 285,
  damage = 80,
  palette: 'cyan' | 'crimson' | 'gold' = enemy.type === 'ORBITER' ? 'crimson' : 'cyan'
): Projectile {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  return {
    id,
    kind: 'ENEMY_ORB',
    owner: 'ENEMY',
    x: enemy.x + dirX * (enemy.radius + 8),
    y: enemy.y + dirY * (enemy.radius + 8),
    vx: dirX * speed,
    vy: dirY * speed,
    radius: enemy.type === 'MINI_BOSS' ? 10 : 8,
    damage,
    rotation: angle,
    spinSpeed: 3.5,
    age: 0,
    fadeInDuration: 0.1,
    fadingOut: false,
    fadeOutTimer: 0,
    fadeOutDuration: 0.12,
    bouncesRemaining: 0,
    maxBounces: 0,
    pierceRemaining: 0,
    hitEntityIds: [],
    appliesDot: false,
    dotDamagePerTick: 0,
    isCrit: false,
    palette,
    trail: [],
    alive: true,
  };
}

export interface CustomBossProjectileOpts {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  palette: Projectile['palette'];
  visualStyle: ProjectileVisualStyle;
  spinSpeed?: number;
  bounces?: number;
  bounceSpeedGain?: number;
  accelRate?: number;
  homingStrength?: number;
  homingTimer?: number;
  splitOnExpire?: boolean;
  splitTimer?: number;
  splitCount?: number;
  sineWobbleAmp?: number;
  sineWobbleFreq?: number;
  orbitBoss?: boolean;
  orbitRadius?: number;
  orbitAngle?: number;
  orbitAngularSpeed?: number;
  orbitExpandRate?: number;
  delayedLaunchTimer?: number;
  delayedSpeed?: number;
  maxLifetime?: number;
}

export function spawnCustomBossProjectile(opts: CustomBossProjectileOpts): Projectile {
  return {
    id: opts.id,
    kind: opts.bounces && opts.bounces > 0 ? 'BOSS_RED_STAR' : 'BOSS_NORMAL_STAR',
    owner: 'BOSS',
    x: opts.x,
    y: opts.y,
    vx: opts.vx,
    vy: opts.vy,
    radius: opts.radius,
    damage: opts.damage,
    rotation: Math.atan2(opts.vy, opts.vx),
    spinSpeed: opts.spinSpeed ?? 4,
    age: 0,
    fadeInDuration: 0.1,
    fadingOut: false,
    fadeOutTimer: 0,
    fadeOutDuration: 0.14,
    bouncesRemaining: opts.bounces ?? 0,
    maxBounces: opts.bounces ?? 0,
    pierceRemaining: 0,
    hitEntityIds: [],
    appliesDot: false,
    dotDamagePerTick: 0,
    isCrit: false,
    palette: opts.palette,
    visualStyle: opts.visualStyle,
    homingStrength: opts.homingStrength,
    homingTimer: opts.homingTimer,
    accelRate: opts.accelRate,
    bounceSpeedGain: opts.bounceSpeedGain,
    splitOnExpire: opts.splitOnExpire,
    splitTimer: opts.splitTimer,
    splitCount: opts.splitCount,
    sineWobbleAmp: opts.sineWobbleAmp,
    sineWobbleFreq: opts.sineWobbleFreq,
    orbitBoss: opts.orbitBoss,
    orbitRadius: opts.orbitRadius,
    orbitAngle: opts.orbitAngle,
    orbitAngularSpeed: opts.orbitAngularSpeed,
    orbitExpandRate: opts.orbitExpandRate,
    delayedLaunchTimer: opts.delayedLaunchTimer,
    delayedSpeed: opts.delayedSpeed,
    maxLifetime: opts.maxLifetime,
    trail: [],
    alive: true,
  };
}

export function chooseNextBossAttack(boss: BossState): BossAttackType {
  const ultraByArchetype: Record<BossArchetype, BossAttackType> = {
    STAR_WARDEN: 'ULTRA_RAGE_LASERS',
    STAR: 'STAR_BINARY_ECLIPSE',
    METAPLASM: 'PLASMA_OVERLOAD',
    PHYSICS: 'PHYS_ENTROPY_COLLAPSE',
    METAL: 'METAL_BLADE_STORM',
    BLACK_HOLE: 'BH_EVENT_HORIZON',
  };

  if (!boss.enragePhaseTriggered && boss.hp <= boss.maxHp * 0.55) {
    boss.enragePhaseTriggered = true;
    boss.isEnraged = true;
    return ultraByArchetype[boss.archetype];
  }

  let baseAttacks: BossAttackType[];
  switch (boss.archetype) {
    case 'STAR':
      baseAttacks = [
        'STAR_SUPERNOVA_RING',
        'STAR_SOLAR_FLARE',
        'STAR_METEOR_RAIN',
        'STAR_CONSTELLATION_ORB',
        'STAR_CROSS_PULSAR',
      ];
      break;
    case 'METAPLASM':
      baseAttacks = [
        'PLASMA_SPLIT_ORBS',
        'PLASMA_LIGHTNING_WEB',
        'PLASMA_PUDDLE_ERUPTION',
        'PLASMA_MUTATION_DASH',
        'PLASMA_SIPHON_SPIRAL',
      ];
      break;
    case 'PHYSICS':
      baseAttacks = [
        'PHYS_KINETIC_IMPULSE',
        'PHYS_PENDULUM_SWEEP',
        'PHYS_RICOCHET_COLLIDER',
        'PHYS_GRAVITY_TRAP',
        'PHYS_VECTOR_GRID',
      ];
      break;
    case 'METAL':
      baseAttacks = [
        'METAL_SAWBLADES',
        'METAL_ANVIL_SLAM',
        'METAL_SHRAPNEL_CONE',
        'METAL_MAGNET_SPEARS',
        'METAL_MOLTEN_FORGE',
      ];
      break;
    case 'BLACK_HOLE':
      baseAttacks = [
        'BH_SINGULARITY_PULL',
        'BH_ACCRETION_ORBIT',
        'BH_VOID_RIFTS',
        'BH_HAWKING_JETS',
        'BH_DARK_MATTER_BARRAGE',
      ];
      break;
    case 'STAR_WARDEN':
    default:
      baseAttacks = [
        'NORMAL_STARS',
        'RED_RICOCHET_STARS',
        'BOUNCE_LASER',
        'POISON_GAS',
        'RED_STAR_SPRAY',
      ];
      break;
  }

  const allAttacks = boss.isEnraged
    ? [...baseAttacks, ultraByArchetype[boss.archetype]]
    : baseAttacks;

  const candidates = allAttacks.filter((atk) => atk !== boss.lastAttack);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function drawStarPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  points: number,
  outerRadius: number,
  innerRadius: number,
  rotation: number
): void {
  ctx.beginPath();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = rotation + i * step;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

export function renderArena(
  ctx: CanvasRenderingContext2D,
  arena: ArenaBounds,
  stars: AmbientStar[],
  time: number
): void {
  const { width, height, wallThickness, innerLeft, innerTop, innerRight, innerBottom } = arena;
  const innerW = innerRight - innerLeft;
  const innerH = innerBottom - innerTop;
  const cx = width * 0.5;
  const cy = height * 0.5;

  const bgGrad = ctx.createRadialGradient(cx, cy * 0.85, 60, cx, cy, width * 0.72);
  bgGrad.addColorStop(0, '#121933');
  bgGrad.addColorStop(0.55, '#0b1022');
  bgGrad.addColorStop(1, '#060812');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.beginPath();
  ctx.rect(innerLeft, innerTop, innerW, innerH);
  ctx.clip();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.045)';
  ctx.lineWidth = 1;
  const tileSize = 64;
  for (let x = innerLeft; x <= innerRight; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, innerTop);
    ctx.lineTo(x, innerBottom);
    ctx.stroke();
  }
  for (let y = innerTop; y <= innerBottom; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(innerLeft, y);
    ctx.lineTo(innerRight, y);
    ctx.stroke();
  }

  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const alpha = s.baseAlpha * (0.65 + 0.35 * Math.sin(time * s.twinkleSpeed + s.phase));
    ctx.fillStyle = `rgba(203, 213, 225, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 130, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)';
  ctx.beginPath();
  ctx.arc(cx, cy, 245, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = '#141b2d';
  ctx.fillRect(0, 0, width, wallThickness);
  ctx.fillRect(0, innerBottom, width, wallThickness);
  ctx.fillRect(0, wallThickness, wallThickness, innerH);
  ctx.fillRect(innerRight, wallThickness, wallThickness, innerH);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(innerLeft, innerTop, innerW, innerH);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  ctx.fillStyle = 'rgba(52, 211, 153, 0.14)';
  ctx.fillRect(cx - 56, innerBottom, 112, 8);
}

export function renderRoomObstacles(
  ctx: CanvasRenderingContext2D,
  layout: RoomLayout,
  time: number
): void {
  // Water lakes
  for (const lake of layout.lakes) {
    ctx.save();
    ctx.translate(lake.x, lake.y);

    ctx.fillStyle = 'rgba(30, 58, 138, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, lake.rx + 7, lake.ry + 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const waterGrad = ctx.createRadialGradient(-lake.rx * 0.2, -lake.ry * 0.2, 8, 0, 0, lake.rx);
    waterGrad.addColorStop(0, '#0ea5e9');
    waterGrad.addColorStop(0.5, '#0369a1');
    waterGrad.addColorStop(1, '#0c2d59');
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, lake.rx, lake.ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const ripplePhase = (time * 0.55 + lake.phase) % 1;
    ctx.strokeStyle = `rgba(186, 230, 253, ${(0.32 * (1 - ripplePhase)).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      lake.rx * (0.25 + 0.65 * ripplePhase),
      lake.ry * (0.25 + 0.65 * ripplePhase),
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    const waveOffset = Math.sin(time * 2 + lake.phase) * 6;
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.24)';
    ctx.beginPath();
    ctx.moveTo(-lake.rx * 0.35 + waveOffset, -lake.ry * 0.18);
    ctx.quadraticCurveTo(waveOffset, -lake.ry * 0.26, lake.rx * 0.35 + waveOffset, -lake.ry * 0.18);
    ctx.moveTo(-lake.rx * 0.28 - waveOffset, lake.ry * 0.22);
    ctx.quadraticCurveTo(-waveOffset, lake.ry * 0.14, lake.rx * 0.28 - waveOffset, lake.ry * 0.22);
    ctx.stroke();

    ctx.restore();
  }

  // Interior stone walls
  for (const w of layout.walls) {
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
    ctx.fillRect(w.x + 5, w.y + 7, w.w, w.h);

    const wallGrad = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
    wallGrad.addColorStop(0, '#26324d');
    wallGrad.addColorStop(1, '#161e31');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(w.x, w.y, w.w, w.h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x, w.y, w.w, w.h);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x + 5, w.y + 5, Math.max(4, w.w - 10), Math.max(4, w.h - 10));
    ctx.restore();
  }

  // North Portal
  const p = layout.portal;
  const portalCx = p.x + p.width * 0.5;
  const portalCy = p.y + p.height * 0.5;

  ctx.save();
  if (p.open) {
    const pulse = 0.7 + 0.3 * Math.sin(time * 6);
    const glow = ctx.createRadialGradient(portalCx, portalCy + 14, 6, portalCx, portalCy + 14, 96);
    glow.addColorStop(0, `rgba(52, 211, 153, ${(0.65 * pulse).toFixed(3)})`);
    glow.addColorStop(0.5, 'rgba(16, 185, 129, 0.22)');
    glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(portalCx, portalCy + 14, 96, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#064e3b';
    ctx.fillRect(p.x, p.y, p.width, p.height);
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(p.x, p.y, p.width, p.height);

    for (let i = 0; i < 2; i++) {
      const yShift = (time * 32 + i * 16) % 32;
      const alpha = 1 - yShift / 32;
      ctx.strokeStyle = `rgba(167, 243, 208, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(portalCx - 16, p.y + p.height + 28 - yShift);
      ctx.lineTo(portalCx, p.y + p.height + 16 - yShift);
      ctx.lineTo(portalCx + 16, p.y + p.height + 28 - yShift);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(p.x, p.y, p.width, p.height);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, p.width, p.height);
  }
  ctx.restore();
}

export function renderPoisonGasZones(
  ctx: CanvasRenderingContext2D,
  zones: PoisonGasZone[],
  time: number
): void {
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    ctx.save();
    if (z.telegraphTimer > 0) {
      const pulse = 0.45 + 0.45 * Math.sin(time * 18);
      ctx.fillStyle = `rgba(34, 197, 94, ${(0.14 * pulse).toFixed(3)})`;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = `rgba(74, 222, 128, ${(0.65 * pulse).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.setLineDash([]);
    } else if (z.activeTimer > 0) {
      const fade = Math.min(1, z.activeTimer / 0.6);
      const grad =
        z.wallSide === 'LEFT'
          ? ctx.createLinearGradient(z.x, 0, z.x + z.w, 0)
          : z.wallSide === 'RIGHT'
            ? ctx.createLinearGradient(z.x + z.w, 0, z.x, 0)
            : z.wallSide === 'TOP'
              ? ctx.createLinearGradient(0, z.y, 0, z.y + z.h)
              : ctx.createLinearGradient(0, z.y + z.h, 0, z.y);

      grad.addColorStop(0, `rgba(22, 163, 74, ${(0.55 * fade).toFixed(3)})`);
      grad.addColorStop(0.6, `rgba(74, 222, 128, ${(0.34 * fade).toFixed(3)})`);
      grad.addColorStop(1, `rgba(74, 222, 128, ${(0.08 * fade).toFixed(3)})`);

      ctx.fillStyle = grad;
      ctx.fillRect(z.x, z.y, z.w, z.h);

      // Swirling toxic gas puffs along wall length
      ctx.beginPath();
      ctx.rect(z.x, z.y, z.w, z.h);
      ctx.clip();

      const puffCount = 14;
      for (let p = 0; p < puffCount; p++) {
        const t = (p / puffCount + time * 0.14) % 1;
        const px =
          z.wallSide === 'TOP' || z.wallSide === 'BOTTOM'
            ? z.x + t * z.w
            : z.x + z.w * (0.22 + 0.56 * ((p % 3) / 2)) + Math.sin(time * 2.5 + p) * 14;
        const py =
          z.wallSide === 'LEFT' || z.wallSide === 'RIGHT'
            ? z.y + t * z.h
            : z.y + z.h * (0.22 + 0.56 * ((p % 3) / 2)) + Math.cos(time * 2.5 + p) * 14;
        const r = 24 + (p % 3) * 12;
        ctx.fillStyle = `rgba(134, 239, 172, ${(0.18 * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

export function renderFloorHazards(
  ctx: CanvasRenderingContext2D,
  hazards: FloorHazard[],
  time: number
): void {
  for (let i = 0; i < hazards.length; i++) {
    const h = hazards[i];
    ctx.save();

    const paletteByKind: Record<
      FloorHazard['kind'],
      { ring: string; fill: string; core: string }
    > = {
      METEOR_STRIKE: {
        ring: '#fbbf24',
        fill: 'rgba(245, 158, 11, 0.24)',
        core: '#fef3c7',
      },
      PLASMA_POOL: {
        ring: '#e879f9',
        fill: 'rgba(217, 70, 239, 0.28)',
        core: '#22d3ee',
      },
      GRAVITY_WELL: {
        ring: '#38bdf8',
        fill: 'rgba(56, 189, 248, 0.24)',
        core: '#e0f2fe',
      },
      MOLTEN_POOL: {
        ring: '#fb923c',
        fill: 'rgba(234, 88, 12, 0.3)',
        core: '#fde047',
      },
      VOID_RIFT: {
        ring: '#a855f7',
        fill: 'rgba(88, 28, 135, 0.42)',
        core: '#090514',
      },
    };
    const colors = paletteByKind[h.kind];

    if (h.telegraphTimer > 0) {
      const progress = Math.max(
        0,
        Math.min(1, 1 - h.telegraphTimer / Math.max(0.05, h.maxTelegraphTimer))
      );
      const pulse = 0.5 + 0.5 * Math.sin(time * 20);
      ctx.fillStyle = colors.fill;
      ctx.globalAlpha = 0.35 + 0.4 * pulse;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = colors.ring;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Closing shrink indicator
      ctx.strokeStyle = colors.core;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, Math.max(4, h.radius * (1 - progress)), 0, Math.PI * 2);
      ctx.stroke();
    } else if (h.activeTimer > 0) {
      const fade = Math.min(1, h.activeTimer / 0.45);
      ctx.globalAlpha = fade;
      const grad = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.radius);
      grad.addColorStop(0, colors.core);
      grad.addColorStop(0.55, colors.fill);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = colors.ring;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius * (0.92 + 0.06 * Math.sin(time * 8 + h.id)), 0, Math.PI * 2);
      ctx.stroke();

      if (h.kind === 'GRAVITY_WELL' || h.kind === 'VOID_RIFT') {
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(time * 4.5);
        ctx.strokeStyle = colors.ring;
        ctx.lineWidth = 1.6;
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(0, 0, h.radius * 0.55, a, a + 1.1);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }
}

export function renderBossLasers(
  ctx: CanvasRenderingContext2D,
  lasers: LaserBeam[],
  time: number
): void {
  for (let i = 0; i < lasers.length; i++) {
    const beam = lasers[i];
    if (beam.segments.length === 0) continue;

    const theme = beam.colorTheme ?? (beam.isUltra ? 'ULTRA' : 'CYAN');
    const themeColors = {
      CYAN: {
        tele: 'rgba(56, 189, 248, ',
        outer: 'rgba(14, 165, 233, 0.45)',
        mid: '#38bdf8',
        core: '#fef9c3',
      },
      ULTRA: {
        tele: 'rgba(217, 70, 239, ',
        outer: 'rgba(225, 29, 72, 0.48)',
        mid: '#d946ef',
        core: '#fdf4ff',
      },
      SOLAR: {
        tele: 'rgba(251, 191, 36, ',
        outer: 'rgba(245, 158, 11, 0.48)',
        mid: '#fbbf24',
        core: '#fffbeb',
      },
      PLASMA: {
        tele: 'rgba(232, 121, 249, ',
        outer: 'rgba(192, 38, 211, 0.46)',
        mid: '#e879f9',
        core: '#ecfeff',
      },
      GRID: {
        tele: 'rgba(34, 211, 238, ',
        outer: 'rgba(99, 102, 241, 0.45)',
        mid: '#22d3ee',
        core: '#f8fafc',
      },
      VOID: {
        tele: 'rgba(168, 85, 247, ',
        outer: 'rgba(126, 34, 206, 0.55)',
        mid: '#a855f7',
        core: '#f5d0fe',
      },
    }[theme];

    ctx.save();
    if (beam.isTelegraph) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 24);
      ctx.strokeStyle = `${themeColors.tele}${(0.6 * pulse).toFixed(3)})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      for (let s = 0; s < beam.segments.length; s++) {
        const seg = beam.segments[s];
        if (s === 0) ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const flicker = 0.88 + 0.12 * Math.sin(time * 42 + i);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const drawPath = () => {
        ctx.beginPath();
        for (let s = 0; s < beam.segments.length; s++) {
          const seg = beam.segments[s];
          if (s === 0) ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
        }
      };

      drawPath();
      ctx.strokeStyle = themeColors.outer;
      ctx.lineWidth = beam.width * 2.5 * flicker;
      ctx.stroke();

      drawPath();
      ctx.strokeStyle = themeColors.mid;
      ctx.lineWidth = beam.width * 1.25 * flicker;
      ctx.stroke();

      drawPath();
      ctx.strokeStyle = themeColors.core;
      ctx.lineWidth = Math.max(3, beam.width * 0.48);
      ctx.stroke();

      for (let s = 0; s < beam.segments.length; s++) {
        const seg = beam.segments[s];
        ctx.fillStyle = themeColors.core;
        ctx.beginPath();
        ctx.arc(seg.x2, seg.y2, beam.width * 0.65 * flicker, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

export function renderTargetReticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  time: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 1.4);
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.arc(0, 0, radius + 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function renderPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  time: number
): void {
  for (let i = 0; i < player.trail.length; i++) {
    const t = player.trail[i];
    ctx.fillStyle = `rgba(52, 211, 153, ${(t.alpha * 0.28).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, player.radius * (0.45 + 0.35 * t.alpha), 0, Math.PI * 2);
    ctx.fill();
  }

  const isInvuln = player.invulnerableTimer > 0;
  const invulnFlicker = isInvuln ? 0.5 + 0.5 * Math.sin(time * 36) : 1;

  ctx.save();
  ctx.translate(player.x, player.y);

  if (!player.isMoving) {
    const progress = Math.max(0, Math.min(1, 1 - player.fireCooldown / player.fireInterval));
    const isReady = player.fireCooldown <= 0.05;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = isReady ? '#fde047' : '#34d399';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      player.radius + 10,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * progress
    );
    ctx.stroke();

    ctx.save();
    ctx.rotate(player.aimAngle);
    ctx.fillStyle = isReady ? '#fde047' : 'rgba(110, 231, 183, 0.72)';
    ctx.beginPath();
    ctx.moveTo(player.radius + 19, 0);
    ctx.lineTo(player.radius + 12, -4.5);
    ctx.lineTo(player.radius + 12, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (isInvuln) {
    ctx.strokeStyle = `rgba(125, 211, 252, ${(0.55 + 0.35 * Math.sin(time * 24)).toFixed(3)})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 13, time * 4, time * 4 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.globalAlpha = isInvuln ? 0.55 + 0.45 * invulnFlicker : 1;

  const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, player.radius * 2.1);
  aura.addColorStop(0, 'rgba(52, 211, 153, 0.32)');
  aura.addColorStop(1, 'rgba(52, 211, 153, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius * 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(player.aimAngle);
  ctx.scale(player.squashX, player.squashY);

  const arcColor =
    player.hitFlashTimer > 0
      ? '#ffffff'
      : player.activeProjectile === 'PIERCING'
        ? '#38bdf8'
        : player.activeProjectile === 'RICOCHET'
          ? '#facc15'
          : player.activeProjectile === 'DOT'
            ? '#c084fc'
            : '#6ee7b7';

  ctx.strokeStyle = arcColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(3, 0, player.radius + 2, -Math.PI * 0.38, Math.PI * 0.38);
  ctx.stroke();

  ctx.fillStyle = player.hitFlashTimer > 0 ? '#fca5a5' : '#0f766e';
  ctx.beginPath();
  ctx.arc(-1, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = player.hitFlashTimer > 0 ? '#ffffff' : '#34d399';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = player.hitFlashTimer > 0 ? '#ffffff' : '#a7f3d0';
  ctx.beginPath();
  ctx.arc(2, 0, player.radius * 0.46, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function renderMinorEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: MinorEnemy,
  time: number
): void {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);

  if (enemy.burnTimer > 0) {
    ctx.strokeStyle = `rgba(192, 132, 252, ${(0.55 + 0.3 * Math.sin(time * 18)).toFixed(3)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (enemy.telegraphTimer > 0) {
    ctx.strokeStyle = enemy.type === 'MINI_BOSS' ? 'rgba(245, 158, 11, 0.9)' : 'rgba(251, 191, 36, 0.8)';
    ctx.lineWidth = enemy.type === 'MINI_BOSS' ? 3 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  const flash = enemy.hitFlashTimer > 0;

  if (enemy.type === 'MINI_BOSS') {
    // Unique Mini-Boss variant: Shard Archon (hexagonal teal-amber core with spinning outer blades)
    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, enemy.radius * 2.1);
    aura.addColorStop(0, 'rgba(245, 158, 11, 0.3)');
    aura.addColorStop(1, 'rgba(20, 184, 166, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(time * 1.8);
    ctx.strokeStyle = flash ? '#ffffff' : '#fbbf24';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 7, a - 0.35, a + 0.35);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = flash ? '#ffffff' : '#115e59';
    ctx.strokeStyle = flash ? '#ffffff' : '#2dd4bf';
    ctx.lineWidth = 3;
    drawStarPath(ctx, 0, 0, 6, enemy.radius + 2, enemy.radius * 0.72, -time * 1.1);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = flash ? '#ffffff' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.type === 'CHASER') {
    ctx.save();
    ctx.rotate(enemy.phaseAngle);
    ctx.fillStyle = flash ? '#ffffff' : '#7c3aed';
    ctx.strokeStyle = flash ? '#ffffff' : '#ddd6fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(enemy.radius + 3, 0);
    ctx.lineTo(-enemy.radius * 0.7, -enemy.radius * 0.9);
    ctx.lineTo(-enemy.radius * 0.3, 0);
    ctx.lineTo(-enemy.radius * 0.7, enemy.radius * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (enemy.type === 'TURRET') {
    ctx.fillStyle = flash ? '#ffffff' : '#0c4a6e';
    ctx.strokeStyle = flash ? '#ffffff' : '#38bdf8';
    ctx.lineWidth = 2.5;
    drawStarPath(ctx, 0, 0, 4, enemy.radius + 2, enemy.radius * 0.75, time * 1.1);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = flash ? '#ffffff' : '#7dd3fc';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.38, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = flash ? '#ffffff' : '#881337';
    ctx.strokeStyle = flash ? '#ffffff' : '#fb7185';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = flash ? '#ffffff' : '#fda4af';
    drawStarPath(ctx, 0, 0, 3, enemy.radius * 0.75, enemy.radius * 0.35, -time * 2.5);
    ctx.fill();
  }

  const barW = enemy.type === 'MINI_BOSS' ? 48 : 30;
  const barH = enemy.type === 'MINI_BOSS' ? 5 : 4;
  const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  ctx.fillRect(-barW / 2, -enemy.radius - 12, barW, barH);
  ctx.fillStyle =
    enemy.burnTimer > 0
      ? '#c084fc'
      : enemy.type === 'MINI_BOSS'
        ? '#f59e0b'
        : '#f43f5e';
  ctx.fillRect(-barW / 2, -enemy.radius - 12, barW * ratio, barH);

  ctx.restore();
}

export function renderBoss(
  ctx: CanvasRenderingContext2D,
  boss: BossState,
  player: PlayerState,
  time: number
): void {
  if (!boss.alive && boss.deathTimer <= 0) return;
  const isDying = boss.deathTimer > 0;
  const deathScale = isDying ? Math.max(0.2, 1 - boss.deathTimer * 0.45) : 1;
  const deathAlpha = isDying ? Math.max(0, 1 - boss.deathTimer / 1.45) : 1;

  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.scale(deathScale, deathScale);
  ctx.globalAlpha = deathAlpha;

  const isTelegraphing = boss.behavior === 'TELEGRAPH';
  const flash = boss.hitFlashTimer > 0;
  const enraged = boss.isEnraged;

  if (boss.burnTimer > 0 && !isDying) {
    ctx.strokeStyle = `rgba(192, 132, 252, ${(0.5 + 0.3 * Math.sin(time * 16)).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius + 17, time * 2, time * 2 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Dash telegraph arrow for Mutating Plasma Dash or Anvil Slam
  if (
    isTelegraphing &&
    !isDying &&
    (boss.currentAttack === 'PLASMA_MUTATION_DASH' || boss.currentAttack === 'METAL_ANVIL_SLAM')
  ) {
    const dx = boss.dashTargetX - boss.x;
    const dy = boss.dashTargetY - boss.y;
    ctx.save();
    ctx.strokeStyle =
      boss.currentAttack === 'METAL_ANVIL_SLAM'
        ? 'rgba(251, 146, 60, 0.72)'
        : 'rgba(232, 121, 249, 0.72)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dx, dy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(dx, dy, boss.radius + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Singularity pull ring visual
  if (boss.pullForceToBoss > 0 && !isDying) {
    const pullPulse = (time * 1.4) % 1;
    ctx.strokeStyle = `rgba(168, 85, 247, ${(0.45 * (1 - pullPulse)).toFixed(3)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius + 220 * (1 - pullPulse), 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isTelegraphing && !isDying) {
    const t = boss.telegraphProgress;
    const pulse = 0.55 + 0.45 * Math.sin(time * 28);
    const ringRadius = boss.radius + 22 + (1 - t) * 34;
    const teleColor =
      boss.archetype === 'STAR'
        ? `rgba(251, 191, 36, ${(0.5 + 0.45 * pulse).toFixed(3)})`
        : boss.archetype === 'METAPLASM'
          ? `rgba(232, 121, 249, ${(0.5 + 0.45 * pulse).toFixed(3)})`
          : boss.archetype === 'PHYSICS'
            ? `rgba(34, 211, 238, ${(0.5 + 0.45 * pulse).toFixed(3)})`
            : boss.archetype === 'METAL'
              ? `rgba(251, 146, 60, ${(0.5 + 0.45 * pulse).toFixed(3)})`
              : boss.archetype === 'BLACK_HOLE'
                ? `rgba(168, 85, 247, ${(0.55 + 0.4 * pulse).toFixed(3)})`
                : `rgba(56, 189, 248, ${(0.5 + 0.45 * pulse).toFixed(3)})`;
    ctx.strokeStyle = teleColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (boss.archetype === 'STAR') {
    const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, boss.radius * 2.8);
    aura.addColorStop(0, enraged ? 'rgba(125, 211, 252, 0.52)' : 'rgba(251, 191, 36, 0.5)');
    aura.addColorStop(0.55, enraged ? 'rgba(56, 189, 248, 0.2)' : 'rgba(249, 115, 22, 0.2)');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(boss.ringRotation * 1.4);
    ctx.fillStyle = flash ? '#ffffff' : enraged ? '#38bdf8' : '#f97316';
    drawStarPath(ctx, 0, 0, 12, boss.radius + 22, boss.radius * 0.72, 0);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.rotate(-boss.innerRingRotation);
    ctx.fillStyle = flash ? '#ffffff' : enraged ? '#e0f2fe' : '#fde047';
    drawStarPath(ctx, 0, 0, 8, boss.radius * 0.92, boss.radius * 0.58, 0);
    ctx.fill();
    ctx.restore();

    const core = ctx.createRadialGradient(0, 0, 2, 0, 0, boss.radius * 0.55);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.6, enraged ? '#bae6fd' : '#fef08a');
    core.addColorStop(1, enraged ? '#0284c7' : '#f59e0b');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (boss.archetype === 'METAPLASM') {
    const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, boss.radius * 2.5);
    aura.addColorStop(0, enraged ? 'rgba(244, 63, 94, 0.48)' : 'rgba(217, 70, 239, 0.45)');
    aura.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Morphing organic plasma membrane
    const pts = 18;
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const wobble =
        Math.sin(a * 4 + time * 5) * 6 + Math.cos(a * 3 - time * 7) * 4;
      const r = boss.radius + wobble;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = flash ? '#ffffff' : enraged ? '#831843' : '#581c87';
    ctx.fill();
    ctx.strokeStyle = flash ? '#ffffff' : enraged ? '#fb7185' : '#e879f9';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Orbiting bio-electric nuclei
    for (let k = 0; k < 3; k++) {
      const oa = time * 3 + (k * Math.PI * 2) / 3;
      const ox = Math.cos(oa) * (boss.radius * 0.45);
      const oy = Math.sin(oa) * (boss.radius * 0.45);
      ctx.fillStyle = k % 2 === 0 ? '#22d3ee' : '#f0abfc';
      ctx.beginPath();
      ctx.arc(ox, oy, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (boss.archetype === 'PHYSICS') {
    const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, boss.radius * 2.5);
    aura.addColorStop(0, enraged ? 'rgba(244, 63, 94, 0.42)' : 'rgba(56, 189, 248, 0.36)');
    aura.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Gyroscope tilted orbital rings
    for (let r = 0; r < 2; r++) {
      ctx.save();
      ctx.rotate(boss.ringRotation * (r === 0 ? 1 : -1.2) + r * 1.1);
      ctx.strokeStyle = flash ? '#ffffff' : enraged ? '#fb7185' : '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, boss.radius + 14, boss.radius * 0.48, 0, 0, Math.PI * 2);
      ctx.stroke();

      const orbX = Math.cos(time * 4 + r * 2) * (boss.radius + 14);
      const orbY = Math.sin(time * 4 + r * 2) * (boss.radius * 0.48);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(orbX, orbY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = flash ? '#ffffff' : '#0f172a';
    ctx.strokeStyle = flash ? '#ffffff' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = enraged ? '#fb7185' : '#7dd3fc';
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (boss.archetype === 'METAL') {
    const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, boss.radius * 2.4);
    aura.addColorStop(0, enraged ? 'rgba(239, 68, 68, 0.45)' : 'rgba(249, 115, 22, 0.35)');
    aura.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Spinning outer saw teeth
    ctx.save();
    ctx.rotate(boss.ringRotation * 2.2);
    ctx.fillStyle = flash ? '#ffffff' : '#64748b';
    ctx.strokeStyle = flash ? '#ffffff' : '#cbd5e1';
    ctx.lineWidth = 2;
    drawStarPath(ctx, 0, 0, 14, boss.radius + 15, boss.radius - 2, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Octagonal heavy armor plate
    ctx.save();
    ctx.rotate(boss.innerRingRotation * 0.4);
    ctx.fillStyle = flash ? '#ffffff' : '#1e293b';
    ctx.strokeStyle = flash ? '#ffffff' : enraged ? '#f97316' : '#94a3b8';
    ctx.lineWidth = 3.5;
    drawStarPath(ctx, 0, 0, 8, boss.radius * 0.85, boss.radius * 0.78, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Molten forge furnace eye
    const forge = ctx.createRadialGradient(0, 0, 2, 0, 0, boss.radius * 0.46);
    forge.addColorStop(0, '#fef08a');
    forge.addColorStop(0.55, enraged ? '#ef4444' : '#f97316');
    forge.addColorStop(1, '#431407');
    ctx.fillStyle = forge;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (boss.archetype === 'BLACK_HOLE') {
    // Gravitational lensing halo
    const lens = ctx.createRadialGradient(0, 0, boss.radius * 0.55, 0, 0, boss.radius * 2.9);
    lens.addColorStop(0, 'rgba(0, 0, 0, 0)');
    lens.addColorStop(0.32, enraged ? 'rgba(244, 63, 94, 0.55)' : 'rgba(168, 85, 247, 0.5)');
    lens.addColorStop(0.6, 'rgba(245, 158, 11, 0.22)');
    lens.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lens;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 2.9, 0, Math.PI * 2);
    ctx.fill();

    // Swirling accretion disk rings
    ctx.save();
    ctx.rotate(-0.28);
    ctx.strokeStyle = enraged ? 'rgba(251, 113, 133, 0.78)' : 'rgba(245, 158, 11, 0.72)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, boss.radius + 24, boss.radius * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, boss.radius + 14, boss.radius * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Pitch-black Event Horizon singularity
    ctx.fillStyle = flash ? '#e2e8f0' : '#020206';
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 0.82, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = flash ? '#ffffff' : enraged ? '#f43f5e' : '#c084fc';
    ctx.lineWidth = 2.8;
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Default: THE STAR WARDEN
  const isRedAttack =
    boss.currentAttack === 'RED_RICOCHET_STARS' || boss.currentAttack === 'RED_STAR_SPRAY';
  const isPoisonAttack = boss.currentAttack === 'POISON_GAS';
  const isWardenEnraged = enraged || boss.currentAttack === 'ULTRA_RAGE_LASERS';

  const glowColor = isWardenEnraged
    ? 'rgba(217, 70, 239, 0.42)'
    : isTelegraphing && isPoisonAttack
      ? 'rgba(34, 197, 94, 0.36)'
      : isTelegraphing && isRedAttack
        ? 'rgba(244, 63, 94, 0.36)'
        : 'rgba(139, 92, 246, 0.28)';

  const bossAura = ctx.createRadialGradient(0, 0, boss.radius * 0.4, 0, 0, boss.radius * 2.6);
  bossAura.addColorStop(0, glowColor);
  bossAura.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = bossAura;
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius * 2.6, 0, Math.PI * 2);
  ctx.fill();

  if (isWardenEnraged) {
    ctx.save();
    ctx.rotate(-time * 2.6);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.72)';
    ctx.lineWidth = 2;
    drawStarPath(ctx, 0, 0, 12, boss.radius + 25, boss.radius + 14, 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.rotate(boss.ringRotation);
  ctx.strokeStyle = flash
    ? '#ffffff'
    : isWardenEnraged
      ? '#e879f9'
      : isTelegraphing && isRedAttack
        ? '#fb7185'
        : '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius + 11, 0, Math.PI * 2);
  ctx.stroke();

  const finCount = isWardenEnraged ? 10 : 8;
  for (let i = 0; i < finCount; i++) {
    const a = (i * Math.PI * 2) / finCount;
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = flash
      ? '#ffffff'
      : isWardenEnraged
        ? i % 2 === 0
          ? '#e11d48'
          : '#a855f7'
        : isTelegraphing && isRedAttack
          ? '#e11d48'
          : '#6366f1';
    ctx.beginPath();
    ctx.moveTo(boss.radius + (isWardenEnraged ? 21 : 17), 0);
    ctx.lineTo(boss.radius + 3, -6);
    ctx.lineTo(boss.radius + 3, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  ctx.save();
  ctx.rotate(boss.innerRingRotation);
  ctx.fillStyle = flash ? '#f8fafc' : isWardenEnraged ? '#4c0519' : '#1e1b4b';
  ctx.strokeStyle = flash ? '#ffffff' : isWardenEnraged ? '#f43f5e' : '#a78bfa';
  ctx.lineWidth = 3;
  drawStarPath(ctx, 0, 0, isWardenEnraged ? 10 : 8, boss.radius, boss.radius * 0.76, 0);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const coreGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, boss.radius * 0.62);
  if (flash) {
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(1, '#e2e8f0');
  } else if (isWardenEnraged) {
    coreGrad.addColorStop(0, '#fdf4ff');
    coreGrad.addColorStop(0.42, '#d946ef');
    coreGrad.addColorStop(0.75, '#e11d48');
    coreGrad.addColorStop(1, '#4c0519');
  } else if (isTelegraphing && isRedAttack) {
    coreGrad.addColorStop(0, '#fff1f2');
    coreGrad.addColorStop(0.5, '#f43f5e');
    coreGrad.addColorStop(1, '#881337');
  } else {
    coreGrad.addColorStop(0, '#fef9c3');
    coreGrad.addColorStop(0.45, '#f59e0b');
    coreGrad.addColorStop(1, '#4338ca');
  }
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, boss.radius * 0.56, 0, Math.PI * 2);
  ctx.fill();

  const eyeAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
  const eyeOffsetX = Math.cos(eyeAngle) * 7;
  const eyeOffsetY = Math.sin(eyeAngle) * 7;
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.arc(eyeOffsetX, eyeOffsetY, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isWardenEnraged
    ? '#f43f5e'
    : isTelegraphing && isRedAttack
      ? '#fda4af'
      : '#fef08a';
  ctx.beginPath();
  ctx.arc(
    eyeOffsetX + Math.cos(eyeAngle) * 2,
    eyeOffsetY + Math.sin(eyeAngle) * 2,
    4,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.restore();
}

function getNormalStarColors(palette: NormalStarPalette | string): {
  core: string;
  mid: string;
  glow: string;
} {
  switch (palette) {
    case 'cyan':
      return {
        core: '#ffffff',
        mid: '#38bdf8',
        glow: 'rgba(56, 189, 248, 0.55)',
      };
    case 'gold':
      return {
        core: '#fffbeb',
        mid: '#facc15',
        glow: 'rgba(250, 204, 21, 0.55)',
      };
    case 'white':
    default:
      return {
        core: '#ffffff',
        mid: '#e0f2fe',
        glow: 'rgba(224, 242, 254, 0.55)',
      };
  }
}

export function renderProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
  const spawnAlpha = Math.min(1, p.age / p.fadeInDuration);
  const fadeOutAlpha = p.fadingOut ? Math.max(0, 1 - p.fadeOutTimer / p.fadeOutDuration) : 1;
  const alpha = spawnAlpha * fadeOutAlpha;
  if (alpha <= 0.01) return;

  const scale = 0.45 + 0.55 * spawnAlpha;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (p.kind === 'PLAYER_STANDARD') {
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, 20);
    grad.addColorStop(0, 'rgba(110, 231, 183, 0.72)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -6);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ecfdf5';
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-4, -2.5);
    ctx.lineTo(-4, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.kind === 'PLAYER_PIERCING') {
    if (p.trail.length > 1) {
      for (let i = 0; i < p.trail.length; i++) {
        const pt = p.trail[i];
        const ratio = (i + 1) / p.trail.length;
        ctx.fillStyle = `rgba(56, 189, 248, ${(ratio * 0.42 * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5 * ratio, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.8)');
    glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-14, -5);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-14, 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f0f9ff';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, -2);
    ctx.lineTo(-8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.kind === 'PLAYER_RICOCHET') {
    if (p.trail.length > 1) {
      for (let i = 0; i < p.trail.length; i++) {
        const pt = p.trail[i];
        const ratio = (i + 1) / p.trail.length;
        ctx.fillStyle = `rgba(250, 204, 21, ${(ratio * 0.35 * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.radius * ratio * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.translate(p.x, p.y);

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
    glow.addColorStop(0, 'rgba(250, 204, 21, 0.78)');
    glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    drawStarPath(ctx, 0, 0, 4, p.radius + 3, p.radius * 0.48, p.rotation);
    ctx.fill();

    ctx.fillStyle = '#fefce8';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.kind === 'PLAYER_DOT') {
    if (p.trail.length > 1) {
      for (let i = 0; i < p.trail.length; i++) {
        const pt = p.trail[i];
        const ratio = (i + 1) / p.trail.length;
        ctx.fillStyle = `rgba(192, 132, 252, ${(ratio * 0.42 * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.radius * ratio * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.translate(p.x, p.y);

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 25);
    glow.addColorStop(0, 'rgba(216, 180, 254, 0.85)');
    glow.addColorStop(0.55, 'rgba(168, 85, 247, 0.45)');
    glow.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c084fc';
    drawStarPath(ctx, 0, 0, 6, p.radius + 2, p.radius * 0.52, p.rotation);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.kind === 'ENEMY_ORB') {
    ctx.translate(p.x, p.y);
    const glowClr =
      p.palette === 'gold'
        ? 'rgba(250, 204, 21, 0.75)'
        : p.palette === 'crimson'
          ? 'rgba(251, 113, 133, 0.7)'
          : 'rgba(56, 189, 248, 0.7)';
    const fillClr =
      p.palette === 'gold' ? '#fbbf24' : p.palette === 'crimson' ? '#fb7185' : '#38bdf8';

    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
    glow.addColorStop(0, glowClr);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fillClr;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.visualStyle === 'SAWBLADE') {
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2;
    drawStarPath(ctx, 0, 0, 8, p.radius + 4, p.radius * 0.55, p.rotation);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.visualStyle === 'IRON_SPEAR') {
    const dirAngle = Math.atan2(p.vy, p.vx);
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.abs(p.vx) + Math.abs(p.vy) > 1 ? dirAngle : p.rotation);
    if (p.delayedLaunchTimer && p.delayedLaunchTimer > 0) {
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(360, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.radius + 14, 0);
    ctx.lineTo(-p.radius - 6, -6);
    ctx.lineTo(-p.radius, 0);
    ctx.lineTo(-p.radius - 6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (p.visualStyle === 'SHRAPNEL') {
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = '#fed7aa';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(p.radius + 4, 0);
    ctx.lineTo(-p.radius, -5);
    ctx.lineTo(-p.radius * 0.6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (p.visualStyle === 'SOLAR_CORE' || p.visualStyle === 'PLASMA_BLOB') {
    const isSolar = p.visualStyle === 'SOLAR_CORE';
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius * 2.5);
    glow.addColorStop(0, isSolar ? 'rgba(251, 191, 36, 0.9)' : 'rgba(232, 121, 249, 0.9)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isSolar ? '#f59e0b' : '#d946ef';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isSolar ? '#fffbeb' : '#22d3ee';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (
    p.visualStyle === 'PLASMA_SHARD' ||
    p.visualStyle === 'KINETIC_ORB' ||
    p.visualStyle === 'DARK_ORB' ||
    p.visualStyle === 'VOID_SHARD'
  ) {
    const colors =
      p.visualStyle === 'PLASMA_SHARD'
        ? { outer: 'rgba(232, 121, 249, 0.8)', mid: '#e879f9', core: '#ecfeff' }
        : p.visualStyle === 'KINETIC_ORB'
          ? { outer: 'rgba(56, 189, 248, 0.8)', mid: '#22d3ee', core: '#f0f9ff' }
          : p.visualStyle === 'DARK_ORB'
            ? { outer: 'rgba(168, 85, 247, 0.85)', mid: '#7e22ce', core: '#f5d0fe' }
            : { outer: 'rgba(245, 158, 11, 0.75)', mid: '#a855f7', core: '#fef08a' };

    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius * 2.3);
    glow.addColorStop(0, colors.outer);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 2.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colors.mid;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.core;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (p.kind === 'BOSS_NORMAL_STAR') {
    const colors = getNormalStarColors(p.palette);
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);

    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius * 2.4);
    glow.addColorStop(0, colors.glow);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colors.mid;
    drawStarPath(ctx, 0, 0, 5, p.radius + 2, p.radius * 0.45, p.rotation);
    ctx.fill();

    ctx.fillStyle = colors.core;
    drawStarPath(ctx, 0, 0, 5, p.radius * 0.68, p.radius * 0.3, p.rotation);
    ctx.fill();

    ctx.restore();
    return;
  }

  // BOSS_RED_STAR
  if (p.trail.length > 1) {
    for (let i = 0; i < p.trail.length; i++) {
      const pt = p.trail[i];
      const ratio = (i + 1) / p.trail.length;
      ctx.fillStyle = `rgba(239, 68, 68, ${(ratio * 0.38 * alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, p.radius * ratio * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.translate(p.x, p.y);
  ctx.scale(scale, scale);

  const redGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius * 2.7);
  redGlow.addColorStop(0, 'rgba(251, 113, 133, 0.85)');
  redGlow.addColorStop(0.45, 'rgba(220, 38, 38, 0.45)');
  redGlow.addColorStop(1, 'rgba(220, 38, 38, 0)');
  ctx.fillStyle = redGlow;
  ctx.beginPath();
  ctx.arc(0, 0, p.radius * 2.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  drawStarPath(ctx, 0, 0, 5, p.radius + 3, p.radius * 0.48, p.rotation);
  ctx.fill();

  ctx.strokeStyle = '#fda4af';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = '#fff1f2';
  drawStarPath(ctx, 0, 0, 5, p.radius * 0.56, p.radius * 0.24, p.rotation);
  ctx.fill();

  ctx.restore();
}

export function renderEffects(
  ctx: CanvasRenderingContext2D,
  shockwaves: Shockwave[],
  particles: Particle[],
  floatingTexts: FloatingText[]
): void {
  for (let i = 0; i < shockwaves.length; i++) {
    const s = shockwaves[i];
    ctx.save();
    ctx.globalAlpha = s.alpha;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.lineWidth;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (let i = 0; i < particles.length; i++) {
    const pt = particles[i];
    ctx.save();
    ctx.globalAlpha = pt.alpha;
    ctx.fillStyle = pt.color;
    ctx.shadowColor = pt.glowColor;
    ctx.shadowBlur = 8;
    if (pt.isStar) {
      drawStarPath(ctx, pt.x, pt.y, 4, pt.radius * 1.4, pt.radius * 0.5, pt.rotation);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (let i = 0; i < floatingTexts.length; i++) {
    const ft = floatingTexts[i];
    const alpha = Math.max(0, 1 - ft.life / ft.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${Math.round(15 * ft.scale)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
    ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}
