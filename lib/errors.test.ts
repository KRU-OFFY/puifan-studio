import { describe, it, expect } from "vitest";
import {
  toUserMessage,
  extractErrorParts,
  redactSensitive,
  USER_MESSAGES,
} from "./errors";

const ALLOWED = new Set<string>(Object.values(USER_MESSAGES));

describe("toUserMessage — ตัดสินด้วย code ก่อน", () => {
  it("23505 unique_violation → ค่าซ้ำ (ไม่ใช่ไม่มีสิทธิ์ ทั้งที่ข้อความมีคำว่า violates)", () => {
    expect(
      toUserMessage({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "characters_channel_id_slug_key"',
      }),
    ).toBe(USER_MESSAGES.duplicate);
  });

  it("23503 foreign_key_violation → ข้อความ FK (ไม่ใช่ไม่มีสิทธิ์)", () => {
    expect(
      toUserMessage({
        code: "23503",
        message:
          'insert or update on table "episodes" violates foreign key constraint "episodes_channel_id_fkey"',
      }),
    ).toBe(USER_MESSAGES.foreignKey);
  });

  it("42501 insufficient_privilege → ไม่มีสิทธิ์", () => {
    expect(
      toUserMessage({
        code: "42501",
        message: 'new row violates row-level security policy for table "episodes"',
      }),
    ).toBe(USER_MESSAGES.forbidden);
  });

  it("23514 check_violation และ 22P02 uuid ผิดรูป → รูปแบบข้อมูลไม่ถูกต้อง", () => {
    expect(toUserMessage({ code: "23514", message: 'violates check constraint "x"' })).toBe(
      USER_MESSAGES.invalidFormat,
    );
    expect(
      toUserMessage({ code: "22P02", message: 'invalid input syntax for type uuid: "abc"' }),
    ).toBe(USER_MESSAGES.invalidFormat);
  });

  it("PGRST116 → ไม่พบข้อมูล", () => {
    expect(
      toUserMessage({ code: "PGRST116", message: "JSON object requested, multiple rows returned" }),
    ).toBe(USER_MESSAGES.notFound);
  });

  it("42P01 relation does not exist → ข้อความกลาง (ไม่บอกชื่อตาราง)", () => {
    const out = toUserMessage({
      code: "42P01",
      message: 'relation "episodes" does not exist',
    });
    expect(out).toBe(USER_MESSAGES.generic);
    expect(out).not.toMatch(/episodes/);
  });
});

describe("toUserMessage — P0001 (raise exception ของเราเอง)", () => {
  it("Gate 0 → ช่องยังไม่อนุมัติ", () => {
    expect(
      toUserMessage({
        code: "P0001",
        message: "channel ยังไม่อนุมัติ (Gate 0) — สร้าง episode ไม่ได้",
      }),
    ).toBe(USER_MESSAGES.gate0);
  });

  it("invalid transition → เปลี่ยนสถานะไม่ได้ และไม่รั่วค่าสถานะที่แทรกมา", () => {
    const out = toUserMessage({
      code: "P0001",
      message: "invalid transition: draft → published",
    });
    expect(out).toBe(USER_MESSAGES.invalidTransition);
    expect(out).not.toMatch(/published/);
  });

  it("episode ไม่ได้อยู่ในช่องนี้ → ข้อความเฉพาะ", () => {
    expect(
      toUserMessage({ code: "P0001", message: "episode ไม่ได้อยู่ในช่องนี้" }),
    ).toBe(USER_MESSAGES.episodeWrongChannel);
  });

  it("ไม่มีสิทธิ์ / เฉพาะ owner → ไม่มีสิทธิ์", () => {
    expect(
      toUserMessage({ code: "P0001", message: "ไม่มีสิทธิ์เปลี่ยนสถานะ episode (ต้องเป็น owner/editor)" }),
    ).toBe(USER_MESSAGES.forbidden);
    expect(
      toUserMessage({ code: "P0001", message: "เฉพาะ owner อนุมัติ channel ได้" }),
    ).toBe(USER_MESSAGES.forbidden);
  });

  it("ต้องเข้าสู่ระบบ → กรุณาเข้าสู่ระบบ", () => {
    expect(
      toUserMessage({ code: "P0001", message: "ต้องเข้าสู่ระบบก่อนสร้าง workspace" }),
    ).toBe(USER_MESSAGES.needLogin);
  });

  it("P0001 ที่ไม่ตรงข้อความของเราเลย → ข้อความกลาง", () => {
    expect(toUserMessage({ code: "P0001", message: "something odd happened" })).toBe(
      USER_MESSAGES.generic,
    );
  });
});

