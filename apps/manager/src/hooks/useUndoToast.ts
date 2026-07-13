"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { undoStack } from "@/lib/undo-stack"

/**
 * useUndoToast — subscribe to the undo stack and surface each newly pushed
 * operation as a sonner toast with an "Undo" action button.
 *
 * Mount this once near the root of the application (e.g. inside the main
 * layout alongside <Toaster />).  It renders nothing.
 */
export function useUndoToast(): void {
  // Track the stack size from the previous render so we can detect new pushes
  const prevSizeRef = useRef<number>(undoStack.getSize())

  useEffect(() => {
    const unsubscribe = undoStack.subscribe(() => {
      const currentSize = undoStack.getSize()
      const prevSize = prevSizeRef.current

      // A new operation was pushed (stack grew)
      if (currentSize > prevSize) {
        const op = undoStack.peek()
        if (op) {
          toast(op.description, {
            duration: 8_000,
            action: {
              label: "Undo",
              onClick: () => {
                const popped = undoStack.pop()
                if (popped) {
                  Promise.resolve(popped.undo()).catch(() => {
                    toast.error("Undo failed")
                  })
                }
              },
            },
          })
        }
      }

      prevSizeRef.current = currentSize
    })

    return unsubscribe
  }, [])
}
