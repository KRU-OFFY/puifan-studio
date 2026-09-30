"use server";

import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import { validateEmail, validatePassword } from "@/lib/auth/validation";
import { logAudit } from "@/lib/audit/log";
import { maskEmail } from "@/lib/audit/sanitize";
import { reportError } from "@/lib/errors.server";

export type AuthState = {
  error: string | null;
  message?: string | null;
};

// บันทึก login-failure ฝั่ง server ด้วย service-role โดยตรง (แนว A′)
// ตอน login ผิดยังไม่มี session → actor=null; ไม่ต้อง grant anon ให้เขียน audit (กัน flood)
// best-effort: ถ้า log ล้ม ไม่ทำให้ flow พัง แต่ต้องไม่เงียบ (ยิงเข้า console)
async function recordLoginFailure(email: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      action: "auth.login",
      result: "failure",
      actor_user_id: null,
      workspace_id: null,
      metadata: { email: maskEmail(email) }, // mask PII
    });
    if (error) console.error("[audit] login-failure insert failed:", error.message);
  } catch (err) {
    console.error("[audit] login-failure insert threw:", err);
  }
}

// ล็อกอิน — error รวมเป็นข้อความเดียวเสมอ เพื่อกัน user enumeration
export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const validationError = validateEmail(email) ?? validatePassword(password);
  if (validationError) return { error: validationError };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // ไม่แยกว่า "ไม่พบอีเมล" หรือ "รหัสผ่านผิด" — ตอบรวมกันเสมอ
  if (error) {
    await recordLoginFailure(email);
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  // สำเร็จ → มี session แล้ว actor = auth.uid()
  await logAudit(supabase, { action: "auth.login", result: "success" });
  redirect("/dashboard");
}

// สมัครสมาชิก
export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const validationError = validateEmail(email) ?? validatePassword(password);
  if (validationError) return { error: validationError };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: reportError("auth.signup", error) };

  // ถ้าโปรเจกต์เปิด email confirmation จะยังไม่มี session ทันที
  if (!data.session) {
    return {
      error: null,
      message: "สมัครสำเร็จ! กรุณาตรวจอีเมลเพื่อยืนยันบัญชี แล้วจึงเข้าสู่ระบบ",
    };
  }

  await logAudit(supabase, { action: "auth.signup", result: "success" });
  redirect("/dashboard");
}

// ออกจากระบบ — log ก่อน signOut (ตอน session ยังอยู่ actor = auth.uid())
export async function logout(): Promise<void> {
  const supabase = createSupabaseServerClient();
  await logAudit(supabase, { action: "auth.logout", result: "success" });
  await supabase.auth.signOut();
  redirect("/login");
}
