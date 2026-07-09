import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const isMobile = React.useSyncExternalStore(
    (notify) => {
      if (typeof window === "undefined") {
        return () => {}
      }
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      mql.addEventListener("change", notify)
      return () => mql.removeEventListener("change", notify)
    },
    () => {
      if (typeof window === "undefined") {
        return false
      }
      return window.innerWidth < MOBILE_BREAKPOINT
    },
    () => false
  )

  return isMobile
}
