import type { Provider } from "../utils.js";

export type GetReplyOptions = {
  onReplyStart?: () => Promise<void> | void;
  isHeartbeat?: boolean;
  onPartialReply?: (payload: ReplyPayload) => Promise<void> | void;
  provider?: Provider;
};

export type ReplyPayload = {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
};
