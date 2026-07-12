import { LikeButton } from "@/components/interactions/LikeButton";
import Link from "next/link";

type FooterItem = {
  id: string;
  type: "vacancy" | "admission" | "event";
  _count: { likes: number; comments: number };
  isLiked: boolean;
};

export function TrendingItemFooter({ item }: { item: FooterItem }) {
  const { type, id } = item;
  const detailUrl = `/${type === "vacancy" ? "vacancies" : type === "admission" ? "admissions" : "events"}/${id}`;

  return (
    <div className="flex items-center gap-6">
      <LikeButton
        targetId={item.id}
        type={item.type}
        initialLikes={item._count.likes}
        initialIsLiked={item.isLiked}
      />
      <Link
        href={detailUrl}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-700"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        {item._count.comments} Comments
      </Link>
    </div>
  );
}
