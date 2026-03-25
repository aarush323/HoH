import requests
import json
import sys

def test_sse(customer_id):
    url = f"http://localhost:8000/journey-stream/{customer_id}"
    print(f"Connecting to {url}...")
    try:
        response = requests.get(url, stream=True, timeout=30)
        print(f"Status: {response.status_code}")
        
        for line in response.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith('data: '):
                    data_str = decoded_line[6:]
                    try:
                        data = json.loads(data_str)
                        print(f"Received: {data.get('type')}")
                        if data.get('type') == 'ping':
                            print("SUCCESS: Received ping!")
                        if data.get('type') == 'complete':
                            print("Journey complete.")
                            break
                    except json.JSONDecodeError:
                        print(f"Raw data: {data_str}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    cid = sys.argv[1] if len(sys.argv) > 1 else "C00002"
    test_sse(cid)
