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
  | 'call_complete'
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
    // Clear history on call_start (new session/reconnection)
    if (eventType === 'call_start') {
      setEvents([]);
    }

    // Only add main chat events to the persistent display history to align with terminal
    const CHAT_EVENTS: VoiceEventType[] = ['agent_speaking', 'transcript', 'error'];

    if (CHAT_EVENTS.includes(eventType)) {
      setEvents(prev => [...prev, {
        event: eventType,
        data,
        timestamp: Date.now(),
      }]);
    }

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
      case 'call_complete':
        setCallState(prev => ({
          ...prev,
          status: 'ended',
          outcome: (data as any).outcome || (data as any).voice_result?.outcome || null,
        }));
        break;
    }
  }, []);

  useEffect(() => {
    if (!pendingId) return;

    // Reset events for new connection to prevent duplication
    setEvents([]);

    const url = `/api/voice/execute/${pendingId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    // Use specific event listeners instead of a default onmessage handler
    // to prevent overwriting granular event data.


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
      es.close();
    });

    es.addEventListener('call_complete', (e) => {
      addEvent('call_complete', JSON.parse(e.data));
      es.close();
    });

    es.addEventListener('call_ended', (e: MessageEvent) => {
      addEvent('call_ended', JSON.parse(e.data));
      es.close();
    });

    es.addEventListener('error', (e: MessageEvent) => {
      addEvent('error', JSON.parse(e.data));
      es.close();
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
