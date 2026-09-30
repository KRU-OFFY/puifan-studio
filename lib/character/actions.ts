"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import { reportError } from "@/lib/errors.server";
import {
  validateCharacterName,
  validateSlug,
  validateJsonObject,
  isCharacterType,
  toArray,
  PILLAR_CODES,
} from "@/lib/character/validation";

export type CharacterState = {
  error: string | null;
  message?: string | null;
};

function s(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "");
}
function orNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}
function jsonOrEmpty(raw: string): Record<string, unknown> {
  const t = raw.trim();
  if (!t) return {};
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}
// appears_in: เก็บเฉพาะ code ที่ถูกติ๊ก (P1/P2/P3)
function appearsIn(fd: FormData): string[] {
  return PILLAR_CODES.filter((c) => fd.get(`appears_${c}`) === "on");
}

function validateCommon(fd: FormData): string | null {
  const nameErr = validateCharacterName(s(fd, "name"));
  if (nameErr) return nameErr;
  const slugErr = validateSlug(s(fd, "slug"));
  if (slugErr) return slugErr;
  if (!isCharacterType(s(fd, "type"))) return "ประเภทตัวละครไม่ถูกต้อง";
  const apErr = validateJsonObject(s(fd, "appearance"));
  if (apErr) return `appearance: ${apErr}`;
  const vErr = validateJsonObject(s(fd, "voice"));
  if (vErr) return `voice: ${vErr}`;
  return null;
}

export async function createCharacter(
  _prev: CharacterState,
  fd: FormData,
): Promise<CharacterState> {
  const channelId = s(fd, "channel_id");
  if (!channelId) return { error: "ไม่พบ channel" };
  const err = validateCommon(fd);
  if (err) return { error: err };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("characters")
    .insert({
      channel_id: channelId,
      name: s(fd, "name").trim(),
      slug: s(fd, "slug").trim(),
      type: s(fd, "type"),
      role: orNull(s(fd, "role")),
      species: orNull(s(fd, "species")),
      description: orNull(s(fd, "description")),
      image_prompt: orNull(s(fd, "image_prompt")),
      anchor_image_url: orNull(s(fd, "anchor_image_url")),
      appearance: jsonOrEmpty(s(fd, "appearance")),
      voice: jsonOrEmpty(s(fd, "voice")),
      personality: toArray(s(fd, "personality")),
      forbidden: toArray(s(fd, "forbidden")),
      appears_in: appearsIn(fd),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (/duplicate key|unique/i.test(error.message))
      return { error: "slug นี้มีอยู่แล้วในช่อง" };
    return { error: reportError("character.create", error) };
  }
  if (!data) return { error: "คุณไม่มีสิทธิ์สร้างตัวละครในช่องนี้ (ต้องเป็น owner/editor)" };

  await logAudit(supabase, {
    action: "character.create",
    entityType: "character",
    entityId: data.id,
    metadata: { name: s(fd, "name").trim(), type: s(fd, "type") },
  });

  redirect(`/characters/${data.id}`);
}

export async function updateCharacter(
  _prev: CharacterState,
  fd: FormData,
): Promise<CharacterState> {
  const id = s(fd, "id");
  if (!id) return { error: "ไม่พบตัวละคร" };
  const err = validateCommon(fd);
  if (err) return { error: err };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("characters")
    .update({
      name: s(fd, "name").trim(),
      slug: s(fd, "slug").trim(),
      type: s(fd, "type"),
      role: orNull(s(fd, "role")),
      species: orNull(s(fd, "species")),
      description: orNull(s(fd, "description")),
      image_prompt: orNull(s(fd, "image_prompt")),
      anchor_image_url: orNull(s(fd, "anchor_image_url")),
      appearance: jsonOrEmpty(s(fd, "appearance")),
      voice: jsonOrEmpty(s(fd, "voice")),
      personality: toArray(s(fd, "personality")),
      forbidden: toArray(s(fd, "forbidden")),
      appears_in: appearsIn(fd),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (/duplicate key|unique/i.test(error.message))
      return { error: "slug นี้มีอยู่แล้วในช่อง" };
    return { error: reportError("character.update", error) };
  }
  if (!data) return { error: "คุณไม่มีสิทธิ์แก้ไขตัวละครนี้" };

  await logAudit(supabase, {
    action: "character.update",
    entityType: "character",
    entityId: id,
    metadata: { name: s(fd, "name").trim() },
  });

  revalidatePath(`/characters/${id}`);
  return { error: null, message: "บันทึกแล้ว" };
}
