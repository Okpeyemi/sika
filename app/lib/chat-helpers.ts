/* ===== Chat Types ===== */
export interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
    fileName?: string;
    fileType?: string;
}

export interface ChatSummary {
    id: string;
    title: string;
    updatedAt: number;
}

/* ===== File Helpers ===== */
export function getFileIcon(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return '/pdf.png';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '/xls.png';
    return '/doc.png';
}

export function getFileType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
    return 'doc';
}

/* ===== ID ===== */
export function generateChatId(): string {
    return crypto.randomUUID();
}

/* ===== LocalStorage ===== */
const CHAT_LIST_KEY = 'sika-chats';
const chatKey = (id: string) => `sika-chat-${id}`;

export function loadChatList(): ChatSummary[] {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(CHAT_LIST_KEY) || '[]');
    } catch { return []; }
}

export function saveChatList(chats: ChatSummary[]) {
    localStorage.setItem(CHAT_LIST_KEY, JSON.stringify(chats));
}

export function saveChatListEntry(id: string, firstMessage: string) {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '…' : '');
    const list = loadChatList();
    const existing = list.findIndex(c => c.id === id);
    const entry: ChatSummary = { id, title, updatedAt: Date.now() };
    if (existing >= 0) {
        list[existing] = entry;
    } else {
        list.unshift(entry);
    }
    saveChatList(list);
}

export function loadChatMessages(chatId: string): Message[] {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(chatKey(chatId)) || '[]');
    } catch { return []; }
}

export function saveChatMessages(chatId: string, messages: Message[]) {
    localStorage.setItem(chatKey(chatId), JSON.stringify(messages));
}

export function deleteChatFromStorage(chatId: string) {
    localStorage.removeItem(chatKey(chatId));
}
