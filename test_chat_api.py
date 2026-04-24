import requests
import uuid

BASE_URL = "http://localhost:8000/api"
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "password123"

def print_step(msg):
    print(f"\n[{msg}]")

def main():
    # 1. Register a test user
    print_step("Registering Test User for Chatbot Test")
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "name": "Chatbot Tester"
    })
    
    if resp.status_code != 200:
        print(f"Failed to register: {resp.text}")
        return
    
    data = resp.json()
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create an LLM config for local model
    print_step("Creating Local LLM Config (Ollama at localhost:11434)")
    llm_payload = {
        "name": "Local Ollama Test",
        "provider": "local",
        "api_key": "dummy",
        "base_url": "http://localhost:11434/v1",
        "model": "gemma4:e4b" # Universal model field
    }
    resp = requests.post(f"{BASE_URL}/llm-configs", headers=headers, json=llm_payload)
    if resp.status_code != 200:
        print(f"Failed to create LLM: {resp.text}")
        return
    llm_id = resp.json()["id"]
    print(f"LLM Config ID: {llm_id}")

    # 3. Create a Workspace
    print_step("Creating Workspace")
    ws_payload = {
        "name": "Chat Test Workspace",
        "llm_config_id": llm_id,
        "system_prompt": "You are a highly capable AI assistant."
    }
    resp = requests.post(f"{BASE_URL}/workspaces", headers=headers, json=ws_payload)
    if resp.status_code != 200:
        print(f"Failed to create workspace: {resp.text}")
        return
    ws_id = resp.json()["id"]
    print(f"Workspace ID: {ws_id}")

    # 4. Create a Conversation
    print_step("Creating Conversation")
    conv_payload = {"title": "Test Chat"}
    resp = requests.post(f"{BASE_URL}/workspaces/{ws_id}/conversations", headers=headers, json=conv_payload)
    if resp.status_code != 200:
        print(f"Failed to create conversation: {resp.text}")
        return
    conv_id = resp.json()["id"]
    print(f"Conversation ID: {conv_id}")

    # 5. Send a chat message
    print_step("Sending Chat Message to LLM...")
    chat_payload = {"message": "Hello! Can you hear me?"}
    try:
        resp = requests.post(f"{BASE_URL}/conversations/{conv_id}/chat", headers=headers, json=chat_payload)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}")
    except Exception as e:
        print(f"Exception during chat call: {e}")

if __name__ == "__main__":
    main()
