'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import ChatInput from './ChatInput';
import MessageBubble, { TypingIndicator } from './MessageBubble';
import WelcomeScreen from './WelcomeScreen';
import {
    Message, ChatSummary,
    getFileType, generateChatId,
    loadChatList, saveChatList,
    loadChatMessages, saveChatMessages,
} from '../lib/chat-helpers';

export default function ChatInterface({ chatId }: { chatId?: string }) {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [chatList, setChatList] = useState<ChatSummary[]>([]);
    const chatRootRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const hasMessages = messages.length > 0;

    /* ===== Effects ===== */
    useEffect(() => {
        setChatList(loadChatList());
        if (chatId && chatId !== 'new') {
            setMessages(loadChatMessages(chatId));
        } else {
            setMessages([]);
        }
    }, [chatId]);

    useEffect(() => {
        if (chatRootRef.current) {
            chatRootRef.current.scrollTop = chatRootRef.current.scrollHeight;
        }
    }, [messages]);

    /* ===== Save Helpers ===== */
    const updateChatInList = useCallback((id: string, firstMessage: string, allMessages: Message[]) => {
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
        setChatList(list);
        saveChatMessages(id, allMessages);
    }, []);

    /* ===== Submit ===== */
    const handleSubmit = async (e?: React.FormEvent, overrideMessage?: string) => {
        e?.preventDefault();
        const messageText = overrideMessage || input.trim();
        if ((!messageText && !file) || isLoading) return;

        // Create or reuse chat ID
        let currentChatId = chatId;
        if (!currentChatId || currentChatId === 'new') {
            currentChatId = generateChatId();
            router.push(`/chat/${currentChatId}`);
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText || (file ? `📎 ${file.name}` : ''),
            fileName: file?.name,
            fileType: file ? getFileType(file.name) : undefined,
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        const currentFile = file;
        setFile(null);

        const history = messages.map(m => ({ role: m.role, content: m.content }));

        try {
            const formData = new FormData();
            formData.append('message', messageText);
            formData.append('history', JSON.stringify(history));
            if (currentFile) formData.append('file', currentFile);

            const res = await fetch('/api/chat', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Erreur serveur');
            }

            // Streaming reader
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            const botMessageId = (Date.now() + 1).toString();
            let botContent = '';

            setMessages([...newMessages, { id: botMessageId, role: 'model', content: '' }]);

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

            const finalMessages = [...newMessages, { id: botMessageId, role: 'model' as const, content: botContent }];
            setMessages(finalMessages);
            updateChatInList(currentChatId, userMessage.content, finalMessages);

        } catch {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: '❌ Désolé, une erreur est survenue. Veuillez réessayer.',
            };
            const finalMessages = [...newMessages, errorMsg];
            setMessages(finalMessages);
            if (currentChatId) updateChatInList(currentChatId, userMessage.content, finalMessages);
        } finally {
            setIsLoading(false);
        }
    };

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
            </div>
        </div>
    );
}