describe("toUserMessage — Supabase Auth code", () => {
  it("user_already_exists → อีเมลถูกใช้แล้ว", () => {
    expect(toUserMessage({ code: "user_already_exists", message: "User already registered" })).toBe(
      USER_MESSAGES.emailTaken,
    );
  });

  it("weak_password → รหัสผ่านไม่ผ่านเกณฑ์", () => {
    expect(
      toUserMessage({ code: "weak_password", message: "Password should be at least 6 characters" }),
    ).toBe(USER_MESSAGES.weakPassword);
  });

  it("over_request_rate_limit / over_email_send_rate_limit → ทำรายการถี่เกินไป", () => {
    expect(toUserMessage({ code: "over_request_rate_limit", message: "" })).toBe(
      USER_MESSAGES.rateLimit,
    );
    expect(toUserMessage({ code: "over_email_send_rate_limit", message: "" })).toBe(
      USER_MESSAGES.rateLimit,
    );
  });
});

describe("toUserMessage — ไม่มี code ให้ดูข้อความ", () => {
  it("ข้อความ unique violation → ค่าซ้ำ", () => {
    expect(
      toUserMessage({ message: 'duplicate key value violates unique constraint "x"' }),
    ).toBe(USER_MESSAGES.duplicate);
  });

  it("row-level security → ไม่มีสิทธิ์", () => {
    expect(
      toUserMessage({ message: 'new row violates row-level security policy for table "assets"' }),
    ).toBe(USER_MESSAGES.forbidden);
  });

  it("does not exist เพียว ๆ (ไม่มี code) → ข้อความกลาง", () => {
    expect(toUserMessage({ message: 'relation "characters" does not exist' })).toBe(
      USER_MESSAGES.generic,
    );
  });

  it("User already registered → อีเมลถูกใช้แล้ว", () => {
    expect(toUserMessage({ message: "User already registered" })).toBe(USER_MESSAGES.emailTaken);
  });

  it("rate limit → ทำรายการถี่เกินไป", () => {
    expect(toUserMessage({ message: "email rate limit exceeded" })).toBe(USER_MESSAGES.rateLimit);
  });
});

describe("toUserMessage — code ขัดกับข้อความ ต้องยึด code", () => {
  it("code 23505 + ข้อความ row-level security → ยึด code (ค่าซ้ำ)", () => {
    expect(
      toUserMessage({ code: "23505", message: "violates row-level security policy" }),
    ).toBe(USER_MESSAGES.duplicate);
  });

  it("code 42501 + ข้อความ duplicate key → ยึด code (ไม่มีสิทธิ์)", () => {
    expect(
      toUserMessage({ code: "42501", message: "duplicate key value violates unique constraint" }),
    ).toBe(USER_MESSAGES.forbidden);
  });

  it("code อย่างเดียว (ไม่มีข้อความ) ก็ตัดสินได้", () => {
    expect(toUserMessage({ code: "23503" })).toBe(USER_MESSAGES.foreignKey);
  });
});

describe("toUserMessage — กรณีไม่รู้จัก", () => {
  it("ข้อความสุ่ม / Error / string / null / undefined / ตัวเลข → ข้อความกลาง", () => {
    expect(toUserMessage({ message: "kaboom 42" })).toBe(USER_MESSAGES.generic);
    expect(toUserMessage(new Error("unexpected token"))).toBe(USER_MESSAGES.generic);
    expect(toUserMessage("fetch failed")).toBe(USER_MESSAGES.generic);
    expect(toUserMessage(null)).toBe(USER_MESSAGES.generic);
    expect(toUserMessage(undefined)).toBe(USER_MESSAGES.generic);
    expect(toUserMessage(500)).toBe(USER_MESSAGES.generic);
    expect(toUserMessage({})).toBe(USER_MESSAGES.generic);
  });
});

