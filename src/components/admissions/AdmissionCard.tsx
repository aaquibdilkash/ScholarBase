"use client";

import { PhdAdmission, User } from "@prisma/client";
import OwnerActionsDropdown from "@/components/cards/OwnerActionsDropdown";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { LikeButton } from "@/components/interactions/LikeButton";
import { deletePhdAdmission } from "@/app/actions/admissions";

type AdmissionWithAuthor = PhdAdmission & {
  author: User & {
    followers?: { followerId: string }[];
  };
  isLiked: boolean;
  _count: { likes: number; comments: number };
};

export function AdmissionCard({
  admission,
  currentUserId,
}: {
  admission: AdmissionWithAuthor;
  currentUserId?: string;
}) {
  const isOwner = currentUserId === admission.authorId;
  const isFollowing = (admission.author.followers?.length ?? 0) > 0;
  return (
    <ListPageCardShell
      authorHref={`/scholar/${admission.author.id}`}
      authorName={admission.author.name || "Scholar"}
      authorId={admission.author.id}
      isFollowing={isFollowing}
      authorHandle={admission.author.handle || undefined}
      authorAvatarUrl={admission.author.avatarUrl || undefined}
      detailPageHref={`/admissions/${admission.id}`}
      managementControls={
        isOwner && (
          <OwnerActionsDropdown
            editHref={`/admissions/${admission.id}/edit`}
            isOwner={true}
            onDelete={async () => {
              await deletePhdAdmission(admission.id);
            }}
            editLabel="Edit Admission"
            deleteLabel="Delete"
          />
        )
      }
      footerLikeButton={
        <LikeButton
          targetId={admission.id}
          type="admission"
          initialLikes={admission._count.likes}
          initialIsLiked={admission.isLiked}
        />
      }
      footerCommentsHref={`/admissions/${admission.id}`}
      footerCommentsCount={admission._count.comments}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold leading-tight text-slate-950">
          {admission.university}
        </h2>
        <p className="mt-1 text-sm font-semibold text-blue-700">
          {admission.department}
        </p>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-slate-600 line-clamp-4">
        {admission.description}
      </p>
    </ListPageCardShell>
  );
}
