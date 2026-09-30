// แปลง error จาก Supabase/Postgres → ข้อความไทยที่ปลอดภัยสำหรับผู้ใช้
//
// กติกา:
// - **ไม่เคย** ส่งข้อความต้นทางออกไปฝั่ง client แม้เป็นภาษาไทยที่เราเขียนเอง
//   (ข้อความจาก DB บางตัวมีชื่อตาราง/constraint หรือค่าที่แทรกมา เช่น
//   "invalid transition: draft → published") → map เป็นข้อความที่ curate ไว้เท่านั้น
// - ตัดสินด้วย **code ก่อน** (`err.code`) แล้วจึงค่อย fallback ไปดูข้อความ
//   ถ้า code กับข้อความขัดกัน ให้ยึด code
// - ผลลัพธ์ทุกกรณีต้องเป็นค่าใน USER_MESSAGES เท่านั้น (test ตรึงไว้)
//
// รายละเอียดจริงของ error เก็บฝั่ง server เท่านั้น — ดู `lib/errors.server.ts`

export const USER_MESSAGES = {
  duplicate: "ข้อมูลนี้มีอยู่แล้ว (ค่าซ้ำกับที่มี)",
  forbidden: "คุณไม่มีสิทธิ์ทำรายการนี้",
  foreignKey: "ข้อมูลที่อ้างถึงไม่ถูกต้องหรือถูกลบไปแล้ว",
  invalidFormat: "ข้อมูลไม่ถูกต้องตามรูปแบบที่กำหนด",
  notFound: "ไม่พบข้อมูลที่ต้องการ",
  gate0: "ช่องนี้ยังไม่อนุมัติ ทำรายการนี้ไม่ได้ (Gate 0)",
  invalidTransition: "เปลี่ยนสถานะนี้ไม่ได้ (ขั้นตอนไม่ถูกต้อง)",
  episodeWrongChannel: "ตอนที่เลือกไม่ได้อยู่ในช่องนี้",
  needLogin: "กรุณาเข้าสู่ระบบก่อน",
  emailTaken: "อีเมลนี้ถูกใช้สมัครแล้ว",
  weakPassword: "รหัสผ่านไม่ผ่านเกณฑ์ความปลอดภัย",
  rateLimit: "ทำรายการถี่เกินไป กรุณารอสักครู่",
  generic: "เกิดข้อผิดพลาด กรุณาลองใหม่",
} as const;

export type UserMessage = (typeof USER_MESSAGES)[keyof typeof USER_MESSAGES];

export type ErrorParts = { code: string | null; message: string };

// ดึง code/message ออกจาก error รูปแบบไหนก็ได้ (PostgrestError, AuthError, Error, string)
export function extractErrorParts(err: unknown): ErrorParts {
  if (err == null) return { code: null, message: "" };
  if (typeof err === "string") return { code: null, message: err };
  if (typeof err === "object") {
    const o = err as { code?: unknown; message?: unknown };
    const code = typeof o.code === "string" && o.code !== "" ? o.code : null;
    const message = typeof o.message === "string" ? o.message : "";
    return { code, message };
  }
  return { code: null, message: String(err) };
}

// ข้อความ `raise exception` ของเราเอง (P0001) — ดูที่ supabase/migrations/*.sql
function fromOurRaiseMessage(message: string): UserMessage | null {
  if (/Gate 0|ยังไม่อนุมัติ/i.test(message)) return USER_MESSAGES.gate0;
  if (/invalid transition/i.test(message)) return USER_MESSAGES.invalidTransition;
  if (/episode ไม่ได้อยู่/i.test(message)) return USER_MESSAGES.episodeWrongChannel;
  if (/ต้องเข้าสู่ระบบ/i.test(message)) return USER_MESSAGES.needLogin;
  if (/ไม่มีสิทธิ์|เฉพาะ owner/i.test(message)) return USER_MESSAGES.forbidden;
  if (/^ไม่พบ|ไม่พบ episode/i.test(message)) return USER_MESSAGES.notFound;
  return null;
}

