# AGENTS.md — Codex Project Rules

## Project

ชื่อ: YouTube AI Content Factory  
เป้าหมาย: สร้างระบบบริหารวงจรผลิตคอนเทนต์ YouTube ด้วย AI สำหรับนิทานเด็ก การ์ตูนเด็ก เพลง AI และการ์ตูน Shorts โดยไม่รวมรีวิวสินค้า/Affiliate

## Source of Truth

อ่านตามลำดับก่อนแก้โค้ด

1. `docs/00-PROJECT-CONTEXT.md`
2. `docs/02-SYSTEM-SPEC.md`
3. `docs/03-ARCHITECTURE-AND-DATA.md`
4. `docs/01-SYSTEM-WORKFLOW.md`
5. `plans/IMPLEMENTATION-ROADMAP.md`
6. `docs/04-BUSINESS-CONTEXT.md` — บริบทแบรนด์และข้อจำกัดทางธุรกิจ
7. `docs/07-DECISIONS-sprint1.md` — บันทึกการตัดสินใจสถาปัตยกรรม (ADR)

## Working Rules

1. ตรวจ Repository, Git Status, Package Manager และคำสั่งที่มีอยู่จริงก่อนทำงาน
2. ทำงานทีละ Task และจำกัด Diff ตาม Scope
3. ห้ามเริ่ม Implementation หาก Task ไม่มี Requirement ID และ Acceptance Criteria
4. เขียนหรือปรับ Test พร้อม Implementation
5. State Transition, Authorization, Approval Gate และ Validation ต้องอยู่ฝั่ง Server
6. UI ห้ามเรียก AI Provider SDK หรือใช้ Secret โดยตรง
7. Provider Integration ต้องผ่าน Adapter Interface
8. ห้าม Hard-code Prompt/Model/Policy ที่ควร Configurable
9. ห้ามแสดง Secret, Token, Private Key, Raw Webhook หรือข้อมูลส่วนบุคคลใน Log
10. ห้าม Deploy, ลบข้อมูล, รัน Production Migration หรือ Rotate Secret โดยไม่มีคำสั่งชัดเจนจากผู้ใช้
11. หากต้องเปลี่ยน Scope ให้บันทึก Change Request ก่อน
12. ชื่อตารางเป็นพหูพจน์ สื่อความหมาย 1 record ต่อ 1 entity (`characters`, `episodes`, `rights_records`, `audit_logs`) — ยึด `rights_records` ไม่ใช่ `rights_log` (ตาม ADR-003)
13. Entity ที่เป็นของแบรนด์ (`pillars`, `characters`, `episodes`) เป็น channel-scoped ผูก FK เข้า `channels.id` และ `channels.workspace_id` → `workspaces.id` (ตาม ADR-004)
14. เมื่อข้อกำหนดขัดแย้ง ให้หยุดและอ้างไฟล์/หัวข้อที่ขัดแย้ง

## Recommended Project Shape

```text
src/
├─ app-or-routes/
├─ modules/
│  ├─ identity/
│  ├─ workspace/
│  ├─ channel/
│  ├─ character/
│  ├─ idea/
│  ├─ content-project/
│  ├─ script/
│  ├─ storyboard/
│  ├─ prompt-library/
│  ├─ asset/
│  ├─ generation/
│  ├─ render/
│  ├─ quality/
│  ├─ publishing/
│  ├─ analytics/
│  └─ audit/
├─ shared/
└─ config/
tests/
docs/
plans/
audits/
```

ให้ปรับตาม Framework ที่เลือก แต่รักษา Module Boundary

## Commands

ตรวจคำสั่งจริงจาก `package.json`, Lockfile และ README ก่อนใช้ ค่าเริ่มต้นที่คาดหวัง

```text
Install:    npm install หรือคำสั่งของ Package Manager ที่ Repository ใช้จริง
Dev:        npm run dev
Format:     npm run format:check
Lint:       npm run lint
Type Check: npm run typecheck
Unit Test:  npm test
Integration:npm run test:integration
E2E:        npm run test:e2e
Build:      npm run build
```

ห้ามสร้างคำสั่งปลอม หากไม่มี Script ให้รายงานและเสนอเพิ่มใน Task แยก

## Implementation Order

```text
Inspect → Plan → Test → Implement → Targeted Test
→ Regression → Lint → Type Check → Build → Diff Review → Docs
```

## Coding Rules

- TypeScript strict mode เมื่อ Stack รองรับ
- หลีกเลี่ยง `any`; ใช้ Schema Validation ที่ Boundary
- Domain State ใช้ Enum/Union ที่ตรวจ exhaustiveness ได้
- External Error ต้อง Normalize
- DB Mutation สำคัญใช้ Transaction
- Create Job/Publish ใช้ Idempotency
- Date/Time เก็บเป็น UTC และแสดงตาม Workspace Timezone
- File Upload ตรวจ MIME, Extension, Size และ Malware Scan Hook เมื่อรองรับ
- Query รายการใหญ่ใช้ Pagination
- ไม่โหลด Binary Asset ใน List API
- Accessibility: label, keyboard, focus, status message

## Test Requirements

ขั้นต่ำต่อ Feature ที่เกี่ยวข้อง

- Happy Path
- Permission Denied
- Validation Error
- Invalid State Transition
- Duplicate/Idempotent Request
- External Provider Error
- Partial Failure
- Audit Log Created
- Export Contract หรือ API Contract

## Migration Rules

- Migration ต้อง Forward-only และมี Rollback/Recovery Note
- เพิ่ม Constraint หลังทำ Data Backfill เมื่อจำเป็น
- ห้าม Drop Column/Table ที่มีข้อมูลโดยไม่มี Compatibility Phase
- ทดสอบ Migration กับข้อมูลตัวอย่าง

## SQL ที่ให้มนุษย์รันใน Supabase SQL Editor

- **ต้องเป็น `DO` block เดียวที่มี guard + `raise exception`** เมื่อเงื่อนไขไม่ตรง —
  Postgres จะ rollback ทั้งบล็อกให้เอง
- **ห้ามเขียนเป็น `begin` / `commit` แยกขั้นให้มนุษย์ไล่ตรวจกลางทาง** เพราะ SQL Editor
  รันทุกคำสั่งจนถึง commit ในครั้งเดียวและแสดงผลแค่คำสั่งสุดท้าย → คนรันไม่เห็นผล
  ของ `select` ตรวจสอบกลางทาง และเข้าใจผิดว่าสำเร็จได้
- guard ต้องเช็กทั้ง **ตัวที่จะลบ** (มีอยู่จริง ชื่อ/ค่าตรงตามที่คาด) และ **ตัวที่ต้องไม่โดน**
  (จำนวนแถวของตารางอื่นต้องเท่าเดิม)
- ปิดท้ายด้วย `raise notice` สรุปสิ่งที่ทำ เพื่อให้คนรันเห็นผลลัพธ์จริงในหน้าต่างเดียว
- หลังรันเสร็จ **ต้องตรวจด้วย `select` แยกรอบ** ว่าเกิดผลจริง ห้ามสรุปจากการที่คำสั่ง
  ไม่ error (บล็อกที่ raise จะ rollback เงียบ ๆ และดูเหมือนรันผ่าน)

## Definition of Done

- Acceptance Criteria ผ่าน
- Test ที่เกี่ยวข้องผ่าน
- Lint/Type Check/Build ผ่าน
- ไม่มี Secret/PII ใน Diff หรือ Log
- Migration/Backfill/Rollback ชัดเจน
- เอกสารอัปเดต
- สรุปไฟล์ที่เปลี่ยน เหตุผล Test และความเสี่ยงคงเหลือ
