/**
 * Shared email notification types used across notification utilities.
 */

export interface CommentNotificationProps {
  recipientEmail: string;
  commenterName: string;
  paperTitle: string;
  commentSnippet: string;
}

export interface ScholarInviteProps {
  recipientEmail: string;
  inviterName: string;
  message: string;
  inviteUrl: string;
}