function fromCode(code: string, message: string): UserMessage | null {
  switch (code) {
    // ── Postgres SQLSTATE ──────────────────────────────────────────────
    case "23505": // unique_violation
      return USER_MESSAGES.duplicate;
    case "42501": // insufficient_privilege — ครอบ RLS ด้วย
      return USER_MESSAGES.forbidden;
    case "23503": // foreign_key_violation
      return USER_MESSAGES.foreignKey;
    case "23514": // check_violation
    case "22P02": // invalid_text_representation (เช่น uuid ผิดรูป)
      return USER_MESSAGES.invalidFormat;
    case "P0001": // raise_exception — ข้อความของเราเอง
      return fromOurRaiseMessage(message);

    // ── PostgREST ─────────────────────────────────────────────────────
    case "PGRST116": // ไม่มีแถว (หรือได้หลายแถวตอนขอแถวเดียว)
      return USER_MESSAGES.notFound;

    // ── Supabase Auth (AuthError.code) ────────────────────────────────
    case "user_already_exists":
      return USER_MESSAGES.emailTaken;
    case "weak_password":
      return USER_MESSAGES.weakPassword;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return USER_MESSAGES.rateLimit;

    default:
      return null;
  }
}

// ใช้เมื่อไม่มี code หรือ code ไม่อยู่ในรายการที่รู้จัก
function fromMessage(message: string): UserMessage | null {
  if (message === "") return null;
  // ตรวจค่าซ้ำก่อนเรื่องสิทธิ์ — ข้อความ unique violation ของ Postgres มีคำว่า
  // "violates" อยู่ด้วย ("duplicate key value violates unique constraint")
  if (/duplicate key|unique constraint|already exists/i.test(message))
    return USER_MESSAGES.duplicate;
  if (/row-level security/i.test(message)) return USER_MESSAGES.forbidden;
  if (/ไม่มีสิทธิ์|เฉพาะ owner|permission denied/i.test(message))
    return USER_MESSAGES.forbidden;
  if (/Gate 0|ยังไม่อนุมัติ/i.test(message)) return USER_MESSAGES.gate0;
  if (/invalid transition/i.test(message)) return USER_MESSAGES.invalidTransition;
  if (/episode ไม่ได้อยู่/i.test(message)) return USER_MESSAGES.episodeWrongChannel;
  if (/ต้องเข้าสู่ระบบ|not authenticated|JWT/i.test(message))
    return USER_MESSAGES.needLogin;
  if (/User already registered/i.test(message)) return USER_MESSAGES.emailTaken;
  if (/Password should be/i.test(message)) return USER_MESSAGES.weakPassword;
  if (/rate limit/i.test(message)) return USER_MESSAGES.rateLimit;
  if (/ไม่พบ|not found/i.test(message)) return USER_MESSAGES.notFound;
  return null;
}

// แปลง error → ข้อความที่แสดงให้ผู้ใช้ได้ (ปลอดภัยเสมอ)
export function toUserMessage(err: unknown): UserMessage {
  const { code, message } = extractErrorParts(err);
  if (code) {
    const byCode = fromCode(code, message);
    if (byCode) return byCode; // code ชนะข้อความเสมอ
  }
  return fromMessage(message) ?? USER_MESSAGES.generic;
}

// true เมื่อ error นี้ตกไปที่ข้อความกลาง — ใช้ตัดสินว่าต้อง log ฝั่ง server
export function isGenericUserMessage(msg: UserMessage): boolean {
  return msg === USER_MESSAGES.generic;
}

// ตัดค่าอ่อนไหวออกจากข้อความก่อนเขียน log (NFR-009)
// ครอบ JWT, คีย์รูปแบบใหม่ของ Supabase และคู่ key=value ที่ชื่อ key อ่อนไหว
export function redactSensitive(text: string): string {
  return String(text ?? "")
    .replace(/eyJ[A-Za-z0-9_-]{5,}(?:\.[A-Za-z0-9_-]+){1,2}/g, "[redacted-jwt]")
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(
      /\b(password|passwd|pwd|token|secret|apikey|api_key|authorization|jwt|credential)\b(\s*[:=]\s*)\S+/gi,
      "$1$2[redacted]",
    )
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]");
}
