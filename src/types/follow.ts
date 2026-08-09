/**
 * Shared follower/following info shape used across follow actions.
 */

export interface FollowerInfo {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  followers?: { followerId: string }[];
}
