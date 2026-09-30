"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import { reportError } from "@/lib/errors.server";
import {
  validateEpisodeTitle,
  isEpisodeStatus,
  type EpisodeStatus,
} from "@/lib/episode/validation";

export type EpisodeState = {
  error: string | null;
  message?: string | null;
};

function pillarOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

// สร้าง episode — RLS: owner+editor · Gate 0 (DB) บังคับ channel approved
export async function createEpisode(
  _prev: EpisodeState,
  formData: FormData,
): Promise<EpisodeState> {
  const channelId = String(formData.get("channel_id") ?? "");
  const title = String(formData.get("title") ?? "");
  const pillarId = pillarOrNull(formData.get("pillar_id"));

  if (!channelId) return { error: "ไม่พบ channel" };
  const titleError = validateEpisodeTitle(title);
  if (titleError) return { error: titleError };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("episodes")
    .insert({ channel_id: channelId, title: title.trim(), pillar_id: pillarId })
    .select("id")
    .maybeSingle();

  if (error) {
    if (/Gate 0|ยังไม่อนุมัติ/i.test(error.message))
      return { error: "channel ยังไม่อนุมัติ — สร้างตอนไม่ได้ (Gate 0)" };
    return { error: reportError("episode.create", error) };
  }
  if (!data) return { error: "คุณไม่มีสิทธิ์สร้างตอนในช่องนี้ (ต้องเป็น owner/editor)" };

  const { data: ch } = await supabase
    .from("channels")
    .select("workspace_id")
    .eq("id", channelId)
    .maybeSingle();

  await logAudit(supabase, {
    action: "episode.create",
    entityType: "episode",
    entityId: data.id,
    workspaceId: (ch as { workspace_id?: string } | null)?.workspace_id ?? null,
    metadata: { title: title.trim() },
  });

  redirect(`/episodes/${data.id}`);
}

// แก้ไข episode (title/script/pillar) — ไม่แตะ status (status ต้องผ่าน transitionEpisode)
export async function updateEpisode(
  _prev: EpisodeState,
  formData: FormData,
): Promise<EpisodeState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "");
  const script = String(formData.get("script") ?? "");
  const pillarId = pillarOrNull(formData.get("pillar_id"));

  if (!id) return { error: "ไม่พบตอน" };
  const titleError = validateEpisodeTitle(title);
  if (titleError) return { error: titleError };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("episodes")
    .update({ title: title.trim(), script: script, pillar_id: pillarId })
    .eq("id", id)
    .select("id, channel_id")
    .maybeSingle();

  if (error) return { error: reportError("episode.update", error) };
  if (!data) return { error: "คุณไม่มีสิทธิ์แก้ไขตอนนี้" };

  await logAudit(supabase, {
    action: "episode.update",
    entityType: "episode",
    entityId: id,
    metadata: { title: title.trim() },
  });

  revalidatePath(`/episodes/${id}`);
  const channelId = (data as { channel_id?: string }).channel_id;
  if (channelId) revalidatePath(`/channels/${channelId}/episodes`);
  return { error: null, message: "บันทึกแล้ว" };
}

// เปลี่ยนสถานะผ่าน RPC เท่านั้น (FR-010) — DB validate + audit ให้เอง
export async function transitionEpisode(
  _prev: EpisodeState,
  formData: FormData,
): Promise<EpisodeState> {
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "");

  if (!id) return { error: "ไม่พบตอน" };
  if (!isEpisodeStatus(to)) return { error: "สถานะปลายทางไม่ถูกต้อง" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("transition_episode", {
    p_id: id,
    p_to: to as EpisodeStatus,
  });

  if (error) {
    if (/invalid transition/i.test(error.message))
      return { error: "เปลี่ยนสถานะนี้ไม่ได้ (ขั้นตอนไม่ถูกต้อง)" };
    if (/ไม่มีสิทธิ์|permission/i.test(error.message))
      return { error: "คุณไม่มีสิทธิ์เปลี่ยนสถานะตอนนี้" };
    return { error: reportError("episode.transition", error) };
  }

  revalidatePath(`/episodes/${id}`);
  return { error: null, message: "เปลี่ยนสถานะแล้ว" };
}

// ── ผูก/ถอดตัวละคร (m2m) — RLS บังคับ same-channel + write ที่ DB ──────
export async function linkCharacter(
  _prev: EpisodeState,
  formData: FormData,
): Promise<EpisodeState> {
  const episodeId = String(formData.get("episode_id") ?? "");
  const characterId = String(formData.get("character_id") ?? "");
  if (!episodeId) return { error: "ไม่พบตอน" };
  if (!characterId) return { error: "กรุณาเลือกตัวละคร" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("episode_characters")
    .insert({ episode_id: episodeId, character_id: characterId });

  if (error) {
    if (/duplicate key|unique|already exists/i.test(error.message))
      return { error: "ผูกตัวละครนี้ไว้แล้ว" };
    if (/row-level security|violates/i.test(error.message))
      return { error: "ผูกไม่ได้ (ต้องเป็นตัวละครในช่องเดียวกัน + สิทธิ์เขียน)" };
    return { error: reportError("episode.link_character", error) };
  }

  await logAudit(supabase, {
    action: "episode.link_character",
    entityType: "episode",
    entityId: episodeId,
    metadata: { character_id: characterId },
  });

  revalidatePath(`/episodes/${episodeId}`);
  return { error: null, message: "ผูกตัวละครแล้ว" };
}

export async function unlinkCharacter(formData: FormData): Promise<void> {
  const episodeId = String(formData.get("episode_id") ?? "");
  const characterId = String(formData.get("character_id") ?? "");
  if (!episodeId || !characterId) return;

  const supabase = createSupabaseServerClient();
  // .select() คืนแถวที่ถูกลบจริง — RLS ที่ไม่มีสิทธิ์คืน 0 แถวโดยไม่ error
  const { data, error } = await supabase
    .from("episode_characters")
    .delete()
    .eq("episode_id", episodeId)
    .eq("character_id", characterId)
    .select("character_id");

  // audit เฉพาะเมื่อถอดจริง (กัน audit noise บน no-op — audit L1)
  if (!error && data && data.length > 0) {
    await logAudit(supabase, {
      action: "episode.unlink_character",
      entityType: "episode",
      entityId: episodeId,
      metadata: { character_id: characterId },
    });
  }
  revalidatePath(`/episodes/${episodeId}`);
}

// ลบ episode — RLS: owner+editor (episodes_write FOR ALL) · ลบแล้วเด้งกลับรายการตอน
export async function deleteEpisode(
  _prev: EpisodeState,
  formData: FormData,
): Promise<EpisodeState> {
  const id = String(formData.get("id") ?? "");
  const channelId = String(formData.get("channel_id") ?? "");
  if (!id) return { error: "ไม่พบตอน" };

  const supabase = createSupabaseServerClient();
  // .select() คืนแถวที่ถูกลบจริง — RLS ที่ไม่มีสิทธิ์คืน 0 แถวโดยไม่ error
  const { data, error } = await supabase
    .from("episodes")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { error: reportError("episode.delete", error) };
  if (!data || data.length === 0)
    return { error: "คุณไม่มีสิทธิ์ลบตอนนี้ (ต้องเป็น owner/editor)" };

  await logAudit(supabase, {
    action: "episode.delete",
    entityType: "episode",
    entityId: id,
  });

  if (channelId) revalidatePath(`/channels/${channelId}/episodes`);
  redirect(channelId ? `/channels/${channelId}/episodes` : "/dashboard");
}
