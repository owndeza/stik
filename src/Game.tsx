import React, { useEffect, useRef, useState } from 'react';
import { Flame, Home, Pause, Play, RotateCcw, Shield, Volume2, VolumeX } from 'lucide-react';
import { GameEngine } from './gameEngine';
import {
  BossAttackType,
  BossSelectOption,
  GameMode,
  HudSnapshot,
  PlayerProjectileType,
  UpgradeId,
} from './types';
import './game.css';

const PROJECTILE_SLOTS: Array<{
  type: PlayerProjectileType;
  keyHint: string;
  label: string;
  unlockLevel: number;
}> = [
  { type: 'STANDARD', keyHint: '1', label: 'Стандарт', unlockLevel: 1 },
  { type: 'PIERCING', keyHint: '2', label: 'Пробивной', unlockLevel: 2 },
  { type: 'RICOCHET', keyHint: '3', label: 'Рикошет', unlockLevel: 3 },
  { type: 'DOT', keyHint: '4', label: 'Ожог (DoT)', unlockLevel: 4 },
];

const PROJECTILE_NAMES: Record<PlayerProjectileType, string> = {
  STANDARD: 'Стандартный луч [1]',
  PIERCING: 'Пробивной луч [2]',
  RICOCHET: 'Рикошетный диск [3]',
  DOT: 'Сфера ожога DoT [4]',
};

const BOSS_MENU_OPTIONS: Array<{ value: BossSelectOption; label: string }> = [
  { value: 'AUTO', label: 'По порядку' },
  { value: 'STAR', label: '1. Стар' },
  { value: 'METAPLASM', label: '2. Метаплазма' },
  { value: 'PHYSICS', label: '3. Физика' },
  { value: 'METAL', label: '4. Метал' },
  { value: 'BLACK_HOLE', label: '5. Чёрная дыра' },
  { value: 'STAR_WARDEN', label: 'Star Warden' },
];

const ATTACK_WARNING_TEXT: Record<
  BossAttackType,
  { text: string; tone: 'normal' | 'crimson' | 'poison' | 'ultra' }
