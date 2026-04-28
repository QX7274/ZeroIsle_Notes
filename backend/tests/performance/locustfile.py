
import json
import random
from locust import HttpUser, task, between, events

class ZeroIsleUser(HttpUser):
    wait_time = between(1, 5)
    token = None
    user_id = None

    def on_start(self):
        """User login to get token"""
        self.login()

    def login(self):
        # Generating a random user for test isolation if needed, 
        # but here we use a fixed test account or create one.
        # For simplicity, assuming a test user exists or we act as one.
        username = f"perf_user_{random.randint(1000, 9999)}"
        password = "test_password_123"
        email = f"{username}@example.com"

        # Try register first (idempotent-ish)
        self.client.post("/api/users/register/", json={
            "username": username,
            "email": email,
            "password": password
        })

        # Login
        response = self.client.post("/api/users/login/", json={
            "username": username, 
            "password": password
        })
        
        if response.status_code == 200:
            data = response.json()
            if 'access' in data:
                self.token = data['access']
                self.user_id = data.get('user', {}).get('id')
            elif 'token' in data:
                self.token = data['token']
    
    @task(3)
    def view_notes(self):
        if not self.token: return
        headers = {'Authorization': f'Bearer {self.token}'}
        self.client.get("/api/notes/", headers=headers, name="/api/notes/ (List)")

    @task(1)
    def create_note(self):
        if not self.token: return
        headers = {'Authorization': f'Bearer {self.token}'}
        note_data = {
            "title": f"Performance Test Note {random.randint(1, 1000)}",
            "content": "This is a test note content for performance benchmarking.",
            "type": "text",
            "tags": ["perf", "test"]
        }
        self.client.post("/api/notes/", json=note_data, headers=headers, name="/api/notes/ (Create)")

    @task(1)
    def search_notes(self):
        if not self.token: return
        headers = {'Authorization': f'Bearer {self.token}'}
        query = "test"
        self.client.get(f"/api/search/?q={query}", headers=headers, name="/api/search/ (Query)")

    @task(1)
    def ai_chat(self):
        if not self.token: return
        headers = {'Authorization': f'Bearer {self.token}'}
        payload = {
            "message": "Hello, this is a load test.",
            "mode": "chat",
            "stream": False 
        }
        # Assuming AI endpoint is /api/ai/chat/ or similar
        self.client.post("/api/ai/assistant/chat/", json=payload, headers=headers, name="/api/ai/assistant/chat/")

