"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import { reportError } from "@/lib/errors.server";
import { validateChannelName, validateSlug } from "@/lib/channel/validation";

export type ChannelState = {
  error: string | null;
  message?: string | null;
};

// สร้าง channel — RLS ให้เฉพาะ owner ของ workspace เพิ่มได้; created_by = auth.uid() (default DB)
export async function createChannel(
  _prev: ChannelState,
  formData: FormData,
): Promise<ChannelState> {
  const workspaceId = String(formData.get("workspace_id") ?? "");
  const name = String(formData.get("name") ?? "");
  const slug = String(formData.get("slug") ?? "");

  if (!workspaceId) return { error: "ไม่พบ workspace" };
  const nameError = validateChannelName(name);
  if (nameError) return { error: nameError };
  const slugError = validateSlug(slug);
  if (slugError) return { error: slugError };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("channels")
    .insert({ workspace_id: workspaceId, name: name.trim(), slug: slug.trim() })
    .select("id")
    .maybeSingle();

  if (error) {
    if (/duplicate key|unique/i.test(error.message))
      return { error: "slug นี้มีอยู่แล้วใน workspace" };
    return { error: reportError("channel.create", error) };
  }
  if (!data) return { error: "คุณไม่มีสิทธิ์สร้าง channel (ต้องเป็น owner)" };

  await logAudit(supabase, {
    action: "channel.create",
    entityType: "channel",
    entityId: data.id,
    workspaceId,
    metadata: { name: name.trim(), slug: slug.trim() },
  });

  redirect(`/channels/${data.id}`);
}

// อนุมัติ channel (Gate 0) — RPC เช็ก owner ฝั่ง DB
export async function approveChannel(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.rpc("approve_channel", { p_id: id });
  const ch = (Array.isArray(data) ? data[0] : data) as
    | { id?: string; workspace_id?: string }
    | null;
  if (ch?.id) {
    await logAudit(supabase, {
      action: "channel.approve",
      entityType: "channel",
      entityId: ch.id,
      workspaceId: ch.workspace_id ?? null,
    });
  }
  revalidatePath(`/channels/${id}`);
}

// seed ข้อมูลปุยฝันครั้งเดียว (idempotent) — สร้าง workspace/channel/content ให้ผู้เรียก
export async function seedPuifun(): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.rpc("seed_puifun");
  const ch = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
  if (ch?.id) redirect(`/channels/${ch.id}`);
  redirect("/workspaces");
}
