import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth/actions";
import { DASHBOARD_NAV_LINKS, NAV_PATH_HINT } from "@/lib/nav/links";
import { reportError } from "@/lib/errors.server";
import type { UserMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

type ConnectionStatus =
  | { state: "missing-env" }
  | { state: "ok"; url: string }
  // message เป็น UserMessage ไม่ใช่ string — typecheck จึงบังคับให้ค่าที่แสดง
  // ต้องผ่าน toUserMessage/reportError เท่านั้น (กันเผลอส่ง error.message ดิบกลับมา)
  | { state: "error"; message: UserMessage };

async function checkSupabase(): Promise<ConnectionStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { state: "missing-env" };
  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("pillars").select("id").limit(1);
    // ตารางยังไม่ถูกสร้าง (42P01) ไม่ถือว่าเชื่อมต่อไม่ได้ — ต่อ DB ติดแล้ว
    if (error && !/relation .* does not exist/i.test(error.message)) {
      // สาเหตุจริงไป log ฝั่ง server เท่านั้น ผู้ใช้เห็นข้อความที่ปลอดภัย
      return { state: "error", message: reportError("dashboard.supabase", error) };
    }
    return { state: "ok", url };
  } catch (err) {
    return { state: "error", message: reportError("dashboard.supabase", err) };
  }
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ป้องกันซ้ำอีกชั้นนอกเหนือจาก middleware (defense in depth)
  if (!user) redirect("/login");

  const status = await checkSupabase();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>Dashboard</h1>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            เข้าสู่ระบบในชื่อ <strong>{user.email}</strong>
          </p>
        </div>
        <form action={logout}>
          <button type="submit" className="auth-submit" style={{ width: "auto" }}>
            ออกจากระบบ
          </button>
        </form>
      </div>

      <p style={{ color: "var(--muted)", marginTop: 16 }}>
        โปรเจกต์: <strong>TOFFY AI YouTube Studio</strong> · แบรนด์: ปุยฝัน (Puifun)
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 8 }}>Supabase connection</h2>
        {status.state === "missing-env" && (
          <p style={{ color: "var(--warn)" }}>
            ยังไม่พบค่า <code>NEXT_PUBLIC_SUPABASE_URL</code> /{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — คัดลอก{" "}
            <code>.env.example</code> เป็น <code>.env.local</code> แล้วกรอกค่าจาก
            Supabase dashboard
          </p>
        )}
        {status.state === "ok" && (
          <p style={{ color: "var(--ok)" }}>เชื่อมต่อ Supabase สำเร็จ · {status.url}</p>
        )}
        {status.state === "error" && (
          <p style={{ color: "var(--err)" }}>
            เชื่อมต่อ Supabase ไม่สำเร็จ: {status.message}
          </p>
        )}
      </section>

      <nav aria-label="เมนูลัด" style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 8 }}>ไปที่</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {DASHBOARD_NAV_LINKS.map((link) => (
            <li key={link.href} style={{ marginBottom: 12 }}>
              <Link href={link.href}>{link.label}</Link>
              <span style={{ color: "var(--muted)" }}> — {link.description}</span>
            </li>
          ))}
        </ul>
        <p style={{ color: "var(--muted)", marginTop: 16, marginBottom: 0 }}>
          {NAV_PATH_HINT}
        </p>
      </nav>
    </main>
  );
}
