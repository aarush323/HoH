import { useEffect, useState, useRef, useCallback } from 'react';

export type VoiceEventType = 
  | 'call_start'
  | 'agent_speaking'
  | 'listening'
  | 'transcript'
  | 'intent_detected'
  | 'stage_change'
  | 'escalation'
  | 'guardrail_triggered'
  | 'call_closing'
  | 'call_end'
  | 'error'
  | 'call_ended';

export interface VoiceEvent {
  event: VoiceEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface CallState {
  status: 'idle' | 'connecting' | 'active' | 'ended';
  stage: string;
  turn: number;
  currentIntent: string | null;
  isEscalated: boolean;
  outcome: string | null;
}

export function useVoiceStream(pendingId: number) {
  const [events, setEvents] = useState<VoiceEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    stage: 'opening',
    turn: 0,
    currentIntent: null,
    isEscalated: false,
    outcome: null,
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  const addEvent = useCallback((eventType: VoiceEventType, data: Record<string, unknown>) => {
    setEvents(prev => [...prev, {
      event: eventType,
      data,
      timestamp: Date.now(),
    }]);

    // Update call state based on event
    switch (eventType) {
      case 'call_start':
        setCallState(prev => ({ ...prev, status: 'connecting' }));
        break;
      case 'agent_speaking':
      case 'transcript':
      case 'listening':
        setCallState(prev => ({ ...prev, status: 'active' }));
        break;
      case 'stage_change':
        setCallState(prev => ({ 
          ...prev, 
          stage: (data.to as string) || prev.stage 
        }));
        break;
      case 'intent_detected':
        setCallState(prev => ({ 
          ...prev, 
          currentIntent: (data.intent as string) || prev.currentIntent,
          turn: (data.turn as number) ?? prev.turn,
        }));
        break;
      case 'escalation':
        setCallState(prev => ({ 
          ...prev, 
          isEscalated: data.triggered as boolean || true 
        }));
        break;
      case 'call_end':
        setCallState(prev => ({ 
          ...prev, 
          status: 'ended',
          outcome: (data.outcome as string) || null,
        }));
        break;
    }
  }, []);

  useEffect(() => {
    if (!pendingId) return;

    const url = `/api/voice/execute/${pendingId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    // Default message handler
    es.onmessage = (e) => {
      try {
        const eventData = JSON.parse(e.data);
        addEvent('call_ended', eventData);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    // Event-specific handlers
    es.addEventListener('call_start', (e) => {
      addEvent('call_start', JSON.parse(e.data));
    });

    es.addEventListener('agent_speaking', (e) => {
      addEvent('agent_speaking', JSON.parse(e.data));
    });

    es.addEventListener('listening', (e) => {
      addEvent('listening', JSON.parse(e.data));
    });

    es.addEventListener('transcript', (e) => {
      addEvent('transcript', JSON.parse(e.data));
    });

    es.addEventListener('intent_detected', (e) => {
      addEvent('intent_detected', JSON.parse(e.data));
    });

    es.addEventListener('stage_change', (e) => {
      addEvent('stage_change', JSON.parse(e.data));
    });

    es.addEventListener('escalation', (e) => {
      addEvent('escalation', JSON.parse(e.data));
    });

    es.addEventListener('guardrail_triggered', (e) => {
      addEvent('guardrail_triggered', JSON.parse(e.data));
    });

    es.addEventListener('call_closing', (e) => {
      addEvent('call_closing', JSON.parse(e.data));
    });

    es.addEventListener('call_end', (e) => {
      addEvent('call_end', JSON.parse(e.data));
    });

    es.addEventListener('call_ended', (e: MessageEvent) => {
      addEvent('call_ended', JSON.parse(e.data));
    });

    es.addEventListener('error', (e: MessageEvent) => {
      addEvent('error', JSON.parse(e.data));
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [pendingId, addEvent]);

  return {
    events,
    isConnected,
    callState,
  };
}
