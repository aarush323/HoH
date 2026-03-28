import json
import time
from typing import Callable, Optional
from dataclasses import dataclass, field
from threading import Lock


@dataclass
class SSEClient:
    """Represents a connected SSE client."""

    pending_id: str
    queue: list = field(default_factory=list)
    closed: bool = False
    lock: Lock = field(default_factory=Lock)

    def write(self, data: str):
        with self.lock:
            if not self.closed:
                self.queue.append(data)

    def close(self):
        with self.lock:
            self.closed = True

    def clear_queue(self):
        with self.lock:
            self.queue.clear()


class VoiceEventEmitter:
    """
    Singleton event emitter for voice call streaming.
    Manages SSE connections for real-time voice call updates.
    """

    _clients: dict[str, set[SSEClient]] = {}
    _lock = Lock()

    @classmethod
    def subscribe(cls, pending_id: str, client: SSEClient) -> None:
        with cls._lock:
            if pending_id not in cls._clients:
                cls._clients[pending_id] = set()
            cls._clients[pending_id].add(client)

    @classmethod
    def unsubscribe(cls, pending_id: str, client: SSEClient) -> None:
        with cls._lock:
            if pending_id in cls._clients:
                cls._clients[pending_id].discard(client)
                if not cls._clients[pending_id]:
                    del cls._clients[pending_id]

    @classmethod
    def emit(cls, pending_id: str, event: str, data: dict) -> None:
        """Emit an event to all connected clients for a pending_id."""
        message = f"event: {event}\ndata: {json.dumps(data)}\n\n"
        with cls._lock:
            clients = cls._clients.get(pending_id, set()).copy()

        for client in clients:
            client.write(message)

    @classmethod
    def emit_error(cls, pending_id: str, error: str) -> None:
        cls.emit(pending_id, "error", {"message": error})

    @classmethod
    def emit_call_end(cls, pending_id: str) -> None:
        """Signal that the call has ended - clients can close connection."""
        cls.emit(pending_id, "call_ended", {"timestamp": time.time()})


def create_emit_fn(pending_id: str) -> Callable[[str, dict], None]:
    """
    Create an emit function for a specific pending_id.
    Usage: emit = create_emit_fn("123"); emit("agent_speaking", {"text": "..."})
    """

    def emit(event: str, data: dict):
        VoiceEventEmitter.emit(pending_id, event, data)

    return emit
