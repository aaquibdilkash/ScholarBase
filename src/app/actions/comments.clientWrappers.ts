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
    | 'contribution'
    | 'publication'
    | 'survey'

export async function deleteCommentClientWrapper(formData: FormData) {
    const commentId = formData.get('_commentId')
    const type = formData.get('_type')

    if (!commentId || typeof commentId !== 'string') return undefined
    if (!type || typeof type !== 'string') return undefined

    return deleteComment(commentId, type as CommentType)
}

export async function editCommentClientWrapper(formData: FormData) {
    const commentId = formData.get('_commentId')
    const type = formData.get('_type')

    if (!commentId || typeof commentId !== 'string') return undefined
    if (!type || typeof type !== 'string') return undefined

    return editComment(formData, commentId, type as CommentType)
}

// Used by the client <form> for creating comments/replies.
export async function createCommentClientWrapper(formData: FormData) {
    const targetId = formData.get('_targetId')
    const type = formData.get('_type')
    const parentId = formData.get('_parentId')

    if (!targetId || typeof targetId !== 'string') return undefined
    if (!type || typeof type !== 'string') return undefined

    // parentId comes as "" for top-level comments
    const parentIdStr = typeof parentId === 'string' && parentId.trim() ? parentId : undefined

    return createComment(formData, targetId, type as CommentType, parentIdStr)
}

