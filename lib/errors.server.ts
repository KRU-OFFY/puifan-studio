import "server-only";

import {
  extractErrorParts,
  isGenericUserMessage,
  redactSensitive,
  toUserMessage,
  type UserMessage,
} from "@/lib/errors";

// ไฟล์นี้ import "server-only" → ถ้ามีใครเผลอ import จาก client component
// build จะพังทันที (กันรายละเอียด error หลุดไปฝั่ง browser)

// เขียน error จริงลง log ฝั่ง server เท่านั้น — sanitize ก่อนเสมอ + ติด code ไปด้วยถ้ามี
export function logServerError(scope: string, err: unknown): void {
  const { code, message } = extractErrorParts(err);
  console.error(`[${scope}]`, {
    code: code ?? "-",
    message: redactSensitive(message),
  });
}

// ใช้แทน `error.message` ทุกจุดที่ส่ง error ออกไปฝั่ง client:
// คืนข้อความที่ปลอดภัย และ log ตัวจริงฝั่ง server เมื่อ map ไม่ได้ (ตกเป็นข้อความกลาง)
export function reportError(scope: string, err: unknown): UserMessage {
  const msg = toUserMessage(err);
  if (isGenericUserMessage(msg)) logServerError(scope, err);
  return msg;
}
