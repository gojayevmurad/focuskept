"use client";
import { Moon, Sun } from "lucide-react";
import { useState } from "react";
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  return (
    <button
      className="icon-button"
      aria-label="Toggle color theme"
      onClick={() => {
        const next = document.documentElement.dataset.theme !== "dark";
        setDark(next);
        document.documentElement.dataset.theme = next ? "dark" : "light";
        localStorage.setItem("theme", next ? "dark" : "light");
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
