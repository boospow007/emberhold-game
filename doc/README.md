# เอกสารประกอบการแก้ไข (Change Log)

โฟลเดอร์นี้เก็บเอกสารของ **ทุกการแก้ไขหรือเพิ่มเติม** ในโปรเจกต์ Emberhold
ทุกครั้งที่มีการเปลี่ยนโค้ด ให้เพิ่มไฟล์ใหม่ในโฟลเดอร์นี้ตามรูปแบบด้านล่าง แล้วเพิ่มบรรทัดในตารางดัชนี

## รูปแบบชื่อไฟล์

`YYYY-MM-DD-<หัวข้อสั้นๆ>.md` เช่น `2026-09-08-claude-md.md`

## โครงสร้างในแต่ละไฟล์

```
# <หัวข้อ>

- วันที่:
- ผู้แก้ไข:
- ไฟล์ที่เกี่ยวข้อง:

## สิ่งที่เปลี่ยน
## เหตุผล
## ผลกระทบ / สิ่งที่ต้องทำต่อ
## วิธีทดสอบ
```

## ดัชนี

| วันที่     | หัวข้อ                                                                                      | ไฟล์                                                               |
| ---------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 2026-09-08 | เพิ่ม CLAUDE.md และโฟลเดอร์ doc                                                             | [2026-09-08-claude-md.md](2026-09-08-claude-md.md)                 |
| 2026-09-08 | เอกสารอ้างอิงเกม They Are Billions                                                          | [ref-game/They-Are-Billions.md](ref-game/They-Are-Billions.md)     |
| 2026-09-08 | เอกสารอ้างอิงเกม Vampire Survivors                                                          | [ref-game/Vampire-Survivors.md](ref-game/Vampire-Survivors.md)     |
| 2026-09-08 | เอกสารอ้างอิงเกม Thronefall                                                                 | [ref-game/Thronefall.md](ref-game/Thronefall.md)                   |
| 2026-09-08 | Game Doc ทิศทางหลักของเกม (v0.3: 1 วัน = 1 wave กดเริ่มเอง)                                 | [game-doc/01-direction.md](game-doc/01-direction.md)               |
| 2026-09-08 | Game Doc อัปเกรดนอกเกมและวงจรเล่นซ้ำ (v0.2 ค่าตั้งต้นยืนยัน)                                | [game-doc/02-meta-progression.md](game-doc/02-meta-progression.md) |
| 2026-09-08 | เฟส 1: ทรัพยากร 5 ชนิด คนงาน ระดับฐานแม่ สิ่งก่อสร้าง 11 ชนิด                               | [2026-09-08-phase1-resources.md](2026-09-08-phase1-resources.md)   |
| 2026-09-08 | เฟส 2: แผนที่ใหญ่จาก seed ความสูง น้ำ สะพาน pathfinding ตาราง seeds                         | [2026-09-08-phase2-map.md](2026-09-08-phase2-map.md)               |
| 2026-09-08 | เฟส 3: หน่วยทหาร 3 ชนิด ค่ายทหาร ระบบรวมพล/ปลด stack จากโปรไฟล์                             | [2026-09-08-phase3-units.md](2026-09-08-phase3-units.md)           |
| 2026-09-08 | เฟส 4: เลือกความยาว 30–150 วัน/ไม่จำกัด Final wave Boss wave ชนะ และ save กลาง run          | [2026-09-08-phase4-length.md](2026-09-08-phase4-length.md)         |
| 2026-09-08 | เฟส 5: co-op เข้าร่วมกลางเกม กลับเข้าห้องหลังหลุด ห้องที่เล่นอยู่ในรายการ                   | [2026-09-08-phase5-latejoin.md](2026-09-08-phase5-latejoin.md)     |
| 2026-09-08 | Game Doc PvP และ netcode server-authoritative (ร่าง v0.1) | [game-doc/07-modes-netcode.md](game-doc/07-modes-netcode.md) |
| 2026-09-08 | ปรับ UI: modal โค้งมน gradient และ animation ครบ (dialog, ปุ่ม, การ์ด, HUD, toast, ผลลัพธ์) | [2026-09-08-ui-polish.md](2026-09-08-ui-polish.md)                 |

## เอกสารอ้างอิง (`ref-game/`)

โฟลเดอร์ `ref-game/` เก็บบทวิเคราะห์เกมอื่นที่ใช้เป็นแรงบันดาลใจหรือเทียบเคียงการออกแบบ Emberhold ไม่ใช่บันทึกการแก้ไข แต่ละไฟล์ควรจบด้วยหัวข้อ "สิ่งที่ Emberhold นำมาใช้ได้"

## เอกสารออกแบบเกม (`game-doc/`)

โฟลเดอร์ `game-doc/` คือ Game Design Document ของ Emberhold ดูกติกาการใช้ป้าย [กำหนด] / [เสนอ] / [คำถาม] ใน `game-doc/README.md`
