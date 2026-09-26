/**
 * Scholar user type used in scholar lists and cards.
 */

export interface Scholar {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  institutionVerifiedAt?: Date | string | null;
  bio: string | null;
  reputation: number;
  createdAt: Date;
  /**
   * Live follow state from the Tri-Split overlay (directory rows). Falls back
   * to the raw `followers` relation for callers that still select it.
   */
  isFollowed?: boolean;
  followers?: { followerId: string }[];
  // RULE 6: materialized counters maintained in transactions.ts (handleFollow)
  followersCount: number;
  followingCount: number;
}
