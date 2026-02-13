'use client';

import { useRef, useEffect } from 'react';
import { Plus, ArrowUp, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { getFileIcon } from '../lib/chat-helpers';

interface ChatInputProps {
    input: string;
    onInputChange: (value: string) => void;
    onSubmit: (e?: React.FormEvent) => void;
    file: File | null;
    onFileSelect: (file: File | null) => void;
    isLoading: boolean;
}

export default function ChatInput({ input, onInputChange, onSubmit, file, onFileSelect, isLoading }: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [input]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            if (selected.size > 10 * 1024 * 1024) {
                alert('Le fichier ne doit pas dépasser 10 Mo.');
                return;
            }
            onFileSelect(selected);
        }
    };

    const clearFile = () => {
        onFileSelect(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="chat-input-card">
            {/* File preview */}
            {file && (
                <div className="chat-file-preview">
                    <div className="chat-file-preview-inner">
                        <Image src={getFileIcon(file.name)} alt="" width={20} height={20} className="chat-file-icon-img" />
                        <span>{file.name}</span>
                        <button onClick={clearFile} className="chat-file-remove">
                            <X size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Textarea */}
            <div className="chat-input-top">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Comment puis-je vous aider ?"
                    className="chat-textarea"
                    rows={1}
                    disabled={isLoading}
                />
            </div>

            {/* Actions */}
            <div className="chat-input-bottom">
                <div className="chat-input-left">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="chat-btn-icon"
                        title="Joindre un document"
                        disabled={isLoading}
                    >
                        <Plus size={18} />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                        onChange={handleFileChange}
                        className="sr-only"
                    />
                </div>
                <div className="chat-input-right">
                    <span className="chat-model-label">Gemini Flash</span>
                    <button
                        type="button"
                        onClick={(e) => onSubmit(e as unknown as React.FormEvent)}
                        className="chat-btn-send"
                        disabled={isLoading || (!input.trim() && !file)}
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
