"use client";

import { createContext, useCallback, useContext, useState } from "react";

import { THEME_COOKIE, type ThemeId } from "@/lib/themes";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
};

const ONE_YEAR = 60 * 60 * 24 * 365;

const ThemeContext = createContext<ThemeContextValue | null>(null);

// サーバーが Cookie から決めた配色を受け取り、切り替えを受け付ける。
// 切り替えると Cookie に保存し、画面の配色もその場で変える（再読み込みは不要）
export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemeId;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState(initialTheme);

  const setTheme = useCallback((next: ThemeId) => {
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    document.documentElement.dataset.theme = next;
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme は ThemeProvider の中で使ってください。");
  return context;
}
