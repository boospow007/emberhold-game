# เฟส 6.0: โครง server แยกสำหรับ PvP (Node + WebSocket + Docker + GitHub Actions)

- วันที่: 2026-09-08
- ผู้แก้ไข: Claude Code
- branch: `docs/pvp-plan`
- ไฟล์ที่เกี่ยวข้อง: `server/` (ใหม่ทั้งโฟลเดอร์), `.github/workflows/deploy-server.yml`, `tests/server.test.mjs`, `tsconfig.json`, `.gitignore`, `doc/game-doc/07-modes-netcode.md`
- อ้างอิง: `doc/game-doc/07-modes-netcode.md` ข้อ 5.5 และลำดับพัฒนาขั้น 6.0

## สิ่งที่เปลี่ยน
1. **`server/`** แอป Node 22 แยก (`type: module`, รันด้วย `--experimental-strip-types` ไม่ต้อง build) import `lib/game/engine.ts`/`terrain.ts` จาก repo เดียวกัน
   - `src/index.ts`: `GET /health` (uptime, จำนวน client, สถานะ Mongo) และ WebSocket `/ws?ticket=` ตรวจ origin + ตั๋ว ตอบ `hello`, `pong`, และ echo ข้อความ (จะกลายเป็น RoomSim ในขั้น 6.2)
   - `src/ticket.ts`: ตั๋ว HMAC-SHA256 (`payload.signature` แบบ base64url) มี `id`, `name`, `exp` ตรวจด้วย `timingSafeEqual`
   - เชื่อม MongoDB Atlas เมื่อมี `MONGODB_URI` (ยังไม่เขียนข้อมูล)
   - `Dockerfile` (context = repo root เพื่อ copy `lib/game`), `docker-compose.yml` (game + Caddy TLS อัตโนมัติ), `Caddyfile`, `.env.example`, `README.md`
2. **`.github/workflows/deploy-server.yml`**: push ไป `main` ที่แตะ `server/**` หรือ `lib/game/**` → SSH ไปเครื่อง DigitalOcean → `git reset --hard origin/main` → `docker compose up -d --build` → เช็ค `/health` ใช้ secrets `DO_HOST`, `DO_USER`, `DO_SSH_KEY`
3. `tests/server.test.mjs` 3 ข้อ: ตั๋วถูก/ผิด/หมดอายุ, health + echo ผ่าน WebSocket, ตั๋วปลอมถูกปฏิเสธตอน upgrade
4. `tsconfig.json` ราก exclude `server` (server มี tsconfig ของตัวเองที่ไม่มี DOM) และ `.gitignore` เพิ่ม `server/node_modules`

## เหตุผล
การตัดสินใจข้อ 2 ของแผน PvP: ใช้ server แยกบน DigitalOcean deploy ผ่าน GitHub Actions และ Mongo Atlas ขั้น 6.0 ทำให้ทดสอบ pipeline และ `wss://` จากเครื่องจริงได้ก่อนเขียน simulation

## ผลกระทบ / สิ่งที่ต้องทำต่อ
- ยังไม่มีการ deploy จริง ต้องการจากเจ้าของ: (1) ใส่ secrets ใน GitHub, (2) ตั้ง `server/.env` บนเครื่อง, (3) โดเมนหรือ sslip.io สำหรับ TLS, (4) ติดตั้ง Docker และ clone repo ที่ `/opt/emberhold`
- Worker ยังไม่มี action `pvp-ticket` (ต้องรู้วิธีตั้ง secret `PVP_SECRET` บน Sites ก่อน) ขั้น 6.3
- Docker ไม่ได้ทดสอบ build ในเครื่องพัฒนา (ไม่มี Docker) ต้องดูผลจาก workflow ครั้งแรก
- ค่าลับทุกตัวอยู่นอก git เท่านั้น ห้ามส่งในแชท

## วิธีทดสอบ
```
cd server && npm install && PVP_SECRET=test-secret npm run dev
# อีกหน้าต่าง จาก repo root
PVP_SECRET=test-secret node --experimental-strip-types --test tests/server.test.mjs
npx tsc -p server/tsconfig.json --noEmit
```
