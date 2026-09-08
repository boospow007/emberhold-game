# เฟส 4: ความยาวเกม Final wave Boss wave และ save กลาง run

- วันที่: 2026-09-08
- ผู้แก้ไข: Claude Code
- branch: `feat/phase4-length`
- ไฟล์ที่เกี่ยวข้อง: `lib/game/engine.ts`, `app/Game.tsx`, `app/page.tsx`, `app/globals.css`, `app/api/game/route.ts`, `lib/game/api.ts`, `db/schema.ts`, `drizzle/0004_smooth_avengers.sql`, `tests/length.test.mjs` (ใหม่)
- อ้างอิง: `doc/game-doc/01-direction.md` ข้อ 7 (ความยาว) และการตัดสินใจรอบสองข้อ 2, ลำดับพัฒนาข้อ (4)

## สิ่งที่เปลี่ยน

### ความยาวเกม (engine)

1. `World.days` เลือกได้ 30 / 80 / 100 / 120 / 150 หรือ 0 = ไม่จำกัด (`LENGTHS`) ค่าอื่นถูกปัดเป็น 0; `World.won`
2. **Boss wave ทุก 10 วัน**: ศัตรู ×1.3 และมี boss 3 ตัว (วันที่หาร 5 ลงตัวยังมี boss 1 ตัวเหมือนเดิม) `bossCount()`
3. **คืนสุดท้าย** (วันที่ = days): ศัตรู ×2, boss 4 ตัว, ข้อความเตือนพิเศษ `isFinal()`
4. รอดคืนสุดท้าย → `phase = 'over'`, `won = true` ไม่กลับเข้า prep ไม่จำกัดวันไม่มีวันชนะ
5. `daysSurvived()` นับวันที่รอดให้ถูกต้องทั้งกรณีชนะ แพ้กลาง wave และอยู่ใน prep; `reward()` ใช้ค่านี้และบวก **โบนัสจบ** ตามความยาว (30→40, 80→80, 100→120, 120→180, 150→250 ตาม 02-meta-progression)

### UI

- หน้าแรกเพิ่มแถวเลือกความยาว 6 ปุ่ม (30/80/100/120/150/∞) ค่าเริ่มต้น 80
- HUD แสดง "วันที่ N / days" และข้อความ prep บอกล่วงหน้าว่าคืนถัดไปเป็น Boss Wave หรือคืนสุดท้าย
- หน้าจบรอบแยกกรณีชนะ ("อาณาจักรรอดแล้ว!" พร้อมโบนัส) และแพ้ แสดง "วันที่รอด / days"
- ห้อง co-op เก็บความยาว (`rooms.days` migration 0004) รายการห้องและ lobby แสดงความยาว guest สร้างโลกด้วยความยาวของห้อง

### Save กลาง run (โหมดเดี่ยวเท่านั้น)

- `Game` รับ `onSave(world | null, weapon)` และเรียก **อัตโนมัติทุกครั้งที่จบวัน** (เข้าช่วง prep ซึ่ง state นิ่งที่สุด) และเรียกด้วย `null` เมื่อรอบจบ
- `page.tsx` เก็บลง `localStorage` คีย์ `emberhold:save:<profileId>` (World ทั้งก้อน ราว 30–60KB) โหลดตอนได้โปรไฟล์ ตรวจว่า phase ไม่ใช่ over และโปรไฟล์นี้อยู่ในโลกนั้น
- การ์ด "เล่นต่อจากที่ค้างไว้" บนหน้าแรก แสดงแผนที่ seed วัน พร้อมปุ่มเล่นต่อและลบเซฟ การออกจากรอบกลางคันไม่ลบเซฟ (กลับมาเล่นต่อได้) รอบที่จบแล้วลบเซฟทันที
- co-op ไม่ save เพราะ state อยู่กับ host และไม่มี reconnect (เฟส 5)

### เทสต์ `tests/length.test.mjs` 4 ข้อ

ตรวจ LENGTHS และค่า default, จำนวนศัตรู/boss ของ wave 5, 10 และคืนสุดท้าย, ชนะเมื่อรอดคืนสุดท้าย (นับ boss 4 ตัว, โบนัสถูกต้อง, run ที่ชนะไม่เดินต่อ), ไม่จำกัดวันไม่ชนะและฐานพังคืนสุดท้ายนับเป็นแพ้

## เหตุผล

ตามข้อกำหนด "เลือกความยาว 80/100/120/150 หรือไม่จำกัด" และข้อเสนอ Final wave / boss wave ทุก 10 วัน / save ตอนจบ wave ที่ยืนยันแล้ว

## ผลกระทบ / สิ่งที่ต้องทำต่อ

- **ต้อง apply migration 0004** กับ D1 ในเครื่อง
- ความยาวทุกแบบเปิดให้เลือกได้ทันที ยังไม่ทำการปลดล็อกตาม achievement ตาม [เสนอ] ใน 02-meta-progression ข้อ 3.5
- เซฟอยู่ใน localStorage ของเบราว์เซอร์นั้น ล้าง site data แล้วหาย และไม่ได้ป้องกันการแก้ไข (โหมดเดี่ยวเชื่อ client อยู่แล้วตาม README)
- Boss wave ×1.3 และคืนสุดท้าย ×2 เป็นค่าตั้งต้น รอ playtest กับกองทัพและป้อมระดับสูง

## วิธีทดสอบ

```
npx tsc --noEmit
node --experimental-strip-types --test tests/engine.test.mjs tests/terrain.test.mjs tests/units.test.mjs tests/length.test.mjs
sed 's/--> statement-breakpoint//g' drizzle/0004_smooth_avengers.sql | sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite
npm run dev && node --experimental-strip-types --test tests/coop.test.mjs
```

ในเกม: เลือก 30 วัน เริ่มโซโล่ เห็น "วันที่ 01 / 30" กดเริ่มวันแล้วรอดถึง prep → กลับหน้าแรก (ปุ่มกลับค่ายพัก) เห็นการ์ด "เล่นต่อจากที่ค้างไว้ วันที่ 2 / 30"
