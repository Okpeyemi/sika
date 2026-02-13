'use client';

import { Sparkles, BookOpen, Landmark, FileText, Briefcase } from 'lucide-react';
import ChatInput from './ChatInput';

const SUGGESTIONS = [
    { icon: <BookOpen size={16} />, label: 'Passeport', query: 'Comment obtenir un passeport au Bénin ?' },
    { icon: <Landmark size={16} />, label: 'CIP', query: 'Quelles sont les pièces à fournir pour la CIP ?' },
    { icon: <FileText size={16} />, label: 'Acte de naissance', query: 'Comment demander un acte de naissance ?' },
    { icon: <Briefcase size={16} />, label: 'Entreprise', query: 'Comment créer une entreprise au Bénin ?' },
];

interface WelcomeScreenProps {
    input: string;
    onInputChange: (value: string) => void;
    onSubmit: (e?: React.FormEvent, overrideQuery?: string) => void;
    file: File | null;
    onFileSelect: (file: File | null) => void;
    isLoading: boolean;
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
}

export default function WelcomeScreen({ input, onInputChange, onSubmit, file, onFileSelect, isLoading }: WelcomeScreenProps) {
    return (
        <div className="chat-welcome">
            <div className="chat-greeting">
                <Sparkles className="chat-greeting-icon" />
                <h1>{getGreeting()}</h1>
            </div>

            <ChatInput
                input={input}
                onInputChange={onInputChange}
                onSubmit={onSubmit}
                file={file}
                onFileSelect={onFileSelect}
                isLoading={isLoading}
            />

            <div className="chat-suggestions">
                {SUGGESTIONS.map((s) => (
                    <button
                        key={s.label}
                        className="chat-chip"
                        onClick={() => onSubmit(undefined, s.query)}
                    >
                        <span>{s.icon}</span>
                        <span>{s.label}</span>
                    </button>
                ))}
            </div>

            <p className="chat-disclaimer">
                Sika peut faire des erreurs. Vérifiez les informations importantes.
            </p>
        </div>
    );
}
