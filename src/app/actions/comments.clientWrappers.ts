'use server'

import { deleteComment, editComment, createComment } from './comments'

type CommentType =
    | 'article'
    | 'post'
    | 'vacancy'
    | 'admission'
    | 'event'
    | 'supervisor'
    | 'recommendation'
    | 'help'
    | 'journal'
    | 'researchTool'
    | 'result'

export async function deleteCommentClientWrapper(formData: FormData) {
    const commentId = formData.get('_commentId')
    const type = formData.get('_type')

    if (!commentId || typeof commentId !== 'string') return
    if (!type || typeof type !== 'string') return

    await deleteComment(commentId, type as CommentType)
}

export async function editCommentClientWrapper(formData: FormData) {
    const commentId = formData.get('_commentId')
    const type = formData.get('_type')

    if (!commentId || typeof commentId !== 'string') return
    if (!type || typeof type !== 'string') return

    await editComment(formData, commentId, type as CommentType)
}

// Used by the client <form> for creating comments/replies.
export async function createCommentClientWrapper(formData: FormData) {
    const targetId = formData.get('_targetId')
    const type = formData.get('_type')
    const parentId = formData.get('_parentId')

    if (!targetId || typeof targetId !== 'string') return
    if (!type || typeof type !== 'string') return

    // parentId comes as "" for top-level comments
    const parentIdStr = typeof parentId === 'string' && parentId.trim() ? parentId : undefined

    await createComment(formData, targetId, type as CommentType, parentIdStr)
}

