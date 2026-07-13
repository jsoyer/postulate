"use client"

import { useEffect, useCallback } from "react"

const SWIPE_THRESHOLD_X = 60
const SWIPE_THRESHOLD_Y = 40

interface UseSwipeNavigationOptions {
  onSwipeLeft: () => void
  onSwipeRight: () => void
}

/**
 * Listens for horizontal swipe gestures on the document.
 * Fires onSwipeLeft when deltaX > 60px and |deltaY| < 40px (left-to-right finger movement).
 * Fires onSwipeRight when deltaX < -60px and |deltaY| < 40px (right-to-left finger movement).
 *
 * Note: "swipe left" means the finger moved left, so the user intends to go forward (next).
 * "swipe right" means the finger moved right, so the user intends to go back (previous).
 */
export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
}: UseSwipeNavigationOptions): void {
  const handleTouchStart = useCallback((e: TouchEvent): void => {
    const touch = e.changedTouches[0]
    if (!touch) return
    const startX = touch.clientX
    const startY = touch.clientY

    const handleTouchEnd = (endEvent: TouchEvent): void => {
      const endTouch = endEvent.changedTouches[0]
      if (!endTouch) return

      const deltaX = endTouch.clientX - startX
      const deltaY = endTouch.clientY - startY

      if (Math.abs(deltaY) >= SWIPE_THRESHOLD_Y) return

      if (deltaX < -SWIPE_THRESHOLD_X) {
        onSwipeLeft()
      } else if (deltaX > SWIPE_THRESHOLD_X) {
        onSwipeRight()
      }

      document.removeEventListener("touchend", handleTouchEnd)
    }

    document.addEventListener("touchend", handleTouchEnd, { passive: true })
  }, [onSwipeLeft, onSwipeRight])

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true })
    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
    }
  }, [handleTouchStart])
}
