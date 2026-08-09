export function formatTimeAgo(date: Date | string | null | undefined): string {
  if (!date) return "recently";
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "recently";
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();

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

export function getTimeLeft(deadline: Date | null | undefined): {
  label: string;
  className: string;
} | null {
  if (!deadline) return null;

  const now = new Date();
  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      label: "Closed",
      className: "bg-red-200 text-red-800",
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
      className: "bg-blue-200 text-blue-800",
    };
  }

  if (days > 0) {
    return {
      label: `${days}d ${hours}h left`,
      className: "bg-orange-200 text-orange-800",
    };
  }

  const minutes = Math.floor((diff / 1000 / 60) % 60);
  if (hours > 0) {
    return {
      label: `${hours}h ${minutes}m left`,
      className: "bg-red-200 text-red-800",
    };
  }

  if (minutes > 0) {
    return {
      label: `${minutes} minutes left`,
      className: "bg-red-200 text-red-800 font-bold",
    };
  }

  return {
    label: "Closing now",
    className: "bg-red-200 text-red-800 font-bold",
  };
}

