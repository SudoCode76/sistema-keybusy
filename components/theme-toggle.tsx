"use client"

import { useSyncExternalStore } from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!mounted) return null

  const isDark = resolvedTheme === "dark"
  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"

  return (
    <Button
      aria-label={label}
      className="fixed bottom-4 right-4 z-40 rounded-full border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      size="icon-lg"
      title={label}
      variant="outline"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
