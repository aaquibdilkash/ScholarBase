'use client'

import { createComment } from '@/app/actions/comments'
import { useState } from 'react'

export function CommentSection({ comments, targetId, type }: { comments: any[], targetId: string, type: 'article' | 'post' }) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="font-bold mb-4">Discussions</h3>
      
      {/* Main Comment Box */}
      <form action={async (fd) => { fd.set('content', fd.get('content') as string); await createComment(fd, targetId, type); }} className="mb-8">
        <textarea name="content" className="w-full border rounded-lg p-2" placeholder="Share your thoughts..." required />
        <button type="submit" className="mt-2 bg-blue-600 text-white px-4 py-1 rounded">Post Comment</button>
      </form>

      <div className="space-y-6">
        {comments.map((comment) => (
          <div key={comment.id} className="border-b pb-4">
            <p className="text-sm font-bold">{comment.author.name}</p>
            <p className="text-gray-700">{comment.content}</p>
            
            {/* Reply Button */}
            <button onClick={() => setReplyingTo(comment.id)} className="text-xs text-blue-600 mt-1">Reply</button>

            {/* Reply Form */}
            {replyingTo === comment.id && (
              <form action={async (fd) => { await createComment(fd, targetId, type, comment.id); setReplyingTo(null); }} className="mt-2 ml-8">
                <textarea name="content" className="w-full border rounded-lg p-2 text-sm" placeholder="Write a reply..." required />
                <button type="submit" className="text-xs bg-gray-800 text-white px-2 py-1 rounded">Send</button>
              </form>
            )}

            {/* Render 1-Layer Replies */}
            <div className="ml-8 mt-4 space-y-2">
              {comment.replies.map((reply: any) => (
                <div key={reply.id} className="bg-gray-50 p-3 rounded-lg text-sm">
                  <p className="font-bold">{reply.author.name}</p>
                  <p>{reply.content}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}