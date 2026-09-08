'use client';
/* eslint-disable react/react-compiler -- This component synchronizes an external room service and imperative WebMCP registry; React Compiler is not enabled. */
import { useEffect, useState } from 'react';
import {
  Flame,
  ArrowRight,
  Users,
  Swords,
  Crosshair,
  Sparkles,
  Mountain,
  Trees,
  Snowflake,
  ArrowUp,
  Heart,
  RefreshCw,
  Copy,
  Check,
  LogOut,
  Radio,
  Shield,
  Dices,
  CalendarDays,
  Bookmark,
  Trash2,
  Play,
} from 'lucide-react';
import { Dialog, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { EmberDialogContent } from '@/components/EmberDialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  api,
  type LobbyMember,
  type RoomSummary,
  type SavedSeed,
  type CurrentRoom,
} from '@/lib/game/api';
import {
  newWorld,
  addPlayer,
  MAPS,
  Profile,
  Weapon,
  MapId,
  randomSeed,
  normalizeSeed,
  weeklySeed,
  squadCost,
  MAX_SQUAD,
  BASE_STACK,
  LENGTHS,
  type World,
} from '@/lib/game/engine';
import Game, { Session } from './Game';
type Room = {
  code: string;
  host: boolean;
  map: MapId;
  seed: string;
  days: number;
};
type SaveSlot = { world: World; weapon: Weapon; savedAt: number };
export const saveKey = (profileId: string) => 'emberhold:save:' + profileId;
export const lengthLabel = (d: number) => (d ? `${d} วัน` : 'ไม่จำกัด');
export default function Home() {
  const [weapon, setWeapon] = useState<Weapon>('bow'),
    [map, setMap] = useState<MapId>('forest'),
    [profile, setProfile] = useState<Profile | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [modal, setModal] = useState(''),
    [room, setRoom] = useState<Room | null>(null),
    [members, setMembers] = useState<LobbyMember[]>([]),
    [rooms, setRooms] = useState<RoomSummary[]>([]),
    [code, setCode] = useState(''),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [copied, setCopied] = useState(false),
    [loadingRooms, setLoadingRooms] = useState(false),
    [seed, setSeed] = useState(''),
    [days, setDays] = useState(80),
    [save, setSave] = useState<SaveSlot | null>(null),
    [current, setCurrent] = useState<CurrentRoom | null>(null),
    [savedSeeds, setSavedSeeds] = useState<SavedSeed[]>([]);
  function loadSave(profileId: string) {
    try {
      const raw = localStorage.getItem(saveKey(profileId));
      const slot = raw ? (JSON.parse(raw) as SaveSlot) : null;
      setSave(
        slot &&
          slot.world &&
          slot.world.phase !== 'over' &&
          slot.world.players?.some((p) => p.id === profileId)
          ? slot
          : null,
      );
    } catch {
      setSave(null);
    }
  }
  async function loadProfile() {
    try {
      const r = await api('profile');
      setProfile(r.profile);
      setName(r.profile.name);
      loadSave(r.profile.id);
      setCurrent(r.room);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void loadProfile();
    const params = new URLSearchParams(window.location.search);
    const fromUrl = normalizeSeed(params.get('seed') || '');
    setSeed(fromUrl || randomSeed());
    const join = params.get('room');
    if (join && /^\d{6}$/.test(join)) {
      setCode(join);
      setModal('coop');
    }
  }, []);
  useEffect(() => {
    if (!room || session) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const r = await api('lobby', { code: room!.code });
        if (stopped) return;
        setMembers(r.players);
        setError('');
        if (r.status === 'playing' && r.snapshot && profile) {
          setSession({ world: r.snapshot, profile, weapon, room: room! });
          setModal('');
          return;
        }
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      }
      if (!stopped) timer = setTimeout(poll, 1100);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [room, session, profile, weapon]);
  useEffect(() => {
    if (modal !== 'coop' || room) return;
    void listRooms();
    const timer = setInterval(listRooms, 5000);
    return () => clearInterval(timer);
  }, [modal, room]);
  async function listRooms() {
    setLoadingRooms(true);
    try {
      const r = await api('list');
      setRooms(r.rooms);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingRooms(false);
    }
  }
  async function loadSeeds() {
    try {
      const r = await api('seeds');
      setSavedSeeds(r.seeds);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (modal === 'camp') void loadSeeds();
  }, [modal]);
  async function deleteSeed(id: string) {
    setBusy(true);
    try {
      const r = await api('seed-delete', { id });
      setSavedSeeds(r.seeds);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveName() {
    if (name.trim() && name !== profile?.name) {
      await api('name', { name: name.trim() });
      setProfile((p) => (p ? { ...p, name: name.trim() } : p));
    }
  }
  function solo() {
    if (!profile) return;
    const world = newWorld(map, seed, days);
    addPlayer(world, profile, weapon);
    setSession({ world, profile, weapon });
  }
  function rejoin() {
    if (!current) return;
    setError('');
    setRoom({
      code: current.code,
      host: current.host,
      map: current.map,
      seed: current.seed,
      days: current.days,
    });
    setMembers([]);
    setModal('coop');
  }
  async function leaveCurrent() {
    if (!current) return;
    try {
      await api('leave', { code: current.code });
    } catch {}
    setCurrent(null);
  }
  function resume() {
    if (!profile || !save) return;
    setSession({ world: save.world, profile, weapon: save.weapon });
  }
  function discardSave() {
    if (!profile) return;
    try {
      localStorage.removeItem(saveKey(profile.id));
    } catch {}
    setSave(null);
  }
  async function create() {
    setBusy(true);
    setError('');
    try {
      await saveName();
      const r = await api('create', { map, weapon, seed, days });
      setRoom(r);
      setMembers([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function join(c = code) {
    setBusy(true);
    setError('');
    try {
      await saveName();
      const r = await api('join', { code: c, weapon });
      setRoom(r);
      setMembers([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    if (room)
      try {
        await api('leave', { code: room.code });
      } catch {}
    setRoom(null);
    setMembers([]);
    setError('');
  }
  async function startRoom() {
    if (!profile || !room) return;
    setBusy(true);
    try {
      const fresh = await api('lobby', { code: room.code });
      const world = newWorld(
        room.map,
        room.seed || fresh.seed,
        room.days ?? fresh.days,
      );
      for (const p of fresh.players) addPlayer(world, p, p.weapon);
      await api('sync', {
        code: room.code,
        snapshot: world,
        input: { x: 0, z: 0, commands: [] },
      });
      setSession({ world, profile, weapon, room });
      setModal('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function purchase(item: string) {
    setBusy(true);
    setError('');
    try {
      const r = await api('purchase', { item });
      setProfile(r.profile);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const abort = new AbortController();
    const tools = [
      {
        name: 'read_emberhold_lobby',
        description: 'Read selected weapon, map and room status.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => ({
          weapon,
          map,
          room: room?.code || null,
          playing: !!session,
        }),
      },
      {
        name: 'configure_emberhold_run',
        description:
          'Select the weapon and map before a solo game. Does not start a game.',
        inputSchema: {
          type: 'object',
          properties: {
            weapon: { type: 'string', enum: ['bow', 'sword', 'staff'] },
            map: { type: 'string', enum: ['forest', 'desert', 'snow'] },
          },
          required: ['weapon', 'map'],
          additionalProperties: false,
        },
        execute: (input: unknown) => {
          if (!input || typeof input !== 'object')
            throw new Error('Invalid selection');
          const v = input as { weapon: Weapon; map: MapId };
          if (session || room) throw new Error('Already in a game or room');
          if (
            !['bow', 'sword', 'staff'].includes(v.weapon) ||
            !['forest', 'desert', 'snow'].includes(v.map)
          )
            throw new Error('Invalid selection');
          setWeapon(v.weapon);
          setMap(v.map);
          return { weapon: v.weapon, map: v.map };
        },
      },
    ];
    for (const tool of tools)
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: abort.signal }),
        ).catch(() => {});
      } catch {}
    return () => abort.abort();
  }, [weapon, map, room, session]);
  if (session)
    return (
      <Game
        session={session}
        onProfile={setProfile}
        onExit={() => {
          setSession(null);
          setRoom(null);
          setMembers([]);
          setModal('');
          void loadProfile();
        }}
        onSave={(world, weapon) => {
          if (!profile) return;
          try {
            if (world) {
              const slot: SaveSlot = { world, weapon, savedAt: Date.now() };
              localStorage.setItem(saveKey(profile.id), JSON.stringify(slot));
            } else localStorage.removeItem(saveKey(profile.id));
          } catch {}
        }}
      />
    );
  return (
    <main className="app-shell">
      <div className="ambient" />
      <header className="masthead">
        <span className="brand">
          <Flame size={20} /> EMBERHOLD
        </span>
        <button
          className="camp-button"
          disabled={!profile}
          onClick={() => {
            setModal('camp');
            setError('');
          }}
        >
          <Sparkles size={16} />
          <b>{profile?.points || 0}</b>
          <span>ค่ายพัก</span>
          <ArrowUp size={14} />
        </button>
      </header>
      <section className="home">
        <div className="title-block">
          <span className="eyebrow gold">THE LAST LIGHT STANDS</span>
          <h1>
            Hold until
            <br />
            <em>dawn.</em>
          </h1>
          <p>
            สร้างอาณาจักรเล็ก ๆ ของคุณ
            <br />
            และปกป้องมันให้นานที่สุด
          </p>
          <div className="title-details">
            <span>
              <Shield size={16} /> สร้างอิสระ
            </span>
            <span>
              <Users size={16} /> CO-OP 1–4
            </span>
            <span>
              <Flame size={16} /> ไม่สิ้นสุด
            </span>
          </div>
          <div className="best-stat">
            <span>YOUR LONGEST STAND</span>
            <b>
              {String(profile?.best || 0).padStart(2, '0')} <small>WAVES</small>
            </b>
          </div>
        </div>
        <div className="setup">
          <div className="section-label">
            <span>01 / เลือกอาวุธ</span>
            <small>โจมตีอัตโนมัติ</small>
          </div>
          <div className="choice-grid">
            {(
              [
                ['bow', 'ธนู', 'คล่องตัว · ยิงไกล', Crosshair],
                ['sword', 'ดาบ', 'กวาดฟัน · ระยะใกล้', Swords],
                ['staff', 'คทา', 'เวทมนตร์ · โจมตีหมู่', Sparkles],
              ] as const
            ).map(([id, name, desc, Icon]) => (
              <button
                key={id}
                aria-pressed={weapon === id}
                className={'choice ' + (weapon === id ? 'selected' : '')}
                onClick={() => setWeapon(id)}
              >
                <Icon />
                <b>{name}</b>
                <small>{desc}</small>
              </button>
            ))}
          </div>
          <div className="section-label">
            <span>02 / เลือกดินแดน</span>
            <small>สร้างได้อย่างอิสระ</small>
          </div>
          <div className="map-list">
            {(
              [
                ['forest', Trees],
                ['desert', Mountain],
                ['snow', Snowflake],
              ] as const
            ).map(([id, Icon]) => (
              <button
                key={id}
                aria-pressed={map === id}
                onClick={() => setMap(id)}
                className={
                  'map-choice ' + id + ' ' + (map === id ? 'selected' : '')
                }
              >
                <Icon />
                <span>
                  <b>{MAPS[id as MapId].name}</b>
                  <small>{MAPS[id as MapId].en}</small>
                </span>
                <span className="radio-dot" />
              </button>
            ))}
          </div>
          <div className="section-label">
            <span>03 / ความยาว</span>
            <small>1 วัน = 1 wave กดเริ่มเอง</small>
          </div>
          <div className="length-row" aria-label="ความยาวเกม">
            {LENGTHS.map((d) => (
              <button
                key={d}
                aria-pressed={days === d}
                className={days === d ? 'selected' : ''}
                onClick={() => setDays(d)}
              >
                {d ? d : '∞'}
                <small>{d ? 'วัน' : 'ไม่จำกัด'}</small>
              </button>
            ))}
          </div>
          <div className="section-label">
            <span>04 / SEED แผนที่</span>
            <small>seed เดียวกัน = แผนที่เดียวกัน</small>
          </div>
          <div className="seed-row">
            <input
              aria-label="seed แผนที่"
              value={seed}
              maxLength={8}
              onChange={(e) => setSeed(e.target.value.toUpperCase())}
              onBlur={() => setSeed(normalizeSeed(seed) || randomSeed())}
              spellCheck={false}
            />
            <button
              className="secondary"
              aria-label="สุ่ม seed"
              onClick={() => setSeed(randomSeed())}
            >
              <Dices size={17} />
            </button>
            <button
              className={'secondary' + (seed === weeklySeed() ? ' active' : '')}
              onClick={() => setSeed(weeklySeed())}
            >
              <CalendarDays size={15} /> สัปดาห์นี้
            </button>
          </div>
          {current && !room && (
            <div className="resume-card rejoin">
              <span>
                <b>
                  {current.status === 'playing'
                    ? 'ห้องของคุณกำลังเล่นอยู่'
                    : 'คุณยังอยู่ในห้องรอ'}
                </b>
                <small>
                  #{current.code} · {MAPS[current.map].name}
                  {current.status === 'playing' ? ` · วันที่ ${current.day}` : ''}
                  {current.host ? ' · คุณเป็นเจ้าของห้อง' : ''}
                </small>
              </span>
              <button className="primary" onClick={rejoin}>
                <Radio size={15} /> กลับเข้าห้อง
              </button>
              <button
                className="secondary"
                aria-label="ออกจากห้อง"
                onClick={leaveCurrent}
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
          {save && (
            <div className="resume-card">
              <span>
                <b>เล่นต่อจากที่ค้างไว้</b>
                <small>
                  {MAPS[save.world.map].name} · SEED {save.world.seed} · วันที่{' '}
                  {save.world.wave + 1}
                  {save.world.days ? ` / ${save.world.days}` : ''}
                </small>
              </span>
              <button className="primary" onClick={resume}>
                <Play size={15} /> เล่นต่อ
              </button>
              <button
                className="secondary"
                aria-label="ลบเซฟ"
                onClick={discardSave}
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
          <button className="primary wide" disabled={!profile} onClick={solo}>
            {profile ? 'เริ่มผจญภัยคนเดียว' : 'กำลังเตรียมค่ายพัก…'}
            <ArrowRight size={19} />
          </button>
          <button
            className="secondary wide"
            disabled={!profile}
            onClick={() => {
              setModal('coop');
              setError('');
            }}
          >
            <Users size={18} /> เล่นกับเพื่อน
          </button>
          {error && !modal && (
            <p className="inline-error" role="alert">
              {error}
              <button onClick={loadProfile}>ลองใหม่</button>
            </p>
          )}
          <p className="footnote">ลากเพื่อเดิน · โจมตีอัตโนมัติ · เล่นได้ด้วยมือเดียว</p>
        </div>
      </section>
      <footer>
        EARLY PLAYTEST <span>01 / ENDLESS SURVIVAL</span>
      </footer>
      <Dialog
        open={modal === 'coop'}
        onOpenChange={(open) => {
          if (!open && !room) {
            setModal('');
            setError('');
          }
        }}
      >
        <EmberDialogContent
          className="ember-dialog lobby-dialog"
          showCloseButton={!room}
        >
          <DialogTitle>{room ? 'รวมพลผู้พิทักษ์' : 'ร่วมปกป้องเปลวไฟ'}</DialogTitle>
          <DialogDescription>
            {room
              ? `${MAPS[room.map].name} · ${lengthLabel(room.days)} · SEED ${room.seed || '?'} · สูงสุด 4 คน`
              : 'สร้างห้อง ชวนด้วยเลข 6 หลัก หรือเข้าห้องที่ว่าง'}
          </DialogDescription>
          {room ? (
            <>
              <div className="room-code">
                <small>เลขห้อง · ส่งให้เพื่อน</small>
                <b>{room.code}</b>
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(room.code);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      setError('คัดลอกไม่ได้ กรุณาส่งเลขห้องด้านบนให้เพื่อน');
                    }
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอกเลขห้อง'}
                </button>
              </div>
              <div className="member-list">
                {Array.from({ length: 4 }, (_, i) => {
                  const p = members[i];
                  return (
                    <div key={p?.id || i} className={p ? '' : 'empty-member'}>
                      <span className="member-avatar">
                        {p ? <Swords size={18} /> : <Users size={18} />}
                      </span>
                      <span>
                        {p?.name || 'รอผู้พิทักษ์…'}
                        {p && (
                          <small>
                            {p.weapon === 'bow'
                              ? 'ธนู'
                              : p.weapon === 'sword'
                                ? 'ดาบ'
                                : 'คทา'}
                            {p.id === profile?.id ? ' · คุณ' : ''}
                          </small>
                        )}
                      </span>
                      {p && <i className="online-dot" />}
                    </div>
                  );
                })}
              </div>
              {room.host ? (
                <button
                  className="primary wide"
                  disabled={busy || members.length < 1}
                  onClick={startRoom}
                >
                  เริ่มป้องกันอาณาจักร <ArrowRight size={17} />
                </button>
              ) : (
                <p className="waiting">
                  <Radio size={17} /> รอเจ้าของห้องเริ่มเกม หรือกำลังเข้าร่วมเกมที่เล่นอยู่…
                </p>
              )}
              <button className="secondary wide" onClick={leave}>
                <LogOut size={16} /> ออกจากห้อง
              </button>
            </>
          ) : (
            <>
              <label className="field-label">
                ชื่อผู้พิทักษ์
                <input
                  value={name}
                  maxLength={20}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อของคุณ"
                />
              </label>
              <Tabs defaultValue="join">
                <TabsList className="build-tabs">
                  <TabsTrigger value="join">เข้าห้อง</TabsTrigger>
                  <TabsTrigger value="create">สร้างห้อง</TabsTrigger>
                </TabsList>
                <TabsContent value="join">
                  <form
                    className="join-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void join();
                    }}
                  >
                    <input
                      aria-label="เลขห้อง 6 หลัก"
                      placeholder="เลขห้อง 6 หลัก"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ''))
                      }
                    />
                    <button
                      className="primary"
                      disabled={busy || code.length !== 6}
                    >
                      เข้าห้อง
                    </button>
                  </form>
                  <div className="section-label room-list-title">
                    <span>ห้องที่ว่าง</span>
                    <button
                      className="icon-button"
                      aria-label="ค้นหาห้องอีกครั้ง"
                      onClick={listRooms}
                    >
                      <RefreshCw
                        size={15}
                        className={loadingRooms ? 'spin' : ''}
                      />
                    </button>
                  </div>
                  <div className="available-rooms">
                    {rooms.length ? (
                      rooms.map((r) => (
                        <button
                          key={r.code}
                          disabled={busy}
                          onClick={() => join(r.code)}
                        >
                          <span>
                            <b>
                              {r.name}
                              {r.status === 'playing' && (
                                <em className="live-badge">
                                  กำลังเล่น · วันที่ {r.day}
                                </em>
                              )}
                            </b>
                            <small>
                              {MAPS[r.map as MapId]?.name} ·{' '}
                              {lengthLabel(r.days)} · #{r.code}
                            </small>
                          </span>
                          <strong>
                            {r.count}/4 <ArrowRight size={16} />
                          </strong>
                        </button>
                      ))
                    ) : (
                      <div className="room-empty">
                        <Users size={25} />
                        <p>{loadingRooms ? 'กำลังค้นหาห้อง…' : 'ยังไม่มีห้องว่าง'}</p>
                        <small>สร้างห้องแรกแล้วส่งเลขห้องให้เพื่อนได้เลย</small>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="create">
                  <div className="create-summary">
                    <Trees size={28} />
                    <b>{MAPS[map].name}</b>
                    <p>
                      ใช้อาวุธที่เลือกไว้ · เงินและฐานใช้ร่วมกัน
                      <br />
                      เพื่อนเลือกอาวุธเองก่อนเข้าห้องได้
                    </p>
                  </div>
                  <button
                    className="primary wide"
                    disabled={busy}
                    onClick={create}
                  >
                    สร้างห้อง <Users size={18} />
                  </button>
                </TabsContent>
              </Tabs>
            </>
          )}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </EmberDialogContent>
      </Dialog>
      <Dialog
        open={modal === 'camp'}
        onOpenChange={(open) => {
          if (!open) setModal('');
        }}
      >
        <EmberDialogContent className="ember-dialog camp-dialog">
          <DialogTitle>ค่ายพักแห่งเปลวไฟ</DialogTitle>
          <DialogDescription>การพัฒนาเหล่านี้อยู่กับคุณในรอบต่อไป</DialogDescription>
          <div className="camp-points">
            <Sparkles />
            <strong>{profile?.points || 0}</strong>
            <span>แต้มเปลวไฟ</span>
          </div>
          <div className="camp-upgrades">
            {(
              [
                ['power', 'ฝึกฝนการต่อสู้', 'พลังโจมตีเริ่มต้น +8% ต่อระดับ', Swords],
                ['vitality', 'หัวใจผู้พิทักษ์', 'HP เริ่มต้น +15 ต่อระดับ', Heart],
                [
                  'squad',
                  'ขยายกองกำลัง',
                  `พาทหารไปด้วยได้ ${BASE_STACK} + ระดับ นาย`,
                  Users,
                ],
                ['frost', 'ปลดล็อกป้อมเวท', 'สร้างป้อมโจมตีและชะลอศัตรู', Snowflake],
                ['shrine', 'ปลดล็อกศาลาฟื้นฟู', 'สร้างอาคารฟื้นฟูผู้เล่นในระยะ', Flame],
              ] as const
            ).map(([key, title, desc, Icon]) => {
              const isLevel =
                  key === 'power' || key === 'vitality' || key === 'squad',
                level = isLevel ? profile?.[key] || 0 : 0,
                maxLevel = key === 'squad' ? MAX_SQUAD : 10,
                unlocked = isLevel
                  ? level >= maxLevel
                  : profile?.unlocks.includes(key),
                cost = isLevel
                  ? key === 'squad'
                    ? squadCost(level)
                    : 30 + level * 25
                  : key === 'frost'
                    ? 60
                    : 90;
              return (
                <div key={key}>
                  <Icon />
                  <span>
                    <b>{title}</b>
                    <small>{desc}</small>
                    {isLevel && (
                      <small>
                        ระดับ {level}/{maxLevel}
                      </small>
                    )}
                  </span>
                  <button
                    className={unlocked ? 'secondary' : 'primary'}
                    disabled={busy || unlocked || (profile?.points || 0) < cost}
                    onClick={() => purchase(key)}
                  >
                    {unlocked ? (
                      <Check size={17} />
                    ) : (
                      <>
                        {cost}
                        <Sparkles size={13} />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="room-list-title">
            <Bookmark size={15} /> SEED ที่บันทึกไว้
          </div>
          {savedSeeds.length === 0 ? (
            <p className="room-empty">
              ยังไม่มี seed ที่บันทึก
              <small>บันทึกได้จากหน้าจบรอบ เมื่อชอบแผนที่นั้น</small>
            </p>
          ) : (
            <div className="saved-seeds">
              {savedSeeds.map((sd) => (
                <div key={sd.id}>
                  <span>
                    <b>{sd.seed}</b>
                    <small>
                      {MAPS[sd.map].name}
                      {sd.best ? ` · ดีที่สุด วันที่ ${sd.best}` : ''}
                      {sd.name ? ` · ${sd.name}` : ''}
                    </small>
                  </span>
                  <button
                    className="primary"
                    aria-label="เล่น seed นี้"
                    onClick={() => {
                      setMap(sd.map);
                      setSeed(sd.seed);
                      setModal('');
                    }}
                  >
                    <Play size={15} />
                  </button>
                  <button
                    className="secondary"
                    aria-label="ลบ seed"
                    disabled={busy}
                    onClick={() => deleteSeed(sd.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="footnote">
            แต้มคำนวณจาก Wave ที่ผ่าน ศัตรูที่กำจัด และเวลาต่อสู้
            <br />
            ความก้าวหน้าผูกกับเบราว์เซอร์นี้ ไม่ต้องสมัครบัญชี
          </p>
          {error && <p className="inline-error">{error}</p>}
        </EmberDialogContent>
      </Dialog>
    </main>
  );
}
