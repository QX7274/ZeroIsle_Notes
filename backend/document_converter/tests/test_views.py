from unittest import TestCase, mock
from django.test import RequestFactory
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.cache import cache
import json

# Mock Django settings for standalone run
from django.conf import settings
if not settings.configured:
    settings.configure(INSTALLED_APPS=['django.contrib.auth', 'django.contrib.contenttypes'])

from .. import views

class DocumentConverterViewsTests(TestCase):

    def setUp(self):
        self.factory = RequestFactory()
        self.user = mock.MagicMock()
        self.user.is_authenticated = True
        self.user.id = 1
        cache.clear()
        # Patch Note model used in views to avoid real DB access
        self.note_patcher = mock.patch('backend.document_converter.views.Note')
        self.mock_Note = self.note_patcher.start()
        self.mock_note_instance = mock.MagicMock()
        self.mock_note_instance.id = 'note-1'
        self.mock_Note.objects.get.return_value = self.mock_note_instance
        # Patch NoteAttachment to avoid GridFS/DB
        self.attachment_patcher = mock.patch('backend.document_converter.views.NoteAttachment')
        self.mock_Attachment = self.attachment_patcher.start()
        attachment_instance = mock.MagicMock()
        # ensure .file.put exists
        attachment_instance.file.put.return_value = None
        self.mock_Attachment.return_value = attachment_instance

    def tearDown(self):
        self.note_patcher.stop()
        self.attachment_patcher.stop()

    @mock.patch('backend.document_converter.views.convert_document_task')
    def test_upload_view_triggers_async_task(self, mock_task_delay):
        """Test that a valid file upload triggers a Celery task."""
        # Create a mock file
        mock_file = SimpleUploadedFile("test.docx", b"file_content", content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        request = self.factory.post('/convert/', {'file': mock_file, 'note_id': 'note-1'})
        request.user = self.user

        # Mock the task instance returned by .delay()
        mock_task = mock.MagicMock()
        mock_task.id = 'test-task-id'
        mock_task_delay.delay.return_value = mock_task

        response = views.DocumentConverterView.as_view()(request)

        self.assertEqual(response.status_code, 202) # 202 Accepted
        mock_task_delay.delay.assert_called_once()
        response_data = response.json()
        self.assertEqual(response_data['task_id'], 'test-task-id')

    def test_upload_view_file_size_limit(self):
        """Test that the view rejects files that are too large."""
        large_content = b'a' * (views.MAX_UPLOAD_BYTES + 1)
        mock_file = SimpleUploadedFile("large.docx", large_content)
        request = self.factory.post('/convert/', {'file': mock_file, 'note_id': 'note-1'})
        request.user = self.user

        response = views.DocumentConverterView.as_view()(request)
        self.assertEqual(response.status_code, 413) # Payload Too Large

    def test_upload_view_unsupported_extension(self):
        """Test that the view rejects files with unsupported extensions."""
        mock_file = SimpleUploadedFile("test.txt", b"content")
        request = self.factory.post('/convert/', {'file': mock_file, 'note_id': 'note-1'})
        request.user = self.user

        response = views.DocumentConverterView.as_view()(request)
        self.assertEqual(response.status_code, 400)

    def test_status_check_requires_auth_and_ownership(self):
        """Test that only the task owner or an admin can check the status."""
        task_id = 'owner-task-id'
        # Store mock task data in cache, owned by self.user (id=1)
        cache.set(f"docconv:{task_id}", {'user_id': self.user.id, 'status': 'running'})

        # 1. Owner should be able to access
        request = self.factory.get(f'/status/{task_id}/')
        request.user = self.user
        response = views.conversion_status_by_id(request, task_id)
        self.assertEqual(response.status_code, 200)

        # 2. Another user should be denied
        other_user = mock.MagicMock()
        other_user.is_authenticated = True
        other_user.id = 2
        request = self.factory.get(f'/status/{task_id}/')
        request.user = other_user
        response = views.conversion_status_by_id(request, task_id)
        self.assertEqual(response.status_code, 403) # Forbidden

    def test_download_token_generation_and_usage(self):
        """Test the end-to-end flow of generating and using a download token."""
        filename = "test_file.pdf"
        # Store mock file owner data in cache
        cache.set(f"docconv:file_owner:{filename}", self.user.id)

        # 1. Generate a token as the file owner
        request_body = {'filename': filename}
        request = self.factory.post('/download-token/', data=json.dumps(request_body), content_type='application/json')
        request.user = self.user
        with mock.patch('django.core.files.storage.default_storage.exists', return_value=True):
            response = views.generate_download_token(request)
        self.assertEqual(response.status_code, 200)
        token_data = response.json()
        self.assertTrue(token_data['success'])
        token = token_data['token']


    @mock.patch('backend.document_converter.views.storage_service')
    def test_generate_token_returns_presigned_when_available(self, mock_storage_service):
        """When object storage is enabled and storage_key exists, API should return presigned URL."""
        filename = "test_presigned.pdf"
        cache.set(f"docconv:file_owner:{filename}", self.user.id)
        cache.set(f"docconv:key_map:{filename}", f"converted/{filename}")
        mock_storage_service.generate_presigned_url.return_value = "https://example.com/presigned"

        request_body = {'filename': filename}
        request = self.factory.post('/download-token/', data=json.dumps(request_body), content_type='application/json')
        request.user = self.user

        response = views.generate_download_token(request)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['mode'], 'presigned')
        self.assertEqual(data['download_url'], 'https://example.com/presigned')
        self.assertIn('presigned_url', data)

    @mock.patch('backend.document_converter.views.storage_service')
    def test_status_enriches_presigned_url(self, mock_storage_service):
        """Status endpoint should enrich pdf_url with presigned when storage_key present."""
        task_id = 'task-with-key'
        cache.set(
            f"docconv:{task_id}",
            {
                'user_id': self.user.id,
                'status': 'completed',
                'progress': 100,
                'storage_key': 'converted/abc.pdf',
                'pdf_url': '/fallback',
                'download_mode': 'local'
            }
        )
        mock_storage_service.generate_presigned_url.return_value = 'https://example.com/presigned2'

        request = self.factory.get(f'/status/{task_id}/')
        request.user = self.user
        response = views.conversion_status_by_id(request, task_id)
        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['pdf_url'], 'https://example.com/presigned2')
        self.assertEqual(data['download_mode'], 'presigned')


    @mock.patch('backend.document_converter.views.convert_document_task')
    def test_base64_upload_enqueues_task(self, mock_task_delay):
        import base64
        payload = {
            'file_data': base64.b64encode(b'hello').decode('ascii'),
            'file_extension': '.docx',
            'note_id': 'note-1',
            'filename': 'test.docx'
        }
        request = self.factory.post('/convert-base64/', data=json.dumps(payload), content_type='application/json')
        request.user = self.user

        mock_task = mock.MagicMock(); mock_task.id = 'b64-task-id'
        mock_task_delay.delay.return_value = mock_task

        response = views.Base64ConvertView.as_view()(request)
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['task_id'], 'b64-task-id')

    @mock.patch('backend.document_converter.views.storage_service')
    def test_generate_token_local_fallback_when_no_presigned(self, mock_storage_service):
        filename = 'local_only.pdf'
        cache.set(f"docconv:file_owner:{filename}", self.user.id)
        cache.set(f"docconv:key_map:{filename}", f"converted/{filename}")
        mock_storage_service.generate_presigned_url.return_value = None

        request_body = {'filename': filename}
        request = self.factory.post('/download-token/', data=json.dumps(request_body), content_type='application/json')
        request.user = self.user

        response = views.generate_download_token(request)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['mode'], 'local')
        self.assertIn('token', data)
        self.assertIn('download_url', data)

