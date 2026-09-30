"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import { reportError } from "@/lib/errors.server";
import {
  isAssetType,
  isAssetRole,
  validateAssetTitle,
  validateStoragePath,
  validateRights,
} from "@/lib/asset/validation";

export type AssetState = {
  error: string | null;
  message?: string | null;
};

function s(formData: FormData, k: string): string {
  return String(formData.get(k) ?? "");
}
function orNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

// สร้าง asset + rights คู่กัน (atomic ผ่าน RPC) — rights ห้ามว่าง
export async function createAssetWithRights(
  _prev: AssetState,
  formData: FormData,
): Promise<AssetState> {
  const channelId = s(formData, "channel_id");
  const type = s(formData, "type");
  const role = s(formData, "role");
  const title = s(formData, "title");
  const storagePath = s(formData, "storage_path");
  const toolUsed = s(formData, "tool_used");
  const exportedAt = s(formData, "exported_at");

  if (!channelId) return { error: "ไม่พบ channel" };
  if (!isAssetType(type)) return { error: "ประเภท asset ไม่ถูกต้อง" };
  if (role && !isAssetRole(role)) return { error: "บทบาท asset ไม่ถูกต้อง" };
  const titleErr = validateAssetTitle(title);
  if (titleErr) return { error: titleErr };
  const pathErr = validateStoragePath(storagePath);
  if (pathErr) return { error: pathErr };
  const rightsErr = validateRights({ toolUsed, exportedAt });
  if (rightsErr) return { error: rightsErr };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_asset_with_rights", {
    p_channel_id: channelId,
    p_type: type,
    p_role: role || null,
    p_title: title,
    p_episode_id: orNull(s(formData, "episode_id")),
    p_storage_path: storagePath.trim(),
    p_source_tool: s(formData, "source_tool"),
    p_tool_used: toolUsed.trim(),
    p_plan: s(formData, "plan"),
    p_model: s(formData, "model"),
    p_prompt_used: s(formData, "prompt_used"),
    p_source_url: s(formData, "source_url"),
    p_license_note: s(formData, "license_note"),
    p_exported_at: exportedAt,
  });

  if (error) {
    if (/ไม่มีสิทธิ์|permission/i.test(error.message))
      return { error: "คุณไม่มีสิทธิ์สร้าง asset ในช่องนี้ (ต้องเป็น owner/editor)" };
    if (/episode ไม่ได้อยู่/i.test(error.message))
      return { error: "ตอนที่เลือกไม่ได้อยู่ในช่องนี้" };
    return { error: reportError("asset.create", error) };
  }
  const asset = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
  if (!asset?.id) return { error: "สร้าง asset ไม่สำเร็จ" };

  await logAudit(supabase, {
    action: "asset.create",
    entityType: "asset",
    entityId: asset.id,
    metadata: { type, role: role || null },
  });

  redirect(`/assets/${asset.id}`);
}

// แก้ไข asset + rights (ทั้งคู่ในที่เดียว) — RLS บังคับ has_channel_write
export async function updateAssetWithRights(
  _prev: AssetState,
  formData: FormData,
): Promise<AssetState> {
  const assetId = s(formData, "asset_id");
  const type = s(formData, "type");
  const role = s(formData, "role");
  const title = s(formData, "title");
  const storagePath = s(formData, "storage_path");
  const toolUsed = s(formData, "tool_used");
  const exportedAt = s(formData, "exported_at");

  if (!assetId) return { error: "ไม่พบ asset" };
  if (!isAssetType(type)) return { error: "ประเภท asset ไม่ถูกต้อง" };
  if (role && !isAssetRole(role)) return { error: "บทบาท asset ไม่ถูกต้อง" };
  const titleErr = validateAssetTitle(title);
  if (titleErr) return { error: titleErr };
  const pathErr = validateStoragePath(storagePath);
  if (pathErr) return { error: pathErr };
  const rightsErr = validateRights({ toolUsed, exportedAt });
  if (rightsErr) return { error: rightsErr };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assets")
    .update({
      type,
      role: role || null,
      title: orNull(title),
      storage_path: storagePath.trim(),
      source_tool: orNull(s(formData, "source_tool")),
    })
    .eq("id", assetId)
    .select("id")
    .maybeSingle();

  if (error) return { error: reportError("asset.update", error) };
  if (!data) return { error: "คุณไม่มีสิทธิ์แก้ไข asset นี้" };

  const { error: rErr } = await supabase
    .from("rights_records")
    .update({
      tool_used: toolUsed.trim(),
      plan: orNull(s(formData, "plan")),
      model: orNull(s(formData, "model")),
      prompt_used: orNull(s(formData, "prompt_used")),
      source_url: orNull(s(formData, "source_url")),
      license_note: orNull(s(formData, "license_note")),
      exported_at: exportedAt,
    })
    .eq("asset_id", assetId);
  if (rErr) return { error: reportError("asset.update.rights", rErr) };

  await logAudit(supabase, {
    action: "asset.update",
    entityType: "asset",
    entityId: assetId,
    metadata: { type },
  });

  revalidatePath(`/assets/${assetId}`);
  return { error: null, message: "บันทึกแล้ว" };
}