> = {
  NORMAL_STARS: { text: 'Предупреждение: залп звёзд', tone: 'normal' },
  RED_RICOCHET_STARS: { text: 'Предупреждение: красные рикошетные звёзды', tone: 'crimson' },
  BOUNCE_LASER: { text: 'Отражающийся лазерный луч (босс неподвижен 3с)', tone: 'normal' },
  POISON_GAS: { text: 'Ядовитый зелёный газ вдоль стен комнаты!', tone: 'poison' },
  RED_STAR_SPRAY: { text: 'Веерные залпы красных звёзд!', tone: 'crimson' },
  ULTRA_RAGE_LASERS: { text: 'УЛЬТРА-АТАКА: ярость Стража — множественные лучи!', tone: 'ultra' },

  STAR_SUPERNOVA_RING: { text: 'Сверхновая: двойное кольцо солнечных звёзд', tone: 'normal' },
  STAR_SOLAR_FLARE: { text: 'Солнечный протуберанец: вращающиеся лучи!', tone: 'crimson' },
  STAR_METEOR_RAIN: { text: 'Звёздный метеоритный дождь!', tone: 'crimson' },
  STAR_CONSTELLATION_ORB: { text: 'Сфера созвездия — детонация в полёте!', tone: 'normal' },
  STAR_CROSS_PULSAR: { text: 'Пульсар: 4 вращающихся потока звёзд', tone: 'normal' },
  STAR_BINARY_ECLIPSE: { text: 'УЛЬТРА-ЗАТМЕНИЕ: метеоры и солнечные лучи!', tone: 'ultra' },

  PLASMA_SPLIT_ORBS: { text: 'Нестабильная плазма — деление на осколки!', tone: 'crimson' },
  PLASMA_LIGHTNING_WEB: { text: 'Плазменная сеть высокого напряжения!', tone: 'normal' },
  PLASMA_PUDDLE_ERUPTION: { text: 'Выброс едких плазменных луж!', tone: 'poison' },
  PLASMA_MUTATION_DASH: { text: 'Рывок мутации с плазменным следом!', tone: 'crimson' },
  PLASMA_SIPHON_SPIRAL: { text: 'Двойная спираль плазменных разрядов', tone: 'normal' },
  PLASMA_OVERLOAD: { text: 'УЛЬТРА-ПЕРЕГРУЗКА: цепные молнии и плазма!', tone: 'ultra' },

  PHYS_KINETIC_IMPULSE: { text: 'Кинетический импульс — отталкивающая волна!', tone: 'normal' },
  PHYS_PENDULUM_SWEEP: { text: 'Маятниковый веер ускоряющихся сфер', tone: 'normal' },
  PHYS_RICOCHET_COLLIDER: { text: 'Коллайдер: ускорение сфер при рикошетах!', tone: 'crimson' },
  PHYS_GRAVITY_TRAP: { text: 'Гравитационные ловушки: притяжение и взрыв!', tone: 'normal' },
  PHYS_VECTOR_GRID: { text: 'Векторная решётка — лазерные оси координат!', tone: 'crimson' },
  PHYS_ENTROPY_COLLAPSE: { text: 'УЛЬТРА-ЭНТРОПИЯ: решётка и коллайдер!', tone: 'ultra' },

  METAL_SAWBLADES: { text: 'Дисковые пилы с рикошетом!', tone: 'crimson' },
  METAL_ANVIL_SLAM: { text: 'Удар наковальни: рывок и залп шрапнели!', tone: 'crimson' },
  METAL_SHRAPNEL_CONE: { text: 'Залпы раскалённой железной шрапнели!', tone: 'normal' },
  METAL_MAGNET_SPEARS: { text: 'Магнитные копья с периметра арены!', tone: 'crimson' },
  METAL_MOLTEN_FORGE: { text: 'Выброс расплавленного металла!', tone: 'poison' },
  METAL_BLADE_STORM: { text: 'УЛЬТРА-ШТОРМ: шквал пил и магнитных копий!', tone: 'ultra' },

  BH_SINGULARITY_PULL: { text: 'Сингулярность: притяжение к центру Чёрной дыры!', tone: 'ultra' },
  BH_ACCRETION_ORBIT: { text: 'Аккреционный диск — вращающиеся осколки', tone: 'normal' },
  BH_VOID_RIFTS: { text: 'Разломы пустоты — взрывные искажения!', tone: 'crimson' },
  BH_HAWKING_JETS: { text: 'Релятивистские джеты Хокинга!', tone: 'crimson' },
  BH_DARK_MATTER_BARRAGE: { text: 'Самонаводящиеся сферы тёмной материи!', tone: 'normal' },
  BH_EVENT_HORIZON: { text: 'УЛЬТРА-ГОРИЗОНТ: коллапс гравитации и джеты!', tone: 'ultra' },
};

const INITIAL_HUD: HudSnapshot = {
  phase: 'TITLE_MENU',
  gameMode: 'NORMAL',
  roomNumber: 1,
  roomKind: 'ENEMIES',
  roomArchetype: 'Бастион Звёзд',
  roomCleared: false,
  difficultyPercent: 100,
  playerHp: 1000,
  playerMaxHp: 1000,
  playerInvulnerable: false,
  playerIsMoving: false,
  attackCooldownRemaining: 0,
  attackCooldownMax: 1.0,
  level: 1,
  xp: 0,
  xpToNextLevel: 85,
  activeProjectile: 'STANDARD',
  unlockedProjectiles: ['STANDARD'],
  newlyUnlockedProjectile: null,
  upgradeChoices: [],
  bossArchetype: 'STAR',
  selectedBossOption: 'AUTO',
  bossName: 'СТАР · СОЛНЕЧНЫЙ ТИТАН',
  bossHp: 20000,
  bossMaxHp: 20000,
  bossAlive: false,
  bossIsEnraged: false,
  miniBossAlive: false,
  miniBossName: '',
  miniBossHp: 0,
  miniBossMaxHp: 1,
  enemiesRemaining: 0,
  pendingSpawns: 0,
  totalRoomEnemies: 1,
  elapsedTime: 0,
  totalDamageDealt: 0,
  hitsTaken: 0,
  shotsFired: 0,
  shotsHit: 0,
  enemiesDefeated: 0,
  bossesDefeated: 0,
  activeAttack: null,
  bossTelegraphing: false,
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString('ru-RU');
}

