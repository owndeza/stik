export type GamePhase =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'LEVEL_UP'
  | 'BOSS_DYING'
  | 'ROOM_TRANSITION'
  | 'DEFEAT';

export type RoomKind = 'ENEMIES' | 'SWARM' | 'BOSS';

export type GameMode = 'NORMAL' | 'HARDMODE';

export type BossArchetype =
  | 'STAR_WARDEN'
  | 'STAR'
  | 'METAPLASM'
  | 'PHYSICS'
  | 'METAL'
  | 'BLACK_HOLE';

export type BossSelectOption = 'AUTO' | BossArchetype;

export type BossAttackType =
  | 'NORMAL_STARS'
  | 'RED_RICOCHET_STARS'
  | 'BOUNCE_LASER'
  | 'POISON_GAS'
  | 'RED_STAR_SPRAY'
  | 'ULTRA_RAGE_LASERS'
  | 'STAR_SUPERNOVA_RING'
  | 'STAR_SOLAR_FLARE'
  | 'STAR_METEOR_RAIN'
  | 'STAR_CONSTELLATION_ORB'
  | 'STAR_CROSS_PULSAR'
  | 'STAR_BINARY_ECLIPSE'
  | 'PLASMA_SPLIT_ORBS'
  | 'PLASMA_LIGHTNING_WEB'
  | 'PLASMA_PUDDLE_ERUPTION'
  | 'PLASMA_MUTATION_DASH'
  | 'PLASMA_SIPHON_SPIRAL'
  | 'PLASMA_OVERLOAD'
  | 'PHYS_KINETIC_IMPULSE'
  | 'PHYS_PENDULUM_SWEEP'
  | 'PHYS_RICOCHET_COLLIDER'
  | 'PHYS_GRAVITY_TRAP'
  | 'PHYS_VECTOR_GRID'
  | 'PHYS_ENTROPY_COLLAPSE'
  | 'METAL_SAWBLADES'
  | 'METAL_ANVIL_SLAM'
  | 'METAL_SHRAPNEL_CONE'
  | 'METAL_MAGNET_SPEARS'
  | 'METAL_MOLTEN_FORGE'
  | 'METAL_BLADE_STORM'
  | 'BH_SINGULARITY_PULL'
  | 'BH_ACCRETION_ORBIT'
  | 'BH_VOID_RIFTS'
  | 'BH_HAWKING_JETS'
  | 'BH_DARK_MATTER_BARRAGE'
  | 'BH_EVENT_HORIZON';

export type BossBehaviorState = 'IDLE' | 'TELEGRAPH' | 'FIRING' | 'COOLDOWN';

export type EnemyType = 'CHASER' | 'TURRET' | 'ORBITER' | 'MINI_BOSS';

export type PlayerProjectileType = 'STANDARD' | 'PIERCING' | 'RICOCHET' | 'DOT';

export type ProjectileKind =
  | 'PLAYER_STANDARD'
  | 'PLAYER_PIERCING'
  | 'PLAYER_RICOCHET'
  | 'PLAYER_DOT'
  | 'BOSS_NORMAL_STAR'
  | 'BOSS_RED_STAR'
  | 'ENEMY_ORB';

export type NormalStarPalette = 'white' | 'cyan' | 'gold';

export type UpgradeId =
  | 'ATTACK_SPEED'
  | 'DAMAGE_UP'
  | 'MAX_HP_UP'
  | 'MOVE_SPEED'
  | 'HEAL_REPAIR'
  | 'CRIT_CHANCE'
  | 'MULTISHOT'
  | 'SHIELD_DURATION';

export interface UpgradeOption {
  id: UpgradeId;
  title: string;
  description: string;
  accent: 'emerald' | 'gold' | 'cyan' | 'crimson';
}

export interface ArenaBounds {
  width: number;
  height: number;
  wallThickness: number;
  innerLeft: number;
  innerTop: number;
  innerRight: number;
  innerBottom: number;
}

