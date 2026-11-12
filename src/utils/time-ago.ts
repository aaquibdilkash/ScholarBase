export function formatTimeAgo(date: Date | string | number | null | undefined): string {
  if (!date && date !== 0) return "recently";
  let dateObj: Date;
  if (typeof date === 'number') {
    dateObj = new Date(date);
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  if (isNaN(dateObj.getTime())) return "recently";
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}

/**
 * Tone of the deadline badge, mapped to `CardChip` on the list cards. The
 * utility stays UI-agnostic (no class strings) so dark-mode styling lives in
 * one place.
 */
export type TimeLeftTone = "info" | "warning" | "danger";

export function getTimeLeft(deadline: Date | string | number | null | undefined): {
  label: string;
  tone: TimeLeftTone;
} | null {
  if (!deadline && deadline !== 0) return null;

  let deadlineDate: Date;
  if (typeof deadline === 'number') {
    deadlineDate = new Date(deadline);
  } else if (typeof deadline === 'string') {
    deadlineDate = new Date(deadline);
  } else {
    deadlineDate = deadline;
  }

  const now = new Date();
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      label: "Closed",
      tone: "danger",
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);

  if (days > 30) {
    return null; // More than a month left, no badge
  }

  if (days > 7) {
    return {
      label: `${days} days left`,
      tone: "info",
    };
  }

  if (days > 0) {
    return {
      label: `${days}d ${hours}h left`,
      tone: "warning",
    };
  }

  const minutes = Math.floor((diff / 1000 / 60) % 60);
  if (hours > 0) {
    return {
      label: `${hours}h ${minutes}m left`,
      tone: "danger",
    };
  }

  if (minutes > 0) {
    return {
      label: `${minutes} minutes left`,
      tone: "danger",
    };
  }

  return {
    label: "Closing now",
    tone: "danger",
  };
}