export const Game: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState<boolean>(false);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const engine = new GameEngine(canvas, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    engine.startLoop();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        engine.resize(width, height);
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStart = () => {
    engineRef.current?.startGame(hud.gameMode, hud.selectedBossOption);
  };

  const handleSelectMode = (mode: GameMode) => {
    engineRef.current?.setGameMode(mode);
  };

  const handleSelectBossOption = (option: BossSelectOption) => {
    engineRef.current?.setSelectedBossOption(option);
  };

  const handleReturnToMenu = () => {
    engineRef.current?.returnToMenu();
  };

  const handleRestart = () => {
    engineRef.current?.restartGame();
  };

  const handleTogglePause = () => {
    if (hud.phase === 'PLAYING') {
      engineRef.current?.pauseGame();
    } else if (hud.phase === 'PAUSED') {
      engineRef.current?.resumeGame();
    }
  };

  const handleToggleMute = () => {
    if (!engineRef.current) return;
    const nextMuted = engineRef.current.sound.toggleMute();
    setMuted(nextMuted);
  };

  const handleSelectProjectile = (type: PlayerProjectileType) => {
    engineRef.current?.switchProjectile(type);
  };

  const handleSelectUpgrade = (id: UpgradeId) => {
    engineRef.current?.selectUpgrade(id);
  };

  const handleJoystickStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    joystickCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joystickCenterRef.current) return;
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoystickEnd = () => {
    joystickCenterRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    engineRef.current?.setTouchJoystick(false, 0, 0);
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const center = joystickCenterRef.current;
    if (!center) return;
    const dx = clientX - center.x;
    const dy = clientY - center.y;
    const maxDist = 36;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);
    const kx = dist > 0.01 ? Math.cos(angle) * clamped : 0;
    const ky = dist > 0.01 ? Math.sin(angle) * clamped : 0;
    setKnobOffset({ x: kx, y: ky });

    if (dist > 6) {
      engineRef.current?.setTouchJoystick(true, dx / dist, dy / dist);
    } else {
      engineRef.current?.setTouchJoystick(false, 0, 0);
    }
  };

  const playerHpRatio = Math.max(0, Math.min(1, hud.playerHp / hud.playerMaxHp));
  const bossHpRatio = Math.max(0, Math.min(1, hud.bossHp / hud.bossMaxHp));
  const miniBossRatio = Math.max(0, Math.min(1, hud.miniBossHp / hud.miniBossMaxHp));
  const totalRemainingEnemies = hud.enemiesRemaining + hud.pendingSpawns;
  const waveRatio = Math.max(
    0,
    Math.min(1, totalRemainingEnemies / Math.max(1, hud.totalRoomEnemies))
  );
  const xpRatio = Math.max(0, Math.min(1, hud.xp / hud.xpToNextLevel));
  const isPlayerLow = playerHpRatio <= 0.3;

  const playerStatusLabel = hud.playerInvulnerable
    ? 'Щит'
    : hud.playerIsMoving
      ? 'Движение'
      : 'Стоит · Авто-огонь';

  const playerStatusClass = hud.playerInvulnerable
    ? 'state-text-shielded'
    : isPlayerLow
      ? 'state-text-critical'
      : hud.playerIsMoving
        ? 'state-text-moving'
        : 'state-text-firing';

  const roomTypeTitle =
    hud.roomKind === 'BOSS'
      ? 'Комната Босса'
      : hud.roomKind === 'SWARM'
        ? 'Орда врагов'
        : 'Боевая комната';

  const accuracy =
    hud.shotsFired > 0 ? Math.round((hud.shotsHit / hud.shotsFired) * 100) : 0;

  return (
    <div className="game-shell">
      <div ref={containerRef} className="game-canvas-stage">
        <canvas ref={canvasRef} className="game-canvas" />
      </div>

      {/* Active HUD */}
      {hud.phase !== 'TITLE_MENU' && (
        <div className="hud-overlay">
          <div className="hud-top-row">
            {/* Player Health, 1s Cooldown & XP */}
            <div className="hud-panel">
              <div className="hud-player-header">
                <span className="hud-label">Здоровье игрока</span>
                <span className="hud-value-mono">
                  {hud.playerHp} / {hud.playerMaxHp}
                </span>
              </div>
              <div className="hp-track">
                <div
                  className={`hp-fill-player ${isPlayerLow ? 'is-low' : ''}`}
                  style={{ transform: `scaleX(${playerHpRatio})` }}
                />
              </div>

              <div className="hud-player-meta">
                <span className={playerStatusClass}>{playerStatusLabel}</span>
                <span className="hud-value-mono">
                  {hud.attackCooldownRemaining <= 0.05
                    ? 'Выстрел готов'
                    : `КД ${hud.attackCooldownRemaining.toFixed(1)}с`}
                </span>
              </div>

              <div className="xp-row">
                <div className="xp-header">
                  <span className="xp-level-text">Уровень {hud.level}</span>
                  <span className="hud-label">
                    {hud.xp} / {hud.xpToNextLevel} XP
                  </span>
                </div>
                <div className="xp-track">
                  <div className="xp-fill" style={{ transform: `scaleX(${xpRatio})` }} />
                </div>
              </div>
            </div>

            {/* Center Panel: Boss Bar (Room 5, 10...) OR Wave Bar (Rooms 1-4) */}
            <div className="hud-boss-panel">
              <div className="hud-room-meta">
                {hud.gameMode === 'HARDMODE' && (
                  <>
                    <span className="hud-mode-hard">HARDMODE</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>Комната {hud.roomNumber}</span>
                <span aria-hidden="true">·</span>
                <span>{roomTypeTitle}</span>
                <span aria-hidden="true">·</span>
                <span>{hud.roomArchetype}</span>
                <span aria-hidden="true">·</span>
                <span>Темп {hud.difficultyPercent}%</span>
              </div>

              {hud.roomKind === 'BOSS' ? (
                <>
                  <div className="hud-boss-title-row">
                    <span className="hud-boss-name">{hud.bossName}</span>
                    <span className="hud-boss-hp-text">
                      {hud.bossHp} / {hud.bossMaxHp}
                    </span>
                  </div>
                  <div className="hp-track-boss">
                    <div
                      className={`hp-fill-boss ${hud.bossIsEnraged ? 'is-enraged' : ''}`}
                      style={{ transform: `scaleX(${bossHpRatio})` }}
                    />
                  </div>
                  {hud.miniBossAlive && (
                    <div className="miniboss-row">
                      <div className="miniboss-header">
                        <span>{hud.miniBossName}</span>
                        <span className="hud-value-mono">
                          {hud.miniBossHp} / {hud.miniBossMaxHp}
                        </span>
                      </div>
                      <div className="hp-track-miniboss">
                        <div
                          className="hp-fill-miniboss"
                          style={{ transform: `scaleX(${miniBossRatio})` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="hud-boss-title-row">
                    <span className="hud-boss-name">
                      {hud.roomKind === 'SWARM' ? 'НАШЕСТВИЕ ОРДЫ' : 'УГРОЗЫ АРЕНЫ'}
                    </span>
                    <span className="hud-boss-hp-text">
                      Осталось: {totalRemainingEnemies}
                    </span>
                  </div>
                  <div className="hp-track-boss">
                    <div
                      className="hp-fill-wave"
                      style={{ transform: `scaleX(${waveRatio})` }}
                    />
                  </div>
                </>
              )}

              <div className="hud-boss-subline">
                {hud.roomCleared && (
                  <span className="portal-ready-alert">
                    Комната зачищена · Войдите в северный портал ↑
                  </span>
                )}
                {!hud.roomCleared &&
                  hud.activeAttack &&
                  ATTACK_WARNING_TEXT[hud.activeAttack] && (
                    <span
                      className={`telegraph-alert-${ATTACK_WARNING_TEXT[hud.activeAttack].tone}`}
                    >
                      {ATTACK_WARNING_TEXT[hud.activeAttack].text}
                    </span>
                  )}
              </div>
            </div>

            {/* Timer, Damage Dealt & Audio/Pause */}
            <div className="hud-right-cluster">
              <div className="hud-panel hud-stats-box">
                <div className="hud-stat-cell">
                  <span className="hud-label">Время</span>
                  <span className="hud-value-mono">{formatTime(hud.elapsedTime)}</span>
                </div>
                <div className="hud-stat-cell">
                  <span className="hud-label">Урон</span>
                  <span className="hud-value-mono">{formatNumber(hud.totalDamageDealt)}</span>
                </div>
                <div className="hud-stat-cell align-right">
                  <span className="hud-label">Убито</span>
                  <span className="hud-value-mono">{hud.enemiesDefeated}</span>
                </div>
              </div>

              <div className="hud-controls-row">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="hud-icon-btn"
                  aria-label={muted ? 'Включить звук' : 'Выключить звук'}
                  title={muted ? 'Включить звук' : 'Выключить звук'}
                >
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                {(hud.phase === 'PLAYING' || hud.phase === 'PAUSED') && (
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="hud-icon-btn"
                    aria-label={hud.phase === 'PAUSED' ? 'Продолжить' : 'Пауза'}
                  >
                    {hud.phase === 'PAUSED' ? <Play size={16} /> : <Pause size={16} />}
                    <span>{hud.phase === 'PAUSED' ? 'Продолжить' : 'Пауза'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Projectile Switcher */}
          <div className="hud-bottom-row">
            <div className="weapon-bar" role="group" aria-label="Тип снарядов">
              {PROJECTILE_SLOTS.map((slot) => {
                const unlocked = hud.unlockedProjectiles.includes(slot.type);
                const active = hud.activeProjectile === slot.type;
                return (
                  <button
                    key={slot.type}
                    type="button"
                    data-kind={slot.type}
                    disabled={!unlocked}
                    onClick={() => handleSelectProjectile(slot.type)}
                    className={`weapon-btn ${active ? 'is-active' : ''}`}
                    title={
                      unlocked
                        ? `${slot.label} (клавиша ${slot.keyHint})`
                        : `Откроется на ${slot.unlockLevel} уровне`
                    }
                  >
                    <span className="weapon-key">[{slot.keyHint}]</span>
                    <span>{slot.label}</span>
                    {!unlocked && <span className="weapon-key">Ур.{slot.unlockLevel}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {hud.phase === 'PLAYING' && (
            <div
              className="touch-joystick-zone"
              onPointerDown={handleJoystickStart}
              onPointerMove={handleJoystickMove}
              onPointerUp={handleJoystickEnd}
              onPointerCancel={handleJoystickEnd}
            >
              <div
                className="touch-joystick-knob"
                style={{
                  transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Main Menu */}
      {hud.phase === 'TITLE_MENU' && (
        <div className="screen-backdrop">
          <div className="title-lockup-wrap">
            <svg
              className="title-svg-lockup"
              viewBox="0 0 460 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="THE STAR WARDEN"
            >
              <path
                d="M230 6L235 20L249 25L235 30L230 44L225 30L211 25L225 20L230 6Z"
                fill={hud.gameMode === 'HARDMODE' ? '#FB7185' : '#F59E0B'}
              />
              <line
                x1="62"
                y1="25"
                x2="196"
                y2="25"
                stroke={
                  hud.gameMode === 'HARDMODE'
                    ? 'rgba(251,113,133,0.42)'
                    : 'rgba(245,158,11,0.38)'
                }
                strokeWidth="1.2"
              />
              <line
                x1="264"
                y1="25"
                x2="398"
                y2="25"
                stroke={
                  hud.gameMode === 'HARDMODE'
                    ? 'rgba(251,113,133,0.42)'
                    : 'rgba(245,158,11,0.38)'
                }
                strokeWidth="1.2"
              />
              <text
                x="230"
                y="78"
                textAnchor="middle"
                fill="#FEF3C7"
                fontFamily="Cinzel, Georgia, serif"
                fontWeight="700"
                fontSize="34"
                letterSpacing="4"
              >
                THE STAR WARDEN
              </text>
              <text
                x="230"
                y="104"
                textAnchor="middle"
                fill="#94A3B8"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontWeight="600"
                fontSize="13"
                letterSpacing="4"
              >
                ГЛАВНОЕ МЕНЮ · BOSS ARENA
              </text>
            </svg>

            <p className="title-subtitle">
              Выберите режим испытания. Остановка запускает авто-выстрел (КД 1с),
              победа открывает северный портал в следующую комнату.
            </p>

            <div className="mode-selector-grid" role="radiogroup" aria-label="Режим игры">
              <button
                type="button"
                role="radio"
                aria-checked={hud.gameMode === 'NORMAL'}
                data-mode="NORMAL"
                className={`mode-card-btn ${hud.gameMode === 'NORMAL' ? 'is-active' : ''}`}
                onClick={() => handleSelectMode('NORMAL')}
              >
                <div className="mode-card-header">
                  <span className="mode-card-title">
                    <Shield size={16} />
                    Обычный режим
                  </span>
                  <span className="mode-card-state">
                    {hud.gameMode === 'NORMAL' ? 'ВЫБРАН' : 'NORMAL'}
                  </span>
                </div>
                <p className="mode-card-desc">
                  1–2 комнаты — враги, 3 — орда, 4 — враги, 5 — Мини-Босс и Страж Звёзд.
                </p>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={hud.gameMode === 'HARDMODE'}
                data-mode="HARDMODE"
                className={`mode-card-btn ${hud.gameMode === 'HARDMODE' ? 'is-active' : ''}`}
                onClick={() => handleSelectMode('HARDMODE')}
              >
                <div className="mode-card-header">
                  <span className="mode-card-title">
                    <Flame size={16} />
                    Hardmode
                  </span>
                  <span className="mode-card-state">
                    {hud.gameMode === 'HARDMODE' ? 'ВЫБРАН' : 'BOSS RUSH'}
                  </span>
                </div>
                <p className="mode-card-desc">
                  Каждая комната — битва с Боссом и Мини-Боссом, ускоренный темп и рост HP.
                </p>
              </button>
            </div>

            <div className="boss-selector-wrap">
              <div className="boss-selector-label">
                Стартовый босс (в Hardmode — уже в 1-й комнате):
              </div>
              <div className="boss-selector-grid" role="radiogroup" aria-label="Выбор босса">
                {BOSS_MENU_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={hud.selectedBossOption === opt.value}
                    className={`boss-chip-btn ${hud.selectedBossOption === opt.value ? 'is-active' : ''}`}
                    onClick={() => handleSelectBossOption(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="menu-actions-row">
              <button
                type="button"
                className={`cta-primary ${hud.gameMode === 'HARDMODE' ? 'is-hardmode' : ''}`}
                onClick={handleStart}
              >
                {hud.gameMode === 'HARDMODE' ? 'Начать Hardmode' : 'Начать игру'}
              </button>
              <button
                type="button"
                className="cta-secondary"
                onClick={handleToggleMute}
                aria-label={muted ? 'Включить звук' : 'Выключить звук'}
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                <span>{muted ? 'Звук выкл.' : 'Звук вкл.'}</span>
              </button>
            </div>

            <div className="control-hint-line">
              <span>WASD / Стрелки — движение</span>
              <span aria-hidden="true">·</span>
              <span>1–4 / Q,E — снаряды</span>
              <span aria-hidden="true">·</span>
              <span>Esc — пауза</span>
            </div>
          </div>
        </div>
      )}

      {/* Level-Up Modal */}
      {hud.phase === 'LEVEL_UP' && (
        <div className="screen-backdrop">
          <div className="levelup-card">
            <h2 className="modal-heading is-levelup">Уровень {hud.level}!</h2>
            <p className="modal-lead">
              Выберите одно улучшение для продолжения восхождения по аренам.
            </p>

            {hud.newlyUnlockedProjectile && (
              <div className="unlock-callout">
                Открыт новый тип снаряда: {PROJECTILE_NAMES[hud.newlyUnlockedProjectile]}
              </div>
            )}

            <div className="upgrade-grid">
              {hud.upgradeChoices.map((upg) => (
                <button
                  key={upg.id}
                  type="button"
                  className="upgrade-option-btn"
                  onClick={() => handleSelectUpgrade(upg.id)}
                >
                  <div>
                    <div className="upgrade-title">{upg.title}</div>
                    <p className="upgrade-desc">{upg.description}</p>
                  </div>
                  <span className="upgrade-action">Выбрать →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {hud.phase === 'PAUSED' && (
        <div className="screen-backdrop">
          <div className="screen-card">
            <h2 className="modal-heading is-paused">Пауза</h2>
            <p className="modal-lead">
              {hud.gameMode === 'HARDMODE' ? 'Hardmode · ' : ''}Комната {hud.roomNumber} ·{' '}
              {roomTypeTitle} · {hud.roomArchetype}.
            </p>
            <div className="metrics-grid">
              <div className="metric-cell">
                <div className="metric-label">
                  {hud.roomKind === 'BOSS' ? 'HP босса' : 'Осталось врагов'}
                </div>
                <div className="metric-value">
                  {hud.roomKind === 'BOSS'
                    ? `${hud.bossHp} / ${hud.bossMaxHp}`
                    : totalRemainingEnemies}
                </div>
              </div>
              <div className="metric-cell">
                <div className="metric-label">Уровень игрока</div>
                <div className="metric-value">Ур. {hud.level}</div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="cta-primary" onClick={handleTogglePause}>
                Продолжить
              </button>
              <button type="button" className="cta-secondary" onClick={handleRestart}>
                <RotateCcw size={16} />
                Заново
              </button>
              <button type="button" className="cta-secondary" onClick={handleReturnToMenu}>
                <Home size={16} />
                Главное меню
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Defeat Modal */}
      {hud.phase === 'DEFEAT' && (
        <div className="screen-backdrop">
          <div className="screen-card">
            <h2 className="modal-heading is-defeat">Поражение</h2>
            <p className="modal-lead">
              Вы пали в комнате {hud.roomNumber} (
              {hud.gameMode === 'HARDMODE' ? 'режим Hardmode' : 'Обычный режим'}).
            </p>

            <div className="metrics-grid">
              <div className="metric-cell">
                <div className="metric-label">Достигнута комната</div>
                <div className="metric-value">{hud.roomNumber}</div>
              </div>
              <div className="metric-cell">
                <div className="metric-label">Боссов повержено</div>
                <div className="metric-value">{hud.bossesDefeated}</div>
              </div>
              <div className="metric-cell">
                <div className="metric-label">Уровень / Враги</div>
                <div className="metric-value">
                  Ур. {hud.level} · {hud.enemiesDefeated}
                </div>
              </div>
              <div className="metric-cell">
                <div className="metric-label">Урон / Точность</div>
                <div className="metric-value">
                  {formatNumber(hud.totalDamageDealt)} ({accuracy}%)
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className={`cta-primary ${hud.gameMode === 'HARDMODE' ? 'is-hardmode' : ''}`}
                onClick={handleRestart}
              >
                <RotateCcw size={16} />
                Заново
              </button>
              <button type="button" className="cta-secondary" onClick={handleReturnToMenu}>
                <Home size={16} />
                Главное меню
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
