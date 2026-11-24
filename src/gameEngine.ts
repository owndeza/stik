import { SoundFX } from './audio';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  chooseNextBossAttack,
  createAmbientStars,
  createArenaBounds,
  createBoss,
  createPlayer,
  renderArena,
  renderBoss,
  renderBossLasers,
  renderEffects,
  renderFloorHazards,
  renderMinorEnemy,
  renderPlayer,
  renderPoisonGasZones,
  renderProjectile,
  renderRoomObstacles,
  renderTargetReticle,
  spawnCustomBossProjectile,
  spawnEnemyOrb,
  spawnNormalBossStar,
  spawnPlayerShot,
  spawnRedRicochetStar,
} from './entities';
import {
  createMinorEnemy,
  generateRoomLayout,
  spawnRoomWavePlan,
} from './roomGenerator';
import {
  AmbientStar,
  ArenaBounds,
  BossAttackType,
  BossSelectOption,
  BossState,
  EnemyType,
  FloatingText,
  FloorHazard,
  GameMode,
  GamePhase,
  HudSnapshot,
  InputState,
  LaserBeam,
  LaserSegment,
  MinorEnemy,
  NormalStarPalette,
  Particle,
  PlayerProjectileType,
  PlayerState,
  PoisonGasZone,
  Projectile,
  RoomLayout,
  Shockwave,
  UpgradeId,
  UpgradeOption,
  WallObstacle,
  WaterLake,
} from './types';

export type HudListener = (snapshot: HudSnapshot) => void;

const NORMAL_PALETTES: NormalStarPalette[] = ['white', 'cyan', 'gold'];

const UPGRADE_POOL: UpgradeOption[] = [
  {
    id: 'ATTACK_SPEED',
    title: 'Ускорение залпа',
    description: 'Сокращает время перезарядки автоатаки на 18%.',
    accent: 'cyan',
  },
  {
    id: 'DAMAGE_UP',
    title: 'Сила звёздного луча',
    description: 'Увеличивает урон всех снарядов и горения на 25%.',
    accent: 'gold',
  },
  {
    id: 'MAX_HP_UP',
    title: 'Броня Стража',
    description: '+250 к максимальному HP и мгновенно восстанавливает 250 HP.',
    accent: 'emerald',
  },
  {
    id: 'MOVE_SPEED',
    title: 'Поступь кометы',
    description: 'Увеличивает скорость передвижения на 15%.',
    accent: 'cyan',
  },
  {
    id: 'HEAL_REPAIR',
    title: 'Звёздное восстановление',
    description: 'Мгновенно восстанавливает 450 HP.',
    accent: 'emerald',
  },
  {
    id: 'CRIT_CHANCE',
    title: 'Критический резонанс',
    description: '+20% шанс нанести двойной (2x) критический урон.',
    accent: 'gold',
  },
  {
    id: 'MULTISHOT',
    title: 'Дополнительный снаряд',
    description: '+1 дополнительный снаряд при каждом выстреле автоатаки.',
    accent: 'crimson',
  },
  {
    id: 'SHIELD_DURATION',
    title: 'Фазовый щит',
    description: '+0.35 сек неуязвимости после получения урона.',
    accent: 'cyan',
  },
];

