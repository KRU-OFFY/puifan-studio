import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateWorkspaceForm } from "@/components/WorkspaceForms";
import { reportError } from "@/lib/errors.server";

export const dynamic = "force-dynamic";

type Workspace = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  created_at: string;
};

export default async function WorkspacesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: เห็นเฉพาะ workspace ที่ตัวเองเป็นสมาชิก
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, timezone, currency, created_at")
    .order("created_at", { ascending: true });

  const workspaces = (data ?? []) as Workspace[];

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/dashboard">← กลับ Dashboard</Link>
      </p>
      <h1>Workspaces ของคุณ</h1>

      <section style={{ marginTop: 24 }}>
        {error && (
          <p style={{ color: "var(--err)" }}>
            โหลดข้อมูลไม่สำเร็จ: {reportError("workspaces.list", error)}
          </p>
        )}
        {!error && workspaces.length === 0 && (
          <p style={{ color: "var(--muted)" }}>
            ยังไม่มี workspace — สร้างอันแรกด้านล่างได้เลย
          </p>
        )}
        {workspaces.length > 0 && (
          <ul style={{ paddingLeft: 18 }}>
            {workspaces.map((w) => (
              <li key={w.id} style={{ marginBottom: 8 }}>
                <Link href={`/workspaces/${w.id}`}>{w.name}</Link>{" "}
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  · {w.timezone} · {w.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ marginBottom: 12 }}>สร้าง workspace ใหม่</h2>
        <CreateWorkspaceForm />
      </section>
    </main>
  );
}
