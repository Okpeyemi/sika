export type MessageRole = 'user' | 'model';

export interface ChatMessage {
    role: MessageRole;
    text: string;
    timestamp: number;
}

// In-memory storage: userId -> Array of messages
// Note: In production, this should be replaced by Redis or a database.
const historyMap = new Map<string, ChatMessage[]>();

const MAX_HISTORY_LENGTH = 10; // Keep last 10 messages for context

export function getHistory(userId: string): ChatMessage[] {
    return historyMap.get(userId) || [];
}

export function addMessage(userId: string, role: MessageRole, text: string) {
    const currentHistory = getHistory(userId);

    const newMessage: ChatMessage = {
        role,
        text,
        timestamp: Date.now()
    };

    const updatedHistory = [...currentHistory, newMessage];

    // Trim to max length
    if (updatedHistory.length > MAX_HISTORY_LENGTH) {
        updatedHistory.shift(); // Remove oldest
    }

    historyMap.set(userId, updatedHistory);
}

export function formatHistoryForGemini(history: ChatMessage[]): string {
    if (history.length === 0) return '';
    return history.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`).join('\n');
}
