"use client";

export function UpdatePasswordForm({ message }: { message?: string }) {
  return (
    <form
      action="/api/auth/update-password"
      method="POST"
      className="flex flex-col gap-4"
    >
      <div>
        <label className="sb-label" htmlFor="password">
          New Password
        </label>
        <input
          className="sb-input"
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
        />
      </div>
      <div>
        <label className="sb-label" htmlFor="confirmPassword">
          Confirm Password
        </label>
        <input
          className="sb-input"
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
        />
      </div>

      {message && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-700">
          {message}
        </div>
      )}

      <button type="submit" className="sb-button-primary w-full mt-2">
        Update Password
      </button>
    </form>
  );
}
