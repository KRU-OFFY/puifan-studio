"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import { reportError } from "@/lib/errors.server";
import {
  validateWorkspaceName,
  normalizeTimezone,
  normalizeCurrency,
} from "@/lib/workspace/validation";

export type WorkspaceState = {
  error: string | null;
  message?: string | null;
};

type WorkspaceRow = { id: string; name: string };

// สร้าง workspace ผ่าน RPC create_workspace (SECURITY DEFINER)
// → insert workspace + owner แถวแรก แบบ atomic โดยไม่ชน RLS
export async function createWorkspace(
  _prev: WorkspaceState,
  formData: FormData,
): Promise<WorkspaceState> {
  const name = String(formData.get("name") ?? "");
  const timezone = String(formData.get("timezone") ?? "");
  const currency = String(formData.get("currency") ?? "");

  const nameError = validateWorkspaceName(name);
  if (nameError) return { error: nameError };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: name.trim(),
    p_timezone: normalizeTimezone(timezone),
    p_currency: normalizeCurrency(currency),
  });

  if (error) return { error: reportError("workspace.create", error) };

  const ws = (Array.isArray(data) ? data[0] : data) as WorkspaceRow | null;
  if (!ws?.id) return { error: "สร้าง workspace ไม่สำเร็จ" };

  await logAudit(supabase, {
    action: "workspace.create",
    entityType: "workspace",
    entityId: ws.id,
    workspaceId: ws.id,
    metadata: { name: ws.name },
  });

  redirect(`/workspaces/${ws.id}`);
}

// แก้ชื่อ workspace — RLS ให้เฉพาะ owner แก้ได้
export async function renameWorkspace(
  _prev: WorkspaceState,
  formData: FormData,
): Promise<WorkspaceState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");

  if (!id) return { error: "ไม่พบ workspace" };
  const nameError = validateWorkspaceName(name);
  if (nameError) return { error: nameError };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { error: reportError("workspace.update", error) };
  // ถ้าไม่ใช่ owner RLS จะกรองจนไม่มีแถวถูกแก้ (data = null)
  if (!data) return { error: "คุณไม่มีสิทธิ์แก้ workspace นี้ (ต้องเป็น owner)" };

  await logAudit(supabase, {
    action: "workspace.update",
    entityType: "workspace",
    entityId: id,
    workspaceId: id,
    metadata: { name: name.trim() },
  });

  revalidatePath(`/workspaces/${id}`);
  return { error: null, message: "บันทึกชื่อใหม่แล้ว" };
}
