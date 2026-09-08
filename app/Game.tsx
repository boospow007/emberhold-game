'use client';
/* eslint-disable react/react-compiler -- Imperative Three.js rendering and network subscriptions intentionally synchronize React HUD state. */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Flame,
  Coins,
  Heart,
  Hammer,
  ArrowUp,
  Play,
  X,
  Shield,
  Wind,
  Swords,
  Home,
  Pause,
  Sparkles,
  Lock,
  Target,
  Radio,
  Check,
  Axe,
  Pickaxe,
  Wheat,
  Mountain,
  Users,
  Castle,
  Gem,
  Logs,
  Crosshair,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GameScene } from '@/lib/game/scene';
import {
  World,
  Profile,
  Weapon,
  BuildKind,
  Building,
  Input,
  Command,
  Cost,
  Resource,
  BUILDINGS,
  MAPS,
  RESOURCES,
  RESOURCE_ORDER,
  KEEP_MAX,
  KEEP_RADIUS,
  KEEP_WORKERS,
  step,
  command,
  dist,
  reward,
  workerCap,
  workersUsed,
  upgradeCost,
  branches,
  buildGate,
  buildError,
  upgradeError,
} from '@/lib/game/engine';
import { api } from '@/lib/game/api';
export type Session = {
  world: World;
  room?: { code: string; host: boolean };
  profile: Profile;
  weapon: Weapon;
};
const emptyInput = (): Input => ({ x: 0, z: 0, commands: [] });
const RES_ICON: Record<Resource, typeof Coins> = {
  gold: Coins,
  wood: Logs,
  stone: Mountain,
  iron: Pickaxe,
  food: Wheat,
};
const BUILD_ICON: Record<BuildKind, typeof Coins> = {
  house: Home,
  farm: Wheat,
  sawmill: Axe,
  goldmine: Gem,
  quarry: Mountain,
  mine: Pickaxe,
  tower: Target,
  wall: Shield,
  frost: Sparkles,
  shrine: Heart,
  ballista: Crosshair,
};
function CostChips({
  cost,
  res,
}: {
  cost: Cost;
  res?: Record<Resource, number>;
}) {
  return (
    <span className="cost-chips">
      {RESOURCE_ORDER.filter((k) => cost[k]).map((k) => {
        const Icon = RES_ICON[k];
        const short = res && res[k] < (cost[k] || 0);
        return (
          <i key={k} className={short ? 'short' : ''}>
            <Icon size={12} />
            {cost[k]}
          </i>
        );
      })}
    </span>
  );
}
const BRANCH_TEXT: Record<string, [string, string]> = {
  rapid: ['ยิงเร็ว', 'เพิ่มอัตราการยิง 80%'],
  heavy: ['ยิงหนัก', 'เพิ่มพลังโจมตี 80% และระยะยิง'],
  grow: ['ขยาย', 'เพิ่มระดับ ผลผลิต และพลังชีวิต'],
  keep: ['อัปเกรดฐานแม่', 'สร้างได้ไกลขึ้น คนงานเพิ่ม และปลดล็อกสิ่งก่อสร้างระดับถัดไป'],
};
export default function Game({
  session,
  onExit,
  onProfile,
}: {
  session: Session;
  onExit: () => void;
  onProfile: (p: Profile) => void;
}) {
  const mount = useRef<HTMLDivElement>(null),
    world = useRef(session.world),
    scene = useRef<GameScene | null>(null),
    input = useRef<Input>(emptyInput()),
    remote = useRef<Record<string, Input>>({}),
    seq = useRef(0),
    placement = useRef<{ kind: BuildKind; x: number; z: number } | null>(null),
    paused = useRef(false),
    panelRef = useRef(''),
    overSaved = useRef(false);
  const [hud, setHud] = useState(session.world),
    [panel, setPanel] = useState(''),
    [selected, setSelected] = useState<Building | null>(null),
    [place, setPlace] = useState<{
      kind: BuildKind;
      x: number;
      z: number;
    } | null>(null),
    [toast, setToast] = useState(''),
    [error, setError] = useState(''),
    [quit, setQuit] = useState(false),
    [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false),
    [joystick, setJoystick] = useState<{
      x: number;
      y: number;
      dx: number;
      dy: number;
    } | null>(null);
  const host = !session.room || session.room.host,
    id = session.profile.id;
  const openPanel = useCallback((v: string) => {
    panelRef.current = v;
    setPanel(v);
    input.current.x = 0;
    input.current.z = 0;
    setJoystick(null);
  }, []);
  function send(c: Omit<Command, 'seq'>) {
    const cmd = { ...c, seq: ++seq.current } as Command;
    if (host) {
      const message = command(world.current, id, cmd);
      if (message) {
        setToast(message);
        return false;
      }
      world.current.acks[id] = cmd.seq;
    } else input.current.commands.push(cmd);
    return true;
  }
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!mount.current) return;
    let renderer: GameScene;
    try {
      renderer = new GameScene(mount.current, world.current.map);
      scene.current = renderer;
    } catch {
      setError('อุปกรณ์นี้เปิดภาพ 3D ไม่ได้ กรุณาลองเบราว์เซอร์ที่รองรับ WebGL');
      return;
    }
    let frame = 0,
      then = performance.now(),
      uiTime = 0;
    const animate = (now: number) => {
      const dt = Math.min((now - then) / 1000, 0.05);
      then = now;
      const w = world.current;
      if (host && !paused.current && !document.hidden) {
        step(w, { ...remote.current, [id]: input.current }, dt);
      }
      renderer.render(w, id, placement.current);
      if (now - uiTime > 90) {
        uiTime = now;
        setHud({
          ...w,
          players: w.players.map((p) => ({ ...p })),
          buildings: w.buildings.map((b) => ({ ...b })),
        });
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const stop = () => {
      input.current.x = 0;
      input.current.z = 0;
      setJoystick(null);
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    const keys = new Set<string>();
    const key = (e: KeyboardEvent, down: boolean) => {
      if (
        e.target instanceof HTMLInputElement ||
        panelRef.current ||
        placement.current
      )
        return;
      const k = e.key.toLowerCase();
      if (
        [
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
        ].includes(k)
      ) {
        e.preventDefault();
        if (down) keys.add(k);
        else keys.delete(k);
        input.current.x =
          Number(keys.has('d') || keys.has('arrowright')) -
          Number(keys.has('a') || keys.has('arrowleft'));
        input.current.z =
          Number(keys.has('s') || keys.has('arrowdown')) -
          Number(keys.has('w') || keys.has('arrowup'));
      }
    };
    const kd = (e: KeyboardEvent) => key(e, true),
      ku = (e: KeyboardEvent) => key(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
      scene.current = null;
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, [host, id]);
  useEffect(() => {
    paused.current = !session.room && (panel === 'pause' || quit);
  }, [panel, quit, session.room]);
  useEffect(() => {
    if (!session.room) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    let lastSuccess = Date.now();
    const sync = async () => {
      try {
        const data = await api('sync', {
          code: session.room!.code,
          input: input.current,
          ...(host ? { snapshot: world.current } : {}),
        });
        if (stopped) return;
        lastSuccess = Date.now();
        setError('');
        paused.current = false;
        if (host) {
          const currentIds = new Set(data.players.map((p) => p.id));
          world.current.players = world.current.players.filter((p) =>
            currentIds.has(p.id),
          );
          for (const p of data.players) {
            remote.current[p.id] = p.online ? p.input : emptyInput();
          }
        } else if (data.snapshot) {
          world.current = data.snapshot;
          const ack = data.snapshot.acks[id] || 0;
          input.current.commands = input.current.commands.filter(
            (c) => c.seq > ack,
          );
        }
      } catch (e) {
        if (stopped) return;
        setError((e as Error).message);
        if (Date.now() - lastSuccess > 3000) paused.current = true;
      } finally {
        if (!stopped) timer = setTimeout(sync, 180);
      }
    };
    void sync();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [host, id, session.room]);
  const saveResult = useCallback(async () => {
    if (overSaved.current) return;
    overSaved.current = true;
    setSaving(true);
    try {
      if (session.room) {
        if (host)
          await api('sync', {
            code: session.room.code,
            input: input.current,
            snapshot: world.current,
          });
        const r = await api('claim', { run: world.current.run });
        onProfile(r.profile);
      } else {
        const w = world.current;
        const r = await api('solo-reward', {
          run: w.run,
          points: reward(w),
          wave: Math.max(0, w.wave - 1),
        });
        onProfile(r.profile);
      }
      setSaved(true);
    } catch (e) {
      overSaved.current = false;
      setToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [host, session.room, onProfile]);
  useEffect(() => {
    if (hud.phase === 'over') {
      placement.current = null;
      setPlace(null);
      openPanel('');
      void saveResult();
    }
  }, [hud.phase, saveResult, openPanel]);
  const me = hud.players.find((p) => p.id === id),
    keep = hud.buildings[0],
    nearest = me
      ? hud.buildings
          .filter((b) => b.kind !== 'keep' && dist(me, b) < 5)
          .sort((a, b) => dist(me, a) - dist(me, b))[0]
      : null,
    nearKeep = !!me && !!keep && dist(me, keep) < 6,
    cap = workerCap(hud),
    used = workersUsed(hud);
  function setPlacement(p: typeof place) {
    placement.current = p;
    setPlace(p);
  }
  function chooseBuild(kind: BuildKind) {
    const p = world.current.players.find((p) => p.id === id);
    if (!p) return;
    input.current.x = 0;
    input.current.z = 0;
    openPanel('');
    setPlacement({
      kind,
      x: Math.round(p.x * 2) / 2,
      z: Math.round((p.z - 3) * 2) / 2,
    });
  }
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  function down(e: React.PointerEvent) {
    if (e.button !== 0 || panel || quit || hud.phase === 'over') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    if (placement.current) {
      const p = scene.current?.point(e.clientX, e.clientY);
      if (p) setPlacement({ ...placement.current, ...p });
    } else setJoystick({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
  }
  function move(e: React.PointerEvent) {
    const ptr = pointer.current;
    if (!ptr || ptr.id !== e.pointerId) return;
    if (placement.current) {
      const p = scene.current?.point(e.clientX, e.clientY);
      if (p) setPlacement({ ...placement.current, ...p });
      return;
    }
    const dx = e.clientX - ptr.x,
      dy = e.clientY - ptr.y,
      len = Math.hypot(dx, dy),
      scale = Math.min(1, len / 45);
    input.current.x = len > 6 ? (dx / len) * scale : 0;
    input.current.z = len > 6 ? (dy / len) * scale : 0;
    setJoystick({
      x: ptr.x,
      y: ptr.y,
      dx: len ? (dx / len) * Math.min(45, len) : 0,
      dy: len ? (dy / len) * Math.min(45, len) : 0,
    });
  }
  function up() {
    pointer.current = null;
    input.current.x = 0;
    input.current.z = 0;
    setJoystick(null);
  }
  async function exit() {
    if (session.room)
      try {
        await api('leave', { code: session.room.code });
      } catch {}
    onExit();
  }
  const seconds = Math.floor(hud.elapsed),
    time =
      String(Math.floor(seconds / 60)).padStart(2, '0') +
      ':' +
      String(seconds % 60).padStart(2, '0');
  const aliveEnemies = hud.enemies.length + hud.left;
  return (
    <main className="game-stage">
      <div
        className="world-canvas"
        ref={mount}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
      />
      <div className="game-vignette" />
      <header className="game-header">
        <div className="game-brand">
          <Flame size={20} />
          <span>
            EMBERHOLD
            <small>
              {session.room ? 'ROOM ' + session.room.code : MAPS[hud.map].en}
            </small>
          </span>
        </div>
        <button
          className="icon-button"
          aria-label="เมนูพักเกม"
          onClick={() => openPanel('pause')}
        >
          <Pause size={18} />
        </button>
      </header>
      <section className="top-hud">
        <div className="wave-label">
          <span className="eyebrow">
            {hud.phase === 'prep' ? 'BUILD & BREATHE' : 'HOLD THE LINE'}
          </span>
          <strong>
            วันที่{' '}
            <b>
              {String(hud.phase === 'prep' ? hud.wave + 1 : hud.wave).padStart(
                2,
                '0',
              )}
            </b>
          </strong>
          <span>
            {hud.phase === 'prep'
              ? host
                ? 'เตรียมฐาน · กดเริ่มวันเมื่อพร้อม'
                : 'เตรียมฐาน · รอเจ้าของห้องเริ่มวัน'
              : `เหลือศัตรู ${aliveEnemies} · ${time}`}
          </span>
        </div>
        <div className="keep-level">
          <Castle size={16} />
          <b>L{keep?.level || 1}</b>
          <small>ฐานแม่</small>
        </div>
      </section>
      <section className="resource-bar" aria-label="ทรัพยากรกองกลาง">
        {RESOURCE_ORDER.map((k) => {
          const Icon = RES_ICON[k];
          return (
            <span key={k} title={RESOURCES[k].name}>
              <Icon size={13} />
              <b>{Math.floor(hud.res[k])}</b>
            </span>
          );
        })}
        <span className={used > cap ? 'strain' : ''} title="คนงาน">
          <Users size={13} />
          <b>
            {used}/{cap}
          </b>
        </span>
      </section>
      <div className="keep-health">
        <span>
          <Flame size={13} /> เปลวไฟแห่งอาณาจักร
        </span>
        <b>
          {Math.max(0, Math.ceil(keep?.hp || 0))} / {keep?.maxHp || 1000}
        </b>
        <div>
          <i
            style={{
              width:
                Math.max(0, ((keep?.hp || 0) / (keep?.maxHp || 1000)) * 100) +
                '%',
            }}
          />
        </div>
      </div>
      <div className="minimap" aria-label="แผนที่ฐานและศัตรู">
        <span className="map-boundary" />
        {hud.buildings.map((b) => (
          <i
            key={b.id}
            className={b.kind === 'keep' ? 'keep-dot' : 'building-dot'}
            style={{ left: 50 + b.x * 1.9 + '%', top: 50 + b.z * 1.9 + '%' }}
          />
        ))}
        {hud.enemies.map((e) => (
          <i
            key={e.id}
            className="enemy-dot"
            style={{ left: 50 + e.x * 1.9 + '%', top: 50 + e.z * 1.9 + '%' }}
          />
        ))}
        {hud.players.map((p) => (
          <i
            key={p.id}
            className="player-dot"
            style={{
              background: '#' + p.color.toString(16),
              left: 50 + p.x * 1.9 + '%',
              top: 50 + p.z * 1.9 + '%',
            }}
          />
        ))}
      </div>
      {session.room && (
        <div className="team-tags">
          {hud.players.map((p) => (
            <span key={p.id}>
              <i style={{ background: '#' + p.color.toString(16) }} />
              {p.name}
              {p.dead > 0 ? ' · ' + Math.ceil(p.dead) + 's' : ''}
            </span>
          ))}
        </div>
      )}
      {error && (
        <div className="network-notice" role="alert">
          <Radio size={16} />
          {error}
          <button onClick={() => setQuit(true)}>ออก</button>
        </div>
      )}
      {me && me.dead > 0 && (
        <div className="respawn">
          <Heart />
          <b>กลับมาสู้ใน {Math.ceil(me.dead)} วินาที</b>
          <span>เพื่อนและป้อมยังปกป้องฐานอยู่</span>
        </div>
      )}
      {joystick && (
        <div className="joystick" style={{ left: joystick.x, top: joystick.y }}>
          <i
            style={{
              transform: `translate(${joystick.dx}px,${joystick.dy}px)`,
            }}
          />
        </div>
      )}
      {!panel && !place && hud.phase !== 'over' && (
        <div className="game-bottom">
          <div className="hero-status">
            <span>
              <Heart size={14} />
              {Math.ceil(me?.hp || 0)}
              <small> / {me?.maxHp}</small>
            </span>
            <span>
              LV. {me?.level}
              <small>
                {' '}
                ·{' '}
                {me?.task === 'chop' ? (
                  <em className="chopping">
                    <Axe size={11} /> กำลังตัดไม้
                  </em>
                ) : me?.weapon === 'bow' ? (
                  'ธนู'
                ) : me?.weapon === 'sword' ? (
                  'ดาบ'
                ) : (
                  'คทา'
                )}
              </small>
            </span>
            <div className="xp-bar">
              <i
                style={{
                  width: ((me?.xp || 0) / ((me?.level || 1) * 22)) * 100 + '%',
                }}
              />
            </div>
          </div>
          <div className="bottom-actions">
            {hud.phase === 'prep' ? (
              <>
                <button
                  className="round-action"
                  onClick={() => openPanel('build')}
                >
                  <Hammer />
                  <span>สร้างฐาน</span>
                </button>
                {nearest ? (
                  <button
                    className="round-action"
                    onClick={() => {
                      setSelected(nearest);
                      openPanel('upgrade');
                    }}
                  >
                    <ArrowUp />
                    <span>อัปเกรด</span>
                  </button>
                ) : nearKeep ? (
                  <button
                    className="round-action"
                    onClick={() => {
                      setSelected(keep);
                      openPanel('keep');
                    }}
                  >
                    <Castle />
                    <span>ฐานแม่</span>
                  </button>
                ) : (
                  <span className="control-hint">
                    ลากบนสนาม
                    <br />
                    เพื่อเดิน
                  </span>
                )}
                {host && (
                  <button
                    className="next-wave"
                    onClick={() => send({ type: 'next' })}
                  >
                    <Play size={19} fill="currentColor" />
                    <span>เริ่มวัน</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="battle-hint">
                  <Swords size={18} /> โจมตีอัตโนมัติ
                  <br />
                  <small>ลากเพื่อเดินและหลบศัตรู</small>
                </span>
              </>
            )}
            {(me?.picks || 0) > 0 && (
              <button className="perk-button" onClick={() => openPanel('perk')}>
                <Sparkles size={21} />
                <span>เลือกพร +{me?.picks}</span>
              </button>
            )}
          </div>
        </div>
      )}
      {place && (
        <div className="placement-bar">
          <span>
            <Target size={16} />{' '}
            {(me && buildError(hud, me, place.kind, place.x, place.z)) ||
              `ลากบนพื้นเพื่อวาง ${BUILDINGS[place.kind].name}`}
          </span>
          <div>
            <button className="secondary" onClick={() => setPlacement(null)}>
              <X size={17} /> ยกเลิก
            </button>
            <button
              className="primary"
              disabled={
                !me ||
                !!buildError(hud, me, place.kind, place.x, place.z) ||
                hud.phase !== 'prep'
              }
              onClick={() => {
                if (send({ type: 'build', ...place })) {
                  setPlacement(null);
                  setToast('ส่งคำสั่งสร้างแล้ว');
                }
              }}
            >
              <Check size={17} /> สร้าง{' '}
              <CostChips cost={BUILDINGS[place.kind].cost} res={hud.res} />
            </button>
          </div>
        </div>
      )}
      <Dialog
        open={['build', 'upgrade', 'keep', 'perk', 'pause'].includes(panel)}
        onOpenChange={(open) => {
          if (!open) openPanel('');
        }}
      >
        <DialogContent
          className="game-sheet"
          showCloseButton={panel !== 'perk'}
        >
          <DialogTitle>
            {panel === 'build'
              ? 'ขยายอาณาจักร'
              : panel === 'upgrade'
                ? `อัปเกรด${selected ? BUILDINGS[selected.kind as BuildKind]?.name : ''}`
                : panel === 'keep'
                  ? `ฐานแม่ ระดับ ${keep?.level || 1}`
                  : panel === 'perk'
                    ? 'เลือกพรแห่งเปลวไฟ'
                    : 'พักใต้แสงไฟ'}
          </DialogTitle>
          <DialogDescription>
            {panel === 'build'
              ? `เลือกสิ่งก่อสร้าง แล้วลากไปวางในรัศมี ${KEEP_RADIUS[keep?.level || 1]} จากฐานแม่`
              : panel === 'upgrade'
                ? 'เดินใกล้อาคารแล้วเลือกสายพัฒนา'
                : panel === 'keep'
                  ? 'อัปเกรดฐานแม่เพื่อขยายรัศมีก่อสร้าง เพิ่มคนงาน และปลดล็อกระดับสิ่งก่อสร้าง'
                  : panel === 'perk'
                    ? 'พรนี้จะอยู่กับคุณตลอดรอบนี้'
                    : session.room
                      ? 'เกมของเพื่อนยังดำเนินต่อไป'
                      : 'เกมหยุดชั่วคราวแล้ว'}
          </DialogDescription>
          {panel === 'build' && (
            <Tabs defaultValue="defense">
              <TabsList className="build-tabs">
                <TabsTrigger value="defense">ป้องกัน</TabsTrigger>
                <TabsTrigger value="economy">เศรษฐกิจ</TabsTrigger>
                <TabsTrigger value="housing">ที่พัก</TabsTrigger>
              </TabsList>
              {(['defense', 'economy', 'housing'] as const).map((tab) => (
                <TabsContent value={tab} key={tab}>
                  <div className="build-options">
                    {(
                      Object.entries(BUILDINGS) as [
                        BuildKind,
                        (typeof BUILDINGS)[BuildKind],
                      ][]
                    )
                      .filter(([, b]) => b.tab === tab)
                      .map(([key, b]) => {
                        const reason = me
                          ? buildGate(hud, me, key)
                          : 'กำลังโหลด';
                        const Icon = BUILD_ICON[key];
                        return (
                          <button
                            key={key}
                            disabled={!!reason || hud.phase !== 'prep'}
                            onClick={() => chooseBuild(key)}
                          >
                            <Icon />
                            <span>
                              <b>
                                {b.name}
                                {b.tier > 1 && (
                                  <small className="tier"> ฐาน L{b.tier}</small>
                                )}
                              </b>
                              <small>{reason || b.desc}</small>
                            </span>
                            <strong>
                              {reason === 'ยังไม่ได้ปลดล็อก' ? (
                                <Lock size={17} />
                              ) : (
                                <>
                                  <CostChips cost={b.cost} res={hud.res} />
                                  {b.workers > 0 && (
                                    <small className="worker-cost">
                                      <Users size={11} /> {b.workers}
                                    </small>
                                  )}
                                </>
                              )}
                            </strong>
                          </button>
                        );
                      })}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
          {(panel === 'upgrade' || panel === 'keep') && selected && me && (
            <>
              <div className="upgrade-info">
                ระดับ {selected.level} /{' '}
                {selected.kind === 'keep' ? KEEP_MAX : 3}{' '}
                <span>{Math.ceil(selected.hp)} HP</span>
                {selected.kind === 'keep' && (
                  <span>
                    <Users size={13} /> คนงานจากฐาน{' '}
                    {KEEP_WORKERS[selected.level]}
                  </span>
                )}
              </div>
              {(
                selected.kind === 'keep'
                  ? selected.level >= KEEP_MAX
                  : selected.level >= 3
              ) ? (
                <p>อาคารนี้อัปเกรดเต็มแล้ว</p>
              ) : (
                <div
                  className={
                    'perk-options' +
                    (branches(selected.kind).length === 1 ? ' one' : '')
                  }
                >
                  {branches(selected.kind).map((branch) => {
                    const [name, desc] = BRANCH_TEXT[branch];
                    const err = upgradeError(hud, me, selected, branch);
                    return (
                      <button
                        key={branch}
                        disabled={hud.phase !== 'prep' || !!err}
                        onClick={() => {
                          if (
                            send({ type: 'upgrade', id: selected.id, branch })
                          ) {
                            openPanel('');
                            setToast('ส่งคำสั่งอัปเกรดแล้ว');
                          }
                        }}
                      >
                        {selected.kind === 'keep' ? <Castle /> : <ArrowUp />}
                        <b>{name}</b>
                        <small>
                          {selected.kind === 'keep'
                            ? `รัศมี ${KEEP_RADIUS[selected.level + 1]} · คนงาน +${KEEP_WORKERS[selected.level + 1] - KEEP_WORKERS[selected.level]} · HP +500`
                            : desc}
                        </small>
                        <CostChips cost={upgradeCost(selected)} res={hud.res} />
                        {err && <small className="lock-reason">{err}</small>}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {panel === 'perk' && (
            <div className="perk-options three">
              {(
                [
                  ['power', 'พลังโจมตี', 'พลังโจมตี +20%', Swords],
                  ['haste', 'ความรวดเร็ว', 'ความเร็วโจมตี +12%', Wind],
                  ['vitality', 'หัวใจผู้พิทักษ์', 'HP สูงสุด +25 และฟื้นฟู 50', Heart],
                ] as const
              ).map(([branch, name, desc, Icon]) => (
                <button
                  key={branch}
                  onClick={() => {
                    send({ type: 'perk', branch });
                    openPanel('');
                  }}
                >
                  <Icon />
                  <b>{name}</b>
                  <small>{desc}</small>
                </button>
              ))}
            </div>
          )}
          {panel === 'pause' && (
            <>
              <p className="pause-help">
                ลากนิ้วเพื่อเดิน ตัวละครโจมตีเองเมื่อศัตรูอยู่ในระยะ สร้างและอัปเกรดในช่วงพัก
                เก็บคริสตัลเพื่อรับพร และปกป้องฐานกลางให้นานที่สุด
              </p>
              <button className="primary wide" onClick={() => openPanel('')}>
                <Play size={18} /> กลับไปเล่น
              </button>
              <button
                className="secondary wide"
                onClick={() => {
                  openPanel('');
                  setQuit(true);
                }}
              >
                <Home size={18} /> กลับค่ายพัก
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={quit} onOpenChange={setQuit}>
        <DialogContent className="ember-dialog">
          <DialogTitle>ออกจากรอบนี้?</DialogTitle>
          <DialogDescription>
            {session.room?.host
              ? 'คุณเป็นเจ้าของห้อง การออกจะปิดห้องของเพื่อนด้วย รอบที่ยังไม่จบจะไม่ได้แต้ม'
              : 'รอบที่ยังไม่จบจะไม่ได้แต้ม คุณสามารถเริ่มรอบใหม่จากค่ายพักได้'}
          </DialogDescription>
          <button className="primary" onClick={exit}>
            ออกจากรอบ
          </button>
          <button className="secondary" onClick={() => setQuit(false)}>
            เล่นต่อ
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={hud.phase === 'over'}>
        <DialogContent
          className="ember-dialog result-dialog"
          showCloseButton={false}
        >
          <span className="result-icon">
            <Flame size={36} />
          </span>
          <span className="eyebrow gold">EVERY END IS A BEGINNING</span>
          <DialogTitle>เปลวไฟดับลง</DialogTitle>
          <DialogDescription>
            พักสักครู่ แล้วกลับมาสร้างให้แข็งแกร่งกว่าเดิม
          </DialogDescription>
          <div className="results-grid">
            <span>
              <b>{Math.max(0, hud.wave - 1)}</b>
              <small>Wave ที่ผ่าน</small>
            </span>
            <span>
              <b>{time}</b>
              <small>เวลาที่รอด</small>
            </span>
            <span>
              <b>{hud.kills}</b>
              <small>ศัตรูที่กำจัด</small>
            </span>
          </div>
          <div className="earned">
            <Sparkles /> +{reward(hud)} แต้มเปลวไฟ
          </div>
          <button
            className="primary wide"
            disabled={saving}
            onClick={saved ? exit : saveResult}
          >
            {saving
              ? 'กำลังบันทึกแต้ม…'
              : saved
                ? 'กลับค่ายพักและอัปเกรด'
                : 'ลองบันทึกแต้มอีกครั้ง'}
            <ArrowUp size={18} />
          </button>
          {!saved && !saving && (
            <button className="secondary" onClick={exit}>
              กลับค่ายโดยไม่บันทึก
            </button>
          )}
        </DialogContent>
      </Dialog>
      {toast && <output className="game-toast">{toast}</output>}
    </main>
  );
}
