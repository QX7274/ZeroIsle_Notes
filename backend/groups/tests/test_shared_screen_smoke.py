import json

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from groups.mongodb_models import Group, GroupMember, SharedScreen
from users.mongodb_models import User as MongoUser


class SharedScreenSmokeTests(TestCase):
    def setUp(self):
        MongoUser.objects.all().delete()
        Group.objects.all().delete()
        GroupMember.objects.all().delete()
        SharedScreen.objects.all().delete()
        self.client = APIClient()

    def tearDown(self):
        SharedScreen.objects.all().delete()
        GroupMember.objects.all().delete()
        Group.objects.all().delete()
        MongoUser.objects.all().delete()

    def test_register_group_share_join_minimal_flow(self):
        register_payload = {
            "username": "smoke_user",
            "password": "TestPassword123!",
        }
        register_response = self.client.post(
            "/api/v1/auth/register/username/",
            data=json.dumps(register_payload),
            content_type="application/json",
        )
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", register_response.data)
        self.assertEqual(register_response.data["user"]["username"], "smoke_user")

        login_response = self.client.post(
            "/api/v1/auth/login/",
            data=json.dumps(register_payload),
            content_type="application/json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        access = login_response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        group_response = self.client.post(
            "/api/v1/groups/",
            data=json.dumps({
                "name": "共享联调群",
                "description": "共享链最小 smoke",
            }),
            content_type="application/json",
        )
        self.assertEqual(group_response.status_code, status.HTTP_201_CREATED)
        group_id = group_response.data["id"]

        group = Group.objects.get(id=group_id)
        mongo_user = MongoUser.objects.get(username="smoke_user")
        membership = GroupMember.objects.get(group=group, user=mongo_user)
        self.assertEqual(membership.role, "admin")
        self.assertTrue(membership.is_active)

        join_code_response = self.client.post(
            f"/api/v1/groups/{group_id}/generate-join-code/",
            data=json.dumps({"expires_in": 30}),
            content_type="application/json",
        )
        self.assertEqual(join_code_response.status_code, status.HTTP_200_OK)
        self.assertTrue(join_code_response.data["join_code"])

        share_response = self.client.post(
            "/api/v1/groups/shared-screens/",
            data=json.dumps({
                "group_id": group_id,
                "title": "共享联调会话",
            }),
            content_type="application/json",
        )
        self.assertEqual(share_response.status_code, status.HTTP_201_CREATED)
        shared_id = share_response.data["id"]

        list_response = self.client.get("/api/v1/groups/shared-screens/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["id"], shared_id)

        join_response = self.client.get(f"/api/v1/groups/shared-screens/{shared_id}/join/")
        self.assertEqual(join_response.status_code, status.HTTP_200_OK)
        self.assertEqual(join_response.data["status"], "active")
        self.assertTrue(join_response.data["webrtc_room_id"].startswith("screen_"))