describe("ไม่มีข้อมูลอ่อนไหวหลุดออกไปฝั่งผู้ใช้", () => {
  const leaky = [
    'new row violates row-level security policy for table "audit_logs"',
    'duplicate key value violates unique constraint "characters_channel_id_slug_key"',
    'relation "episodes" does not exist',
    "JWSError JWSInvalidSignature: eyJFAKEheaderNOTREAL.eyJFAKEpayload.FAKEsig",
    "connect ENOTFOUND sxevdedipklivvgxosap.supabase.co",
    "password authentication failed for user postgres",
    "invalid input syntax for type uuid: 11111111-1111-1111-1111-111111111111",
  ];

  it("ผลลัพธ์ต้องอยู่ในชุดข้อความที่ประกาศไว้เท่านั้น", () => {
    for (const message of leaky) {
      expect(ALLOWED.has(toUserMessage({ message }))).toBe(true);
    }
  });

  it("ไม่มีชื่อตาราง / constraint / policy / JWT / โฮสต์ / รหัสผ่าน / uuid ติดออกไป", () => {
    const forbidden =
      /audit_logs|characters_channel_id_slug_key|episodes|eyJ|supabase\.co|postgres|11111111|row-level security|constraint/i;
    for (const message of leaky) {
      expect(toUserMessage({ message })).not.toMatch(forbidden);
    }
  });

  it("ทุกข้อความใน USER_MESSAGES เป็นภาษาไทยล้วน ไม่มีศัพท์ภายในของ DB", () => {
    for (const msg of Object.values(USER_MESSAGES)) {
      expect(msg).not.toMatch(/constraint|relation|policy|table |column |postgres/i);
      expect(msg.trim()).not.toBe("");
    }
  });
});

describe("extractErrorParts", () => {
  it("อ่าน code/message จาก object และเว้นค่าที่ไม่ใช่ string", () => {
    expect(extractErrorParts({ code: "23505", message: "dup" })).toEqual({
      code: "23505",
      message: "dup",
    });
    expect(extractErrorParts({ code: 500, message: null })).toEqual({
      code: null,
      message: "",
    });
    expect(extractErrorParts({ code: "", message: "x" })).toEqual({ code: null, message: "x" });
  });

  it("รับ string / null / undefined ได้", () => {
    expect(extractErrorParts("boom")).toEqual({ code: null, message: "boom" });
    expect(extractErrorParts(null)).toEqual({ code: null, message: "" });
    expect(extractErrorParts(undefined)).toEqual({ code: null, message: "" });
  });
});

describe("redactSensitive (ใช้ก่อนเขียน log ฝั่ง server)", () => {
  it("ตัด JWT ออก", () => {
    const out = redactSensitive("bad token eyJFAKEheaderNOTREAL.eyJFAKEpayload.FAKEsig here");
    expect(out).not.toMatch(/eyJ/);
    expect(out).toMatch(/\[redacted-jwt\]/);
  });

  it("ตัดคีย์รูปแบบใหม่ของ Supabase ออก", () => {
    const out = redactSensitive("using sb_secret_FAKEnotReal123 failed");
    expect(out).not.toMatch(/sb_secret_FAKEnotReal123/);
    expect(out).toMatch(/\[redacted-key\]/);
  });

  it("ตัดค่าที่ตามหลัง key อ่อนไหว และ Bearer token", () => {
    expect(redactSensitive("password=hunter2")).toBe("password=[redacted]");
    expect(redactSensitive("apikey: abc123")).toBe("apikey: [redacted]");
    expect(redactSensitive("Authorization: Bearer abc.def")).toMatch(/\[redacted\]/);
    expect(redactSensitive("Bearer abc.def")).toBe("Bearer [redacted]");
  });

  it("ข้อความธรรมดาไม่ถูกแก้ และรับค่าว่างได้", () => {
    expect(redactSensitive("connection reset")).toBe("connection reset");
    expect(redactSensitive("")).toBe("");
  });
});
