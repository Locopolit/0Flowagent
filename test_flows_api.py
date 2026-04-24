import requests
import uuid

BASE_URL = "http://localhost:8000/api"
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "password123"

def print_step(msg):
    print(f"\n[{msg}]")

def main():
    # 1. Register a test user
    print_step("Registering Test User")
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "name": "Test User"
    })
    
    if resp.status_code != 200:
        print(f"Failed to register: {resp.text}")
        return
    
    data = resp.json()
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Registered user. Token: {token[:10]}...")

    # 2. GET /flows (should be empty)
    print_step("GET /flows (initially empty)")
    resp = requests.get(f"{BASE_URL}/flows", headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")

    # 3. POST /flows
    print_step("POST /flows (Create Flow)")
    payload = {
        "name": "My Test Flow",
        "description": "Just a test",
        "nodes": [
            {"id": "node_1", "type": "trigger", "subtype": "webhook", "config": {"webhook_id": "test_wh_123"}}
        ],
        "edges": []
    }
    resp = requests.post(f"{BASE_URL}/flows", headers=headers, json=payload)
    print(f"Status: {resp.status_code}")
    flow_data = resp.json()
    print(f"Response: {flow_data}")
    flow_id = flow_data.get("id")

    if not flow_id:
        print("Flow creation failed!")
        return

    # 4. GET /flows/{id}
    print_step(f"GET /flows/{flow_id}")
    resp = requests.get(f"{BASE_URL}/flows/{flow_id}", headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")

    # 5. PUT /flows/{id}
    print_step(f"PUT /flows/{flow_id}")
    update_payload = {
        "name": "My Updated Flow",
        "description": "Updated description",
        "nodes": [
            {"id": "node_1", "type": "trigger", "subtype": "webhook", "config": {"webhook_id": "test_wh_123"}}
        ],
        "edges": []
    }
    resp = requests.put(f"{BASE_URL}/flows/{flow_id}", headers=headers, json=update_payload)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")

    # 6. POST /flows/{id}/execute
    print_step(f"POST /flows/{flow_id}/execute")
    resp = requests.post(f"{BASE_URL}/flows/{flow_id}/execute", headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")

    # 7. DELETE /flows/{id}
    print_step(f"DELETE /flows/{flow_id}")
    resp = requests.delete(f"{BASE_URL}/flows/{flow_id}", headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")

    # 8. GET /flows (should be empty again)
    print_step("GET /flows (after delete)")
    resp = requests.get(f"{BASE_URL}/flows", headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")

if __name__ == "__main__":
    main()
