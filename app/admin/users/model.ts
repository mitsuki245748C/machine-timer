export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

export type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  created_at: string;
};

export type AdminUsersResponse = {
  // 自分の行は役割を変更できないので、画面で見分けるために返す
  currentUserId: string;
  users: AdminUser[];
};
