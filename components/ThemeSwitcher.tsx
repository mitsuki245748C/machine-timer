"use client";

import { THEMES, parseTheme } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";

// ヘッダーに置く配色の切り替え。配色が増えても選択肢が増えるだけで済むよう、セレクトにしている
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <select
      className="theme-select"
      aria-label="配色"
      value={theme}
      onChange={(event) => setTheme(parseTheme(event.target.value))}
    >
      {THEMES.map(({ id, label }) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  );
}
