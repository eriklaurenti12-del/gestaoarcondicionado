import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const getIsMobile = () => {
    if (typeof window === 'undefined') return false
    // Check both window.innerWidth and document.documentElement.clientWidth
    const width = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth)
    return width < MOBILE_BREAKPOINT
  }

  const [isMobile, setIsMobile] = React.useState<boolean>(getIsMobile)

  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = getIsMobile()
      console.log("useIsMobile check:", { width: window.innerWidth, clientWidth: document.documentElement.clientWidth, mobile })
      setIsMobile(mobile)
    }
    
    // Check on mount
    checkMobile()
    
    // Listen for resize with debounce
    let timeoutId: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(checkMobile, 100)
    }
    
    window.addEventListener("resize", handleResize)
    // Also listen for orientation change on mobile devices
    window.addEventListener("orientationchange", checkMobile)
    
    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("orientationchange", checkMobile)
      clearTimeout(timeoutId)
    }
  }, [])

  return isMobile
}
