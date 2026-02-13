'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, PanelLeft } from 'lucide-react';
import Image from 'next/image';
import { ChatSummary, loadChatList, saveChatList, deleteChatFromStorage } from '../lib/chat-helpers';

interface SidebarProps {
    open: boolean;
    onToggle: () => void;
    chatList: ChatSummary[];
    onChatListChange: (list: ChatSummary[]) => void;
    activeChatId?: string;
}

export default function Sidebar({ open, onToggle, chatList, onChatListChange, activeChatId }: SidebarProps) {
    const router = useRouter();
    const [showLogo, setShowLogo] = useState(true);

    // Alternate between logo and PanelLeft icon when sidebar is closed
    useEffect(() => {
        if (open) return;
        const interval = setInterval(() => {
            setShowLogo(prev => !prev);
        }, 3000);
        return () => clearInterval(interval);
    }, [open]);

    const handleNewChat = () => {
        router.push('/chat/new');
    };

    const handleSelectChat = (id: string) => {
        router.push(`/chat/${id}`);
    };

    const handleDeleteChat = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = loadChatList().filter(c => c.id !== id);
        saveChatList(updated);
        onChatListChange(updated);
        deleteChatFromStorage(id);
        if (activeChatId === id) {
            router.push('/chat/new');
        }
    };

    return (
        <aside className={`chat-sidebar ${open ? 'open' : 'closed'}`}>
            {/* Row 1: Logo + toggle */}
            <div className="sidebar-header" onClick={!open ? onToggle : undefined} style={!open ? { cursor: 'pointer', justifyContent: 'center' } : undefined}>
                {open ? (
                    <>
                        <div className="sidebar-logo">
                            <Image src="/sika-logo.png" alt="Sika" width={32} height={32} className="sidebar-logo-img" />
                            <span className="sidebar-logo-text">Sika</span>
                        </div>
                        <button className="chat-btn-icon sidebar-toggle" onClick={onToggle} title="Fermer le panneau">
                            <PanelLeft size={20} />
                        </button>
                    </>
                ) : (
                    <div className="sidebar-collapsed-icon">
                        <div className={`sidebar-cycle ${showLogo ? 'visible' : 'hidden'}`}>
                            <Image src="/sika-logo.png" alt="Sika" width={26} height={26} className="sidebar-logo-img" />
                        </div>
                        <div className={`sidebar-cycle ${!showLogo ? 'visible' : 'hidden'}`}>
                            <PanelLeft size={22} />
                        </div>
                    </div>
                )}
            </div>

            {/* Row 2: New chat button */}
            {open ? (
                <div className="sidebar-new-row">
                    <button className="sidebar-new-chat" onClick={handleNewChat}>
                        <Plus size={16} />
                        <span>Nouveau chat</span>
                    </button>
                </div>
            ) : (
                <button className="chat-btn-icon sidebar-new-btn" onClick={handleNewChat} title="Nouveau chat">
                    <Plus size={20} />
                </button>
            )}

            {/* Row 3: Chat history */}
            {open && (
                <nav className="sidebar-chat-list">
                    {chatList.length === 0 ? (
                        <p className="sidebar-empty">Aucun historique</p>
                    ) : (
                        chatList.map(chat => (
                            <div
                                key={chat.id}
                                className={`sidebar-chat-item ${activeChatId === chat.id ? 'active' : ''}`}
                                onClick={() => handleSelectChat(chat.id)}
                            >
                                <span className="sidebar-chat-title">{chat.title}</span>
                                <button
                                    className="sidebar-chat-delete"
                                    onClick={(e) => handleDeleteChat(chat.id, e)}
                                    title="Supprimer"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </nav>
            )}
        </aside>
    );
}
