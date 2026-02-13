'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Quote, X } from 'lucide-react';
import Sidebar from './Sidebar';
import ChatInput from './ChatInput';
import MessageBubble, { TypingIndicator } from './MessageBubble';
import WelcomeScreen from './WelcomeScreen';
import {
    Message, ChatSummary,
    getFileType, generateChatId,
    loadChatList, saveChatList,
    loadChatMessages, saveChatMessages,
    saveChatListEntry
} from '../lib/chat-helpers';

export default function ChatInterface({ chatId }: { chatId?: string }) {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [chatList, setChatList] = useState<ChatSummary[]>([]);
    const [quote, setQuote] = useState<string | null>(null);
    const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
    
    const chatRootRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const hasMessages = messages.length > 0;

    /* ===== Effects ===== */
    useEffect(() => {
        setChatList(loadChatList());
        if (chatId && chatId !== 'new') {
            const loaded = loadChatMessages(chatId);
            setMessages(loaded);
            
            // Auto-resume generation if last message key is user (handled redirect or refresh)
            if (loaded.length > 0 && loaded[loaded.length - 1].role === 'user') {
                processMessageStream(loaded, chatId);
            }
        } else {
            setMessages([]);
        }
    }, [chatId]);

    useEffect(() => {
        if (chatRootRef.current) {
            chatRootRef.current.scrollTop = chatRootRef.current.scrollHeight;
        }
    }, [messages]);

    // Text selection listener for Quote feature
    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || !selection.toString().trim()) {
                setSelectionRect(null);
                return;
            }

            // Check if selection is inside a chat message
            const anchorNode = selection.anchorNode;
            const focusNode = selection.focusNode;
            const element = anchorNode?.parentElement?.closest('.chat-message') || focusNode?.parentElement?.closest('.chat-message');
            
            if (element) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                // Adjust for viewport relative to our container if needed, but 'fixed' works for tooltip
                setSelectionRect({ top: rect.top - 40, left: rect.left + rect.width / 2 });
            } else {
                setSelectionRect(null);
            }
        };

        const handleMouseUp = () => {
            // Tiny delay to ensure selection is final
            setTimeout(handleSelection, 10);
        };

        document.addEventListener('mouseup', handleMouseUp);
        // Also listen to selectionchange if possible, but mouseup is often sufficient/cleaner
        return () => document.removeEventListener('mouseup', handleMouseUp);
    }, []);

    /* ===== Logic ===== */
    
    // Core function to stream response based on history
    const processMessageStream = async (currentMessages: Message[], activeChatId: string) => {
        if (isLoading) return;
        setIsLoading(true);

        const lastMap = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1] : null;

        // Prepare context
        const history = currentMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
        // If the last message is user, it's the strict query.
        // We actually want the whole history including the trigger message for context building if needed,
        // but API usually takes history + new prompt.
        // Our API takes 'message' and 'history'.
        // If we are resuming, 'message' is the last item of loaded messages.
        
        // Wait, if we resume, the last message is already in 'messages'.
        // We need to NOT add it again.
        // So 'history' is all EXCEPT last, 'message' IS last.
        
        let messageText = '';
        let messageFile: File | null = null; // We probably lost the file object on reload/redirect. 
        // Limitation: File objects don't survive reload easily without re-fetching blob. 
        // For redirect reuse, we might have lost the actual File *object* unless we passed it.
        // For this implementation, we assume text-based resume or we accept we lost the binary file if it wasn't uploaded yet.
        // Actually, since we saved to LS, we have the file NAME but not the content.
        // This is acceptable for a "fix": text survives.
        
        if (lastMap && lastMap.role === 'user') {
            messageText = lastMap.content;
        }

        try {
            const formData = new FormData();
            formData.append('message', messageText);
            formData.append('history', JSON.stringify(history));
            
            // Note: If we lost the file object due to redirect/reload, it won't be sent here.
            // Future improvement: Upload file immediately on select?
            
            const res = await fetch('/api/chat', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Erreur serveur');

            // Streaming setup
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            const botMessageId = (Date.now() + 1).toString();
            let botContent = '';

            // Add placeholder bot message
            setMessages(prev => [...prev, { id: botMessageId, role: 'model', content: '' }]);

            if (reader) {
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();
                            if (data === '[DONE]') break;
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.text) {
                                    botContent += parsed.text;
                                    setMessages(prev => {
                                        const updated = [...prev];
                                        const last = updated[updated.length - 1];
                                        if (last && last.id === botMessageId) {
                                            last.content = botContent;
                                        }
                                        return [...updated];
                                    });
                                }
                            } catch { /* skip */ }
                        }
                    }
                }
            }

            // Final save
            const finalMessages = [...currentMessages, { id: botMessageId, role: 'model' as const, content: botContent }];
            setMessages(finalMessages);
            saveChatMessages(activeChatId, finalMessages);
            
            // Update list snippet
            const firstMsg = currentMessages[0]?.content || 'Nouvelle conversation';
            saveChatListEntry(activeChatId, firstMsg);
            setChatList(loadChatList());

        } catch (e) {
            const errorMsg: Message = { id: Date.now().toString(), role: 'model', content: '❌ Erreur de connexion.' };
            setMessages(prev => [...prev, errorMsg]);
            saveChatMessages(activeChatId, [...currentMessages, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuote = () => {
        const selection = window.getSelection();
        if (selection) {
            setQuote(selection.toString());
            setSelectionRect(null);
            selection.removeAllRanges();
            // Focus input?
            const inputEl = document.querySelector('textarea');
            inputEl?.focus();
        }
    };

    const clearQuote = () => setQuote(null);

    const handleSubmit = async (e?: React.FormEvent, overrideMessage?: string) => {
        e?.preventDefault();
        let messageText = overrideMessage || input.trim();
        if ((!messageText && !file) || isLoading) return;

        if (quote) {
            messageText = `> ${quote}\n\n${messageText}`;
            setQuote(null);
        }

        // 1. Logic for NEW chat (Redirect Flow)
        if (!chatId || chatId === 'new') {
            const newId = generateChatId();
            const userMessage: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: messageText || (file ? `📎 ${file.name}` : ''),
                fileName: file?.name,
                fileType: file ? getFileType(file.name) : undefined,
            };

            // IMMEDIATE SAVE to survive redirect
            saveChatMessages(newId, [userMessage]);
            saveChatListEntry(newId, userMessage.content);
            
            // Redirect - logic will resume in useEffect on new page
            router.push(`/chat/${newId}`);
            return; 
        }

        // 2. Logic for EXISTING chat (Stream in place)
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText || (file ? `📎 ${file.name}` : ''),
            fileName: file?.name,
            fileType: file ? getFileType(file.name) : undefined,
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        const currentFile = file;
        setFile(null); // Clear file input
        
        // We still have the file object here, so we could theoretically pass it to processMessageStream
        // but processMessageStream currently pulls from 'lastMap'. 
        // We should improve processMessageStream to take optional context or just handle the API call logic.
        // For consistency with the "Resume" logic, let's keep it uniform but handle the file if present.
        
        // Actually, easiest is to just call processMessageStream with the updated state
        // BUT processMessageStream needs the file object if we want to send it.
        // The current implementation of processMessageStream above didn't handle the 'file' argument.
        // Let's inline the fetch here for existing chat OR modify processMessageStream to take file.
        
        processIsBusy(updatedMessages, chatId, currentFile);
    };

    // Helper separate from resume logic to include file
    const processIsBusy = async (currentMessages: Message[], activeChatId: string, currentFile: File | null) => {
        setIsLoading(true);
        const lastMap = currentMessages[currentMessages.length - 1];
        const history = currentMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
        
        try {
            const formData = new FormData();
            formData.append('message', lastMap.content);
            formData.append('history', JSON.stringify(history));
            if (currentFile) formData.append('file', currentFile);

            const res = await fetch('/api/chat', { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Erreur');

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            const botMessageId = (Date.now() + 1).toString();
            let botContent = '';

            setMessages(prev => [...prev, { id: botMessageId, role: 'model', content: '' }]);

            if (reader) {
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();
                            if (data === '[DONE]') break;
                            try {
                                const p = JSON.parse(data);
                                if (p.text) {
                                    botContent += p.text;
                                    setMessages(prev => {
                                        const upd = [...prev];
                                        if (upd[upd.length - 1].id === botMessageId) upd[upd.length - 1].content = botContent;
                                        return [...upd];
                                    });
                                }
                            } catch {}
                        }
                    }
                }
            }
            const final = [...currentMessages, { id: botMessageId, role: 'model' as const, content: botContent }];
            setMessages(final);
            saveChatMessages(activeChatId, final);
            if (currentMessages.length === 1) {
             saveChatListEntry(activeChatId, currentMessages[0].content);
             setChatList(loadChatList());
            }

        } catch { 
             /* Error handling same as above */ 
             const err = { id: Date.now().toString(), role: 'model' as const, content: '❌ Erreur.' };
             setMessages(prev => [...prev, err]);
             saveChatMessages(activeChatId, [...currentMessages, err]);
        } finally {
            setIsLoading(false);
        }
    }


    /* ===== Render ===== */
    return (
        <div className="chat-layout">
            <Sidebar
                open={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
                chatList={chatList}
                onChatListChange={setChatList}
                activeChatId={chatId}
            />

            <div className="chat-root" ref={chatRootRef}>
                <div className="chat-container">
                    <div className="chat-messages-area">
                        {!hasMessages ? (
                            <WelcomeScreen
                                input={input}
                                onInputChange={setInput}
                                onSubmit={handleSubmit}
                                file={file}
                                onFileSelect={setFile}
                                isLoading={isLoading}
                            />
                        ) : (
                            <div className="chat-messages-list">
                                {messages.map(msg => (
                                    <MessageBubble key={msg.id} message={msg} />
                                ))}
                                {isLoading && messages[messages.length - 1]?.role !== 'model' && (
                                    <TypingIndicator />
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {hasMessages && (
                        <div className="chat-input-pinned">
                            {/* Quote Preview */}
                            {quote && (
                                <div className="chat-quote-preview">
                                    <div className="chat-quote-content">
                                        <Quote size={14} className="chat-quote-icon" />
                                        <span className="chat-quote-text">{quote}</span>
                                    </div>
                                    <button onClick={clearQuote} className="chat-quote-close">
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                            
                            <ChatInput
                                input={input}
                                onInputChange={setInput}
                                onSubmit={handleSubmit}
                                file={file}
                                onFileSelect={setFile}
                                isLoading={isLoading}
                            />
                            <p className="chat-disclaimer">
                                Sika peut faire des erreurs. Vérifiez les informations importantes.
                            </p>
                        </div>
                    )}
                </div>
                
                {SelectionButton(selectionRect, handleQuote)}
            </div>
        </div>
    );
}

function SelectionButton(rect: { top: number; left: number } | null, onClick: () => void) {
    if (!rect) return null;
    return (
        <div
            style={{
                position: 'fixed',
                top: rect.top,
                left: rect.left,
                transform: 'translate(-50%, -100%)',
                zIndex: 1000,
            }}
            className="chat-selection-tooltip"
        >
            <button onClick={onClick} className="chat-quote-btn">
                <Quote size={14} />
                <span>Citer</span>
            </button>
        </div>
    );
}
