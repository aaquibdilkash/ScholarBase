export type NetnoKitPlatform = "youtube" | "instagram";

export type NetnoKitComment = {
  commentId: string;
  parentId: string | null;
  threadRootId: string;
  depth: number;
  authorId: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  createdAt: string; // ISO UTC
  updatedAt: string | null;
  likeCount: number;
  replyCount: number;
  isDeleted: boolean;
  permalink: string | null;
  text: string;
  cleanedText: string;
};

export type NetnoKitMetadata = {
  platform: NetnoKitPlatform;
  sourceUrl: string;
  videoId?: string;
  channelId?: string | null;
  channelTitle?: string | null;
  postUrl?: string;
  collectedAt: string; // ISO UTC
  provider: string;
  params: Record<string, unknown>;
  totalComments: number;
  truncated: boolean;
  truncatedReason?: string;
};

export type CollectResult = {
  comments: NetnoKitComment[];
  metadata: NetnoKitMetadata;
};

export type AnonymizationOptions = {
  enabled: boolean;
  studySalt: string;
};
