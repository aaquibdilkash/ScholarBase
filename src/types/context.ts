/**
 * Shared context types used across provider components.
 */

export type ToastType = "success" | "error";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

export interface AuthModalContextValue {
  openAuthModal: (callbackUrl?: string) => void;
}

export interface FollowContextValue {
  /** Returns the follow state for a given author. Falls back to `initial` if not set. */
  getFollowState: (authorId: string, initial: boolean) => boolean;
  /** Updates the follow state for a given author and propagates to all consumers. */
  setFollowState: (authorId: string, following: boolean) => void;
}

export type FollowMap = Map<string, boolean>;
