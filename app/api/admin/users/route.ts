import { adminContext, adminError } from "@/lib/supabase/admin";
import { ROLES, type AdminUser, type AdminUsersResponse, type Role } from "../../../admin/users/model";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ユーザー一覧
export async function GET() {
  const context = await adminContext();
  if (context.response) return context.response;
  const { supabase, userId } = context;

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, created_at")
    .order("created_at", { ascending: true })
    .overrideTypes<AdminUser[]>();
  if (error) {
    console.error("[/api/admin/users] ユーザー一覧の取得に失敗しました:", error);
    return adminError("ユーザー一覧を取得できませんでした。", 500);
  }

  const body: AdminUsersResponse = { currentUserId: userId, users: data ?? [] };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}

// 役割の変更（{ userId, role }）
export async function PATCH(request: Request) {
  const context = await adminContext();
  if (context.response) return context.response;
  const { supabase, userId } = context;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return adminError("リクエストが不正です。", 400);
  }
  const { userId: targetId, role } = body as Record<string, unknown>;
  if (
    typeof targetId !== "string" ||
    !UUID_PATTERN.test(targetId) ||
    !ROLES.includes(role as Role)
  ) {
    return adminError("ユーザーまたは役割が不正です。", 400);
  }
  // 自分を一般に戻すと管理者がいなくなる可能性があるので、自分の役割は変えられない
  if (targetId === userId) {
    return adminError("自分の役割は変更できません。", 400);
  }

  const { data, error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", targetId)
    .select("id");
  if (error) {
    console.error("[/api/admin/users] 役割の変更に失敗しました:", error);
    return adminError("役割を変更できませんでした。", 500);
  }
  if (data.length === 0) return adminError("ユーザーが見つかりません。", 404);
  return Response.json({ ok: true });
}
