"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";

interface AuthModalContextValue {
  openAuthModal: (callbackUrl?: string) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx)
    throw new Error("useAuthModal must be used within <AuthModalProvider>");
  return ctx;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("/");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { user } = useUser();

  const openAuthModal = useCallback(
    (url?: string) => {
      if (user) {
        return;
      }

      setCallbackUrl(url || window.location.pathname + window.location.search);
      setIsOpen(true);
    },
    [user],
  );

  useEffect(() => {
    // If the user becomes logged in while the modal is open, close it.
    if (user && isOpen) {
      setIsOpen(false);
    }
  }, [user, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    // Preserve the callback URL in sessionStorage so it survives redirect
    if (callbackUrl && callbackUrl !== "/") {
      try {
        sessionStorage.setItem("auth_redirect_url", callbackUrl);
      } catch {}
    }
  }, [callbackUrl]);

  const handleClose = () => {
    console.log("Closing auth modal");
    setIsOpen(false);
  };

  const handleLogin = () => {
    router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    setIsOpen(false);
  };

  return (
    <AuthModalContext.Provider value={{ openAuthModal }}>
      {children}
      <dialog
        ref={dialogRef}
        className="fixed inset-0 z-[100] m-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClose={handleClose}
        onClick={(e) => {
          if (e.target === dialogRef.current) handleClose();
        }}
      >
        <div className="flex h-fit w-full max-w-md flex-col p-8">
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <svg
                className="h-7 w-7 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-950">
              Sign In Required
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              You need to sign in to perform this action.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleLogin}
              className="sb-button-primary w-full justify-center py-3"
            >
              Sign In
            </button>
            <button
              onClick={handleClose}
              className="sb-button-soft w-full justify-center py-3"
            >
              Cancel
            </button>
          </div>
        </div>
      </dialog>
    </AuthModalContext.Provider>
  );
}
