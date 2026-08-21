import { ReactNode } from "react";

type CautionNoteProps = {
  content?: ReactNode;
};

export function CautionNote({ content }: CautionNoteProps) {
  const defaultContent = (
    <>
      <strong className="font-semibold">Caution:</strong> Please ensure you are not creating a duplicate post that already exists on the platform by you or any other author. Creating duplicate posts may result in downvotes from the community and negatively impact your reputation.
    </>
  );

  return (
    <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
      {content || defaultContent}
    </div>
  );
}