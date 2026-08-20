/**
 * Scholar user type used in scholar lists and cards.
 */

export interface Scholar {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  reputation: number;
  createdAt: Date;
    followers?: { followerId: string }[];
  // RULE 6: materialized counters maintained in transactions.ts (handleFollow)
  followersCount: number;
  followingCount: number;
}
