import { fetchChatHistory } from './evolution';

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

export async function getHistory(userId: string): Promise<ChatMessage[]> {
    if (historyMap.has(userId)) {
        return historyMap.get(userId) || [];
    }

    // Attempt to fetch from Evolution API if not in memory
    console.log(`[History] Fetching history for ${userId} from Evolution API...`);
    const remoteHistory = await fetchChatHistory(userId, MAX_HISTORY_LENGTH);
    
    if (remoteHistory.length > 0) {
        const mappedHistory: ChatMessage[] = remoteHistory.map(msg => ({
            role: msg.role,
            text: msg.text,
            timestamp: Date.now() // Approximated timestamp
        }));
        historyMap.set(userId, mappedHistory);
        return mappedHistory;
    }

    return [];
}

export async function addMessage(userId: string, role: MessageRole, text: string) {
    const currentHistory = await getHistory(userId);

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
