"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Pointer-events drag implementation for the survey builder.
 *
 * Deliberately NOT the HTML5 Drag-and-Drop API: browsers never start an HTML5
 * drag session from a touch pointer (touch is reserved for scroll/zoom), so
 * `draggable` + dragstart/drop simply does not work on phones. Pointer Events
 * unify mouse, touch and pen through one code path, which is why a single
 * implementation here works on desktop and mobile alike.
 *
 * The handle that starts a drag must carry `touch-none` (touch-action: none) so
 * the browser does not scroll the page mid-drag. Everything else stays
 * scrollable.
 */

/** Where a dragged question should land. `index` is within that section's run. */
export interface QuestionDropTarget {
  blockId: string | null;
  index: number;
}

/** Movement (px) before a press becomes a drag, so taps/clicks still work. */
const DRAG_THRESHOLD_PX = 8;
const AUTOSCROLL_EDGE_PX = 90;
const AUTOSCROLL_STEP_PX = 14;

function readBucket(el: HTMLElement): string | null {
  const raw = el.dataset.dropBucket;
  return !raw || raw === "general" ? null : raw;
}

/**
 * Resolve the drop target under the pointer by hit-testing the rendered drop
 * markers. Each question wrapper carries `data-drop-index` and lives inside a
 * container carrying `data-drop-bucket`.
 */
function resolveDropTarget(
  clientX: number,
  clientY: number,
): QuestionDropTarget | null {
  if (typeof document === "undefined") return null;
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return null;

  const questionEl = hit.closest<HTMLElement>("[data-drop-index]");
  if (questionEl) {
    const bucketEl = questionEl.closest<HTMLElement>("[data-drop-bucket]");
    if (!bucketEl) return null;
    const index = Number(questionEl.dataset.dropIndex ?? "0");
    const rect = questionEl.getBoundingClientRect();
    // Dropping in the lower half of a question inserts after it.
    const after = clientY > rect.top + rect.height / 2;
    return { blockId: readBucket(bucketEl), index: after ? index + 1 : index };
  }

  // Empty section (or the gap below its last question): append to the end.
  const bucketEl = hit.closest<HTMLElement>("[data-drop-bucket]");
  if (bucketEl) {
    return {
      blockId: readBucket(bucketEl),
      index: bucketEl.querySelectorAll("[data-drop-index]").length,
    };
  }

  return null;
}

export function useQuestionDrag(
  onDrop: (questionId: string, target: QuestionDropTarget) => void,
) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [target, setTarget] = useState<QuestionDropTarget | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const onDropRef = useRef(onDrop);
  const targetRef = useRef<QuestionDropTarget | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Keep the latest callback without mutating a ref during render. The drop
  // handler reads the ref later (on pointerup), so this is always up to date.
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => () => cleanupRef.current?.(), []);

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, questionId: string) => {
      // Mouse: left button only. Touch/pen always start a drag.
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      let active = false;

      const previousUserSelect = document.body.style.userSelect;

      const handleMove = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;

        if (!active) {
          const travelled =
            Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
          if (travelled < DRAG_THRESHOLD_PX) return;
          active = true;
          setDraggingId(questionId);
          document.body.style.userSelect = "none";
        }

        e.preventDefault();
        setPointer({ x: e.clientX, y: e.clientY });

        const next = resolveDropTarget(e.clientX, e.clientY);
        targetRef.current = next;
        setTarget(next);

        if (e.clientY < AUTOSCROLL_EDGE_PX) {
          window.scrollBy(0, -AUTOSCROLL_STEP_PX);
        } else if (e.clientY > window.innerHeight - AUTOSCROLL_EDGE_PX) {
          window.scrollBy(0, AUTOSCROLL_STEP_PX);
        }
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", onKeyDown);
        document.body.style.userSelect = previousUserSelect;
        cleanupRef.current = null;
      };

      const finish = (commit: boolean) => {
        const dropTarget = targetRef.current;
        cleanup();
        if (commit && active && dropTarget) {
          onDropRef.current(questionId, dropTarget);
        }
        targetRef.current = null;
        setDraggingId(null);
        setTarget(null);
        setPointer(null);
      };

      function handleUp(e: PointerEvent) {
        if (e.pointerId !== pointerId) return;
        finish(true);
      }

      function cancel() {
        finish(false);
      }

      function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") finish(false);
      }

      window.addEventListener("pointermove", handleMove, { passive: false });
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("keydown", onKeyDown);
      cleanupRef.current = cleanup;
    },
    [],
  );

  return { beginDrag, draggingId, target, pointer };
}
