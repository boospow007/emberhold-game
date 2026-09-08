import { database } from '@/db/raw';
import {
  reward,
  normalizeSeed,
  type World,
  type Profile,
  type MapId,
  type Weapon,
  type Input,
} from '@/lib/game/engine';
type DbProfile = Omit<Profile, 'unlocks'> & { unlocks: string };
type DbRoom = {
  host: string;
  map: MapId;
  seed: string;
  updated: number;
  snapshot: string | null;
  status: string;
};
type DbMember = DbProfile & { weapon: Weapon; input: string; updated: number };
type Payload = {
  action: string;
  name: string;
  item: string;
  map: MapId;
  weapon: Weapon;
  code: string;
  run: string;
  seed: string;
  id: string;
  points: number;
  wave: number;
  input: Input;
  snapshot: World;
};
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200, cookie?: string) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  });
const valid = (s: unknown, max = 40) =>
  typeof s === 'string' && s.length > 0 && s.length <= max;
function profileRow(p: DbProfile | null) {
  if (!p) throw new Error('Profile missing');
  return { ...p, unlocks: JSON.parse(p.unlocks || '[]') as string[] };
}
export async function POST(req: Request) {
  try {
    if (
      req.headers.get('origin') &&
      new URL(req.headers.get('origin')!).host !== new URL(req.url).host
    )
      return json({ error: 'คำขอไม่ถูกต้อง' }, 403);
    const raw = await req.text();
    if (raw.length > 180000) return json({ error: 'ข้อมูลใหญ่เกินไป' }, 413);
    let b: Payload;
    try {
      b = JSON.parse(raw) as Payload;
      if (!b || typeof b !== 'object')
        return json({ error: 'ข้อมูลไม่ถูกต้อง' }, 400);
    } catch {
      return json({ error: 'ข้อมูลไม่ถูกต้อง' }, 400);
    }
    const db = database(),
      now = Date.now();
    let sessionToken = req.headers
      .get('cookie')
      ?.match(/(?:^|;\s*)ember_session=([a-f0-9-]{36})/)?.[1];
    let cookie: string | undefined;
    if (!sessionToken) {
      sessionToken = crypto.randomUUID();
      cookie = `ember_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
    }
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(sessionToken),
    );
    const id = Array.from(new Uint8Array(digest), (n) =>
      n.toString(16).padStart(2, '0'),
    ).join('');
    await db
      .prepare('INSERT OR IGNORE INTO profiles(id,name) VALUES(?,?)')
      .bind(id, 'ผู้พิทักษ์ ' + id.slice(0, 3).toUpperCase())
      .run();
    const profile = await db
      .prepare('SELECT * FROM profiles WHERE id=?')
      .bind(id)
      .first<DbProfile>();
    if (!profile) throw new Error('Profile unavailable');
    const result = (data: unknown, status = 200) => json(data, status, cookie);
    if (b.action === 'profile') return result({ profile: profileRow(profile) });
    if (b.action === 'name') {
      if (!valid(b.name, 20))
        return result({ error: 'ชื่อยาวได้ไม่เกิน 20 ตัวอักษร' }, 400);
      await db
        .prepare('UPDATE profiles SET name=? WHERE id=?')
        .bind(b.name.trim() || 'ผู้พิทักษ์', id)
        .run();
      return result({ ok: true });
    }
    if (b.action === 'purchase') {
      let cost = 0,
        sql = '';
      if (b.item === 'power' || b.item === 'vitality') {
        if (profile[b.item] >= 10)
          return result({ error: 'อัปเกรดเต็มแล้ว' }, 400);
        cost = 30 + profile[b.item] * 25;
        sql = `UPDATE profiles SET ${b.item}=${b.item}+1,points=points-? WHERE id=? AND points>=?`;
      } else if (['frost', 'shrine'].includes(b.item)) {
        cost = b.item === 'frost' ? 60 : 90;
        const unlocks = JSON.parse(profile.unlocks);
        if (unlocks.includes(b.item))
          return result({ error: 'ปลดล็อกแล้ว' }, 400);
        sql =
          'UPDATE profiles SET unlocks=?,points=points-? WHERE id=? AND points>=?';
        const r = await db
          .prepare(sql)
          .bind(JSON.stringify([...unlocks, b.item]), cost, id, cost)
          .run();
        if (!r.meta.changes) return result({ error: 'แต้มไม่พอ' }, 400);
        return result({
          profile: profileRow(
            await db
              .prepare('SELECT * FROM profiles WHERE id=?')
              .bind(id)
              .first<DbProfile>(),
          ),
        });
      } else return result({ error: 'ไม่พบอัปเกรด' }, 400);
      const r = await db.prepare(sql).bind(cost, id, cost).run();
      if (!r.meta.changes) return result({ error: 'แต้มไม่พอ' }, 400);
      return result({
        profile: profileRow(
          await db
            .prepare('SELECT * FROM profiles WHERE id=?')
            .bind(id)
            .first<DbProfile>(),
        ),
      });
    }
    if (
      b.action === 'seeds' ||
      b.action === 'seed-save' ||
      b.action === 'seed-delete'
    ) {
      if (b.action === 'seed-save') {
        const seed = normalizeSeed(b.seed);
        if (!seed || !['forest', 'desert', 'snow'].includes(b.map))
          return result({ error: 'seed ไม่ถูกต้อง' }, 400);
        const count = await db
          .prepare('SELECT COUNT(*) AS n FROM seeds WHERE profile=?')
          .bind(id)
          .first<{ n: number }>();
        const exists = await db
          .prepare('SELECT id FROM seeds WHERE profile=? AND seed=? AND map=?')
          .bind(id, seed, b.map)
          .first<{ id: string }>();
        if (!exists && (count?.n || 0) >= 20)
          return result({ error: 'บันทึก seed ได้สูงสุด 20 รายการ' }, 400);
        const wave = Math.max(
          0,
          Math.min(999, Math.floor(Number(b.wave) || 0)),
        );
        if (exists)
          await db
            .prepare(
              "UPDATE seeds SET best=MAX(best,?),name=COALESCE(NULLIF(?,''),name) WHERE id=?",
            )
            .bind(wave, valid(b.name, 30) ? b.name.trim() : '', exists.id)
            .run();
        else
          await db
            .prepare(
              'INSERT INTO seeds(id,profile,seed,map,name,best,created) VALUES(?,?,?,?,?,?,?)',
            )
            .bind(
              crypto.randomUUID(),
              id,
              seed,
              b.map,
              valid(b.name, 30) ? b.name.trim() : '',
              wave,
              now,
            )
            .run();
      } else if (b.action === 'seed-delete') {
        if (!valid(b.id, 60)) return result({ error: 'ไม่พบ seed' }, 400);
        await db
          .prepare('DELETE FROM seeds WHERE id=? AND profile=?')
          .bind(b.id, id)
          .run();
      }
      const rows = await db
        .prepare(
          'SELECT id,seed,map,name,best,created FROM seeds WHERE profile=? ORDER BY created DESC LIMIT 20',
        )
        .bind(id)
        .all();
      return result({ seeds: rows.results });
    }
    if (b.action === 'list') {
      const rooms = await db
        .prepare(
          "SELECT r.code,r.name,r.map,(SELECT COUNT(*) FROM members m WHERE m.room=r.code AND m.updated>?) AS count FROM rooms r WHERE r.status='lobby' AND r.updated>? ORDER BY r.updated DESC LIMIT 25",
        )
        .bind(now - 45000, now - 45000)
        .all<{ code: string; name: string; map: MapId; count: number }>();
      return result({ rooms: rooms.results.filter((r) => r.count < 4) });
    }
    if (b.action === 'create') {
      if (
        !['forest', 'desert', 'snow'].includes(b.map) ||
        !['bow', 'sword', 'staff'].includes(b.weapon)
      )
        return result({ error: 'เลือกแผนที่และอาวุธ' }, 400);
      await db.batch([
        db.prepare('DELETE FROM members WHERE id=?').bind(id),
        db
          .prepare('DELETE FROM rooms WHERE host=? OR updated<?')
          .bind(id, now - 86400000),
        db.prepare('DELETE FROM members WHERE updated<?').bind(now - 86400000),
      ]);
      const seed = normalizeSeed(b.seed || '');
      let code = '';
      for (let i = 0; i < 5; i++) {
        code = String(
          100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000),
        );
        const r = await db
          .prepare(
            'INSERT OR IGNORE INTO rooms(code,host,name,map,seed,updated) VALUES(?,?,?,?,?,?)',
          )
          .bind(code, id, profile.name, b.map, seed, now)
          .run();
        if (r.meta.changes) break;
        code = '';
      }
      if (!code) return result({ error: 'สร้างห้องไม่สำเร็จ ลองใหม่' }, 503);
      await db
        .prepare('INSERT INTO members(id,room,weapon,updated) VALUES(?,?,?,?)')
        .bind(id, code, b.weapon, now)
        .run();
      return result({ code, host: true, map: b.map, seed });
    }
    if (b.action === 'join') {
      if (
        !/^\d{6}$/.test(b.code) ||
        !['bow', 'sword', 'staff'].includes(b.weapon)
      )
        return result({ error: 'กรอกเลขห้อง 6 หลัก' }, 400);
      const room = await db
        .prepare(
          "SELECT * FROM rooms WHERE code=? AND status='lobby' AND updated>?",
        )
        .bind(b.code, now - 45000)
        .first<DbRoom>();
      if (!room) return result({ error: 'ไม่พบห้อง หรือห้องเริ่มเล่นแล้ว' }, 404);
      await db.prepare('DELETE FROM members WHERE id=?').bind(id).run();
      const r = await db
        .prepare(
          'INSERT INTO members(id,room,weapon,updated) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM members WHERE room=? AND updated>?)<4',
        )
        .bind(id, b.code, b.weapon, now, b.code, now - 45000)
        .run();
      if (!r.meta.changes) return result({ error: 'ห้องเต็มแล้ว' }, 409);
      return result({
        code: b.code,
        host: room.host === id,
        map: room.map,
        seed: room.seed || '',
      });
    }
    if (b.action === 'solo-reward') {
      if (
        !valid(b.run, 60) ||
        !Number.isFinite(b.points) ||
        !Number.isFinite(b.wave)
      )
        return result({ error: 'ผลเกมไม่ถูกต้อง' }, 400);
      const points = Math.max(0, Math.min(5000, Math.floor(b.points))),
        wave = Math.max(0, Math.min(999, Math.floor(b.wave)));
      await db.batch([
        db
          .prepare(
            'INSERT OR IGNORE INTO rewards(id,profile,points,wave) VALUES(?,?,?,?)',
          )
          .bind(b.run + id, id, points, wave),
        db
          .prepare(
            'UPDATE profiles SET points=points+COALESCE((SELECT points FROM rewards WHERE id=? AND claimed=0),0),best=MAX(best,?) WHERE id=?',
          )
          .bind(b.run + id, wave, id),
        db.prepare('UPDATE rewards SET claimed=1 WHERE id=?').bind(b.run + id),
      ]);
      return result({
        profile: profileRow(
          await db
            .prepare('SELECT * FROM profiles WHERE id=?')
            .bind(id)
            .first<DbProfile>(),
        ),
      });
    }
    if (b.action === 'claim') {
      if (
        b.run &&
        !(await db
          .prepare('SELECT id FROM rewards WHERE id=? AND profile=?')
          .bind(String(b.run) + id, id)
          .first())
      )
        return result({ error: 'กำลังรอผลจากเจ้าของห้อง กรุณาลองบันทึกอีกครั้ง' }, 409);
      await db.batch([
        db
          .prepare(
            'UPDATE profiles SET points=points+COALESCE((SELECT SUM(points) FROM rewards WHERE profile=? AND claimed=0),0),best=MAX(best,COALESCE((SELECT MAX(wave) FROM rewards WHERE profile=?),0)) WHERE id=?',
          )
          .bind(id, id, id),
        db
          .prepare('UPDATE rewards SET claimed=1 WHERE profile=? AND claimed=0')
          .bind(id),
      ]);
      return result({
        profile: profileRow(
          await db
            .prepare('SELECT * FROM profiles WHERE id=?')
            .bind(id)
            .first<DbProfile>(),
        ),
      });
    }
    if (!/^\d{6}$/.test(b.code)) return result({ error: 'เลขห้องไม่ถูกต้อง' }, 400);
    const room = await db
      .prepare('SELECT * FROM rooms WHERE code=?')
      .bind(b.code)
      .first<DbRoom>();
    if (!room || room.updated < now - 45000)
      return result({ error: 'ห้องถูกปิดหรือเจ้าของห้องขาดการเชื่อมต่อ' }, 410);
    const member = await db
      .prepare('SELECT * FROM members WHERE id=? AND room=?')
      .bind(id, b.code)
      .first();
    if (!member) return result({ error: 'คุณไม่ได้อยู่ในห้องนี้' }, 403);
    if (b.action === 'leave') {
      await db.prepare('DELETE FROM members WHERE id=?').bind(id).run();
      if (room.host === id)
        await db.prepare('DELETE FROM rooms WHERE code=?').bind(b.code).run();
      return result({ ok: true });
    }
    if (b.action === 'sync' || b.action === 'lobby') {
      const input = b.input;
      const cleaned = input
        ? {
            x: Math.max(-1, Math.min(1, Number(input.x) || 0)),
            z: Math.max(-1, Math.min(1, Number(input.z) || 0)),
            commands: Array.isArray(input.commands)
              ? input.commands
                  .filter(
                    (c) =>
                      Number.isSafeInteger(c.seq) &&
                      c.seq > 0 &&
                      ['build', 'upgrade', 'perk'].includes(c.type),
                  )
                  .slice(-8)
              : [],
          }
        : {};
      await db
        .prepare('UPDATE members SET updated=?,input=? WHERE id=?')
        .bind(now, JSON.stringify(cleaned), id)
        .run();
      if (room.host === id) {
        if (b.snapshot) {
          const s = b.snapshot as World;
          if (
            !s ||
            !Array.isArray(s.players) ||
            s.players.length > 4 ||
            !Array.isArray(s.enemies) ||
            s.enemies.length > 160 ||
            !Array.isArray(s.buildings) ||
            s.buildings.length > 90 ||
            !['prep', 'battle', 'over'].includes(s.phase) ||
            !valid(s.run, 60) ||
            !valid(s.seed, 8) ||
            !Array.isArray(s.terrain) ||
            s.terrain.length > 400
          )
            return result({ error: 'สถานะเกมไม่ถูกต้อง' }, 400);
          await db
            .prepare(
              'UPDATE rooms SET snapshot=?,status=?,updated=? WHERE code=?',
            )
            .bind(
              JSON.stringify(s),
              s.phase === 'over' ? 'over' : 'playing',
              now,
              b.code,
            )
            .run();
          room.snapshot = JSON.stringify(s);
          room.status = s.phase === 'over' ? 'over' : 'playing';
          if (s.phase === 'over') {
            const members = await db
              .prepare('SELECT id FROM members WHERE room=?')
              .bind(b.code)
              .all();
            for (const m of members.results)
              await db
                .prepare(
                  'INSERT OR IGNORE INTO rewards(id,profile,points,wave) VALUES(?,?,?,?)',
                )
                .bind(
                  s.run + String(m.id),
                  m.id,
                  Math.min(5000, reward(s)),
                  Math.max(0, s.wave - 1),
                )
                .run();
          }
        } else
          await db
            .prepare('UPDATE rooms SET updated=? WHERE code=?')
            .bind(now, b.code)
            .run();
      }
      const players = await db
        .prepare(
          'SELECT p.*,m.weapon,m.input,m.updated FROM members m JOIN profiles p ON p.id=m.id WHERE m.room=? AND m.updated>? ORDER BY m.rowid',
        )
        .bind(b.code, now - 45000)
        .all<DbMember>();
      return result({
        status: room.status,
        map: room.map,
        seed: room.seed || '',
        players: players.results.map((p) => ({
          ...profileRow(p),
          weapon: p.weapon,
          updated: p.updated,
          input: JSON.parse(p.input),
          online: p.updated > now - 3000,
        })),
        snapshot: room.snapshot ? JSON.parse(room.snapshot) : null,
      });
    }
    return result({ error: 'ไม่พบคำสั่ง' }, 400);
  } catch (e) {
    console.error('Game API', e);
    return json({ error: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' }, 500);
  }
}
