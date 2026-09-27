"""MongoDB state for resumable, chunked file uploads."""

import uuid

from django.utils import timezone
from mongoengine import (
    DateTimeField,
    DictField,
    IntField,
    ListField,
    ReferenceField,
    StringField,
    Document,
)

from users.mongodb_models import User


class UploadSession(Document):
    """Durable server-side upload state owned by one user."""

    id = StringField(primary_key=True, default=lambda: f"up_{uuid.uuid4().hex}")
    user = ReferenceField(User, required=True)
    note = ReferenceField('Note')
    attachment_id = StringField(max_length=150)
    file_name = StringField(max_length=255, required=True)
    file_type = StringField(max_length=150, required=True)
    file_size = IntField(required=True, min_value=1)
    chunk_size = IntField(required=True, min_value=1)
    received_bytes = IntField(default=0, min_value=0)
    received_chunks = ListField(IntField(), default=list)
    chunk_hashes = DictField(default=dict)
    sha256 = StringField(max_length=64)
    storage_prefix = StringField(required=True)
    final_storage_key = StringField()
    client_op_id = StringField(max_length=150, sparse=True)
    device_id = StringField(max_length=150, sparse=True)
    status = StringField(
        choices=('uploading', 'completed', 'cancelled', 'failed'),
        default='uploading',
    )
    error = StringField()
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
    expires_at = DateTimeField()

    meta = {
        'collection': 'upload_sessions',
        'indexes': [
            {'fields': ['user', 'status', 'updated_at']},
            {'fields': ['user', 'client_op_id'], 'sparse': True},
            {'fields': ['expires_at'], 'expireAfterSeconds': 0},
        ],
    }

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
