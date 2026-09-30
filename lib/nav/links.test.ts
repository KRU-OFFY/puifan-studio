import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { DASHBOARD_NAV_LINKS, NAV_PATH_HINT } from "./links";

// resolve จากตำแหน่งไฟล์ test เอง ไม่พึ่ง cwd — ให้รันได้ทั้งเครื่องและ CI
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, "../../app");

const isRouteGroup = (name: string) =>
  name.startsWith("(") && name.endsWith(")");

// เดิน app/ แล้วแปลง path ของ page.tsx เป็น URL ตามกฎ App Router:
// โฟลเดอร์กลุ่ม (xxx) ไม่นับเป็น segment · page.tsx = route ของโฟลเดอร์ที่มันอยู่
function collectRoutes(dir: string, segments: string[] = []): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      routes.push(
        ...collectRoutes(
          path.join(dir, entry.name),
          isRouteGroup(entry.name) ? segments : [...segments, entry.name],
        ),
      );
    } else if (entry.name === "page.tsx") {
      routes.push("/" + segments.join("/"));
    }
  }
  return routes;
}

const ROUTES = collectRoutes(APP_DIR);
const STATIC_ROUTES = ROUTES.filter((r) => !r.includes("["));

describe("การอ่าน route จาก app/ (ฐานของ test ข้ออื่น)", () => {
  it("อ่านเจอ route จริง และตัดโฟลเดอร์กลุ่มออกถูกต้อง", () => {
    // ถ้า collectRoutes พังเงียบ ๆ test ข้ออื่นจะผ่านแบบไร้ความหมาย → ตรึงด้วย 3 route ที่รู้แน่
    expect(ROUTES.length).toBeGreaterThan(0);
    expect(STATIC_ROUTES).toContain("/dashboard"); // จาก app/(app)/dashboard
    expect(STATIC_ROUTES).toContain("/login"); // จาก app/(auth)/login
    expect(ROUTES).toContain("/episodes/[id]"); // route แบบ dynamic ต้องถูกอ่านเจอด้วย
  });
});

describe("DASHBOARD_NAV_LINKS", () => {
  it("ต้องไม่ว่าง", () => {
    expect(DASHBOARD_NAV_LINKS.length).toBeGreaterThan(0);
  });

  it("ทุก href ชี้ route ที่มี page.tsx จริง", () => {
    const missing = DASHBOARD_NAV_LINKS.filter(
      (l) => !STATIC_ROUTES.includes(l.href),
    ).map((l) => l.href);
    expect(missing).toEqual([]);
  });

  it("ห้ามมี href ที่ต้องใช้ segment [param]", () => {
    const dynamic = DASHBOARD_NAV_LINKS.filter((l) =>
      l.href.includes("["),
    ).map((l) => l.href);
    expect(dynamic).toEqual([]);
  });

  it("href ขึ้นต้นด้วย / และไม่ซ้ำกัน", () => {
    const hrefs = DASHBOARD_NAV_LINKS.map((l) => l.href);
    expect(hrefs.every((h) => h.startsWith("/"))).toBe(true);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("label และ description ต้องมีข้อความ", () => {
    for (const link of DASHBOARD_NAV_LINKS) {
      expect(link.label.trim()).not.toBe("");
      expect(link.description.trim()).not.toBe("");
    }
  });
});

describe("NAV_PATH_HINT", () => {
  it("มีข้อความบอกเส้นทาง", () => {
    expect(NAV_PATH_HINT.trim()).not.toBe("");
  });
});
