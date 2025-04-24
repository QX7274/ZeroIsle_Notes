import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ReminderNotification
from django.utils import timezone

class ReminderConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        if self.user.is_anonymous:
            await self.close()
        else:
            self.room_group_name = f"reminders_{self.user.id}"
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()

    async def disconnect(self, close_code):
        if not self.user.is_anonymous:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get('type') == 'mark_read':
            await self.mark_notification_read(data['notification_id'])

    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        try:
            notification = ReminderNotification.objects.get(
                id=notification_id,
                reminder__user=self.user
            )
            notification.is_sent = True
            notification.save()
        except ReminderNotification.DoesNotExist:
            pass

    async def send_notification(self, event):
        await self.send(text_data=json.dumps(event)) 