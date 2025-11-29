import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ThemeToggle({ className = "", size = "md" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  const sizeStyles = {
    sm: { width: 44, height: 24, iconSize: 12, translate: 20 },
    md: { width: 52, height: 28, iconSize: 14, translate: 24 },
    lg: { width: 60, height: 32, iconSize: 16, translate: 28 },
  };

  const s = sizeStyles[size];

  return (
    <button
      onClick={toggleTheme}
      className={className}
      data-testid="button-theme-toggle"
      style={{
        position: "relative",
        width: s.width,
        height: s.height,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: theme === "dark" 
          ? "linear-gradient(135deg, #1a1a2e, #16213e)" 
          : "linear-gradient(135deg, #ffecd2, #fcb69f)",
        boxShadow: theme === "dark"
          ? "inset 0 2px 4px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)"
          : "inset 0 2px 4px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.1)",
        transition: "all 0.3s ease",
        padding: 0,
        display: "flex",
        alignItems: "center",
      }}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <div
        style={{
          position: "absolute",
          left: 4,
          width: s.height - 8,
          height: s.height - 8,
          borderRadius: "50%",
          background: theme === "dark" ? "#e6eef3" : "#fff",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          transform: `translateX(${theme === "dark" ? s.translate : 0}px)`,
          transition: "transform 0.3s ease, background 0.3s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {theme === "dark" ? (
          <Moon size={s.iconSize} color="#1a1a2e" />
        ) : (
          <Sun size={s.iconSize} color="#f59e0b" />
        )}
      </div>
    </button>
  );
}
