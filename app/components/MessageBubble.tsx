'use client';

import { Sparkles } from 'lucide-react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, getFileIcon } from '../lib/chat-helpers';

interface MessageBubbleProps {
    message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
    const isBot = message.role === 'model';

    return (
        <div className={`chat-message ${isBot ? 'chat-message-bot' : 'chat-message-user'}`}>
            {isBot && (
                <div className="chat-avatar">
                    <Sparkles size={16} />
                </div>
            )}
            <div className={`chat-bubble ${isBot ? 'chat-bubble-bot' : 'chat-bubble-user'}`}>
                {message.fileName && (
                    <div className="chat-file-badge">
                        <Image src={getFileIcon(message.fileName)} alt="" width={16} height={16} className="chat-file-icon-img" />
                        <span>{message.fileName}</span>
                    </div>
                )}
                {isBot ? (
                    <div className="chat-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <p>{message.content}</p>
                )}
            </div>
        </div>
    );
}

/* ===== Typing Indicator ===== */
export function TypingIndicator() {
    return (
        <div className="chat-message chat-message-bot">
            <div className="chat-avatar">
                <Sparkles size={16} />
            </div>
            <div className="chat-bubble chat-bubble-bot">
                <div className="chat-typing">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    );
}
