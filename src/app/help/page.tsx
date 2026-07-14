import { getHelpPosts } from "@/app/actions/help";
import { HelpPostList } from "./components/HelpPostList";
import { requireCurrentUser } from "@/lib/auth";
import Link from "next/link";

export default async function HelpPage() {
  const user = await requireCurrentUser();
  const posts = await getHelpPosts();

  const postsWithLikes = posts.map((post) => ({
    ...post,
    isLiked: post.likes.some((like) => like.userId === user.id),
    _count: {
      likes: post.likes.length,
      comments: post.comments.length,
    },
  }));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Help & Support</h1>
        <Link href="/help/add" className="sb-button-primary">
          New Post
        </Link>
      </div>
      <HelpPostList posts={postsWithLikes} />
    </div>
  );
}
