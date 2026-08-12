/**
 * Shared direct-messaging types used across messages components.
 */

export interface MessageSender {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
}

export interface Message {
    id: string;
    body: string;
    createdAt: Date | string;
    senderId: string;
    conversationId: string;
    sender: MessageSender;
}

export interface ConversationParticipant {
    user: MessageSender;
    lastReadAt: string | null;
}

export interface InboxMessage {
    body: string;
    createdAt: Date | string;
    sender: {
        id: string;
        name: string | null;
        handle: string | null;
    };
}

export interface InboxConversation {
    id: string;
    lastMessageAt: Date | string;
    participants: ConversationParticipant[];
    messages: InboxMessage[];
}

/** A message created by the sendMessage server action. */
export interface CreatedMessage {
    id: string;
    body: string;
    createdAt: Date | string;
    senderId: string;
    sender: MessageSender;
}
