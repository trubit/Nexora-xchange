import { create } from "zustand";

const KEY = "bnx_theme";

const apply = (theme) => {
  const root = document.documentElement;
  root.classList.toggle("dark",  theme === "dark");
  root.classList.toggle("light", theme === "light");
  localStorage.setItem(KEY, theme);
};

const initial = () => {
  const stored = localStorage.getItem(KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
};

export const useThemeStore = create((set) => ({
  theme: initial(),

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      apply(next);
      return { theme: next };
    }),

  setTheme: (theme) => {
    apply(theme);
    set({ theme });
  },
}));

// Apply theme immediately when this module is imported (before first render)
apply(initial());
