export const VISIBLE_PARENT_COMMENT_WHERE = {
  parentId: null,
  OR: [
    { isDeleted: false },
    { isDeleted: true, totalReplies: { gt: 0 } },
  ],
};

export function visibleParentCommentWhere(
  commentFk: string,
  entityId: string,
) {
  return {
    ...VISIBLE_PARENT_COMMENT_WHERE,
    [commentFk]: entityId,
  };
}
