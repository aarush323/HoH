import requests
import json
import sys
import time

def test_voice_stream(pending_id):
    url = f"http://localhost:8000/voice/execute/{pending_id}"
    print(f"Connecting to Voice SSE: {url}...")
    
    try:
        # Use a longer timeout for voice calls
        response = requests.get(url, stream=True, timeout=60)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Error: {response.text}")
            return

        current_event = None
        for line in response.iter_lines():
            if not line:
                continue
                
            decoded_line = line.decode('utf-8')
            
            if decoded_line.startswith('event: '):
                current_event = decoded_line[7:]
            elif decoded_line.startswith('data: '):
                data_str = decoded_line[6:]
                try:
                    data = json.loads(data_str)
                    print(f"[{current_event}] -> {data_str[:100]}...")
                    
                    if current_event == 'call_complete':
                        print("\nSUCCESS: Received 'call_complete' event!")
                        print(f"Outcome: {data.get('outcome')}")
                    
                    if current_event == 'call_ended':
                        print("Stream finished gracefully.")
                        break
                        
                    if current_event == 'error':
                        print(f"FAILURE: Received error event: {data.get('error')}")
                        break
                        
                except json.JSONDecodeError:
                    print(f"[{current_event}] Raw data: {data_str}")
                    
    except requests.exceptions.Timeout:
        print("Error: Connection timed out")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_voice_stream.py <pending_id>")
        sys.exit(1)
        
    pid = sys.argv[1]
    test_voice_stream(pid)
