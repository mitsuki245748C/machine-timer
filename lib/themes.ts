// 選べる配色の一覧。色そのものは app/themes.css の [data-theme="<id>"] に書く。
// 配色を増やすときは、themes.css にブロックを足して、ここに1行足す。
export const THEMES = [
  { id: "dark-red", label: "ダークレッド" },
  { id: "light-blue", label: "ライトブルー" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "dark-red";

// 選んだ配色を覚えておく Cookie の名前
export const THEME_COOKIE = "theme";

// Cookie の値が一覧にない（未設定・書き換えられた）ときは初期配色にする
export function parseTheme(value: string | undefined): ThemeId {
  return THEMES.find((theme) => theme.id === value)?.id ?? DEFAULT_THEME;
}
