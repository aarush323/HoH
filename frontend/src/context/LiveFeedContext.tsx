import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createEventSource } from '../api/client';
import type { CustomerSummary } from '../types';

interface LiveFeedContextType {
    customers: CustomerSummary[];
    eventCount: number;
    lastUpdate: Date | null;
    connected: boolean;
}

const LiveFeedContext = createContext<LiveFeedContextType | undefined>(undefined);

export const LiveFeedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [customers, setCustomers] = useState<CustomerSummary[]>([]);
    const [eventCount, setEventCount] = useState(0);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [connected, setConnected] = useState(false);
    const esRef = useRef<EventSource | null>(null);

    useEffect(() => {
        // Only start if not already running
        if (esRef.current) return;

        const es = createEventSource();
        esRef.current = es;

        es.onopen = () => setConnected(true);
        es.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data);
                if (payload.customers && Array.isArray(payload.customers)) {
                    setCustomers(payload.customers);
                    setEventCount(payload.total_events || 0);
                    setLastUpdate(new Date());
                }
            } catch (err) {
                console.error('SSE Parse Error:', err);
            }
        };
        es.onerror = () => {
            setConnected(false);
            // EventSource auto-reconnects, so we just wait
        };

        return () => {
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }
        };
    }, []);

    return (
        <LiveFeedContext.Provider value={{ customers, eventCount, lastUpdate, connected }}>
            {children}
        </LiveFeedContext.Provider>
    );
};

export const useLiveFeed = () => {
    const context = useContext(LiveFeedContext);
    if (context === undefined) {
        throw new Error('useLiveFeed must be used within a LiveFeedProvider');
    }
    return context;
};
