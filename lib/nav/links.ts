// แหล่งความจริงเดียวของเมนูลัดบน Dashboard
//
// กติกา: ใส่ได้เฉพาะ route ที่ "เข้าตรงได้จริง" — ไม่ต้องมี [param]
// route ของตอน / ตัวละคร / asset อยู่ใต้ `channels/[id]/` ทั้งหมด จึงลิงก์ตรงจาก
// Dashboard ไม่ได้ ต้องเข้าทาง workspace → channel ก่อน (ดู NAV_PATH_HINT)
//
// `links.test.ts` จะ fail ถ้ามี href ที่ไม่มีไฟล์ page.tsx จริง หรือ href ที่ต้องใช้
// segment แบบ [param] — กันเมนูลิงก์ตายเวลา route ถูกย้าย/เปลี่ยนชื่อ

export type NavLink = {
  href: string;
  label: string;
  description: string;
};

export const DASHBOARD_NAV_LINKS: NavLink[] = [
  {
    href: "/workspaces",
    label: "Workspaces",
    description:
      "ทางเข้าหลัก — สร้างหรือเปิด workspace แล้วไปต่อที่ช่องข้างใน",
  },
];

// เส้นทางใช้งานจริงของระบบ — ข้อความคงที่ ไม่ query อะไร
// มีไว้เพราะเมนูลัดชี้ได้แค่ /workspaces ผู้ใช้จึงต้องรู้ว่าไปต่อทางไหน
export const NAV_PATH_HINT =
  "เส้นทางใช้งาน: Workspace → ช่อง (channel) → ตอน / ตัวละคร / asset";
