# สถานะงาน — ปุยฝัน (Puifun) / TOFFY AI YouTube Studio

> **อ่านไฟล์นี้ก่อนเริ่มทำงานต่อทุกครั้ง** แล้วดำเนินการจากส่วน "ขั้นตอนถัดไป" ด้านล่าง
> เมื่อคืบหน้า อย่าลืมอัปเดตวันที่ และย้ายงานที่เสร็จไปไว้ในส่วน "ทำเสร็จแล้ว"

**อัปเดตล่าสุด:** 30 ก.ย. 2026 (main = `24be029` · sanitize error message merged แล้ว)

---

## ภาพรวมโปรเจกต์
- ช่อง YouTube เด็กภาษาไทย ชื่อแบรนด์ **ปุยฝัน (Puifun)** — คาแรกเตอร์เมฆปุกปุย ธีมดาว/ก่อนนอน
- ระบบผลิต: **TOFFY AI YouTube Studio** (Next.js + Supabase + Vercel)
- ขอบเขต MVP: 7 เฟส จบที่ Export Production Package
- ตัวชี้วัดหลัก: rewatch rate และ asset reuse ratio (สำคัญกว่า RPM)

## ทำเสร็จล่าสุด (ส.ค.–ก.ย. 2026)
- **✅ ปิด blocker deploy Vercel (18 ก.ย. 2026)** — `ai-you-tube-studio.vercel.app` = **Ready** ที่ `edb9477`
  - **สาเหตุจริง (อ่านจาก build log):** Supabase marketplace integration ผี (`supabase-orange-compass` ชี้ฐานข้อมูล `fejdbckepcgcelkzpmtw` ที่ไม่มีอยู่แล้ว) → build ตายที่ขั้น **Provisioning Integrations** ภายใน 2 วินาที ทุกครั้ง
  - **วิธีแก้:** ตัด integration ผีออกจากโปรเจกต์ + แก้ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (เดิมใส่ **service_role key ผิด**) + ขยาย env เป็น Production+Preview + redeploy
  - **ไม่ใช่** ปัญหาโค้ดและไม่ใช่ Framework Preset — `vercel.json` (PR #11) ไม่ผิดแต่ซ้ำซ้อน (preset ใน dashboard เป็น Next.js อยู่แล้ว) เก็บไว้ได้
  - 📌 **บทเรียน:** ห้ามสรุปสาเหตุจาก error code ที่ยังไม่ได้อ่าน log จริง — รอบนี้เสียเวลาหลายวันเพราะสรุปว่าเป็น `STATIC_BUILD_NO_OUT_DIR` ทั้งที่ log จริงบอกคนละเรื่อง
- **✅ ปุ่ม/action ลบตอน (delete episode) — [PR #9](https://github.com/KRU-OFFY/puifan-studio/pull/9) merged (`e86965f`)** — `deleteEpisode` (RLS owner+editor · `.select` ยืนยันลบจริง · audit `episode.delete` · redirect กลับรายการตอน) + `DeleteEpisodeControl` (confirm ก่อนลบ) + section ท้ายหน้า `episodes/[id]`
  - RLS harness ครอบครบ: owner/editor ลบ = 1 แถว · viewer = 0 แถว (RLS บล็อก) · cascade ลบ `episode_characters` — ผ่านบน CircleCI `db-harness` จริง ([run #98](https://circleci.com/gh/KRU-OFFY/puifan-studio/98))
- **✅ CircleCI ต่อ repo แล้ว** — `build-and-check` ✅ ([run #97](https://circleci.com/gh/KRU-OFFY/puifan-studio/97)) + `db-harness` ✅ ([run #98](https://circleci.com/gh/KRU-OFFY/puifan-studio/98)) รายงานเข้า PR แล้ว (เดิมมี config แต่ยังไม่ต่อ)
- **✅ Sprint 2 UI merged เข้า main** — Episodes UI (FR-010), Asset/Rights UI (FR-009), Characters/Character Bible, episode_characters (m2m) รวมเข้า main แล้ว (PR #3/#4/#5) พร้อม migration 0008–0012
- **✅ Revert Cloudflare → main (PR #7 merged, `09e9b51`)** — เคยมี session อื่น push งานย้ายไป Cloudflare Workers (Next 15 + OpenNext) **ตรงเข้า main โดยไม่ผ่าน PR** (main ยัง `protected=false`) → กู้คืนกลับ target เดิม (Vercel/Next.js) ที่ `next@14.2.15`; สภาพ Cloudflare สำรองไว้ที่ branch `backup/cloudflare-migration`
  - Verify: lint/typecheck/test **77**/build ผ่าน · Vercel Preview Ready
- **✅ ปิด TG3 (E2E บน Supabase จริง `sxevdedipklivvgxosap`)** — deploy schema 0001–0012 + `seed_puifun()` (owner จริง) + anchor rights น้องปุย/มุ่ย
  - ยืนยันจาก DB จริง: `assets`=2, `rights_records`=2 (1:1 ตาม constraint), `created_by`=UID เจ้าของ (24614d73…)
  - สคริปต์: `supabase/scripts/deploy-schema-0001-0012.sql` + `anchor-rights-puifun.sql` (idempotent · verify ครบสายบน throwaway Postgres 16)
- **✅ sanitize `error.message` ก่อนส่งถึงผู้ใช้ทั้งแอป** — [PR #16](https://github.com/KRU-OFFY/puifan-studio/pull/16) merged (`24be029`)
  - `lib/errors.ts` (pure): `toUserMessage()` ตัดสินด้วย `err.code` ก่อน (23505/42501/23503/23514/22P02/PGRST116/P0001 + auth codes) แล้วจึง fallback ไปดูข้อความ · ถ้าขัดกันยึด code · ผลลัพธ์อยู่ใน `USER_MESSAGES` เท่านั้น ไม่เคย forward ข้อความต้นทาง
  - `lib/errors.server.ts` (`import "server-only"`): `logServerError()` เขียนสาเหตุจริงฝั่ง server พร้อม code โดย `redactSensitive()` ตัด JWT / คีย์ `sb_*` / ค่าหลัง key อ่อนไหว / Bearer ออกก่อน · `reportError()` log เมื่อตกเป็นข้อความกลาง
  - แทนที่ 18 จุด (server action 14 + หน้า UI 4) · คงข้อความเฉพาะที่ caller map ไว้แล้ว
  - Verify: lint/typecheck/**test 117** (เพิ่ม 33)/build ผ่าน · CircleCI `build-and-check` ✅ [#117](https://circleci.com/gh/KRU-OFFY/puifan-studio/117) · `db-harness` ✅ [#118](https://circleci.com/gh/KRU-OFFY/puifan-studio/118) · หัวหน้าทดสอบบน Preview: ค่าซ้ำ channel/character + Gate 0 แสดงข้อความไทย ไม่มีข้อความดิบ
  - 📌 ยืนยันจากการทดสอบจริง: โปรเจกต์ **เปิด Confirm email** → สมัครด้วยอีเมลซ้ำจะไม่คืน error (Supabase กัน user enumeration) ⇒ mapping `user_already_exists` จะไม่เกิดบน prod ตราบที่ยังเปิดอยู่ · คงไว้ได้ ไม่เสียหาย
- **⚠️ ข้อมูลทดสอบจาก PR #16 ยังไม่ถูกลบ (30 ก.ย. 2026)** — หัวหน้ารัน `DO` block (guard + `raise exception`) ใน Supabase SQL Editor แล้ว แต่ตรวจ DB จริงหลังรันพบว่า **ข้อมูลยังอยู่ครบทั้ง 3 ชิ้น ด้วย id และ `created_at` เดิมเป๊ะ** ⇒ guard บางข้อไม่ผ่าน บล็อกจึง `raise` และ rollback ทั้งหมด (ไม่ใช่การสร้างใหม่)
  - ยังค้างอยู่: workspace `puifun` (`197559c4-…`) · channel `ทดสอบ`/`test-dup` (draft, `aa59c23e-…`) · character `ปุย`/`test-char` (`1a31eef7-…`)
  - workspace จริง `Puifun Studio` (`27d5d813-…`) ไม่ถูกแตะ
  - 📌 บทเรียน: SQL Editor รันจน commit ในครั้งเดียวและแสดงผลแค่คำสั่งสุดท้าย → บล็อกที่ `raise` แล้ว rollback ดูเหมือนรันผ่าน · **ต้องตรวจด้วย `select` แยกรอบทุกครั้ง** (เพิ่มเป็นกฎใน `AGENTS.md` แล้ว)
  - การลบนี้ทำนอกแอป (SQL Editor) จึง **ไม่มี audit log จากแอป** สำหรับการลบ — และ `audit_logs` ไม่มี FK ไป `workspaces` เลย จึงไม่ถูกลบตาม cascade ในทุกกรณี (append-only ปลอดภัย)
- **✅ Dashboard: แทน section "ขั้นตอนถัดไป" ที่เป็น scaffold ด้วยเมนูลัด** — [PR #14](https://github.com/KRU-OFFY/puifan-studio/pull/14) merged (`5b066ca`) · ข้อความเดิมยังบอกให้ "สร้างโปรเจกต์ Supabase / รัน migration / seed" ซึ่งทำเสร็จนานแล้ว ทำให้เข้าใจผิดว่าระบบยังตั้งไม่เสร็จ
  - เมนูมาจาก `lib/nav/links.ts` (แหล่งความจริงเดียว) ครอบด้วย `<nav aria-label="เมนูลัด">` + บรรทัดบอกเส้นทางจริง (workspace → channel → ตอน/ตัวละคร/asset)
  - `lib/nav/links.test.ts` กันลิงก์ตาย: อ่าน `page.tsx` ใต้ `app/` แล้ว assert ว่า href ทุกตัวมี route จริงและไม่ต้องใช้ segment `[param]` (resolve path จากตำแหน่งไฟล์ test ไม่พึ่ง cwd)
  - คงบล็อก "Supabase connection" ไว้ทั้งหมด (มีประโยชน์ตอน DB หลับ)
  - Verify: lint/typecheck/**test 84** (เพิ่ม 7)/build ผ่าน · CircleCI `build-and-check` ✅ [#110](https://circleci.com/gh/KRU-OFFY/puifan-studio/110) · `db-harness` ✅ [#109](https://circleci.com/gh/KRU-OFFY/puifan-studio/109) · Vercel preview ✅
  - ⏳ ยังไม่ได้ยืนยันด้วยตาบน production — ช่างเปิดหน้า prod เองไม่ได้ (egress ของ sandbox บล็อก `*.vercel.app` = 403) และ Vercel API ตอบ 403 `You don't have permission to list the deployment` → **หัวหน้าเปิด `/dashboard` บน prod ดูเองว่าเมนูลัดกดไป `/workspaces` ได้ และบล็อก Supabase connection ยังอยู่**
  - ⏳ branch `feat/dashboard-nav-shortcuts` ฝั่ง remote ยังลบไม่ได้ (git proxy ปฏิเสธ delete ref: `the remote end hung up unexpectedly`) · ลบ local แล้ว → หัวหน้ากด **Delete branch** บนหน้า PR #14 ได้เลย
- **🔴 หนี้อันดับ 1 — ตัด legacy key ที่รั่ว (`service_role`):** ค่า service_role เคยถูกใส่ผิดเป็น `NEXT_PUBLIC_SUPABASE_ANON_KEY` บน Vercel (พบตอนแก้ deploy) และ key เคยถูกวางในแชต
  - **รั่วถึง browser จริงหรือไม่ = ยังไม่ยืนยัน** (ตรวจไม่ได้ด้วยเครื่องมือที่ช่างมี ไม่อนุมานแทน):
    - (a) ประวัติ env ว่าค่าผิดถูกใส่เมื่อไร → Vercel API เห็นแค่ team ไม่เห็น project/deployment (404, token scope จำกัด)
    - (b) มี deployment สถานะ Ready ที่ build ด้วยค่านั้นหรือไม่ → เหตุผลเดียวกับ (a)
    - (c) ตรวจ JS bundle หา JWT ที่ `role=service_role` → egress ของ sandbox บล็อก `*.vercel.app` (403)
  - **ต้องการเพื่อยืนยัน:** Vercel → Project Settings → Environment Variables (ประวัติ/วันที่แก้ `NEXT_PUBLIC_SUPABASE_ANON_KEY`) + รายการ deployment ที่ **Ready** ก่อนวันที่แก้
  - **ไม่ว่าผลเป็นแบบไหน การตัด key เดิมยังเป็นงานอันดับ 1** (key เคยถูกวางในแชตแน่นอนอยู่แล้ว)
  - **วิธีที่เลือก = ย้ายไป API key แบบใหม่ (`sb_publishable_` / `sb_secret_`) แล้ว Disable legacy API keys — ไม่ใช่ rotate JWT secret** (โปรเจกต์นี้มีคีย์ทั้งสองแบบให้ใช้อยู่แล้ว · rotate JWT secret จะพลอยเปลี่ยน `anon` ด้วย และยังทิ้ง legacy key ไว้ให้เผลอใช้ผิดซ้ำ) → ขั้นตอนอยู่ที่ "ขั้นตอนถัดไป" ข้อ 1
  - ถ้ายืนยันว่ามี Ready deployment ที่ฝังค่านั้น → เพิ่มงาน: **ลบ/ปิด deployment นั้นหลังตัด legacy key**
- **⏳ งานเก็บกวาดฝั่งเจ้าของ (ไม่บล็อกงานโค้ด):** ลบ Cloudflare Worker `ai-youtube-studio` + ตัด GitHub integration · ตั้ง branch protection บน `main` (กัน push ตรง)

## ทำเสร็จแล้ว (Week 0)
- เอกสารโลกแบรนด์ (brand world)
- คาแรกเตอร์หลัก 3 ตัว: น้องปุย, มุ่ย, กัปตันโก๊ะ (มี prompt สร้างภาพ)
- 3 เสาเนื้อหา: นิทานก่อนนอน, เพลงร้องตาม, คลิปตลกสั้น + ซิกเนเจอร์ดาวเรืองแสงปิดท้ายนิทาน
- แบ็กล็อกไพลอต 10 ตอน + seed data spec + QC checklist
- รายงานเคลียร์ชื่อ: เลี่ยง "ปุยนุ่น" → ใช้ "ปุยฝัน" (ตรวจผ่านแล้ว)
- Task 0.1 scaffold prompt สำหรับ Claude Code
- เทมเพลต Rights Log CSV (ติดตามที่มาของ asset ที่ AI สร้าง)
- **Task 0.1 — Scaffold โปรเจกต์ Next.js + Supabase (เสร็จ 24 ก.ค. 2026)**
  - โครง Next.js App Router + TypeScript
  - Supabase client (browser / server / admin) ใน `lib/supabase/`
  - Migration เริ่มต้น `supabase/migrations/0001_init.sql`
    (characters / content_pillars / episodes / assets / rights_log)
  - หน้า `/dashboard` มี health check ของ Supabase
  - `.env.example`, `.gitignore`, `README.md`, `CLAUDE.md`, `docs/QC-checklist.md`
- **นำเข้าเอกสารส่งมอบ Week 0 + seed data (เสร็จ 24 ก.ค. 2026)**
  - `docs/00-WEEK0-HANDOFF.md`, `docs/05-SEED-DATA.md`, `docs/06-NAME-CLEARANCE.md`
  - `docs/pilots/pilot-01-theme-song.md`, `docs/pilots/pilot-02-pui-lost-blanket.md`
  - `supabase/seed.sql` — 3 pillars + 4 ตัวละคร + 10 ตอน (ตอน #1/#2 มีบท) ทดสอบรันจริงบน Postgres ผ่าน + idempotent
  - อัปเดต `CLAUDE.md` เพิ่มหัวข้อ Source of Truth

## กำลังทำ / ค้างอยู่
- **✅ Characters / Character Bible (migration 0011)** — branch feat/characters (จาก main 2c31325)
  - ALTER characters เติมฟิลด์ bible (type/role/species/appearance/voice/personality/forbidden/appears_in/anchor_image_url/created_by) · reuse image_prompt(=canonical_prompt) · RLS เดิมครอบ (ไม่แตะ policy)
  - enum `character_type` (character/brand_motif) · ดาวดวงน้อย = brand_motif · appears_in = advisory text[] (P1/P2/P3, ไม่ FK)
  - seed_puifun re-create: เติมค่า bible ให้ 4 ตัวตาม docs/05 §5 (count=4, motif ถูก)
  - `lib/character/` (validation+test · actions create/update) · `components/CharacterForms.tsx`
  - หน้า `/channels/[id]/characters` (list+filter type+create) · `/characters/[id]` (edit) · middleware ครอบ `/characters` · ลิงก์จาก channel
  - ✅ VERIFY: lint/typecheck/test **77/77**/build + harness `rls_characters_test` (cross-workspace · viewer เขียนไม่ได้ · enum · seed count=4) ผ่านบน Postgres 16 (0001..0011) · CI loop เพิ่ม test
  - Deferred: episode_characters (m2m, PR ถัดไป) · appears_in enforcement (ตอน QC) · Storage/upload
- **✅ Asset/Rights UI + FR-009 provenance (migration 0010)**
  - เปิดใช้ assets/rights_records (เดิม deny-all ตั้งแต่ 0003) ครั้งแรก: เติมคอลัมน์ provenance + RLS policy + 1:1
  - 0010: enum `asset_role` · assets ADD channel_id NOT NULL/role/title/created_by · rights ADD plan/model/source_url/created_by/exported_at + UNIQUE(asset_id) · RPC `create_asset_with_rights` (atomic 1:1, has_channel_write)
  - RLS: assets channel-scoped (can_access_channel/has_channel_write) · rights ผูกผ่าน asset→channel
  - `lib/asset/` (validation+test · actions create/update) · `components/AssetForms.tsx`
  - หน้า `/channels/[id]/assets` (list filter type/role/episode + pagination + สร้าง asset+rights คู่) · `/assets/[id]` (edit ทั้งคู่) · middleware ครอบ `/assets` · ลิงก์จาก channel
  - ✅ VERIFY: lint/typecheck/test **63/63**/build + harness `rls_assets_test` (RPC create · UNIQUE · cross-workspace · viewer เขียนไม่ได้) ผ่านบน Postgres 16 (0001..0010) · seed_puifun ผ่าน · CI loop เพิ่ม test
  - Deferred: character_id (หนี้ L) · file upload/Supabase Storage · publish-time rights enforcement
- **✅ Episodes UI + FR-010 state machine (Sprint 2 เริ่ม)**
  - migration `0009_episode_transition.sql`: allowed-transition map + trigger BEFORE UPDATE (guard status) + RPC `transition_episode`
    · graph (ตาม handoff สมอง): draft→scripted · scripted→in_production · in_production→qc/scripted · qc→ready/in_production/scripted · ready→published/qc · {any}→archived
    · สิทธิ์ = `has_channel_write` (owner+editor) · reject invalid ฝั่ง server · log_audit `episode.transition` · reuse flag `app.allow_status_change`
  - `lib/episode/` (validation+test mirror allowed-map · actions create/update/transition) · `components/EpisodeForms.tsx`
  - หน้า `/channels/[id]/episodes` (list filter status/pillar + pagination + สร้าง; ไม่ดึง script/binary — NFR-010) · `/episodes/[id]` (edit + ปุ่มเปลี่ยนสถานะเฉพาะ allowed)
  - middleware ครอบ `/episodes` · ลิงก์จากหน้า channel
  - ✅ VERIFY: lint/typecheck/test **53/53**/build + harness `rls_episodes_test` (valid/invalid/guard/non-writer/{any}→archived) ผ่านบน Postgres 16 (shim→0001..0009) · CI db-harness เพิ่ม test เข้า loop
- **✅ M-new ปิดแล้ว (migration 0008)** — trigger BEFORE INSERT on channels บังคับ channel เกิดใหม่ = draft (Gate 0 ปิดทั้ง INSERT+UPDATE) · seed_puifun ตั้ง flag ก่อน insert
  - probe ยืนยัน: INSERT approved→blocked · insert ปกติ→draft · approve_channel→approved · seed_puifun ผ่าน (11 forbidden + 10 ตอน)
  - re-audit #2 = **Go** (Critical=0/High=0, Medium เหลือ M3 หนี้) · บันทึก `audits/sprint-1-reaudit-2.md`
  - VERIFY: lint/typecheck/test 43/build + harness shim→0001..0008 ผ่านบน Postgres จริง
- **✅ เพิ่มกฎการทำงานลง CLAUDE.md** — บทบาท (หัวหน้า/สมอง/ช่าง) · Scope fidelity · ความซื่อตรง commit/audit · Migration immutable
- **✅ PR #1 MERGED เข้า main (`914702f`)** — Sprint 1 ครบ (Task 1.1–1.4 + hardening H1/M1/M4 + M2)
- **Re-audit (หลังปิด M2) = Go** — Critical=0/High=0 · บันทึกที่ `audits/sprint-1-reaudit.md`
  - ยืนยันด้วย probe: H1/M1/M2/M4 FIXED · anon เขียน/อ่าน audit ไม่ได้
  - **M-new (Medium, ยังเปิด):** owner INSERT channel `status='approved'` ตรงได้ → Gate 0 bypass ทาง INSERT (คู่กับ M1) → เสนอ migration 0008 ปิด
  - หมายเหตุ: รอบ re-audit นี้รันในเซสชันผู้พัฒนา (sub-agent อิสระชน session limit) — ยืนยันซ้ำได้เมื่อ limit reset
- **Sprint 1 hardening — แก้ finding จาก Audit (25 ก.ค. 2026)**
  - **H1 (High) แก้แล้ว:** migration `0006` ตัด FK ของ `audit_logs.workspace_id`/`actor_user_id` → ลบ workspace/user ได้ + audit row คงเป็นประวัติ (ยืนยันด้วย harness)
  - **M1 แก้แล้ว:** trigger `channels_status_guard` กันเปลี่ยน `channels.status` นอก `approve_channel` (บังคับผ่าน RPC + audit)
  - **M4 แก้แล้ว:** CI เพิ่ม `lint` + `test` และ job `db-harness` (Postgres service) รัน SQL harness ทุก push
  - ✅ verify: lint/typecheck/test 43/build + harness (workspaces/channels+M1/audit+H1-delete) ผ่านบน Postgres จริง
  - ⏳ รอ sub-agent re-audit ยืนยัน High=0
- **Task 1.4 (audit log, FR-013) — เขียนโค้ดเสร็จ + verify ผ่านครบ (25 ก.ค. 2026)**
  - migration `0005_audit_logs.sql`: ตาราง audit_logs (append-only) + RPC `log_audit` (actor=auth.uid())
  - **Append-only 2 ชั้น:** ไม่มี policy/grant UPDATE/DELETE + trigger BEFORE UPDATE/DELETE → RAISE
  - **เขียนผ่าน RPC/server เท่านั้น:** ไม่มี INSERT policy client · **revoke EXECUTE จาก PUBLIC** (กัน anon เขียน) — และทำกับ write RPC เดิม (create_workspace/approve_channel/seed_puifun) ด้วย
  - **ไม่เก็บ secret/PII:** `sanitizeMetadata()` ตัด password/token/secret/key + **mask email** (+ unit test)
  - login-failure บันทึกฝั่ง server ด้วย service-role (แนว A′) actor=null — ไม่ grant anon
  - logAudit best-effort (ไม่ทำ action หลักพัง) แต่ยิง error เข้า console
  - hook logging: workspace.create/update · channel.create/approve · auth.login(success/failure)/logout/signup
  - UI: audit log ล่าสุดในหน้า `/workspaces/[id]`
  - ✅ verify จริง: lint / typecheck / test 43/43 / build ผ่าน
  - ✅ **SQL harness (Postgres จริง) ผ่าน:** append-only (update/delete→raise) · client insert ตรงไม่ได้ · actor ปลอมไม่ได้ · B เห็น audit ของ A ไม่ได้ · anon SELECT=0 + anon เขียนไม่ได้
  - ➕ เพิ่มกฎถาวร **Security & Audit** ใน CLAUDE.md
- **Task 1.3 (channels + Gate 0 + RLS) — เขียนโค้ดเสร็จ + verify ผ่านครบ (25 ก.ค. 2026)**
  - migration `0003_channels.sql`: ตาราง channels (+enum draft/approved) + forbidden_words (ADR-002)
    + เพิ่ม channel_id ให้ pillars/characters/episodes (channel-scoped unique)
  - rename `content_pillars→pillars` (AGENTS ข้อ 13) + `rights_log→rights_records` (ADR-003)
  - **Gate 0**: BEFORE INSERT trigger บน episodes — channel ยัง draft สร้าง episode ไม่ได้ (บังคับที่ DB ทุกเส้นทาง)
  - helper `can_access_channel`/`has_channel_write` (SECURITY DEFINER, search_path='') → RLS สืบทอด scope ผ่าน channel→workspace
  - RPC `approve_channel` (owner-only) + `seed_puifun()` (idempotent: workspace+channel+pillars/characters/episodes/forbidden_words)
  - migration `0004`: channel_id ของ content SET NOT NULL (หลัง seed backfill — ปลายทางไม่ปล่อย nullable)
  - UI: workspace page ลิสต์+สร้าง channel, `/channels/[id]` มีปุ่มอนุมัติ (Gate 0)
  - ✅ verify จริง: lint / typecheck / test 37/37 / build ผ่าน
  - ✅ **SQL harness (Postgres จริง) ผ่าน:** Gate 0 (draft→สร้างไม่ได้ / approved→ได้) · B เข้าถึง channel/episodes ของ A ไม่ได้ · channel_id NOT NULL · seed_puifun idempotent
  - ⏳ **ค้าง E2E ฝั่งเจ้าของ:** รัน migration + `select seed_puifun()` (ล็อกอิน) บน Supabase จริง แล้วทดสอบ 2 บัญชี
- **Task 1.2 (workspaces + workspace_members + RLS) — เขียนโค้ดเสร็จ + verify ผ่านครบ (24 ก.ค. 2026)**
  - migration `0002_workspaces.sql`: ตาราง workspaces / workspace_members (+ enum owner/editor/viewer)
  - RLS เปิดทั้ง 2 ตาราง · helper `is_workspace_member`/`is_workspace_owner` (SECURITY DEFINER, search_path='')
  - RPC `create_workspace` (SECURITY DEFINER) bootstrap owner แถวแรกแบบ atomic กันปัญหาไก่-ไข่
  - ทุกฟังก์ชัน SECURITY DEFINER ตั้ง `search_path=''` + อ้างชื่อเต็ม (กัน search_path hijacking)
  - UI: `/workspaces` (list + สร้าง), `/workspaces/[id]` (แก้ชื่อ + ดูสมาชิก) — RLS-scoped
  - ✅ verify จริง: lint / typecheck / test 24/24 / build ผ่าน
  - ✅ **RLS harness (Postgres จริง) ผ่าน:** user B ดึง/แก้/แทรก/เห็นสมาชิก ของ workspace user A ไม่ได้เลยที่ระดับ DB · owner ยังจัดการของตัวเองได้
  - ⏳ **ค้าง E2E ฝั่งเจ้าของ:** สร้าง 2 บัญชีจริงบน Supabase ยืนยัน isolation ผ่านเบราว์เซอร์/REST
- **Task 1.1 (Auth) — เขียนโค้ดเสร็จ + automated verify ผ่านครบ (24 ก.ค. 2026)**
  - Supabase email auth (sign up / log in / log out) ด้วย server action
  - middleware กันหน้า `/dashboard` + refresh session ฝั่ง server
  - login error รวมเป็น "อีเมลหรือรหัสผ่านไม่ถูกต้อง" (กัน user enumeration)
  - `lib/auth/validation.ts` + unit test 15 เคส (Vitest)
  - ✅ รันจริงผ่าน: `lint` / `typecheck` / `test` (15/15) / `build` · ไม่มี secret ใน diff
  - ⏳ **ค้าง E2E ฝั่งเจ้าของ:** ต้องมีโปรเจกต์ Supabase จริง + `.env.local` ถึงจะทดสอบ
    สมัคร→ล็อกอิน→เห็นอีเมล→logout และ redirect ได้จริง (ผมทดสอบส่วนนี้แทนไม่ได้)

## ✅ ข้อตัดสินจากฝั่งวางแผน (ADR — ปิดคำถามค้างทั้ง 4 ข้อแล้ว)
ดูฉบับเต็มที่ `docs/07-DECISIONS-sprint1.md`
1. **ADR-001:** workspace/channel = **ตารางจริง + RLS** (ไม่ใช่ config) → Task 1.2 / 1.3
2. **ADR-002:** `forbidden_words` = ตาราง config (channel-scoped) seed จาก docs/05 · QC checklist คง docs ไปก่อน (สร้างตาราง Sprint 6)
3. **ADR-003:** ยึดชื่อ **`rights_records`** (ไม่ใช่ `rights_log`) → ต้องแก้ scaffold + กฎ naming อยู่ใน `AGENTS.md` แล้ว
4. **ADR-004:** เบรก Episodes UI — จัดลำดับราก→ยอด; pillars/characters/episodes เป็น channel-scoped (FK → channels → workspaces)

## 📌 หนี้ที่เคลียร์แล้วใน Task 1.3
- ✅ rename `rights_log` → `rights_records` (ADR-003) + `content_pillars` → `pillars` (AGENTS ข้อ 13)
- ✅ seed ผูก channel-scoped ผ่าน RPC `seed_puifun()` (workspace "Puifun Studio" + channel "ปุยฝัน")
- ⏳ ยังเหลือ: ออกแบบ RLS policy ของ `assets` / `rights_records` (ตอนนี้ล็อก deny-all ไว้ก่อน)

## ขั้นตอนถัดไป
> Sprint 1 (Task 1.1–1.4) + Sprint 2 UI ✅ เสร็จและ merged เข้า main แล้ว · TG3 ปิดบน Supabase จริงแล้ว
1. **🔴 ย้ายไป API key แบบใหม่ + Disable legacy API keys** — เร่งด่วนที่สุด · **หัวหน้ากดเอง ช่างทำแทนไม่ได้** (ค่าใหม่ห้ามผ่านแชต)
   > แทนการ rotate JWT secret: โปรเจกต์นี้มีทั้ง legacy (`anon`/`service_role`) และคีย์แบบใหม่ (`sb_publishable_`/`sb_secret_`) ให้ใช้อยู่แล้ว · rotate JWT secret จะพลอยเปลี่ยน `anon` ด้วยและยังทิ้ง legacy key ไว้ให้เผลอใช้ผิดซ้ำ ส่วนการย้ายไปคีย์ใหม่แล้วปิด legacy = ตัดคีย์ที่รั่วทิ้งถาวรในคราวเดียว
   1) Supabase dashboard → Project Settings → **API Keys** → คัดลอก `sb_publishable_…` (ฝั่ง browser ได้) + สร้าง/คัดลอก `sb_secret_…` (**ฝั่ง server เท่านั้น**)
   2) Vercel → Settings → Environment Variables → แทนค่าเดิมให้ครบทั้ง **Production + Preview**
      - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← ค่า `sb_publishable_…`
      - `SUPABASE_SERVICE_ROLE_KEY` ← ค่า `sb_secret_…`
      - ชื่อตัวแปรคงเดิมได้ **ไม่ต้องแก้โค้ด** (หลักฐานด้านล่าง) · การเปลี่ยนชื่อให้ตรงความจริงเป็นงานแยกทีหลัง
   3) `.env.local` บนเครื่องหัวหน้า → แทนค่าเดียวกัน (ไม่ผ่านแชต)
   4) Redeploy → เช็ก: ล็อกอิน · dashboard · สร้าง/แก้/ลบตอน ยังทำงาน
   5) เมื่อยืนยันว่าใช้งานได้ → Supabase dashboard → **Disable legacy API keys** (ตัด `anon`/`service_role` เดิมที่รั่วไปแล้วทิ้งถาวร)
   6) ถ้าพบ Ready deployment เก่าที่ฝังค่า service_role → ลบ/ปิด deployment นั้นหลังจากนี้
   - **หลักฐานความเข้ากันได้ (อ่านจากซอร์สที่ติดตั้งจริง ไม่ใช่เดา):**
     - `@supabase/supabase-js` ระบุ `^2.45.4` แต่ lockfile resolve เป็น **2.110.8** ซึ่งรู้จักคีย์ใหม่ตรง ๆ — `isNewApiKey()` เช็ก `sb_publishable_` / `sb_secret_` (`node_modules/@supabase/supabase-js/dist/index.cjs`)
     - `checkApiKeyFormat()` **ไม่ throw** และไม่ warn สำหรับ 2 prefix นี้ · key ถูกส่งเป็น header `apikey` เสมอ
     - `@supabase/ssr` 0.5.2 (`dist/main/createServerClient.js:8`) ตรวจแค่ "ค่าว่างหรือไม่" แล้วส่ง key ต่อให้ `createClient` ตรง ๆ → ไม่จำกัดรูปแบบคีย์
     - สรุป: `lib/supabase/server.ts:38` (`createSupabaseAdminClient`) รับ `sb_secret_…` ได้ทันทีโดยไม่ต้องแก้โค้ด
     - ⚠️ หนี้ที่พบเพิ่ม (ไม่บล็อกการย้ายคีย์): SDK ยังใส่ key เป็น `Authorization: Bearer` เป็น fallback ด้วย ทั้งที่คอมเมนต์ในซอร์สเองระบุว่าคีย์แบบใหม่ "ต้องอยู่ใน header `apikey` เท่านั้น" → ปิดได้ด้วย option `omitApiKeyAsBearer` (มีใน 2.110.8) · ควรเปิดตอนแก้ admin client รอบถัดไป
2. **Episodes UI — เติม gap + polish** (โครงหลัก list/create/edit/transition/characters/**ลบตอน** + RLS + Gate 0 + audit อยู่บน main แล้ว)
   - gap ที่เหลือ: ยังไม่มี UI component library (ทำ ad-hoc inline style ต่อหน้า) — **รับเป็นหนี้เทคนิค** (ฝ่ายวางแผนสั่ง NOT NOW)
   - รอสมองเคาะ scope ก่อนทำ Plan
3. **ตรวจว่า `vercel.json` ยังจำเป็นไหม** — ไม่ผิดแต่ซ้ำซ้อนกับ Framework Preset (Next.js) ใน dashboard · เก็บไว้ได้ ไม่เร่ง
4. **แสดง `error.message` ดิบให้ผู้ใช้ทั่วแอป** — `app/(app)/dashboard/page.tsx`, `app/(app)/workspaces/page.tsx` และ fallback ของ action แทบทุกตัวใน `lib/*/actions.ts` คืนข้อความ error จาก Postgres/PostgREST ตรง ๆ (ชื่อตาราง/constraint/policy)
   - ไม่พบเส้นทางที่ secret หรือ PII หลุด (client ไม่ใส่ค่า apikey ลงใน message) และทุกจุดอยู่หลัง auth guard · schema ก็เปิดเผยอยู่แล้วใน `supabase/migrations/` ของ repo public → ผลกระทบจริงต่ำ
   - **ควรแก้ทั้งแอปรวดเดียว** (map เป็นข้อความกลาง + `console.error` ตัวจริงฝั่ง server) ไม่ใช่แก้เฉพาะหน้าใดหน้าหนึ่ง เพราะจะทำให้พฤติกรรมไม่สม่ำเสมอ
5. **ไม่มี `app/(app)/layout.tsx` → ไม่มี nav ร่วม** — แต่ละหน้าเขียนลิงก์ย้อนกลับเอง · เมนูลัดบน Dashboard ชี้ได้แค่ `/workspaces` เพราะตอน/ตัวละคร/asset อยู่ใต้ `channels/[id]/` ทั้งหมด
   - งานนี้ให้รวม **deep link** (ดึง workspace/channel ของผู้ใช้มาลัดตรงไปตอน/ตัวละคร — แนวคิด Option B ที่เลื่อนไว้) เข้ามาด้วยในคราวเดียว
6. **งานเก็บกวาดฝั่งเจ้าของ** (คู่ขนาน ไม่บล็อกงานโค้ด): ลบ Cloudflare Worker · branch protection main

## งานฝั่งเจ้าของ (ผมทำแทนไม่ได้ — ทำคู่ขนาน)
- **จองแฮนเดิล YouTube `@puifun`** — ด่วนสุด
- สร้างโปรเจกต์ Supabase จริง → ใส่ค่าใน `.env.local` (Task 1.1 ต้องใช้ตอนทดสอบ login จริง)
- Track A: สร้าง anchor image น้องปุย/มุ่ย + generate เพลงธีม Pilot #1 (Suno) + จด Rights Log

## ข้อจำกัดที่ต้องเผื่อไว้เวลาวางแผน
- Claude สร้างไฟล์ / รันโค้ดในแซนด์บ็อกซ์ / ค้นเว็บได้ แต่ **ติดตั้งซอฟต์แวร์บนเครื่องคุณไม่ได้, สมัครบัญชีบริการภายนอกแทนไม่ได้, และควบคุมเบราว์เซอร์แทนไม่ได้** — งานพวกนี้คุณต้องลงมือเอง
- Claude เริ่มทำงานเองอัตโนมัติไม่ได้ ต้องให้คุณเปิดแชตแล้วสั่ง "ทำต่อ"

## บันทึกการตัดสินใจ / โน้ตสำคัญ
- เลือกชื่อ "ปุยฝัน" เพราะชื่อเดิม "ปุยนุ่น" ติดแบรนด์เชิงพาณิชย์ + เพลงดังในผลค้นหา + มีข่าวเชิงลบพ่วง
- Scaffold ใช้ Next.js 14 (App Router) + `@supabase/ssr` เพื่อให้เข้ากับ Vercel/Server Components
- Package manager = npm (ถ้าเปลี่ยนภายหลัง ต้องอัปเดต CLAUDE.md ด้วย)
