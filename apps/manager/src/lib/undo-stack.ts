"use client"

import { useSyncExternalStore, useCallback } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UndoOperation {
  /** Short human-readable label shown in the undo toast. */
  description: string
  /** Called when the user triggers undo. May be async. */
  undo: () => void | Promise<void>
}

// ---------------------------------------------------------------------------
// UndoStack class — module-level singleton
// ---------------------------------------------------------------------------

const MAX_STACK_SIZE = 10

class UndoStack {
  private stack: UndoOperation[] = []
  private listeners: Set<() => void> = new Set()

  /** Add a new operation to the top of the stack (LIFO). */
  push(op: UndoOperation): void {
    this.stack = [op, ...this.stack].slice(0, MAX_STACK_SIZE)
    this.notify()
  }

  /** Remove and return the top operation. */
  pop(): UndoOperation | undefined {
    const [head, ...rest] = this.stack
    if (head === undefined) return undefined
    this.stack = rest
    this.notify()
    return head
  }

  /** Inspect the top operation without removing it. */
  peek(): UndoOperation | undefined {
    return this.stack[0]
  }

  /** Remove all operations from the stack. */
  clear(): void {
    this.stack = []
    this.notify()
  }

  /** Returns the current stack length — used as snapshot for useSyncExternalStore. */
  getSize(): number {
    return this.stack.length
  }

  /** Subscribe to stack mutations. Returns an unsubscribe function. */
  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notify(): void {
    for (const cb of this.listeners) cb()
  }
}

export const undoStack = new UndoStack()

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/** Stable server snapshot — the stack is always empty on the server. */
function getServerSnapshot(): number {
  return 0
}

/**
 * useUndoStack — subscribe to the module-level undo stack.
 *
 * Returns:
 *   canUndo  — true when at least one operation is queued
 *   peek     — the top operation (or undefined)
 *   push     — stable callback to add an operation
 *   undo     — stable callback to execute and remove the top operation
 */
export function useUndoStack(): {
  canUndo: boolean
  peek: UndoOperation | undefined
  push: (op: UndoOperation) => void
  undo: () => Promise<void>
} {
  // Re-render whenever the stack size changes
  const size = useSyncExternalStore(
    (cb) => undoStack.subscribe(cb),
    () => undoStack.getSize(),
    getServerSnapshot
  )

  const push = useCallback((op: UndoOperation) => {
    undoStack.push(op)
  }, [])

  const undo = useCallback(async () => {
    const op = undoStack.pop()
    if (op) await op.undo()
  }, [])

  return {
    canUndo: size > 0,
    peek: undoStack.peek(),
    push,
    undo,
  }
}