export interface WallObstacle {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WaterLake {
  id: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  phase: number;
}

export interface RoomPortal {
  x: number;
  y: number;
  width: number;
  height: number;
  open: boolean;
}

export interface RoomLayout {
  roomNumber: number;
  roomKind: RoomKind;
  archetypeName: string;
  speedMultiplier: number;
  spawnInterval: number;
  walls: WallObstacle[];
  lakes: WaterLake[];
  portal: RoomPortal;
}

export interface LaserSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type LaserColorTheme = 'CYAN' | 'ULTRA' | 'SOLAR' | 'PLASMA' | 'GRID' | 'VOID';

export interface LaserBeam {
  segments: LaserSegment[];
  isTelegraph: boolean;
  isUltra: boolean;
  damage: number;
  width: number;
  colorTheme?: LaserColorTheme;
  originX?: number;
  originY?: number;
  angle?: number;
  angularSpeed?: number;
  maxBounces?: number;
}

export interface PoisonGasZone {
  x: number;
  y: number;
  w: number;
  h: number;
  wallSide: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
  telegraphTimer: number;
  activeTimer: number;
  maxActiveTimer: number;
  damagePerTick: number;
}

export type FloorHazardKind =
  | 'METEOR_STRIKE'
  | 'PLASMA_POOL'
  | 'GRAVITY_WELL'
  | 'MOLTEN_POOL'
  | 'VOID_RIFT';

export interface FloorHazard {
  id: number;
  kind: FloorHazardKind;
  x: number;
  y: number;
  radius: number;
  telegraphTimer: number;
  maxTelegraphTimer: number;
  activeTimer: number;
  maxActiveTimer: number;
  damage: number;
  pullStrength: number;
  burstDone: boolean;
  tickTimer: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
  isMoving: boolean;
  aimAngle: number;
  fireCooldown: number;
  fireInterval: number;
  damageMultiplier: number;
  critChance: number;
  multishotCount: number;
  activeProjectile: PlayerProjectileType;
  unlockedProjectiles: PlayerProjectileType[];
  level: number;
  xp: number;
  xpToNextLevel: number;
  invulnerableTimer: number;
  invulnerableDuration: number;
  poisonTickTimer: number;
  hitFlashTimer: number;
  squashX: number;
  squashY: number;
  stridePhase: number;
  trail: Array<{ x: number; y: number; alpha: number }>;
}

export interface BossState {
  id: number;
  archetype: BossArchetype;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  behavior: BossBehaviorState;
  stateTimer: number;
  currentAttack: BossAttackType;
  lastAttack: BossAttackType | null;
  consecutiveSameAttack: number;
  shotsRemaining: number;
  shotIntervalTimer: number;
  sprayAngleOffset: number;
  laserAimAngle: number;
  laserChannelTimer: number;
  activeLasers: LaserBeam[];
  isEnraged: boolean;
  enragePhaseTriggered: boolean;
  attackCounter: number;
  hitFlashTimer: number;
  ringRotation: number;
  innerRingRotation: number;
  patrolAngle: number;
  anchorX: number;
  anchorY: number;
  telegraphProgress: number;
  deathTimer: number;
  deathBurstTimer: number;
  burnTimer: number;
  burnTickTimer: number;
  burnDamagePerTick: number;
  dashTimer: number;
  dashVx: number;
  dashVy: number;
  dashDropsTrail: boolean;
  dashTrailAccum: number;
  dashTargetX: number;
  dashTargetY: number;
  dashSlamOnEnd: boolean;
  pullForceToBoss: number;
  pulsarAngle: number;
  waveDir: number;
}

export interface MinorEnemy {
  id: number;
  type: EnemyType;
  name?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
  xpReward: number;
  attackCooldown: number;
  attackInterval: number;
  attackPatternStep: number;
  telegraphTimer: number;
  hitFlashTimer: number;
  phaseAngle: number;
  anchorX: number;
  anchorY: number;
  burnTimer: number;
  burnTickTimer: number;
  burnDamagePerTick: number;
  alive: boolean;
}

export interface ProjectileTrailPoint {
  x: number;
  y: number;
}

export type ProjectileVisualStyle =
  | 'STAR'
  | 'RED_STAR'
  | 'SOLAR_CORE'
  | 'PLASMA_BLOB'
  | 'PLASMA_SHARD'
  | 'KINETIC_ORB'
  | 'SAWBLADE'
  | 'IRON_SPEAR'
  | 'SHRAPNEL'
  | 'DARK_ORB'
  | 'VOID_SHARD'
  | 'ORB';

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  owner: 'PLAYER' | 'BOSS' | 'ENEMY';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  rotation: number;
  spinSpeed: number;
  age: number;
  fadeInDuration: number;
  fadingOut: boolean;
  fadeOutTimer: number;
  fadeOutDuration: number;
  bouncesRemaining: number;
  maxBounces: number;
  pierceRemaining: number;
  hitEntityIds: number[];
  appliesDot: boolean;
  dotDamagePerTick: number;
  isCrit: boolean;
  palette:
    | NormalStarPalette
    | 'crimson'
    | 'emerald'
    | 'cyan'
    | 'gold'
    | 'violet'
    | 'orange'
    | 'magenta'
    | 'steel'
    | 'indigo';
  visualStyle?: ProjectileVisualStyle;
  homingStrength?: number;
  homingTimer?: number;
  accelRate?: number;
  bounceSpeedGain?: number;
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
  trail: ProjectileTrailPoint[];
  alive: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glowColor: string;
  alpha: number;
  life: number;
  maxLife: number;
  drag: number;
  isStar: boolean;
  rotation: number;
  spin: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  lineWidth: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface AmbientStar {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  pointerMoveActive: boolean;
  pointerDirX: number;
  pointerDirY: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  gameMode: GameMode;
  roomNumber: number;
  roomKind: RoomKind;
  roomArchetype: string;
  roomCleared: boolean;
  difficultyPercent: number;
  playerHp: number;
  playerMaxHp: number;
  playerInvulnerable: boolean;
  playerIsMoving: boolean;
  attackCooldownRemaining: number;
  attackCooldownMax: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  activeProjectile: PlayerProjectileType;
  unlockedProjectiles: PlayerProjectileType[];
  newlyUnlockedProjectile: PlayerProjectileType | null;
  upgradeChoices: UpgradeOption[];
  bossArchetype: BossArchetype;
  selectedBossOption: BossSelectOption;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossAlive: boolean;
  bossIsEnraged: boolean;
  miniBossAlive: boolean;
  miniBossName: string;
  miniBossHp: number;
  miniBossMaxHp: number;
  enemiesRemaining: number;
  pendingSpawns: number;
  totalRoomEnemies: number;
  elapsedTime: number;
  totalDamageDealt: number;
  hitsTaken: number;
  shotsFired: number;
  shotsHit: number;
  enemiesDefeated: number;
  bossesDefeated: number;
  activeAttack: BossAttackType | null;
  bossTelegraphing: boolean;
}
