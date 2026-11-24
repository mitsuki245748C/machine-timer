"use client";

import { CheckIcon, ChevronDownIcon, PaletteIcon } from "lucide-react";
import { useState } from "react";
import { THEMES } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";

// ヘッダーのメニューに置く配色の切り替え。「カラー」を押すと配色の一覧がプルダウンで開く。配色が増えても THEMES に足すだけで済む
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="theme-switcher">
      <button
        type="button"
        className="theme-switcher-toggle"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <PaletteIcon aria-hidden size={18} />
        カラー
        <ChevronDownIcon aria-hidden size={16} className="theme-switcher-chevron" data-open={open} />
      </button>
      {open && (
        <ul className="theme-switcher-list" role="listbox" aria-label="配色">
          {THEMES.map(({ id, label }) => (
            <li key={id} role="option" aria-selected={id === theme}>
              <button
                type="button"
                onClick={() => {
                  setTheme(id);
                  setOpen(false);
                }}
              >
                {label}
                {id === theme && <CheckIcon aria-hidden size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