function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 0.0001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
  const projX = x1 + t * vx;
  const projY = y1 + t * vy;
  return Math.hypot(px - projX, py - projY);
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHudUpdate: HudListener;
  public sound: SoundFX;

  private arena: ArenaBounds;
  private roomLayout: RoomLayout;
  private roomNumber: number = 1;
  private roomCleared: boolean = false;
  private roomTransitionTimer: number = 0;

  private player: PlayerState;
  private boss: BossState;
  private enemies: MinorEnemy[] = [];
  private reinforcementQueue: EnemyType[] = [];
  private reinforcementTimer: number = 0;
  private totalRoomEnemies: number = 0;

  private projectiles: Projectile[] = [];
  private poisonZones: PoisonGasZone[] = [];
  private floorHazards: FloorHazard[] = [];
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private floatingTexts: FloatingText[] = [];
  private ambientStars: AmbientStar[];

  private phase: GamePhase = 'TITLE_MENU';
  private gameMode: GameMode = 'NORMAL';
  private selectedBossOption: BossSelectOption = 'AUTO';
  private elapsedTime: number = 0;
  private totalDamageDealt: number = 0;
  private hitsTaken: number = 0;
  private shotsFired: number = 0;
  private shotsHit: number = 0;
  private enemiesDefeated: number = 0;
  private bossesDefeated: number = 0;

  private upgradeChoices: UpgradeOption[] = [];
  private newlyUnlockedProjectile: PlayerProjectileType | null = null;
  private pendingRoomClearCheck: boolean = false;

  private nextEntityId: number = 10;
  private rafId: number | null = null;
  private lastTimestamp: number = 0;
  private globalTime: number = 0;

  private hitstopTimer: number = 0;
  private shakeIntensity: number = 0;
  private damageFlashAlpha: number = 0;
  private hudSyncTimer: number = 0;
  private lastHudSignature: string = '';

  private currentTargetX: number = 600;
  private currentTargetY: number = 180;
  private currentTargetRadius: number = 42;
  private hasCurrentTarget: boolean = false;

  private input: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    pointerMoveActive: false,
    pointerDirX: 0,
    pointerDirY: 0,
  };

  private canvasCssWidth: number = ARENA_WIDTH;
  private canvasCssHeight: number = ARENA_HEIGHT;
  private dpr: number = 1;

  constructor(canvas: HTMLCanvasElement, onHudUpdate: HudListener) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.onHudUpdate = onHudUpdate;
    this.sound = new SoundFX();

    this.arena = createArenaBounds();
    this.roomLayout = generateRoomLayout(1, this.arena, this.gameMode);
    this.player = createPlayer(this.arena);
    this.boss = createBoss(this.arena, 1, 1, this.gameMode, this.selectedBossOption);
    this.boss.alive = true;
    this.ambientStars = createAmbientStars(this.arena, 80);

    this.bindEvents();
    this.resize(canvas.clientWidth || ARENA_WIDTH, canvas.clientHeight || ARENA_HEIGHT);
    this.emitHud(true);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (
      code === 'KeyW' ||
      code === 'ArrowUp' ||
      code === 'KeyS' ||
      code === 'ArrowDown' ||
      code === 'KeyA' ||
      code === 'ArrowLeft' ||
      code === 'KeyD' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      if (this.phase === 'PLAYING') {
        e.preventDefault();
      }
    }

    if (code === 'KeyW' || code === 'ArrowUp') this.input.up = true;
    if (code === 'KeyS' || code === 'ArrowDown') this.input.down = true;
    if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = true;
    if (code === 'KeyD' || code === 'ArrowRight') this.input.right = true;

    if (this.phase === 'PLAYING') {
      if (code === 'Digit1') this.switchProjectile('STANDARD');
      if (code === 'Digit2') this.switchProjectile('PIERCING');
      if (code === 'Digit3') this.switchProjectile('RICOCHET');
      if (code === 'Digit4') this.switchProjectile('DOT');
      if (code === 'KeyQ' || code === 'KeyE') {
        this.cycleProjectile(code === 'KeyE' ? 1 : -1);
      }
    }

    if (code === 'Escape') {
      if (this.phase === 'PLAYING') {
        this.pauseGame();
      } else if (this.phase === 'PAUSED') {
        this.resumeGame();
      }
    }

    if (
      (code === 'Enter' || code === 'Space') &&
      this.phase === 'TITLE_MENU' &&
      !(e.target instanceof HTMLButtonElement)
    ) {
      e.preventDefault();
      this.startGame();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp') this.input.up = false;
    if (code === 'KeyS' || code === 'ArrowDown') this.input.down = false;
    if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = false;
    if (code === 'KeyD' || code === 'ArrowRight') this.input.right = false;
  };

  private handleWindowBlur = (): void => {
    this.clearInputs();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
  }

  public destroy(): void {
    this.stopLoop();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
  }

  public clearInputs(): void {
    this.input.up = false;
    this.input.down = false;
    this.input.left = false;
    this.input.right = false;
    this.input.pointerMoveActive = false;
    this.input.pointerDirX = 0;
    this.input.pointerDirY = 0;
  }

  public setTouchJoystick(active: boolean, dirX: number, dirY: number): void {
    this.input.pointerMoveActive = active;
    this.input.pointerDirX = dirX;
    this.input.pointerDirY = dirY;
  }

  public resize(cssWidth: number, cssHeight: number): void {
    const safeW = Math.max(320, Math.floor(cssWidth));
    const safeH = Math.max(240, Math.floor(cssHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvasCssWidth = safeW;
    this.canvasCssHeight = safeH;
    this.dpr = dpr;

    this.canvas.width = Math.floor(safeW * dpr);
    this.canvas.height = Math.floor(safeH * dpr);
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      this.update(dt);
      this.render();

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public setGameMode(mode: GameMode): void {
    this.gameMode = mode;
    this.emitHud(true);
  }

  public setSelectedBossOption(option: BossSelectOption): void {
    this.selectedBossOption = option;
    if (this.phase === 'TITLE_MENU') {
      this.boss = createBoss(this.arena, 1, 1, 'HARDMODE', this.selectedBossOption);
      this.boss.alive = true;
    }
    this.emitHud(true);
  }

  public startGame(mode?: GameMode, bossOption?: BossSelectOption): void {
    if (mode) {
      this.gameMode = mode;
    }
    if (bossOption) {
      this.selectedBossOption = bossOption;
    }
    this.sound.unlock();
    this.resetWorld();
    this.phase = 'PLAYING';
    this.emitHud(true);
  }

  public restartGame(): void {
    this.sound.unlock();
    this.resetWorld();
    this.phase = 'PLAYING';
    this.emitHud(true);
  }

  public returnToMenu(): void {
    this.clearInputs();
    this.roomNumber = 1;
    this.roomCleared = false;
    this.roomLayout = generateRoomLayout(1, this.arena, this.gameMode);
    this.player = createPlayer(this.arena);
    this.boss = createBoss(this.arena, 1, 1, this.gameMode, this.selectedBossOption);
    this.boss.alive = true;
    this.enemies = [];
    this.reinforcementQueue = [];
    this.projectiles = [];
    this.poisonZones = [];
    this.floorHazards = [];
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.phase = 'TITLE_MENU';
    this.emitHud(true);
  }

  public pauseGame(): void {
    if (this.phase !== 'PLAYING') return;
    this.clearInputs();
    this.phase = 'PAUSED';
    this.emitHud(true);
  }

  public resumeGame(): void {
    if (this.phase !== 'PAUSED') return;
    this.lastTimestamp = performance.now();
    this.phase = 'PLAYING';
    this.emitHud(true);
  }

  public switchProjectile(type: PlayerProjectileType): void {
    if (!this.player.unlockedProjectiles.includes(type)) return;
    if (this.player.activeProjectile === type) return;
    this.player.activeProjectile = type;
    this.sound.playSwitchWeapon();
    this.emitHud(true);
  }

  private cycleProjectile(dir: 1 | -1): void {
    const list = this.player.unlockedProjectiles;
    if (list.length <= 1) return;
    const idx = list.indexOf(this.player.activeProjectile);
    const nextIdx = (idx + dir + list.length) % list.length;
    this.switchProjectile(list[nextIdx]);
  }

  public selectUpgrade(upgradeId: UpgradeId): void {
    if (this.phase !== 'LEVEL_UP') return;
    const p = this.player;

    switch (upgradeId) {
      case 'ATTACK_SPEED':
        p.fireInterval = Math.max(0.25, Number((p.fireInterval * 0.82).toFixed(2)));
        p.fireCooldown = Math.min(p.fireCooldown, p.fireInterval);
        break;
      case 'DAMAGE_UP':
        p.damageMultiplier += 0.25;
        break;
      case 'MAX_HP_UP':
        p.maxHp += 250;
        p.hp = Math.min(p.maxHp, p.hp + 250);
        break;
      case 'MOVE_SPEED':
        p.speed = Math.round(p.speed * 1.15);
        break;
      case 'HEAL_REPAIR':
        p.hp = Math.min(p.maxHp, p.hp + 450);
        break;
      case 'CRIT_CHANCE':
        p.critChance = Math.min(0.8, p.critChance + 0.2);
        break;
      case 'MULTISHOT':
        p.multishotCount = Math.min(5, p.multishotCount + 1);
        break;
      case 'SHIELD_DURATION':
        p.invulnerableDuration += 0.35;
        break;
    }

    this.upgradeChoices = [];
    this.newlyUnlockedProjectile = null;
    this.clearInputs();
    this.lastTimestamp = performance.now();

    if (p.xp >= p.xpToNextLevel) {
      this.triggerLevelUp();
      return;
    }

    this.phase = 'PLAYING';
    if (this.pendingRoomClearCheck) {
      this.pendingRoomClearCheck = false;
      this.checkRoomCleared();
    }
    this.emitHud(true);
  }

  private resetWorld(): void {
    this.roomNumber = 1;
    this.nextEntityId = 10;
    this.player = createPlayer(this.arena);
    this.elapsedTime = 0;
    this.totalDamageDealt = 0;
    this.hitsTaken = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.enemiesDefeated = 0;
    this.bossesDefeated = 0;
    this.upgradeChoices = [];
    this.newlyUnlockedProjectile = null;
    this.pendingRoomClearCheck = false;
    this.setupRoom(1);
  }

  private setupRoom(roomNum: number): void {
    this.roomNumber = roomNum;
    this.roomCleared = false;
    this.roomLayout = generateRoomLayout(roomNum, this.arena, this.gameMode);

    this.player.x = this.arena.width * 0.5;
    this.player.y = this.arena.innerBottom - 95;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.trail = [];
    this.player.fireCooldown = Math.min(this.player.fireCooldown, 0.25);

    this.boss = createBoss(
      this.arena,
      roomNum,
      this.nextEntityId++,
      this.gameMode,
      this.selectedBossOption
    );
    this.boss.alive = this.roomLayout.roomKind === 'BOSS';

    const wave = spawnRoomWavePlan(
      roomNum,
      this.arena,
      this.roomLayout,
      this.nextEntityId,
      this.gameMode
    );
    this.enemies = wave.initialEnemies;
    this.reinforcementQueue = wave.reinforcementQueue;
    this.reinforcementTimer = this.roomLayout.spawnInterval;
    this.totalRoomEnemies = this.enemies.length + this.reinforcementQueue.length;
    this.nextEntityId = wave.nextId;

    this.projectiles = [];
    this.poisonZones = [];
    this.floorHazards = [];
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.damageFlashAlpha = 0;
    this.hudSyncTimer = 0;
    this.clearInputs();
  }

  private update(dt: number): void {
    this.globalTime += dt;

    if (this.phase === 'TITLE_MENU') {
      this.boss.ringRotation += dt * 0.45;
      this.boss.innerRingRotation -= dt * 0.65;
      this.boss.patrolAngle += dt * 0.35;
      this.boss.x = this.boss.anchorX + Math.sin(this.boss.patrolAngle) * 140;
      this.boss.y = this.boss.anchorY + Math.sin(this.boss.patrolAngle * 2) * 28;
      this.player.aimAngle = Math.atan2(this.boss.y - this.player.y, this.boss.x - this.player.x);
      return;
    }

    if (this.phase === 'PAUSED' || this.phase === 'LEVEL_UP' || this.phase === 'DEFEAT') {
      this.updateVisualEffectsOnly(dt);
      return;
    }

    if (this.phase === 'ROOM_TRANSITION') {
      this.roomTransitionTimer -= dt;
      this.updateVisualEffectsOnly(dt);
      if (this.roomTransitionTimer <= 0) {
        const nextRoom = this.roomNumber + 1;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 120);
        this.setupRoom(nextRoom);
        this.phase = 'PLAYING';
        this.emitHud(true);
      }
      return;
    }

    if (this.damageFlashAlpha > 0) {
      this.damageFlashAlpha = Math.max(0, this.damageFlashAlpha - dt * 2.1);
    }
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 36);
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    if (this.phase === 'BOSS_DYING') {
      this.updateBossDying(dt);
      this.updateVisualEffectsOnly(dt);
      return;
    }

    // Active combat simulation
    this.elapsedTime += dt;
    this.updateReinforcements(dt);
    this.updateAimTarget();
    this.updatePlayer(dt);
    this.updateBoss(dt);
    this.updatePoisonZones(dt);
    this.updateFloorHazards(dt);
    this.updateMinorEnemies(dt);
    this.updateProjectiles(dt);
    this.updateVisualEffectsOnly(dt);

    if (this.roomCleared && this.phase === 'PLAYING') {
      const portal = this.roomLayout.portal;
      const inPortalX =
        this.player.x >= portal.x + 8 && this.player.x <= portal.x + portal.width - 8;
      const inPortalY = this.player.y - this.player.radius <= this.arena.innerTop + 26;
      if (inPortalX && inPortalY) {
        this.sound.playPortalEnter();
        this.phase = 'ROOM_TRANSITION';
        this.roomTransitionTimer = 0.45;
        this.clearInputs();
        this.emitHud(true);
        return;
      }
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.1) {
      this.hudSyncTimer = 0;
      this.emitHud(false);
    } else {
      this.emitHudIfChanged();
    }
  }

  private updateReinforcements(dt: number): void {
    if (this.reinforcementQueue.length === 0) return;

    // Cap simultaneous active minor enemies slightly for readability in Swarm rooms
    const maxConcurrent = this.roomLayout.roomKind === 'SWARM' ? 11 : 7;
    if (this.enemies.length >= maxConcurrent) return;

    this.reinforcementTimer -= dt;
    if (this.reinforcementTimer <= 0) {
      this.reinforcementTimer = this.roomLayout.spawnInterval;
      const spawnBatch = this.roomLayout.roomKind === 'SWARM' ? 2 : 1;
      for (let i = 0; i < spawnBatch && this.reinforcementQueue.length > 0; i++) {
        const nextType = this.reinforcementQueue.shift()!;
        const spawned = createMinorEnemy(
          this.nextEntityId++,
          nextType,
          this.roomNumber,
          this.arena,
          this.roomLayout,
          this.enemies
        );
        this.enemies.push(spawned);
        this.shockwaves.push({
          x: spawned.x,
          y: spawned.y,
          radius: 4,
          maxRadius: 34,
          color: '#a78bfa',
          alpha: 0.8,
          lineWidth: 2,
          life: 0,
          maxLife: 0.3,
        });
      }
    }
  }

  private updateAimTarget(): void {
    let bestDist = Infinity;
    let found = false;
    let tx = this.boss.x;
    let ty = this.boss.y;
    let tr = this.boss.radius;

    if (this.boss.alive) {
      bestDist = Math.hypot(this.boss.x - this.player.x, this.boss.y - this.player.y);
      found = true;
    }

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < bestDist) {
        bestDist = d;
        tx = e.x;
        ty = e.y;
        tr = e.radius;
        found = true;
      }
    }

    this.hasCurrentTarget = found;
    this.currentTargetX = tx;
    this.currentTargetY = ty;
    this.currentTargetRadius = tr;
  }

  private resolveCircleObstacleCollisions(
    x: number,
    y: number,
    radius: number,
    blockWater: boolean
  ): { x: number; y: number } {
    let rx = x;
    let ry = y;

    const minX = this.arena.innerLeft + radius;
    const maxX = this.arena.innerRight - radius;
    const minY = this.arena.innerTop + radius;
    const maxY = this.arena.innerBottom - radius;
    rx = Math.max(minX, Math.min(maxX, rx));
    ry = Math.max(minY, Math.min(maxY, ry));

    for (let i = 0; i < this.roomLayout.walls.length; i++) {
      const w: WallObstacle = this.roomLayout.walls[i];
      const closestX = Math.max(w.x, Math.min(rx, w.x + w.w));
      const closestY = Math.max(w.y, Math.min(ry, w.y + w.h));
      const dx = rx - closestX;
      const dy = ry - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          rx += (dx / dist) * push;
          ry += (dy / dist) * push;
        } else {
          const leftPen = rx - w.x;
          const rightPen = w.x + w.w - rx;
          const topPen = ry - w.y;
          const bottomPen = w.y + w.h - ry;
          const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
          if (minPen === leftPen) rx = w.x - radius;
          else if (minPen === rightPen) rx = w.x + w.w + radius;
          else if (minPen === topPen) ry = w.y - radius;
          else ry = w.y + w.h + radius;
        }
      }
    }

    if (blockWater) {
      for (let i = 0; i < this.roomLayout.lakes.length; i++) {
        const lake: WaterLake = this.roomLayout.lakes[i];
        const effRx = lake.rx + radius;
        const effRy = lake.ry + radius;
        const nx = (rx - lake.x) / effRx;
        const ny = (ry - lake.y) / effRy;
        const normSq = nx * nx + ny * ny;
        if (normSq < 1 && normSq > 0.00001) {
          const norm = Math.sqrt(normSq);
          rx = lake.x + (nx / norm) * effRx;
          ry = lake.y + (ny / norm) * effRy;
        }
      }
    }

    rx = Math.max(minX, Math.min(maxX, rx));
    ry = Math.max(minY, Math.min(maxY, ry));

    return { x: rx, y: ry };
  }

  private updatePlayer(dt: number): void {
    const p = this.player;

    let moveX = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    let moveY = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);

    if (this.input.pointerMoveActive && moveX === 0 && moveY === 0) {
      moveX = this.input.pointerDirX;
      moveY = this.input.pointerDirY;
    }

    const mag = Math.hypot(moveX, moveY);
    if (mag > 0.05) {
      const nx = moveX / mag;
      const ny = moveY / mag;
      p.vx = nx * p.speed;
      p.vy = ny * p.speed;
      p.isMoving = true;
      p.stridePhase += dt * 14;
      p.squashX = 1.07;
      p.squashY = 0.94;

      if (Math.random() < 0.65) {
        p.trail.push({ x: p.x, y: p.y, alpha: 0.9 });
        if (p.trail.length > 8) p.trail.shift();
      }
    } else {
      p.vx = 0;
      p.vy = 0;
      p.isMoving = false;
      p.squashX += (1 - p.squashX) * Math.min(1, dt * 14);
      p.squashY += (1 - p.squashY) * Math.min(1, dt * 14);
    }

    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].alpha -= dt * 4.2;
      if (p.trail[i].alpha <= 0) {
        p.trail.splice(i, 1);
      }
    }

    let extX = 0;
    let extY = 0;
    if (this.boss.alive && this.boss.pullForceToBoss > 0) {
      const dxB = this.boss.x - p.x;
      const dyB = this.boss.y - p.y;
      const dB = Math.hypot(dxB, dyB) || 1;
      if (dB > this.boss.radius + p.radius + 14) {
        extX += (dxB / dB) * this.boss.pullForceToBoss;
        extY += (dyB / dB) * this.boss.pullForceToBoss;
      }
    }
    for (let hIdx = 0; hIdx < this.floorHazards.length; hIdx++) {
      const hz = this.floorHazards[hIdx];
      if (hz.telegraphTimer <= 0 && hz.pullStrength > 0) {
        const dxH = hz.x - p.x;
        const dyH = hz.y - p.y;
        const dH = Math.hypot(dxH, dyH) || 1;
        if (dH < hz.radius * 2.4 && dH > 12) {
          extX += (dxH / dH) * hz.pullStrength;
          extY += (dyH / dH) * hz.pullStrength;
        }
      }
    }

    const resolved = this.resolveCircleObstacleCollisions(
      p.x + (p.vx + extX) * dt,
      p.y + (p.vy + extY) * dt,
      p.radius,
      true
    );
    p.x = resolved.x;
    p.y = resolved.y;

    if (this.hasCurrentTarget) {
      p.aimAngle = Math.atan2(this.currentTargetY - p.y, this.currentTargetX - p.x);
    }

    if (p.invulnerableTimer > 0) {
      p.invulnerableTimer = Math.max(0, p.invulnerableTimer - dt);
    }
    if (p.hitFlashTimer > 0) {
      p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt);
    }
    if (p.poisonTickTimer > 0) {
      p.poisonTickTimer = Math.max(0, p.poisonTickTimer - dt);
    }

    // Archero Auto-Attack with 1-second base cooldown
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (!p.isMoving && this.hasCurrentTarget && p.fireCooldown <= 0) {
      p.fireCooldown = p.fireInterval;
      const count = p.multishotCount;
      const spreadStep = 0.14;
      for (let m = 0; m < count; m++) {
        const offset = (m - (count - 1) / 2) * spreadStep;
        const shot = spawnPlayerShot(
          this.nextEntityId++,
          p,
          this.currentTargetX,
          this.currentTargetY,
          offset
        );
        this.projectiles.push(shot);
        this.shotsFired++;
      }
      p.squashX = 0.84;
      p.squashY = 1.16;
      this.sound.playPlayerShoot();
    }

    if (this.boss.alive) {
      const distToBoss = Math.hypot(p.x - this.boss.x, p.y - this.boss.y);
      const minDist = p.radius + this.boss.radius;
      if (distToBoss < minDist) {
        const nx = distToBoss > 0.001 ? (p.x - this.boss.x) / distToBoss : 0;
        const ny = distToBoss > 0.001 ? (p.y - this.boss.y) / distToBoss : 1;
        const pushed = this.resolveCircleObstacleCollisions(
          this.boss.x + nx * (minDist + 3),
          this.boss.y + ny * (minDist + 3),
          p.radius,
          true
        );
        p.x = pushed.x;
        p.y = pushed.y;
        this.damagePlayer(120, p.x, p.y);
      }
    }
  }

  private computeBouncingLaserSegments(
    originX: number,
    originY: number,
    angle: number,
    maxBounces: number
  ): LaserSegment[] {
    const segments: LaserSegment[] = [];
    let ox = originX;
    let oy = originY;
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);
    const { innerLeft, innerTop, innerRight, innerBottom } = this.arena;

    for (let b = 0; b <= maxBounces; b++) {
      let bestT = Infinity;
      let hitNx = 0;
      let hitNy = 0;

      // Outer arena bounds
      if (dx < -1e-6) {
        const t = (innerLeft - ox) / dx;
        if (t > 0.5 && t < bestT) {
          bestT = t;
          hitNx = 1;
          hitNy = 0;
        }
      } else if (dx > 1e-6) {
        const t = (innerRight - ox) / dx;
        if (t > 0.5 && t < bestT) {
          bestT = t;
          hitNx = -1;
          hitNy = 0;
        }
      }

      if (dy < -1e-6) {
        const t = (innerTop - oy) / dy;
        if (t > 0.5 && t < bestT) {
          bestT = t;
          hitNx = 0;
          hitNy = 1;
        }
      } else if (dy > 1e-6) {
        const t = (innerBottom - oy) / dy;
        if (t > 0.5 && t < bestT) {
          bestT = t;
          hitNx = 0;
          hitNy = -1;
        }
      }

      // Interior stone walls slab intersection
      for (let wIdx = 0; wIdx < this.roomLayout.walls.length; wIdx++) {
        const w = this.roomLayout.walls[wIdx];
        let tmin = 0.5;
        let tmax = bestT;
        let nx = 0;
        let ny = 0;

        if (Math.abs(dx) < 1e-6) {
          if (ox < w.x || ox > w.x + w.w) continue;
        } else {
          const invDx = 1 / dx;
          let t1 = (w.x - ox) * invDx;
          let t2 = (w.x + w.w - ox) * invDx;
          let candNx = -1;
          if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
            candNx = 1;
          }
          if (t1 > tmin) {
            tmin = t1;
            nx = candNx;
            ny = 0;
          }
          if (t2 < tmax) tmax = t2;
          if (tmin > tmax) continue;
        }

        if (Math.abs(dy) < 1e-6) {
          if (oy < w.y || oy > w.y + w.h) continue;
        } else {
          const invDy = 1 / dy;
          let t1 = (w.y - oy) * invDy;
          let t2 = (w.y + w.h - oy) * invDy;
          let candNy = -1;
          if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
            candNy = 1;
          }
          if (t1 > tmin) {
            tmin = t1;
            nx = 0;
            ny = candNy;
          }
          if (t2 < tmax) tmax = t2;
          if (tmin > tmax) continue;
        }

        if (tmin > 0.5 && tmin < bestT && (nx !== 0 || ny !== 0)) {
          bestT = tmin;
          hitNx = nx;
          hitNy = ny;
        }
      }

      if (!Number.isFinite(bestT)) break;
      const hx = ox + dx * bestT;
      const hy = oy + dy * bestT;
      segments.push({ x1: ox, y1: oy, x2: hx, y2: hy });

      if (hitNx !== 0) dx = -dx;
      if (hitNy !== 0) dy = -dy;
      ox = hx + hitNx * 0.8;
      oy = hy + hitNy * 0.8;
    }

    return segments;
  }

  private spawnPoisonGasFromWalls(): void {
    const { innerLeft, innerTop, innerRight, innerBottom } = this.arena;
    const innerW = innerRight - innerLeft;
    const innerH = innerBottom - innerTop;

    const pattern = Math.random() < 0.5 ? 'SIDES' : 'TOP_BOTTOM';
    const bandThickness = 115;

    if (pattern === 'SIDES') {
      this.poisonZones.push(
        {
          x: innerLeft,
          y: innerTop,
          w: bandThickness,
          h: innerH,
          wallSide: 'LEFT',
          telegraphTimer: 0.95,
          activeTimer: 4.4,
          maxActiveTimer: 4.4,
          damagePerTick: 38,
        },
        {
          x: innerRight - bandThickness,
          y: innerTop,
          w: bandThickness,
          h: innerH,
          wallSide: 'RIGHT',
          telegraphTimer: 0.95,
          activeTimer: 4.4,
          maxActiveTimer: 4.4,
          damagePerTick: 38,
        }
      );
    } else {
      this.poisonZones.push(
        {
          x: innerLeft,
          y: innerTop,
          w: innerW,
          h: bandThickness,
          wallSide: 'TOP',
          telegraphTimer: 0.95,
          activeTimer: 4.4,
          maxActiveTimer: 4.4,
          damagePerTick: 38,
        },
        {
          x: innerLeft,
          y: innerBottom - bandThickness,
          w: innerW,
          h: bandThickness,
          wallSide: 'BOTTOM',
          telegraphTimer: 0.95,
          activeTimer: 4.4,
          maxActiveTimer: 4.4,
          damagePerTick: 38,
        }
      );
    }
  }

  private updatePoisonZones(dt: number): void {
    const p = this.player;
    for (let i = this.poisonZones.length - 1; i >= 0; i--) {
      const z = this.poisonZones[i];
      if (z.telegraphTimer > 0) {
        z.telegraphTimer = Math.max(0, z.telegraphTimer - dt);
        continue;
      }

      z.activeTimer -= dt;
      if (z.activeTimer <= 0) {
        this.poisonZones.splice(i, 1);
        continue;
      }

      // Check if player stands inside green poison gas
      if (
        this.phase === 'PLAYING' &&
        p.x >= z.x &&
        p.x <= z.x + z.w &&
        p.y >= z.y &&
        p.y <= z.y + z.h &&
        p.poisonTickTimer <= 0
      ) {
        p.poisonTickTimer = 0.45;
        this.damagePlayerGradualPoison(z.damagePerTick);
      }
    }
  }

  private damagePlayerGradualPoison(amount: number): void {
    const p = this.player;
    if (this.phase !== 'PLAYING') return;

    p.hp = Math.max(0, p.hp - amount);
    p.hitFlashTimer = 0.1;

    this.floatingTexts.push({
      x: p.x + (Math.random() - 0.5) * 14,
      y: p.y - 20,
      vy: -36,
      text: `-${amount} ЯД`,
      color: '#4ade80',
      life: 0,
      maxLife: 0.65,
      scale: 0.95,
    });

    if (p.hp <= 0) {
      this.clearInputs();
      this.phase = 'DEFEAT';
      this.spawnSparkBurst(p.x, p.y, '#4ade80', '#16a34a', 24, 240);
      this.sound.playDefeat();
      this.emitHud(true);
    } else {
      this.emitHudIfChanged();
    }
  }

  private spawnFloorHazardNearPlayer(
    kind: FloorHazard['kind'],
    radius: number,
    telegraphTimer: number,
    activeTimer: number,
    damage: number,
    pullStrength: number,
    jitterRadius = 110
  ): void {
    const { innerLeft, innerTop, innerRight, innerBottom } = this.arena;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * jitterRadius;
    const hx = Math.max(
      innerLeft + radius + 16,
      Math.min(innerRight - radius - 16, this.player.x + Math.cos(angle) * dist)
    );
    const hy = Math.max(
      innerTop + radius + 16,
      Math.min(innerBottom - radius - 16, this.player.y + Math.sin(angle) * dist)
    );
    this.floorHazards.push({
      id: this.nextEntityId++,
      kind,
      x: hx,
      y: hy,
      radius,
      telegraphTimer,
      maxTelegraphTimer: telegraphTimer,
      activeTimer,
      maxActiveTimer: activeTimer,
      damage,
      pullStrength,
      burstDone: false,
      tickTimer: 0,
    });
  }

  private updateFloorHazards(dt: number): void {
    const p = this.player;
    for (let i = this.floorHazards.length - 1; i >= 0; i--) {
      const h = this.floorHazards[i];
      if (h.telegraphTimer > 0) {
        h.telegraphTimer = Math.max(0, h.telegraphTimer - dt);
        if (h.telegraphTimer === 0) {
          if (h.kind === 'METEOR_STRIKE') {
            h.burstDone = true;
            this.sound.playImpactBurst();
            this.shakeIntensity = Math.max(this.shakeIntensity, 7);
            this.shockwaves.push({
              x: h.x,
              y: h.y,
              radius: 10,
              maxRadius: h.radius * 1.25,
              color: '#fbbf24',
              alpha: 0.9,
              lineWidth: 3.5,
              life: 0,
              maxLife: 0.35,
            });
            this.spawnSparkBurst(h.x, h.y, '#fde047', '#f97316', 14, 240, true);
            if (Math.hypot(p.x - h.x, p.y - h.y) <= h.radius + p.radius * 0.5) {
              this.damagePlayer(h.damage, h.x, h.y);
            }
            for (let k = 0; k < 4; k++) {
              const a = (k * Math.PI) / 2 + 0.35;
              this.projectiles.push(
                spawnCustomBossProjectile({
                  id: this.nextEntityId++,
                  x: h.x,
                  y: h.y,
                  vx: Math.cos(a) * 310,
                  vy: Math.sin(a) * 310,
                  radius: 10,
                  damage: 95,
                  palette: 'gold',
                  visualStyle: 'STAR',
                })
              );
            }
          } else if (h.kind === 'VOID_RIFT') {
            h.burstDone = true;
            this.sound.playImpactBurst();
            this.shockwaves.push({
              x: h.x,
              y: h.y,
              radius: h.radius,
              maxRadius: 8,
              color: '#c084fc',
              alpha: 0.95,
              lineWidth: 3.5,
              life: 0,
              maxLife: 0.32,
            });
            this.spawnSparkBurst(h.x, h.y, '#d8b4fe', '#7e22ce', 14, 250, true);
            if (Math.hypot(p.x - h.x, p.y - h.y) <= h.radius + p.radius * 0.4) {
              this.damagePlayer(h.damage, h.x, h.y);
            }
            for (let k = 0; k < 6; k++) {
              const a = (k * Math.PI * 2) / 6;
              this.projectiles.push(
                spawnCustomBossProjectile({
                  id: this.nextEntityId++,
                  x: h.x,
                  y: h.y,
                  vx: Math.cos(a) * 285,
                  vy: Math.sin(a) * 285,
                  radius: 9,
                  damage: 95,
                  palette: 'violet',
                  visualStyle: 'VOID_SHARD',
                })
              );
            }
          } else if (h.kind === 'GRAVITY_WELL') {
            this.sound.playGravityPulse();
          }
        }
        continue;
      }

      h.activeTimer -= dt;
      if (h.activeTimer <= 0) {
        if (h.kind === 'GRAVITY_WELL') {
          this.sound.playImpactBurst();
          this.shockwaves.push({
            x: h.x,
            y: h.y,
            radius: 10,
            maxRadius: h.radius * 1.4,
            color: '#38bdf8',
            alpha: 0.85,
            lineWidth: 3,
            life: 0,
            maxLife: 0.35,
          });
          for (let k = 0; k < 8; k++) {
            const a = (k * Math.PI * 2) / 8;
            this.projectiles.push(
              spawnCustomBossProjectile({
                id: this.nextEntityId++,
                x: h.x,
                y: h.y,
                vx: Math.cos(a) * 330,
                vy: Math.sin(a) * 330,
                radius: 9,
                damage: 100,
                palette: 'cyan',
                visualStyle: 'KINETIC_ORB',
              })
            );
          }
        }
        this.floorHazards.splice(i, 1);
        continue;
      }

      if (
        (h.kind === 'PLASMA_POOL' || h.kind === 'MOLTEN_POOL') &&
        this.phase === 'PLAYING' &&
        Math.hypot(p.x - h.x, p.y - h.y) <= h.radius + p.radius * 0.35 &&
        p.poisonTickTimer <= 0
      ) {
        p.poisonTickTimer = 0.45;
        this.damagePlayerGradualPoison(h.damage);
      }
    }
  }

  private createVectorGridLasers(isTelegraph: boolean): LaserBeam[] {
    const { innerLeft, innerTop, innerRight, innerBottom } = this.arena;
    const xs = [innerLeft + (innerRight - innerLeft) * 0.33, innerLeft + (innerRight - innerLeft) * 0.67];
    const ys = [innerTop + (innerBottom - innerTop) * 0.36, innerTop + (innerBottom - innerTop) * 0.68];
    const beams: LaserBeam[] = [];
    for (const x of xs) {
      beams.push({
        segments: [{ x1: x, y1: innerTop, x2: x, y2: innerBottom }],
        isTelegraph,
        isUltra: false,
        damage: 175,
        width: 8,
        colorTheme: 'GRID',
      });
    }
    for (const y of ys) {
      beams.push({
        segments: [{ x1: innerLeft, y1: y, x2: innerRight, y2: y }],
        isTelegraph,
        isUltra: false,
        damage: 175,
        width: 8,
        colorTheme: 'GRID',
      });
    }
    return beams;
  }

  private spawnMagnetSpears(count: number): void {
    const { innerLeft, innerTop, innerRight, innerBottom } = this.arena;
    const cx = (innerLeft + innerRight) * 0.5;
    const cy = (innerTop + innerBottom) * 0.5;
    for (let k = 0; k < count; k++) {
      const perimeterAngle = (k * Math.PI * 2) / count + Math.random() * 0.2;
      const sx = Math.max(
        innerLeft + 34,
        Math.min(innerRight - 34, cx + Math.cos(perimeterAngle) * 510)
      );
      const sy = Math.max(
        innerTop + 34,
        Math.min(innerBottom - 34, cy + Math.sin(perimeterAngle) * 300)
      );
      const aimToPlayer = Math.atan2(this.player.y - sy, this.player.x - sx);
      const spear = spawnCustomBossProjectile({
        id: this.nextEntityId++,
        x: sx,
        y: sy,
        vx: Math.cos(aimToPlayer) * 1,
        vy: Math.sin(aimToPlayer) * 1,
        radius: 11,
        damage: 140,
        palette: 'steel',
        visualStyle: 'IRON_SPEAR',
        spinSpeed: 0,
        delayedLaunchTimer: 0.9,
        delayedSpeed: 760,
      });
      spear.rotation = aimToPlayer;
      spear.vx = 0;
      spear.vy = 0;
      this.projectiles.push(spear);
    }
  }

  private triggerBossAttackStart(b: BossState, nextAtk: BossAttackType): void {
    b.lastAttack = nextAtk;
    b.currentAttack = nextAtk;
    b.attackCounter++;
    b.pullForceToBoss = 0;

    // Zero-delay Ultra Attacks for all 6 archetypes
    if (
      nextAtk === 'ULTRA_RAGE_LASERS' ||
      nextAtk === 'STAR_BINARY_ECLIPSE' ||
      nextAtk === 'PLASMA_OVERLOAD' ||
      nextAtk === 'PHYS_ENTROPY_COLLAPSE' ||
      nextAtk === 'METAL_BLADE_STORM' ||
      nextAtk === 'BH_EVENT_HORIZON'
    ) {
      b.isEnraged = true;
      this.shakeIntensity = 11;
      this.sound.playUltraRage();

      if (nextAtk === 'ULTRA_RAGE_LASERS') {
        b.behavior = 'FIRING';
        b.laserChannelTimer = 2.25;
        const baseAngle = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        b.activeLasers = [-0.52, 0, 0.52].map((off) => ({
          segments: this.computeBouncingLaserSegments(b.x, b.y, baseAngle + off, 3),
          isTelegraph: false,
          isUltra: true,
          damage: 210,
          width: 9,
          colorTheme: 'ULTRA',
        }));
        this.sound.playLaserBeam(true);
      } else if (nextAtk === 'STAR_BINARY_ECLIPSE') {
        b.behavior = 'FIRING';
        b.laserChannelTimer = 2.1;
        const baseAngle = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        b.activeLasers = [-0.45, 0.45].map((off, idx) => ({
          segments: this.computeBouncingLaserSegments(b.x, b.y, baseAngle + off, 1),
          isTelegraph: false,
          isUltra: true,
          damage: 175,
          width: 9,
          colorTheme: 'SOLAR',
          originX: b.x,
          originY: b.y,
          angle: baseAngle + off,
          angularSpeed: idx === 0 ? 0.55 : -0.55,
          maxBounces: 1,
        }));
        for (let k = 0; k < 14; k++) {
          const a = (k * Math.PI * 2) / 14;
          this.projectiles.push(
            spawnCustomBossProjectile({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              vx: Math.cos(a) * 330,
              vy: Math.sin(a) * 330,
              radius: 12,
              damage: 115,
              palette: 'gold',
              visualStyle: 'STAR',
            })
          );
        }
        for (let m = 0; m < 4; m++) {
          this.spawnFloorHazardNearPlayer('METEOR_STRIKE', 56, 0.85, 0.25, 145, 0, 140);
        }
        this.sound.playLaserBeam(true);
      } else if (nextAtk === 'PLASMA_OVERLOAD') {
        b.behavior = 'FIRING';
        b.laserChannelTimer = 1.6;
        const baseA = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        b.activeLasers = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((off) => ({
          segments: this.computeBouncingLaserSegments(b.x, b.y, baseA + off, 1),
          isTelegraph: false,
          isUltra: true,
          damage: 165,
          width: 8,
          colorTheme: 'PLASMA',
        }));
        for (let k = 0; k < 14; k++) {
          const a = (k * Math.PI * 2) / 14;
          this.projectiles.push(
            spawnCustomBossProjectile({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              vx: Math.cos(a) * 370,
              vy: Math.sin(a) * 370,
              radius: 10,
              damage: 115,
              palette: 'magenta',
              visualStyle: 'PLASMA_SHARD',
              bounces: 3,
            })
          );
        }
        for (let m = 0; m < 4; m++) {
          this.spawnFloorHazardNearPlayer('PLASMA_POOL', 58, 0.75, 4.2, 36, 0, 170);
        }
        this.sound.playLaserBeam(true);
      } else if (nextAtk === 'PHYS_ENTROPY_COLLAPSE') {
        b.behavior = 'FIRING';
        b.laserChannelTimer = 1.6;
        b.activeLasers = this.createVectorGridLasers(false);
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI * 2) / 8 + 0.2;
          this.projectiles.push(
            spawnCustomBossProjectile({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              vx: Math.cos(a) * 390,
              vy: Math.sin(a) * 390,
              radius: 11,
              damage: 120,
              palette: 'cyan',
              visualStyle: 'KINETIC_ORB',
              bounces: 6,
              bounceSpeedGain: 1.06,
            })
          );
        }
        this.sound.playLaserBeam(true);
      } else if (nextAtk === 'METAL_BLADE_STORM') {
        b.behavior = 'FIRING';
        b.shotsRemaining = 1;
        b.shotIntervalTimer = 0.8;
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI * 2) / 6 + 0.15;
          this.projectiles.push(
            spawnCustomBossProjectile({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              vx: Math.cos(a) * 380,
              vy: Math.sin(a) * 380,
              radius: 17,
              damage: 135,
              palette: 'orange',
              visualStyle: 'SAWBLADE',
              spinSpeed: 15,
              bounces: 4,
            })
          );
        }
        this.spawnMagnetSpears(6);
      } else if (nextAtk === 'BH_EVENT_HORIZON') {
        b.behavior = 'FIRING';
        b.laserChannelTimer = 2.3;
        b.pullForceToBoss = 155;
        const baseA = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        b.activeLasers = [0, Math.PI].map((off) => ({
          segments: this.computeBouncingLaserSegments(b.x, b.y, baseA + off, 0),
          isTelegraph: false,
          isUltra: true,
          damage: 185,
          width: 14,
          colorTheme: 'VOID',
          originX: b.x,
          originY: b.y,
          angle: baseA + off,
          angularSpeed: 0.62,
          maxBounces: 0,
        }));
        for (let k = 0; k < 10; k++) {
          const a = (k * Math.PI * 2) / 10;
          this.projectiles.push(
            spawnCustomBossProjectile({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              vx: Math.cos(a) * 265,
              vy: Math.sin(a) * 265,
              radius: 11,
              damage: 120,
              palette: 'violet',
              visualStyle: 'DARK_ORB',
              homingStrength: 1.85,
              homingTimer: 1.4,
            })
          );
        }
        this.sound.playGravityPulse();
      }
      this.emitHud(true);
      return;
    }

    // Standard Telegraphs for all 6 bosses
    b.behavior = 'TELEGRAPH';
    b.telegraphProgress = 0;

    if (nextAtk === 'BOUNCE_LASER') {
      b.stateTimer = 0.95;
      b.laserAimAngle = Math.atan2(this.player.y - b.y, this.player.x - b.x);
      b.activeLasers = [
        {
          segments: this.computeBouncingLaserSegments(b.x, b.y, b.laserAimAngle, 3),
          isTelegraph: true,
          isUltra: false,
          damage: 200,
          width: 8,
          colorTheme: 'CYAN',
        },
      ];
      this.sound.playTelegraph(false);
    } else if (nextAtk === 'STAR_SOLAR_FLARE') {
      b.stateTimer = 0.85;
      const baseA = Math.atan2(this.player.y - b.y, this.player.x - b.x);
      b.laserAimAngle = baseA;
      b.activeLasers = [-0.55, 0, 0.55].map((off) => ({
        segments: this.computeBouncingLaserSegments(b.x, b.y, baseA + off, 0),
        isTelegraph: true,
        isUltra: false,
        damage: 170,
        width: 9,
        colorTheme: 'SOLAR',
        originX: b.x,
        originY: b.y,
        angle: baseA + off,
        angularSpeed: 0.45,
        maxBounces: 0,
      }));
      this.sound.playTelegraph(false);
    } else if (nextAtk === 'PLASMA_LIGHTNING_WEB') {
      b.stateTimer = 0.82;
      const baseA = Math.atan2(this.player.y - b.y, this.player.x - b.x);
      b.laserAimAngle = baseA;
      b.activeLasers = [-0.6, -0.2, 0.2, 0.6].map((off) => ({
        segments: this.computeBouncingLaserSegments(b.x, b.y, baseA + off, 1),
        isTelegraph: true,
        isUltra: false,
        damage: 165,
        width: 7,
        colorTheme: 'PLASMA',
      }));
      this.sound.playTelegraph(true);
    } else if (nextAtk === 'PHYS_VECTOR_GRID') {
      b.stateTimer = 0.92;
      b.activeLasers = this.createVectorGridLasers(true);
      this.sound.playTelegraph(false);
    } else if (nextAtk === 'BH_HAWKING_JETS') {
      b.stateTimer = 0.88;
      const baseA = Math.atan2(this.player.y - b.y, this.player.x - b.x);
      b.laserAimAngle = baseA;
      b.activeLasers = [0, Math.PI].map((off) => ({
        segments: this.computeBouncingLaserSegments(b.x, b.y, baseA + off, 0),
        isTelegraph: true,
        isUltra: false,
        damage: 185,
        width: 14,
        colorTheme: 'VOID',
        originX: b.x,
        originY: b.y,
        angle: baseA + off,
        angularSpeed: 0.55,
        maxBounces: 0,
      }));
      this.sound.playGravityPulse();
    } else if (nextAtk === 'PLASMA_MUTATION_DASH' || nextAtk === 'METAL_ANVIL_SLAM') {
      b.stateTimer = 0.68;
      const dx = this.player.x - b.x;
      const dy = this.player.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      const clampDist = Math.min(390, Math.max(180, dist));
      b.dashTargetX = Math.max(
        this.arena.innerLeft + b.radius + 16,
        Math.min(this.arena.innerRight - b.radius - 16, b.x + (dx / dist) * clampDist)
      );
      b.dashTargetY = Math.max(
        this.arena.innerTop + b.radius + 16,
        Math.min(this.arena.innerBottom - b.radius - 16, b.y + (dy / dist) * clampDist)
      );
      this.sound.playTelegraph(true);
    } else if (nextAtk === 'POISON_GAS') {
      b.stateTimer = 0.65;
      this.spawnPoisonGasFromWalls();
      this.sound.playPoisonGas();
    } else {
      b.stateTimer = 0.68;
      this.sound.playTelegraph(
        nextAtk === 'RED_RICOCHET_STARS' || nextAtk === 'RED_STAR_SPRAY'
      );
    }
  }

  private beginBossFiringPhase(b: BossState): void {
    b.behavior = 'FIRING';
    b.telegraphProgress = 1;

    switch (b.currentAttack) {
      case 'NORMAL_STARS':
      case 'RED_RICOCHET_STARS':
        b.shotsRemaining = 5;
        b.shotIntervalTimer = 0;
        break;
      case 'RED_STAR_SPRAY':
        b.shotsRemaining = 12;
        b.shotIntervalTimer = 0;
        b.sprayAngleOffset = 0;
        break;
      case 'BOUNCE_LASER':
        b.laserChannelTimer = 2.05;
        b.activeLasers = [
          {
            segments: this.computeBouncingLaserSegments(b.x, b.y, b.laserAimAngle, 3),
            isTelegraph: false,
            isUltra: false,
            damage: 200,
            width: 9,
            colorTheme: 'CYAN',
          },
        ];
        this.sound.playLaserBeam(false);
        break;
      case 'POISON_GAS':
        b.stateTimer = 0.5;
        break;

      // 1. STAR
      case 'STAR_SUPERNOVA_RING':
        b.shotsRemaining = 2;
        b.shotIntervalTimer = 0;
        break;
      case 'STAR_SOLAR_FLARE':
        b.laserChannelTimer = 2.2;
        b.activeLasers = b.activeLasers.map((l) => ({ ...l, isTelegraph: false }));
        this.sound.playLaserBeam(false);
        break;
      case 'STAR_METEOR_RAIN':
        b.shotsRemaining = 7;
        b.shotIntervalTimer = 0;
        break;
      case 'STAR_CONSTELLATION_ORB':
        b.shotsRemaining = 3;
        b.shotIntervalTimer = 0;
        break;
      case 'STAR_CROSS_PULSAR':
        b.shotsRemaining = 9;
        b.shotIntervalTimer = 0;
        b.pulsarAngle = 0;
        break;

      // 2. METAPLASM
      case 'PLASMA_SPLIT_ORBS':
        b.shotsRemaining = 1;
        b.shotIntervalTimer = 0;
        break;
      case 'PLASMA_LIGHTNING_WEB':
        b.laserChannelTimer = 1.65;
        b.activeLasers = b.activeLasers.map((l) => ({ ...l, isTelegraph: false }));
        this.sound.playLaserBeam(true);
        break;
      case 'PLASMA_PUDDLE_ERUPTION':
        for (let k = 0; k < 5; k++) {
          this.spawnFloorHazardNearPlayer('PLASMA_POOL', 54, 0.85, 4.5, 36, 0, 175);
        }
        b.stateTimer = 0.45;
        this.sound.playPoisonGas();
        break;
      case 'PLASMA_MUTATION_DASH': {
        b.shotsRemaining = 2;
        b.dashTimer = 0.5;
        b.dashVx = (b.dashTargetX - b.x) / 0.5;
        b.dashVy = (b.dashTargetY - b.y) / 0.5;
        b.dashDropsTrail = true;
        b.dashTrailAccum = 0;
        b.dashSlamOnEnd = false;
        this.sound.playBossDash();
        break;
      }
      case 'PLASMA_SIPHON_SPIRAL':
        b.shotsRemaining = 10;
        b.shotIntervalTimer = 0;
        b.sprayAngleOffset = 0;
        break;

      // 3. PHYSICS
      case 'PHYS_KINETIC_IMPULSE': {
        this.sound.playImpactBurst();
        this.shakeIntensity = 10;
        this.shockwaves.push({
          x: b.x,
          y: b.y,
          radius: b.radius,
          maxRadius: 420,
          color: '#22d3ee',
          alpha: 0.95,
          lineWidth: 4,
          life: 0,
          maxLife: 0.48,
        });
        const dx = this.player.x - b.x;
        const dy = this.player.y - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 420) {
          const push = Math.max(90, 220 * (1 - dist / 460));
          const pushed = this.resolveCircleObstacleCollisions(
            this.player.x + (dx / dist) * push,
            this.player.y + (dy / dist) * push,
            this.player.radius,
            true
          );
          this.player.x = pushed.x;
          this.player.y = pushed.y;
        }
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI * 2) / 12;
          this.projectiles.push(
            spawnCustomBossProjectile({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              vx: Math.cos(a) * 340,
              vy: Math.sin(a) * 340,
              radius: 10,
              damage: 110,
              palette: 'cyan',
              visualStyle: 'KINETIC_ORB',
            })
          );
        }
        b.stateTimer = 0.55;
        break;
      }
      case 'PHYS_PENDULUM_SWEEP':
        b.shotsRemaining = 10;
        b.shotIntervalTimer = 0;
        b.sprayAngleOffset = -0.85;
        b.waveDir = 1;
        break;
      case 'PHYS_RICOCHET_COLLIDER':
        for (let k = 0; k < 6; k++) {
          const base = Math.atan2(this.player.y - b.y, this.player.x - b.x);
          const a = base + (k - 2.5) * 0.36;
          this.projectiles.push(
            spawnCustomBossProjectile({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              vx: Math.cos(a) * 355,
              vy: Math.sin(a) * 355,
              radius: 11,
              damage: 120,
              palette: 'cyan',
              visualStyle: 'KINETIC_ORB',
              bounces: 6,
              bounceSpeedGain: 1.07,
            })
          );
        }
        this.sound.playBossStarLaunch(true);
        b.stateTimer = 0.65;
        break;
      case 'PHYS_GRAVITY_TRAP':
        for (let k = 0; k < 2; k++) {
          this.spawnFloorHazardNearPlayer('GRAVITY_WELL', 74, 0.75, 2.1, 100, 175, 130);
        }
        this.sound.playGravityPulse();
        b.stateTimer = 0.6;
        break;
      case 'PHYS_VECTOR_GRID':
        b.laserChannelTimer = 1.45;
        b.activeLasers = this.createVectorGridLasers(false);
        this.sound.playLaserBeam(false);
        break;

      // 4. METAL
      case 'METAL_SAWBLADES':
        for (let k = 0; k < 4; k++) {
          const base = Math.atan2(this.player.y - b.y, this.player.x - b.x);
          const a = base + (k - 1.5) * 0.42;
          this.projectiles.push(
            spawnCustomBossProjectile({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              vx: Math.cos(a) * 365,
              vy: Math.sin(a) * 365,
              radius: 17,
              damage: 135,
              palette: 'orange',
              visualStyle: 'SAWBLADE',
              spinSpeed: 14,
              bounces: 4,
            })
          );
        }
        this.sound.playBossStarLaunch(true);
        b.stateTimer = 0.65;
        break;
      case 'METAL_ANVIL_SLAM':
        b.dashTimer = 0.42;
        b.dashVx = (b.dashTargetX - b.x) / 0.42;
        b.dashVy = (b.dashTargetY - b.y) / 0.42;
        b.dashDropsTrail = false;
        b.dashSlamOnEnd = true;
        this.sound.playBossDash();
        break;
      case 'METAL_SHRAPNEL_CONE':
        b.shotsRemaining = 3;
        b.shotIntervalTimer = 0;
        break;
      case 'METAL_MAGNET_SPEARS':
        this.spawnMagnetSpears(6);
        this.sound.playTelegraph(true);
        b.stateTimer = 0.9;
        break;
      case 'METAL_MOLTEN_FORGE':
        for (let k = 0; k < 3; k++) {
          this.spawnFloorHazardNearPlayer('MOLTEN_POOL', 58, 0.85, 4.2, 38, 0, 150);
        }
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI * 2) / 8 + 0.2;
          this.projectiles.push(
            spawnCustomBossProjectile({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              vx: Math.cos(a) * 310,
              vy: Math.sin(a) * 310,
              radius: 10,
              damage: 105,
              palette: 'orange',
              visualStyle: 'SHRAPNEL',
              spinSpeed: 8,
            })
          );
        }
        this.sound.playImpactBurst();
        b.stateTimer = 0.55;
        break;

      // 5. BLACK_HOLE
      case 'BH_SINGULARITY_PULL':
        b.pullForceToBoss = 145;
        b.shotsRemaining = 8;
        b.shotIntervalTimer = 0;
        b.pulsarAngle = 0;
        this.sound.playGravityPulse();
        break;
      case 'BH_ACCRETION_ORBIT':
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI * 2) / 6;
          this.projectiles.push(
            spawnCustomBossProjectile({
              id: this.nextEntityId++,
              x: b.x + Math.cos(a) * 56,
              y: b.y + Math.sin(a) * 56,
              vx: 0,
              vy: 0,
              radius: 12,
              damage: 120,
              palette: 'gold',
              visualStyle: 'VOID_SHARD',
              orbitBoss: true,
              orbitRadius: 56,
              orbitAngle: a,
              orbitAngularSpeed: 2.55,
              orbitExpandRate: 78,
              maxLifetime: 4.5,
            })
          );
        }
        this.sound.playGravityPulse();
        b.stateTimer = 0.9;
        break;
      case 'BH_VOID_RIFTS':
        b.shotsRemaining = 5;
        b.shotIntervalTimer = 0;
        break;
      case 'BH_HAWKING_JETS':
        b.laserChannelTimer = 2.3;
        b.activeLasers = b.activeLasers.map((l) => ({ ...l, isTelegraph: false }));
        this.sound.playLaserBeam(true);
        break;
      case 'BH_DARK_MATTER_BARRAGE':
        for (let k = 0; k < 8; k++) {
          const base = Math.atan2(this.player.y - b.y, this.player.x - b.x);
          const a = base + (k - 3.5) * 0.44;
          this.projectiles.push(
            spawnCustomBossProjectile({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              vx: Math.cos(a) * 260,
              vy: Math.sin(a) * 260,
              radius: 11,
              damage: 115,
              palette: 'violet',
              visualStyle: 'DARK_ORB',
              homingStrength: 2.1,
              homingTimer: 1.45,
            })
          );
        }
        this.sound.playBossStarLaunch(true);
        b.stateTimer = 0.65;
        break;
    }
  }

  private updateBoss(dt: number): void {
    const b = this.boss;
    if (!b.alive) return;

    b.ringRotation += dt * (b.isEnraged ? 1.8 : b.behavior === 'TELEGRAPH' ? 2.4 : 0.7);
    b.innerRingRotation -= dt * (b.isEnraged ? 2.4 : b.behavior === 'FIRING' ? 2.1 : 0.95);

    if (b.hitFlashTimer > 0) {
      b.hitFlashTimer = Math.max(0, b.hitFlashTimer - dt);
    }

    if (b.burnTimer > 0) {
      b.burnTimer = Math.max(0, b.burnTimer - dt);
      b.burnTickTimer -= dt;
      if (b.burnTickTimer <= 0) {
        b.burnTickTimer = 0.5;
        this.applyDotDamageToBoss(b.burnDamagePerTick);
        if (!b.alive) return;
      }
    }

    const isDashing = b.dashTimer > 0 && b.behavior === 'FIRING';
    const isStationary =
      (b.currentAttack === 'BOUNCE_LASER' ||
        b.currentAttack === 'ULTRA_RAGE_LASERS' ||
        b.currentAttack === 'STAR_SOLAR_FLARE' ||
        b.currentAttack === 'STAR_CROSS_PULSAR' ||
        b.currentAttack === 'PLASMA_LIGHTNING_WEB' ||
        b.currentAttack === 'BH_HAWKING_JETS' ||
        b.currentAttack === 'BH_EVENT_HORIZON') &&
      (b.behavior === 'TELEGRAPH' || b.behavior === 'FIRING');

    if (isDashing) {
      b.dashTimer -= dt;
      const resolved = this.resolveCircleObstacleCollisions(
        b.x + b.dashVx * dt,
        b.y + b.dashVy * dt,
        b.radius,
        false
      );
      b.x = resolved.x;
      b.y = resolved.y;

      if (b.dashDropsTrail) {
        b.dashTrailAccum += dt;
        if (b.dashTrailAccum >= 0.14) {
          b.dashTrailAccum = 0;
          this.floorHazards.push({
            id: this.nextEntityId++,
            kind: 'PLASMA_POOL',
            x: b.x,
            y: b.y,
            radius: 42,
            telegraphTimer: 0.25,
            maxTelegraphTimer: 0.25,
            activeTimer: 3.4,
            maxActiveTimer: 3.4,
            damage: 34,
            pullStrength: 0,
            burstDone: false,
            tickTimer: 0,
          });
        }
      }

      if (b.dashTimer <= 0) {
        if (b.dashSlamOnEnd) {
          this.sound.playImpactBurst();
          this.shakeIntensity = 12;
          this.shockwaves.push({
            x: b.x,
            y: b.y,
            radius: b.radius,
            maxRadius: 230,
            color: '#fb923c',
            alpha: 0.95,
            lineWidth: 4,
            life: 0,
            maxLife: 0.42,
          });
          if (Math.hypot(this.player.x - b.x, this.player.y - b.y) <= 135) {
            this.damagePlayer(145, this.player.x, this.player.y);
          }
          for (let k = 0; k < 10; k++) {
            const a = (k * Math.PI * 2) / 10;
            this.projectiles.push(
              spawnCustomBossProjectile({
                id: this.nextEntityId++,
                x: b.x,
                y: b.y,
                vx: Math.cos(a) * 355,
                vy: Math.sin(a) * 355,
                radius: 10,
                damage: 105,
                palette: 'orange',
                visualStyle: 'SHRAPNEL',
                spinSpeed: 10,
              })
            );
          }
          b.behavior = 'COOLDOWN';
          b.stateTimer = 0.85;
        } else if (b.currentAttack === 'PLASMA_MUTATION_DASH') {
          b.shotsRemaining--;
          if (b.shotsRemaining > 0) {
            const dx = this.player.x - b.x;
            const dy = this.player.y - b.y;
            const dist = Math.hypot(dx, dy) || 1;
            const clampDist = Math.min(380, Math.max(180, dist));
            b.dashTargetX = Math.max(
              this.arena.innerLeft + b.radius + 16,
              Math.min(this.arena.innerRight - b.radius - 16, b.x + (dx / dist) * clampDist)
            );
            b.dashTargetY = Math.max(
              this.arena.innerTop + b.radius + 16,
              Math.min(this.arena.innerBottom - b.radius - 16, b.y + (dy / dist) * clampDist)
            );
            b.dashTimer = 0.5;
            b.dashVx = (b.dashTargetX - b.x) / 0.5;
            b.dashVy = (b.dashTargetY - b.y) / 0.5;
            this.sound.playBossDash();
          } else {
            b.behavior = 'COOLDOWN';
            b.stateTimer = 0.85;
          }
        }
      }
    } else if (!isStationary) {
      b.patrolAngle += dt * (b.isEnraged ? 0.72 : 0.48);
      const targetX = b.anchorX + Math.sin(b.patrolAngle) * 195;
      const targetY = b.anchorY + Math.sin(b.patrolAngle * 2) * 38;
      const followRate = b.behavior === 'FIRING' ? 1.1 : 2.2;
      b.x += (targetX - b.x) * Math.min(1, dt * followRate);
      b.y += (targetY - b.y) * Math.min(1, dt * followRate);
    }

    switch (b.behavior) {
      case 'IDLE': {
        b.activeLasers = [];
        b.pullForceToBoss = 0;
        b.stateTimer -= dt;
        if (b.stateTimer <= 0) {
          const nextAtk = chooseNextBossAttack(b);
          this.triggerBossAttackStart(b, nextAtk);
        }
        break;
      }

      case 'TELEGRAPH': {
        b.stateTimer -= dt;
        const maxT = b.currentAttack === 'BOUNCE_LASER' ? 0.95 : 0.72;
        b.telegraphProgress = Math.min(1, 1 - b.stateTimer / maxT);

        if (b.currentAttack === 'BOUNCE_LASER') {
          if (b.stateTimer > 0.35) {
            b.laserAimAngle = Math.atan2(this.player.y - b.y, this.player.x - b.x);
          }
          b.activeLasers = [
            {
              segments: this.computeBouncingLaserSegments(b.x, b.y, b.laserAimAngle, 3),
              isTelegraph: true,
              isUltra: false,
              damage: 200,
              width: 8,
              colorTheme: 'CYAN',
            },
          ];
        }

        if (b.stateTimer <= 0) {
          this.beginBossFiringPhase(b);
        }
        break;
      }

      case 'FIRING': {
        if (b.dashTimer > 0) break;

        if (b.activeLasers.length > 0) {
          b.laserChannelTimer -= dt;
          for (let lIdx = 0; lIdx < b.activeLasers.length; lIdx++) {
            const beam = b.activeLasers[lIdx];
            if (beam.isTelegraph) continue;
            if (beam.angularSpeed && beam.angle !== undefined) {
              beam.angle += beam.angularSpeed * dt;
              beam.segments = this.computeBouncingLaserSegments(
                b.x,
                b.y,
                beam.angle,
                beam.maxBounces ?? 0
              );
            }
            for (let sIdx = 0; sIdx < beam.segments.length; sIdx++) {
              const seg = beam.segments[sIdx];
              const d = distPointToSegment(
                this.player.x,
                this.player.y,
                seg.x1,
                seg.y1,
                seg.x2,
                seg.y2
              );
              if (d <= this.player.radius + beam.width * 0.55) {
                this.damagePlayer(beam.damage, this.player.x, this.player.y);
                break;
              }
            }
          }

          if (b.laserChannelTimer <= 0) {
            b.activeLasers = [];
            b.pullForceToBoss = 0;
            b.behavior = 'COOLDOWN';
            b.stateTimer = 0.85;
          }
          break;
        }

        if (b.shotsRemaining <= 0) {
          b.stateTimer -= dt;
          if (b.stateTimer <= 0) {
            b.pullForceToBoss = 0;
            b.behavior = 'COOLDOWN';
            b.stateTimer = 0.8;
          }
          break;
        }

        b.shotIntervalTimer -= dt;
        if (b.shotIntervalTimer <= 0 && b.shotsRemaining > 0) {
          if (b.currentAttack === 'NORMAL_STARS') {
            const shotIndex = 5 - b.shotsRemaining;
            const palette = NORMAL_PALETTES[shotIndex % NORMAL_PALETTES.length];
            this.projectiles.push(
              spawnNormalBossStar(this.nextEntityId++, b, this.player, palette)
            );
            this.sound.playBossStarLaunch(false);
            b.shotIntervalTimer = 0.22;
          } else if (b.currentAttack === 'RED_RICOCHET_STARS') {
            const aimAngle = Math.atan2(this.player.y - b.y, this.player.x - b.x);
            this.projectiles.push(
              spawnRedRicochetStar(this.nextEntityId++, b, aimAngle, 5, 385, 135)
            );
            this.sound.playBossStarLaunch(true);
            b.shotIntervalTimer = 0.26;
          } else if (b.currentAttack === 'RED_STAR_SPRAY') {
            const clusterCount = 7;
            const baseAngle =
              Math.atan2(this.player.y - b.y, this.player.x - b.x) +
              Math.sin(b.sprayAngleOffset) * 0.35;
            const spread = Math.PI * 1.45;
            for (let k = 0; k < clusterCount; k++) {
              const angle = baseAngle - spread * 0.5 + (spread * k) / (clusterCount - 1);
              this.projectiles.push(
                spawnRedRicochetStar(this.nextEntityId++, b, angle, 1, 355, 115)
              );
            }
            b.sprayAngleOffset += 0.65;
            this.sound.playBossStarLaunch(true);
            b.shotIntervalTimer = 0.23;
          } else if (b.currentAttack === 'STAR_SUPERNOVA_RING') {
            const count = b.shotsRemaining === 2 ? 16 : 12;
            const offset = b.shotsRemaining === 2 ? 0 : Math.PI / 12;
            for (let k = 0; k < count; k++) {
              const a = offset + (k * Math.PI * 2) / count;
              this.projectiles.push(
                spawnCustomBossProjectile({
                  id: this.nextEntityId++,
                  x: b.x,
                  y: b.y,
                  vx: Math.cos(a) * 320,
                  vy: Math.sin(a) * 320,
                  radius: 12,
                  damage: 110,
                  palette: k % 2 === 0 ? 'gold' : 'white',
                  visualStyle: 'STAR',
                })
              );
            }
            this.sound.playBossStarLaunch(false);
            b.shotIntervalTimer = 0.38;
          } else if (b.currentAttack === 'STAR_METEOR_RAIN') {
            this.spawnFloorHazardNearPlayer('METEOR_STRIKE', 55, 0.85, 0.25, 145, 0, 135);
            this.sound.playTelegraph(false);
            b.shotIntervalTimer = 0.24;
          } else if (b.currentAttack === 'STAR_CONSTELLATION_ORB') {
            const aim = Math.atan2(this.player.y - b.y, this.player.x - b.x);
            const spread = (2 - b.shotsRemaining) * 0.32;
            this.projectiles.push(
              spawnCustomBossProjectile({
                id: this.nextEntityId++,
                x: b.x,
                y: b.y,
                vx: Math.cos(aim + spread) * 265,
                vy: Math.sin(aim + spread) * 265,
                radius: 15,
                damage: 130,
                palette: 'gold',
                visualStyle: 'SOLAR_CORE',
                splitOnExpire: true,
                splitTimer: 1.05,
                splitCount: 6,
              })
            );
            this.sound.playBossStarLaunch(false);
            b.shotIntervalTimer = 0.32;
          } else if (b.currentAttack === 'STAR_CROSS_PULSAR') {
            for (let arm = 0; arm < 4; arm++) {
              const a = b.pulsarAngle + (arm * Math.PI) / 2;
              this.projectiles.push(
                spawnCustomBossProjectile({
                  id: this.nextEntityId++,
                  x: b.x,
                  y: b.y,
                  vx: Math.cos(a) * 340,
                  vy: Math.sin(a) * 340,
                  radius: 11,
                  damage: 105,
                  palette: 'gold',
                  visualStyle: 'STAR',
                })
              );
            }
            b.pulsarAngle += 0.26;
            this.sound.playBossStarLaunch(false);
            b.shotIntervalTimer = 0.24;
          } else if (b.currentAttack === 'PLASMA_SPLIT_ORBS') {
            const aim = Math.atan2(this.player.y - b.y, this.player.x - b.x);
            for (let k = -1; k <= 1; k++) {
              const a = aim + k * 0.42;
              this.projectiles.push(
                spawnCustomBossProjectile({
                  id: this.nextEntityId++,
                  x: b.x,
                  y: b.y,
                  vx: Math.cos(a) * 270,
                  vy: Math.sin(a) * 270,
                  radius: 15,
                  damage: 125,
                  palette: 'magenta',
                  visualStyle: 'PLASMA_BLOB',
                  splitOnExpire: true,
                  splitTimer: 1.15,
                  splitCount: 3,
                })
              );
            }
            this.sound.playBossStarLaunch(true);
            b.shotIntervalTimer = 0.45;
          } else if (b.currentAttack === 'PLASMA_SIPHON_SPIRAL') {
            const aim = Math.atan2(this.player.y - b.y, this.player.x - b.x);
            for (let side = -1; side <= 1; side += 2) {
              this.projectiles.push(
                spawnCustomBossProjectile({
                  id: this.nextEntityId++,
                  x: b.x,
                  y: b.y,
                  vx: Math.cos(aim) * 320,
                  vy: Math.sin(aim) * 320,
                  radius: 10,
                  damage: 100,
                  palette: side > 0 ? 'magenta' : 'cyan',
                  visualStyle: 'PLASMA_SHARD',
                  sineWobbleAmp: 185 * side,
                  sineWobbleFreq: 9,
                })
              );
            }
            this.sound.playBossStarLaunch(false);
            b.shotIntervalTimer = 0.16;
          } else if (b.currentAttack === 'PHYS_PENDULUM_SWEEP') {
            const aim = Math.atan2(this.player.y - b.y, this.player.x - b.x);
            const a = aim + b.sprayAngleOffset;
            this.projectiles.push(
              spawnCustomBossProjectile({
                id: this.nextEntityId++,
                x: b.x,
                y: b.y,
                vx: Math.cos(a) * 195,
                vy: Math.sin(a) * 195,
                radius: 11,
                damage: 110,
                palette: 'cyan',
                visualStyle: 'KINETIC_ORB',
                accelRate: 0.85,
              })
            );
            b.sprayAngleOffset += 0.2 * b.waveDir;
            this.sound.playBossStarLaunch(false);
            b.shotIntervalTimer = 0.14;
          } else if (b.currentAttack === 'METAL_SHRAPNEL_CONE') {
            const aim = Math.atan2(this.player.y - b.y, this.player.x - b.x);
            for (let k = 0; k < 9; k++) {
              const a = aim + (k - 4) * 0.11;
              const spd = 430 + (k % 3) * 45;
              this.projectiles.push(
                spawnCustomBossProjectile({
                  id: this.nextEntityId++,
                  x: b.x,
                  y: b.y,
                  vx: Math.cos(a) * spd,
                  vy: Math.sin(a) * spd,
                  radius: 8,
                  damage: 90,
                  palette: 'orange',
                  visualStyle: 'SHRAPNEL',
                  spinSpeed: 12,
                })
              );
            }
            this.sound.playImpactBurst();
            b.shotIntervalTimer = 0.42;
          } else if (b.currentAttack === 'BH_SINGULARITY_PULL') {
            for (let k = 0; k < 5; k++) {
              const a = b.pulsarAngle + (k * Math.PI * 2) / 5;
              this.projectiles.push(
                spawnCustomBossProjectile({
                  id: this.nextEntityId++,
                  x: b.x,
                  y: b.y,
                  vx: Math.cos(a) * 265,
                  vy: Math.sin(a) * 265,
                  radius: 10,
                  damage: 105,
                  palette: 'violet',
                  visualStyle: 'VOID_SHARD',
                })
              );
            }
            b.pulsarAngle += 0.45;
            this.sound.playBossStarLaunch(false);
            b.shotIntervalTimer = 0.3;
          } else if (b.currentAttack === 'BH_VOID_RIFTS') {
            this.spawnFloorHazardNearPlayer('VOID_RIFT', 56, 0.9, 0.25, 140, 0, 125);
            this.sound.playTelegraph(true);
            b.shotIntervalTimer = 0.28;
          } else if (b.currentAttack === 'METAL_BLADE_STORM') {
            b.shotIntervalTimer = 0.2;
          }

          b.shotsRemaining--;
          if (b.shotsRemaining <= 0) {
            b.pullForceToBoss = 0;
            b.behavior = 'COOLDOWN';
            b.stateTimer = 0.85;
          }
        }
        break;
      }

      case 'COOLDOWN': {
        b.activeLasers = [];
        b.pullForceToBoss = 0;
        b.stateTimer -= dt;
        if (b.stateTimer <= 0) {
          b.behavior = 'IDLE';
          b.stateTimer = b.isEnraged ? 0.35 : 0.55;
        }
        break;
      }
    }
  }

  private updateMinorEnemies(dt: number): void {
    const p = this.player;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.phase !== 'PLAYING') break;
      const e = this.enemies[i];
      if (!e || !e.alive) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
      }

      if (e.burnTimer > 0) {
        e.burnTimer = Math.max(0, e.burnTimer - dt);
        e.burnTickTimer -= dt;
        if (e.burnTickTimer <= 0) {
          e.burnTickTimer = 0.5;
          this.damageEnemy(e, e.burnDamagePerTick, e.x, e.y, '#c084fc', false);
          if (!e.alive) {
            this.enemies.splice(i, 1);
            continue;
          }
        }
      }

      const dxToPlayer = p.x - e.x;
      const dyToPlayer = p.y - e.y;
      const distToPlayer = Math.hypot(dxToPlayer, dyToPlayer) || 1;
      const angleToPlayer = Math.atan2(dyToPlayer, dxToPlayer);

      if (e.type === 'MINI_BOSS') {
        // Unique Mini-Boss pattern: patrols horizontally/orbitally & alternates 6-way spiral volley and 8-orb nova
        e.phaseAngle += dt * 1.4;
        const tx = e.anchorX + Math.cos(e.phaseAngle) * 150;
        const ty = e.anchorY + Math.sin(e.phaseAngle * 1.5) * 55;
        const resolved = this.resolveCircleObstacleCollisions(
          e.x + (tx - e.x) * Math.min(1, dt * 2.2),
          e.y + (ty - e.y) * Math.min(1, dt * 2.2),
          e.radius,
          false
        );
        e.x = resolved.x;
        e.y = resolved.y;

        e.attackCooldown -= dt;
        e.telegraphTimer =
          e.attackCooldown <= 0.45 && e.attackCooldown > 0 ? e.attackCooldown : 0;
        if (e.attackCooldown <= 0) {
          e.attackCooldown = e.attackInterval;
          e.attackPatternStep++;
          const count = e.attackPatternStep % 2 === 0 ? 8 : 6;
          const baseOffset = e.attackPatternStep * 0.35;
          for (let k = 0; k < count; k++) {
            const angle = baseOffset + (k * Math.PI * 2) / count;
            this.projectiles.push(
              spawnEnemyOrb(this.nextEntityId++, e, angle, 275, 95, 'gold')
            );
          }
          this.shockwaves.push({
            x: e.x,
            y: e.y,
            radius: e.radius,
            maxRadius: e.radius + 38,
            color: '#fbbf24',
            alpha: 0.75,
            lineWidth: 2,
            life: 0,
            maxLife: 0.3,
          });
        }

        if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
          this.damagePlayer(95, p.x, p.y);
        }
      } else if (e.type === 'CHASER') {
        e.phaseAngle = angleToPlayer;
        const nextX = e.x + (dxToPlayer / distToPlayer) * e.speed * dt;
        const nextY = e.y + (dyToPlayer / distToPlayer) * e.speed * dt;
        const resolved = this.resolveCircleObstacleCollisions(nextX, nextY, e.radius, true);
        e.x = resolved.x;
        e.y = resolved.y;

        if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
          this.damagePlayer(75, p.x, p.y);
        }
      } else if (e.type === 'TURRET') {
        e.phaseAngle += dt * 1.1;
        const tx = e.anchorX + Math.sin(e.phaseAngle) * 44;
        const ty = e.anchorY + Math.cos(e.phaseAngle * 0.7) * 20;
        const resolved = this.resolveCircleObstacleCollisions(
          e.x + (tx - e.x) * Math.min(1, dt * 2.5),
          e.y + (ty - e.y) * Math.min(1, dt * 2.5),
          e.radius,
          true
        );
        e.x = resolved.x;
        e.y = resolved.y;

        e.attackCooldown -= dt;
        e.telegraphTimer =
          e.attackCooldown <= 0.45 && e.attackCooldown > 0 ? e.attackCooldown : 0;
        if (e.attackCooldown <= 0) {
          e.attackCooldown = e.attackInterval;
          this.projectiles.push(spawnEnemyOrb(this.nextEntityId++, e, angleToPlayer, 305, 85));
        }
      } else {
        e.phaseAngle += dt * 1.3;
        const tx = e.anchorX + Math.cos(e.phaseAngle) * 95;
        const ty = e.anchorY + Math.sin(e.phaseAngle * 1.4) * 55;
        const resolved = this.resolveCircleObstacleCollisions(
          e.x + (tx - e.x) * Math.min(1, dt * 2.0),
          e.y + (ty - e.y) * Math.min(1, dt * 2.0),
          e.radius,
          false
        );
        e.x = resolved.x;
        e.y = resolved.y;

        e.attackCooldown -= dt;
        e.telegraphTimer =
          e.attackCooldown <= 0.45 && e.attackCooldown > 0 ? e.attackCooldown : 0;
        if (e.attackCooldown <= 0) {
          e.attackCooldown = e.attackInterval;
          for (let s = -1; s <= 1; s++) {
            this.projectiles.push(
              spawnEnemyOrb(this.nextEntityId++, e, angleToPlayer + s * 0.24, 260, 80)
            );
          }
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    const { innerLeft, innerTop, innerRight, innerBottom } = this.arena;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.phase !== 'PLAYING') break;
      const pr = this.projectiles[i];
      if (!pr) continue;
      pr.age += dt;
      pr.rotation += pr.spinSpeed * dt;

      if (pr.fadingOut) {
        pr.fadeOutTimer += dt;
        if (pr.fadeOutTimer >= pr.fadeOutDuration) {
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      if (pr.maxLifetime && pr.age >= pr.maxLifetime) {
        pr.fadingOut = true;
        continue;
      }

      if (pr.delayedLaunchTimer && pr.delayedLaunchTimer > 0) {
        pr.delayedLaunchTimer -= dt;
        if (pr.delayedLaunchTimer <= 0) {
          const spd = pr.delayedSpeed ?? 720;
          pr.vx = Math.cos(pr.rotation) * spd;
          pr.vy = Math.sin(pr.rotation) * spd;
          this.sound.playBossStarLaunch(true);
        }
        continue;
      }

      if (pr.splitOnExpire && pr.splitTimer !== undefined) {
        pr.splitTimer -= dt;
        if (pr.splitTimer <= 0) {
          const cnt = pr.splitCount ?? 4;
          const isSolar = pr.visualStyle === 'SOLAR_CORE';
          for (let k = 0; k < cnt; k++) {
            const a = (k * Math.PI * 2) / cnt + pr.age;
            this.projectiles.push(
              spawnCustomBossProjectile({
                id: this.nextEntityId++,
                x: pr.x,
                y: pr.y,
                vx: Math.cos(a) * (isSolar ? 320 : 350),
                vy: Math.sin(a) * (isSolar ? 320 : 350),
                radius: 10,
                damage: 95,
                palette: isSolar ? 'gold' : 'magenta',
                visualStyle: isSolar ? 'STAR' : 'PLASMA_SHARD',
                bounces: isSolar ? 0 : 2,
              })
            );
          }
          this.spawnSparkBurst(
            pr.x,
            pr.y,
            isSolar ? '#fbbf24' : '#e879f9',
            isSolar ? '#f59e0b' : '#d946ef',
            10,
            210,
            isSolar
          );
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      if (pr.orbitBoss && this.boss.alive) {
        pr.orbitAngle = (pr.orbitAngle ?? 0) + (pr.orbitAngularSpeed ?? 2.4) * dt;
        pr.orbitRadius = (pr.orbitRadius ?? 56) + (pr.orbitExpandRate ?? 75) * dt;
        pr.x = this.boss.x + Math.cos(pr.orbitAngle) * pr.orbitRadius;
        pr.y = this.boss.y + Math.sin(pr.orbitAngle) * pr.orbitRadius;
        if (
          pr.x < innerLeft - 20 ||
          pr.x > innerRight + 20 ||
          pr.y < innerTop - 20 ||
          pr.y > innerBottom + 20
        ) {
          pr.fadingOut = true;
        }
      } else {
        if (pr.homingStrength && pr.homingTimer && pr.homingTimer > 0) {
          pr.homingTimer -= dt;
          const curSpd = Math.hypot(pr.vx, pr.vy) || 260;
          const curAng = Math.atan2(pr.vy, pr.vx);
          const targetAng = Math.atan2(this.player.y - pr.y, this.player.x - pr.x);
          let diff = targetAng - curAng;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const nextAng = curAng + Math.max(-pr.homingStrength * dt, Math.min(pr.homingStrength * dt, diff));
          pr.vx = Math.cos(nextAng) * curSpd;
          pr.vy = Math.sin(nextAng) * curSpd;
        }

        if (pr.accelRate) {
          const factor = 1 + pr.accelRate * dt;
          pr.vx *= factor;
          pr.vy *= factor;
        }

        if (
          pr.kind === 'BOSS_RED_STAR' ||
          pr.kind === 'PLAYER_RICOCHET' ||
          pr.kind === 'PLAYER_PIERCING' ||
          pr.kind === 'PLAYER_DOT'
        ) {
          pr.trail.push({ x: pr.x, y: pr.y });
          if (pr.trail.length > 10) {
            pr.trail.shift();
          }
        }

        const prevX = pr.x;
        const prevY = pr.y;

        let wobX = 0;
        let wobY = 0;
        if (pr.sineWobbleAmp && pr.sineWobbleFreq) {
          const mag = Math.hypot(pr.vx, pr.vy) || 1;
          const perpX = -pr.vy / mag;
          const perpY = pr.vx / mag;
          const wob = Math.cos(pr.age * pr.sineWobbleFreq) * pr.sineWobbleAmp;
          wobX = perpX * wob;
          wobY = perpY * wob;
        }

        pr.x += (pr.vx + wobX) * dt;
        pr.y += (pr.vy + wobY) * dt;

        const isBouncing =
          pr.kind === 'BOSS_RED_STAR' ||
          pr.kind === 'PLAYER_RICOCHET' ||
          pr.bouncesRemaining > 0;

        if (isBouncing) {
          let destroyed = false;
          let bouncedNow = false;
          const sparkClr = pr.kind === 'BOSS_RED_STAR' ? '#fb7185' : '#fde047';
          const glowClr = pr.kind === 'BOSS_RED_STAR' ? '#ef4444' : '#f59e0b';

          if (pr.x - pr.radius <= innerLeft) {
            if (pr.bouncesRemaining > 0) {
              pr.x = innerLeft + pr.radius;
              pr.vx = Math.abs(pr.vx);
              pr.bouncesRemaining--;
              bouncedNow = true;
              this.spawnSparkBurst(pr.x, pr.y, sparkClr, glowClr, 5, 160);
              this.sound.playRicochet();
            } else {
              destroyed = true;
            }
          } else if (pr.x + pr.radius >= innerRight) {
            if (pr.bouncesRemaining > 0) {
              pr.x = innerRight - pr.radius;
              pr.vx = -Math.abs(pr.vx);
              pr.bouncesRemaining--;
              bouncedNow = true;
              this.spawnSparkBurst(pr.x, pr.y, sparkClr, glowClr, 5, 160);
              this.sound.playRicochet();
            } else {
              destroyed = true;
            }
          }

          if (!destroyed) {
            if (pr.y - pr.radius <= innerTop) {
              if (pr.bouncesRemaining > 0) {
                pr.y = innerTop + pr.radius;
                pr.vy = Math.abs(pr.vy);
                pr.bouncesRemaining--;
                bouncedNow = true;
                this.spawnSparkBurst(pr.x, pr.y, sparkClr, glowClr, 5, 160);
                this.sound.playRicochet();
              } else {
                destroyed = true;
              }
            } else if (pr.y + pr.radius >= innerBottom) {
              if (pr.bouncesRemaining > 0) {
                pr.y = innerBottom - pr.radius;
                pr.vy = -Math.abs(pr.vy);
                pr.bouncesRemaining--;
                bouncedNow = true;
                this.spawnSparkBurst(pr.x, pr.y, sparkClr, glowClr, 5, 160);
                this.sound.playRicochet();
              } else {
                destroyed = true;
              }
            }
          }

          if (!destroyed) {
            for (let wIdx = 0; wIdx < this.roomLayout.walls.length; wIdx++) {
              const w = this.roomLayout.walls[wIdx];
              const cx = Math.max(w.x, Math.min(pr.x, w.x + w.w));
              const cy = Math.max(w.y, Math.min(pr.y, w.y + w.h));
              const dx = pr.x - cx;
              const dy = pr.y - cy;
              if (dx * dx + dy * dy <= pr.radius * pr.radius) {
                if (pr.bouncesRemaining > 0) {
                  const wasLeftOrRight =
                    prevX + pr.radius <= w.x + 2 || prevX - pr.radius >= w.x + w.w - 2;
                  const wasTopOrBottom =
                    prevY + pr.radius <= w.y + 2 || prevY - pr.radius >= w.y + w.h - 2;

                  if (wasLeftOrRight && !wasTopOrBottom) {
                    pr.vx = -pr.vx;
                    pr.x = prevX < w.x ? w.x - pr.radius - 1 : w.x + w.w + pr.radius + 1;
                  } else if (wasTopOrBottom && !wasLeftOrRight) {
                    pr.vy = -pr.vy;
                    pr.y = prevY < w.y ? w.y - pr.radius - 1 : w.y + w.h + pr.radius + 1;
                  } else {
                    if (Math.abs(dx) >= Math.abs(dy)) {
                      pr.vx = -pr.vx;
                      pr.x = dx < 0 ? w.x - pr.radius - 1 : w.x + w.w + pr.radius + 1;
                    } else {
                      pr.vy = -pr.vy;
                      pr.y = dy < 0 ? w.y - pr.radius - 1 : w.y + w.h + pr.radius + 1;
                    }
                  }
                  pr.bouncesRemaining--;
                  bouncedNow = true;
                  this.spawnSparkBurst(pr.x, pr.y, sparkClr, glowClr, 5, 160);
                  this.sound.playRicochet();
                  break;
                } else {
                  destroyed = true;
                  break;
                }
              }
            }
          }

          if (bouncedNow && pr.bounceSpeedGain) {
            pr.vx *= pr.bounceSpeedGain;
            pr.vy *= pr.bounceSpeedGain;
          }

          if (destroyed) {
            this.spawnSparkBurst(pr.x, pr.y, sparkClr, glowClr, 8, 190);
            pr.fadingOut = true;
            continue;
          }
        } else {
          const hitOuterWall =
            pr.x - pr.radius <= innerLeft ||
            pr.x + pr.radius >= innerRight ||
            pr.y - pr.radius <= innerTop ||
            pr.y + pr.radius >= innerBottom;

          let hitInnerWall = false;
          if (!hitOuterWall) {
            for (let wIdx = 0; wIdx < this.roomLayout.walls.length; wIdx++) {
              const w = this.roomLayout.walls[wIdx];
              const cx = Math.max(w.x, Math.min(pr.x, w.x + w.w));
              const cy = Math.max(w.y, Math.min(pr.y, w.y + w.h));
              const dx = pr.x - cx;
              const dy = pr.y - cy;
              if (dx * dx + dy * dy <= pr.radius * pr.radius) {
                hitInnerWall = true;
                break;
              }
            }
          }

          if (hitOuterWall || hitInnerWall) {
            const sparkColor =
              pr.owner === 'PLAYER'
                ? '#6ee7b7'
                : pr.palette === 'gold'
                  ? '#fde047'
                  : pr.palette === 'cyan'
                    ? '#38bdf8'
                    : '#e0f2fe';
            this.spawnSparkBurst(pr.x, pr.y, sparkColor, sparkColor, 6, 140);
            pr.fadingOut = true;
            continue;
          }
        }
      }

      if (pr.owner === 'PLAYER') {
        let consumed = false;

        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
          const enemy = this.enemies[eIdx];
          if (!enemy.alive || pr.hitEntityIds.includes(enemy.id)) continue;
          const dist = Math.hypot(pr.x - enemy.x, pr.y - enemy.y);
          if (dist <= pr.radius + enemy.radius) {
            pr.hitEntityIds.push(enemy.id);
            this.shotsHit++;
            const hitColor = pr.isCrit ? '#fde047' : '#6ee7b7';
            this.damageEnemy(enemy, pr.damage, pr.x, pr.y, hitColor, pr.isCrit);

            if (pr.appliesDot && enemy.alive) {
              enemy.burnTimer = 3.0;
              enemy.burnTickTimer = 0.5;
              enemy.burnDamagePerTick = pr.dotDamagePerTick;
            }

            if (pr.pierceRemaining > 0) {
              pr.pierceRemaining--;
            } else {
              consumed = true;
              break;
            }
          }
        }

        if (!consumed && this.boss.alive && !pr.hitEntityIds.includes(this.boss.id)) {
          const dist = Math.hypot(pr.x - this.boss.x, pr.y - this.boss.y);
          if (dist <= pr.radius + this.boss.radius) {
            pr.hitEntityIds.push(this.boss.id);
            this.shotsHit++;
            this.damageBoss(pr.damage, pr.x, pr.y, pr.isCrit);

            if (pr.appliesDot && this.boss.alive) {
              this.boss.burnTimer = 3.0;
              this.boss.burnTickTimer = 0.5;
              this.boss.burnDamagePerTick = pr.dotDamagePerTick;
            }

            if (pr.pierceRemaining > 0) {
              pr.pierceRemaining--;
            } else {
              consumed = true;
            }
          }
        }

        if (consumed) {
          this.projectiles.splice(i, 1);
          if (this.phase !== 'PLAYING') break;
          continue;
        }
        if (this.phase !== 'PLAYING') break;
      } else {
        const dist = Math.hypot(pr.x - this.player.x, pr.y - this.player.y);
        if (dist <= pr.radius + this.player.radius - 3) {
          const burstColor = pr.kind === 'BOSS_RED_STAR' ? '#fb7185' : '#7dd3fc';
          this.spawnSparkBurst(pr.x, pr.y, burstColor, burstColor, 12, 220);
          this.damagePlayer(pr.damage, pr.x, pr.y);
          if (this.phase !== 'PLAYING') break;
          this.projectiles.splice(i, 1);
          continue;
        }
      }
    }
  }

  private damageEnemy(
    enemy: MinorEnemy,
    amount: number,
    hitX: number,
    hitY: number,
    textColor: string,
    isCrit: boolean
  ): void {
    const actualDamage = Math.min(enemy.hp, amount);
    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.hitFlashTimer = 0.08;
    this.totalDamageDealt += actualDamage;

    this.spawnSparkBurst(hitX, hitY, textColor, textColor, 7, 190);
    this.floatingTexts.push({
      x: hitX + (Math.random() - 0.5) * 18,
      y: hitY - 12,
      vy: -52,
      text: isCrit ? `-${actualDamage}!` : `-${actualDamage}`,
      color: textColor,
      life: 0,
      maxLife: 0.55,
      scale: isCrit ? 1.18 : 0.95,
    });
    this.sound.playBossHit();

    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.enemiesDefeated++;
      this.spawnSparkBurst(enemy.x, enemy.y, '#ddd6fe', '#8b5cf6', 18, 250, true);
      this.sound.playEnemyDie();
      this.grantXp(enemy.xpReward, enemy.x, enemy.y);
      this.checkRoomCleared();
    } else {
      this.emitHudIfChanged();
    }
  }

  private applyDotDamageToBoss(amount: number): void {
    const b = this.boss;
    if (!b.alive) return;
    const actualDamage = Math.min(b.hp, amount);
    b.hp = Math.max(0, b.hp - amount);
    this.totalDamageDealt += actualDamage;

    this.spawnSparkBurst(b.x, b.y, '#c084fc', '#a855f7', 5, 160);
    this.floatingTexts.push({
      x: b.x + (Math.random() - 0.5) * 36,
      y: b.y - b.radius,
      vy: -42,
      text: `-${actualDamage}`,
      color: '#d8b4fe',
      life: 0,
      maxLife: 0.55,
      scale: 0.95,
    });

    if (b.hp <= 0 && this.phase === 'PLAYING') {
      this.triggerBossDeath();
    } else {
      this.emitHudIfChanged();
    }
  }

  private damageBoss(amount: number, hitX: number, hitY: number, isCrit: boolean): void {
    const b = this.boss;
    if (!b.alive) return;
    const actualDamage = Math.min(b.hp, amount);
    b.hp = Math.max(0, b.hp - amount);
    b.hitFlashTimer = 0.08;
    this.totalDamageDealt += actualDamage;

    const color = isCrit ? '#fde047' : '#6ee7b7';
    this.spawnSparkBurst(hitX, hitY, color, '#34d399', 9, 230);
    this.floatingTexts.push({
      x: hitX + (Math.random() - 0.5) * 26,
      y: hitY - 12,
      vy: -56,
      text: isCrit ? `-${actualDamage}!` : `-${actualDamage}`,
      color,
      life: 0,
      maxLife: 0.6,
      scale: isCrit ? 1.24 : 1.0,
    });
    this.sound.playBossHit();

    if (b.hp <= 0 && this.phase === 'PLAYING') {
      this.triggerBossDeath();
    } else {
      this.emitHudIfChanged();
    }
  }

  private damagePlayer(amount: number, hitX: number, hitY: number): void {
    const p = this.player;
    if (p.invulnerableTimer > 0 || this.phase !== 'PLAYING') return;

    p.hp = Math.max(0, p.hp - amount);
    p.invulnerableTimer = p.invulnerableDuration;
    p.hitFlashTimer = 0.16;
    this.hitsTaken++;

    this.damageFlashAlpha = 0.44;
    this.shakeIntensity = 12;
    this.hitstopTimer = 0.04;

    this.shockwaves.push({
      x: p.x,
      y: p.y,
      radius: p.radius,
      maxRadius: p.radius + 54,
      color: '#f43f5e',
      alpha: 0.85,
      lineWidth: 3,
      life: 0,
      maxLife: 0.28,
    });

    this.floatingTexts.push({
      x: hitX,
      y: hitY - 16,
      vy: -45,
      text: `-${amount}`,
      color: '#fb7185',
      life: 0,
      maxLife: 0.72,
      scale: 1.15,
    });

    this.sound.playPlayerHurt();

    if (p.hp <= 0) {
      this.clearInputs();
      this.phase = 'DEFEAT';
      this.spawnSparkBurst(p.x, p.y, '#fb7185', '#ef4444', 28, 280);
      this.sound.playDefeat();
      this.emitHud(true);
    } else {
      this.emitHudIfChanged();
    }
  }

  private grantXp(amount: number, x: number, y: number): void {
    const p = this.player;
    p.xp += amount;

    this.floatingTexts.push({
      x,
      y: y - 28,
      vy: -36,
      text: `+${amount} XP`,
      color: '#38bdf8',
      life: 0,
      maxLife: 0.8,
      scale: 0.9,
    });

    if (p.xp >= p.xpToNextLevel && this.phase === 'PLAYING') {
      this.triggerLevelUp();
    }
  }

  private triggerLevelUp(): void {
    const p = this.player;
    p.xp -= p.xpToNextLevel;
    p.level++;
    p.xpToNextLevel = Math.round(p.xpToNextLevel * 1.45);

    let unlockedNow: PlayerProjectileType | null = null;
    if (p.level === 2 && !p.unlockedProjectiles.includes('PIERCING')) {
      p.unlockedProjectiles.push('PIERCING');
      unlockedNow = 'PIERCING';
    } else if (p.level === 3 && !p.unlockedProjectiles.includes('RICOCHET')) {
      p.unlockedProjectiles.push('RICOCHET');
      unlockedNow = 'RICOCHET';
    } else if (p.level === 4 && !p.unlockedProjectiles.includes('DOT')) {
      p.unlockedProjectiles.push('DOT');
      unlockedNow = 'DOT';
    }
    this.newlyUnlockedProjectile = unlockedNow;

    const shuffled = [...UPGRADE_POOL].sort(() => Math.random() - 0.5);
    this.upgradeChoices = shuffled.slice(0, 3);

    this.clearInputs();
    this.pendingRoomClearCheck = true;
    this.phase = 'LEVEL_UP';
    this.sound.playLevelUp();
    this.emitHud(true);
  }

  private triggerBossDeath(): void {
    this.phase = 'BOSS_DYING';
    this.boss.alive = false;
    this.boss.activeLasers = [];
    this.boss.pullForceToBoss = 0;
    this.boss.dashTimer = 0;
    this.poisonZones = [];
    this.floorHazards = [];
    this.bossesDefeated++;
    this.clearInputs();

    for (let i = 0; i < this.projectiles.length; i++) {
      if (this.projectiles[i].owner !== 'PLAYER') {
        this.projectiles[i].fadingOut = true;
      }
    }

    this.boss.deathTimer = 0.001;
    this.boss.deathBurstTimer = 0;
    this.hitstopTimer = 0.065;
    this.shakeIntensity = 18;
    this.sound.playBossExplosion();

    this.shockwaves.push({
      x: this.boss.x,
      y: this.boss.y,
      radius: this.boss.radius,
      maxRadius: 280,
      color: '#fbbf24',
      alpha: 0.95,
      lineWidth: 5,
      life: 0,
      maxLife: 0.7,
    });

    this.spawnSparkBurst(this.boss.x, this.boss.y, '#fde047', '#f59e0b', 36, 360, true);
    this.emitHud(true);
  }

  private updateBossDying(dt: number): void {
    const b = this.boss;
    b.deathTimer += dt;
    b.deathBurstTimer += dt;
    b.ringRotation += dt * 5.2;
    b.innerRingRotation -= dt * 6.5;

    if (b.deathBurstTimer >= 0.16 && b.deathTimer < 1.1) {
      b.deathBurstTimer = 0;
      const ox = b.x + (Math.random() - 0.5) * 70;
      const oy = b.y + (Math.random() - 0.5) * 70;
      const colors = ['#fde047', '#38bdf8', '#f43f5e', '#a78bfa'];
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.spawnSparkBurst(ox, oy, c, c, 14, 290, true);
      this.shakeIntensity = Math.max(this.shakeIntensity, 8);
    }

    if (b.deathTimer >= 1.25) {
      b.deathTimer = 0;
      this.shockwaves.push({
        x: b.x,
        y: b.y,
        radius: 15,
        maxRadius: 360,
        color: '#fef08a',
        alpha: 1,
        lineWidth: 5,
        life: 0,
        maxLife: 0.7,
      });
      this.spawnSparkBurst(b.x, b.y, '#fef08a', '#f59e0b', 42, 400, true);

      const bossXp = 130 + (this.roomNumber - 1) * 30;
      this.phase = 'PLAYING';
      this.grantXp(bossXp, b.x, b.y);
      if (this.phase === 'PLAYING') {
        this.checkRoomCleared();
      }
      this.emitHud(true);
    }
  }

  private checkRoomCleared(): void {
    if (this.roomCleared) return;
    const anyEnemyAlive = this.enemies.some((e) => e.alive);
    const anyQueued = this.reinforcementQueue.length > 0;
    if (!this.boss.alive && !anyEnemyAlive && !anyQueued) {
      this.roomCleared = true;
      this.roomLayout.portal.open = true;
      this.sound.playVictory();
      this.shockwaves.push({
        x: this.roomLayout.portal.x + this.roomLayout.portal.width * 0.5,
        y: this.roomLayout.portal.y + 18,
        radius: 12,
        maxRadius: 160,
        color: '#34d399',
        alpha: 0.9,
        lineWidth: 4,
        life: 0,
        maxLife: 0.65,
      });
      this.emitHud(true);
    }
  }

  private updateVisualEffectsOnly(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life += dt;
      const progress = Math.min(1, s.life / s.maxLife);
      s.radius = s.radius + (s.maxRadius - s.radius) * Math.min(1, dt * 8);
      s.alpha = 1 - progress;
      if (s.life >= s.maxLife) {
        this.shockwaves.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.max(0, 1 - pt.drag * dt);
      pt.vy *= Math.max(0, 1 - pt.drag * dt);
      pt.rotation += pt.spin * dt;
      pt.alpha = Math.max(0, 1 - pt.life / pt.maxLife);
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      ft.y += ft.vy * dt;
      ft.vy *= Math.max(0, 1 - 2.5 * dt);
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private spawnSparkBurst(
    x: number,
    y: number,
    color: string,
    glowColor: string,
    count: number,
    maxSpeed: number,
    isStar: boolean = false
  ): void {
    if (this.particles.length > 280) {
      this.particles.splice(0, Math.min(count, this.particles.length - 220));
    }

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * maxSpeed;
      const maxLife = 0.28 + Math.random() * 0.34;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2.2 + Math.random() * 2.8,
        color,
        glowColor,
        alpha: 1,
        life: 0,
        maxLife,
        drag: 3.4,
        isStar: isStar || Math.random() < 0.35,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    ctx.fillStyle = '#050711';
    ctx.fillRect(0, 0, this.canvasCssWidth, this.canvasCssHeight);

    const scale = Math.min(
      this.canvasCssWidth / ARENA_WIDTH,
      this.canvasCssHeight / ARENA_HEIGHT
    );
    const offsetX = (this.canvasCssWidth - ARENA_WIDTH * scale) * 0.5;
    const offsetY = (this.canvasCssHeight - ARENA_HEIGHT * scale) * 0.5;

    const shakeX =
      this.shakeIntensity > 0 ? (Math.random() - 0.5) * 2 * this.shakeIntensity : 0;
    const shakeY =
      this.shakeIntensity > 0 ? (Math.random() - 0.5) * 2 * this.shakeIntensity : 0;

    ctx.translate(offsetX + shakeX * scale, offsetY + shakeY * scale);
    ctx.scale(scale, scale);

    renderArena(ctx, this.arena, this.ambientStars, this.globalTime);
    renderPoisonGasZones(ctx, this.poisonZones, this.globalTime);
    renderFloorHazards(ctx, this.floorHazards, this.globalTime);
    renderRoomObstacles(ctx, this.roomLayout, this.globalTime);

    if (this.hasCurrentTarget && this.phase === 'PLAYING') {
      renderTargetReticle(
        ctx,
        this.currentTargetX,
        this.currentTargetY,
        this.currentTargetRadius,
        this.globalTime
      );
    }

    if (this.phase !== 'DEFEAT') {
      renderPlayer(ctx, this.player, this.globalTime);
    }

    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].alive) {
        renderMinorEnemy(ctx, this.enemies[i], this.globalTime);
      }
    }

    renderBoss(ctx, this.boss, this.player, this.globalTime);
    renderBossLasers(ctx, this.boss.activeLasers, this.globalTime);

    for (let i = 0; i < this.projectiles.length; i++) {
      renderProjectile(ctx, this.projectiles[i]);
    }

    renderEffects(ctx, this.shockwaves, this.particles, this.floatingTexts);

    if (this.damageFlashAlpha > 0.01) {
      const flashGrad = ctx.createRadialGradient(
        ARENA_WIDTH * 0.5,
        ARENA_HEIGHT * 0.5,
        ARENA_HEIGHT * 0.25,
        ARENA_WIDTH * 0.5,
        ARENA_HEIGHT * 0.5,
        ARENA_WIDTH * 0.65
      );
      flashGrad.addColorStop(0, 'rgba(225, 29, 72, 0)');
      flashGrad.addColorStop(1, `rgba(225, 29, 72, ${this.damageFlashAlpha.toFixed(3)})`);
      ctx.fillStyle = flashGrad;
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    }

    if (this.phase === 'ROOM_TRANSITION') {
      const t = 1 - Math.abs(this.roomTransitionTimer / 0.225 - 1);
      ctx.fillStyle = `rgba(5, 7, 17, ${(Math.max(0, Math.min(1, t)) * 0.88).toFixed(3)})`;
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    }

    ctx.restore();
  }

  private getSnapshot(): HudSnapshot {
    const aliveEnemies = this.enemies.filter((e) => e.alive).length;
    const miniBoss = this.enemies.find((e) => e.alive && e.type === 'MINI_BOSS');
    return {
      phase: this.phase,
      gameMode: this.gameMode,
      roomNumber: this.roomNumber,
      roomKind: this.roomLayout.roomKind,
      roomArchetype: this.roomLayout.archetypeName,
      roomCleared: this.roomCleared,
      difficultyPercent: Math.round(this.roomLayout.speedMultiplier * 100),
      playerHp: this.player.hp,
      playerMaxHp: this.player.maxHp,
      playerInvulnerable: this.player.invulnerableTimer > 0,
      playerIsMoving: this.player.isMoving,
      attackCooldownRemaining: Number(this.player.fireCooldown.toFixed(1)),
      attackCooldownMax: this.player.fireInterval,
      level: this.player.level,
      xp: this.player.xp,
      xpToNextLevel: this.player.xpToNextLevel,
      activeProjectile: this.player.activeProjectile,
      unlockedProjectiles: [...this.player.unlockedProjectiles],
      newlyUnlockedProjectile: this.newlyUnlockedProjectile,
      upgradeChoices: this.upgradeChoices,
      bossArchetype: this.boss.archetype,
      selectedBossOption: this.selectedBossOption,
      bossName: this.boss.name,
      bossHp: this.boss.hp,
      bossMaxHp: this.boss.maxHp,
      bossAlive: this.boss.alive,
      bossIsEnraged: this.boss.isEnraged,
      miniBossAlive: Boolean(miniBoss),
      miniBossName: miniBoss?.name ?? '',
      miniBossHp: miniBoss?.hp ?? 0,
      miniBossMaxHp: miniBoss?.maxHp ?? 1,
      enemiesRemaining: aliveEnemies,
      pendingSpawns: this.reinforcementQueue.length,
      totalRoomEnemies: Math.max(1, this.totalRoomEnemies),
      elapsedTime: this.elapsedTime,
      totalDamageDealt: this.totalDamageDealt,
      hitsTaken: this.hitsTaken,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      enemiesDefeated: this.enemiesDefeated,
      bossesDefeated: this.bossesDefeated,
      activeAttack:
        this.boss.behavior === 'TELEGRAPH' || this.boss.behavior === 'FIRING'
          ? this.boss.currentAttack
          : null,
      bossTelegraphing:
        this.boss.behavior === 'TELEGRAPH' ||
        this.boss.currentAttack === 'ULTRA_RAGE_LASERS' ||
        this.boss.currentAttack === 'STAR_BINARY_ECLIPSE' ||
        this.boss.currentAttack === 'PLASMA_OVERLOAD' ||
        this.boss.currentAttack === 'PHYS_ENTROPY_COLLAPSE' ||
        this.boss.currentAttack === 'METAL_BLADE_STORM' ||
        this.boss.currentAttack === 'BH_EVENT_HORIZON',
    };
  }

  private emitHud(force: boolean): void {
    const snap = this.getSnapshot();
    const signature = `${snap.phase}|${snap.gameMode}|${snap.selectedBossOption}|${snap.bossArchetype}|${snap.roomNumber}|${snap.roomKind}|${snap.roomCleared}|${snap.playerHp}|${snap.playerMaxHp}|${snap.playerInvulnerable}|${snap.playerIsMoving}|${snap.attackCooldownRemaining}|${snap.level}|${snap.xp}|${snap.activeProjectile}|${snap.unlockedProjectiles.length}|${snap.bossHp}|${snap.bossAlive}|${snap.bossIsEnraged}|${snap.miniBossHp}|${snap.enemiesRemaining}|${snap.pendingSpawns}|${snap.totalDamageDealt}|${Math.floor(snap.elapsedTime * 10)}|${snap.activeAttack}|${snap.bossTelegraphing}`;
    if (force || signature !== this.lastHudSignature) {
      this.lastHudSignature = signature;
      this.onHudUpdate(snap);
    }
  }

  private emitHudIfChanged(): void {
    this.emitHud(false);
  }
}
