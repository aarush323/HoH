import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVoiceStream } from '../hooks/useVoiceStream';
import { api } from '../api/client';
import {
    Phone,
    User,
    Radio,
    ArrowLeft,
    CheckCircle2,
    AlertTriangle,
    Clock,
} from 'lucide-react';

interface Message {
    id: number;
    role: 'agent' | 'customer' | 'system';
    text: string;
    timestamp: number;
}

export default function VoiceCall() {
    const { pendingId } = useParams<{ pendingId: string }>();
    const navigate = useNavigate();
    const id = pendingId ? parseInt(pendingId) : 0;
    const { events, isConnected, callState } = useVoiceStream(id);
    const [messages, setMessages] = useState<Message[]>([]);
    const [customerName, setCustomerName] = useState('Customer');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!id) return;
        
        api.getPendingDetail(id).then((detail) => {
            setCustomerName(detail.name || 'Customer');
        }).catch(console.error);
    }, [id]);

    useEffect(() => {
        let msgId = 0;
        const newMessages: Message[] = [];
        
        events.forEach((event) => {
            switch (event.event) {
                case 'agent_speaking':
                    newMessages.push({
                        id: msgId++,
                        role: 'agent',
                        text: event.data.text as string,
                        timestamp: event.timestamp,
                    });
                    break;
                case 'transcript':
                    newMessages.push({
                        id: msgId++,
                        role: 'customer',
                        text: event.data.text as string,
                        timestamp: event.timestamp,
                    });
                    break;
                case 'listening':
                    newMessages.push({
                        id: msgId++,
                        role: 'system',
                        text: '🎤 Listening...',
                        timestamp: event.timestamp,
                    });
                    break;
            }
        });
        
        setMessages(newMessages);
    }, [events]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const getStatusColor = () => {
        if (!isConnected) return 'bg-yellow-100 text-yellow-800';
        if (callState.status === 'ended') return 'bg-zinc-100 text-zinc-600';
        return 'bg-green-100 text-green-800';
    };

    const getStatusText = () => {
        if (callState.status === 'ended') return 'Call Ended';
        if (!isConnected) return 'Connecting...';
        if (callState.status === 'active') return 'Live';
        return 'Starting...';
    };

    const formatStage = (stage: string) => {
        return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    return (
        <div className="min-h-screen bg-zinc-50 font-sans">
            {/* Header */}
            <div className="bg-white border-b border-zinc-200 px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/pending-approvals')}
                            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-zinc-600" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-zinc-900">Voice Call</h1>
                            <p className="text-sm text-zinc-500">{customerName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor()}`}>
                            {getStatusText()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Call Info Bar */}
            <div className="bg-white border-b border-zinc-200 px-6 py-3">
                <div className="max-w-3xl mx-auto flex items-center justify-between text-sm">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Radio className="w-4 h-4 text-indigo-600" />
                            <span className="text-zinc-600">Stage:</span>
                            <span className="font-medium text-zinc-900">{formatStage(callState.stage)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-zinc-400" />
                            <span className="text-zinc-600">Turn:</span>
                            <span className="font-medium text-zinc-900">{callState.turn}/5</span>
                        </div>
                        {callState.currentIntent && (
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-600">Intent:</span>
                                <span className="font-medium text-zinc-900">{callState.currentIntent}</span>
                            </div>
                        )}
                    </div>
                    {callState.isEscalated && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-lg">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm font-medium">Escalation Triggered</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="max-w-3xl mx-auto px-6 py-8">
                <div className="space-y-4 min-h-[400px]">
                    {messages.length === 0 && callState.status !== 'ended' && (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Phone className="w-8 h-8 text-indigo-600 animate-pulse" />
                                </div>
                                <p className="text-zinc-500">Starting voice call...</p>
                            </div>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'customer' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}
                        >
                            {msg.role === 'system' ? (
                                <div className="px-4 py-2 bg-zinc-100 text-zinc-500 italic text-sm rounded-full">
                                    {msg.text}
                                </div>
                            ) : (
                                <div
                                    className={`max-w-[80%] px-5 py-3 rounded-2xl ${
                                        msg.role === 'agent'
                                            ? 'bg-indigo-600 text-white rounded-bl-md'
                                            : 'bg-emerald-500 text-white rounded-br-md'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        {msg.role === 'agent' ? (
                                            <>
                                                <Phone className="w-3 h-3" />
                                                <span className="text-xs font-bold uppercase opacity-75">Agent</span>
                                            </>
                                        ) : (
                                            <>
                                                <User className="w-3 h-3" />
                                                <span className="text-xs font-bold uppercase opacity-75">Customer</span>
                                            </>
                                        )}
                                    </div>
                                    <p className="text-sm">{msg.text}</p>
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Call Ended Summary */}
                {callState.status === 'ended' && (
                    <div className="mt-8 p-6 bg-white rounded-2xl border border-zinc-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            {callState.isEscalated ? (
                                <AlertTriangle className="w-6 h-6 text-amber-500" />
                            ) : (
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            )}
                            <h3 className="text-lg font-bold text-zinc-900">
                                {callState.isEscalated ? 'Call Escalated' : 'Call Completed'}
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-zinc-500">Outcome:</span>
                                <span className="ml-2 font-medium text-zinc-900">{callState.outcome || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-zinc-500">Total Turns:</span>
                                <span className="ml-2 font-medium text-zinc-900">{callState.turn}</span>
                            </div>
                            <div>
                                <span className="text-zinc-500">Final Stage:</span>
                                <span className="ml-2 font-medium text-zinc-900">{formatStage(callState.stage)}</span>
                            </div>
                            <div>
                                <span className="text-zinc-500">Duration:</span>
                                <span className="ml-2 font-medium text-zinc-900">
                                    ~{Math.ceil(events.length * 0.5)}s estimated
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/pending-approvals')}
                            className="mt-6 w-full py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-colors"
                        >
                            Back to Approvals
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
