import ast
import base64
import hashlib
import io
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from notes.services.chunked_upload_service import (
    ChunkedUploadService,
    UploadSessionError,
    validate_upload_init,
)
from notes.views.chunked_upload import chunked_upload_chunk, chunked_upload_download


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _root_url_source():
    return (PROJECT_ROOT / 'backend' / 'urls.py').read_text(encoding='utf-8')


def test_root_urls_mount_the_client_chunked_upload_contract():
    source = _root_url_source()
    tree = ast.parse(source)

    mounted_routes = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name):
            continue
        if node.func.id != 'path' or len(node.args) < 2:
            continue
        route = node.args[0]
        view = node.args[1]
        if isinstance(route, ast.JoinedStr):
            parts = []
            for value in route.values:
                if isinstance(value, ast.Constant):
                    parts.append(str(value.value))
                elif isinstance(value, ast.FormattedValue) and isinstance(value.value, ast.Name):
                    parts.append('{' + value.value.id + '}')
            route = ''.join(parts)
        elif isinstance(route, ast.Constant):
            route = route.value
        else:
            continue
        if isinstance(view, ast.Name):
            mounted_routes.append((route, view.id))

    expected = {
        ('{api_prefix}files/upload/init/', 'chunked_upload_init'),
        ('{api_prefix}files/upload/chunk/', 'chunked_upload_chunk'),
        ('{api_prefix}files/upload/complete/', 'chunked_upload_complete'),
        ('{api_prefix}files/upload/cancel/', 'chunked_upload_cancel'),
        ('{api_prefix}files/upload/<str:session_id>/status/', 'chunked_upload_status'),
        ('{api_prefix}files/upload/<str:session_id>/download/', 'chunked_upload_download'),
    }
    assert expected.issubset(set(mounted_routes))


def test_chunked_upload_route_module_is_imported_by_root_urls():
    source = _root_url_source()
    assert "from notes.views.chunked_upload import" in source


def test_chunked_upload_validation_accepts_exact_500mb_boundary():
    result = validate_upload_init({
        'name': 'tablet-export.pdf',
        'size': 500 * 1024 * 1024,
        'type': 'application/pdf',
    })

    assert result['size'] == 500 * 1024 * 1024
    assert result['name'] == 'tablet-export.pdf'


def test_chunked_upload_validation_rejects_one_byte_over_500mb():
    with pytest.raises(ValueError, match='文件大小超过分片上传限制'):
        validate_upload_init({
            'name': 'too-large.bin',
            'size': 500 * 1024 * 1024 + 1,
            'type': 'application/octet-stream',
        })


def _session(**overrides):
    values = {
        'id': 'up_test',
        'status': 'uploading',
        'user': SimpleNamespace(id='user-1'),
        'note': None,
        'attachment_id': None,
        'file_size': 5,
        'chunk_size': 3,
        'received_bytes': 0,
        'received_chunks': [],
        'chunk_hashes': {},
        'storage_prefix': 'uploads/chunks/test/up_test',
        'file_name': 'sample.txt',
        'file_type': 'text/plain',
        'final_storage_key': None,
        'error': None,
        'save': lambda self: None,
    }
    values.update(overrides)
    session = SimpleNamespace(**values)
    session.save = lambda: None
    return session


def test_chunk_upload_accepts_bounded_raw_binary_bytes_without_base64_transport():
    service = ChunkedUploadService()
    session = _session()

    with patch('notes.services.chunked_upload_service._session_for_user', return_value=session), \
            patch('notes.services.chunked_upload_service.storage_service.save_bytes') as save_bytes:
        result = service.upload_chunk('user-1', {
            'sessionId': session.id,
            'offset': 0,
            'chunkIndex': 0,
            'totalSize': 5,
        }, raw_chunk=b'abc')

    assert result['uploadedBytes'] == 3
    save_bytes.assert_called_once()
    assert save_bytes.call_args.args[0] == b'abc'


def test_chunk_view_maps_octet_stream_headers_to_the_service_contract():
    factory = APIRequestFactory()
    request = factory.post(
        '/api/v1/files/upload/chunk/',
        data=b'abc',
        content_type='application/octet-stream',
        HTTP_X_UPLOAD_SESSION='up_test',
        HTTP_X_UPLOAD_OFFSET='0',
        HTTP_X_UPLOAD_CHUNK_INDEX='0',
        HTTP_X_UPLOAD_TOTAL_SIZE='5',
    )
    user = SimpleNamespace(id='user-1', pk='user-1', is_authenticated=True)
    force_authenticate(request, user=user)

    with patch(
        'notes.views.chunked_upload.chunked_upload_service.upload_chunk',
        return_value={'uploadedBytes': 3},
    ) as upload_chunk:
        response = chunked_upload_chunk(request)

    assert response.status_code == 200
    assert upload_chunk.call_args.kwargs['raw_chunk'] == b'abc'
    assert upload_chunk.call_args.args[1] == {
        'sessionId': 'up_test',
        'offset': '0',
        'chunkIndex': '0',
        'totalSize': '5',
        'deviceId': None,
        'clientOpId': None,
    }


def test_chunk_upload_is_idempotent_for_an_already_acknowledged_chunk():
    service = ChunkedUploadService()
    session = _session()
    chunk = base64.b64encode(b'abc').decode('ascii')

    with patch('notes.services.chunked_upload_service._session_for_user', return_value=session), \
            patch('notes.services.chunked_upload_service.storage_service.save_bytes') as save_bytes:
        first = service.upload_chunk('user-1', {
            'sessionId': session.id,
            'offset': 0,
            'chunkIndex': 0,
            'totalSize': 5,
            'data': chunk,
        })
        second = service.upload_chunk('user-1', {
            'sessionId': session.id,
            'offset': 0,
            'chunkIndex': 0,
            'totalSize': 5,
            'data': chunk,
        })

    assert first['uploadedBytes'] == 3
    assert second['uploadedBytes'] == 3
    save_bytes.assert_called_once()


def test_chunk_upload_rejects_a_gap_in_the_server_authoritative_offset():
    service = ChunkedUploadService()
    session = _session()
    chunk = base64.b64encode(b'de').decode('ascii')

    with patch('notes.services.chunked_upload_service._session_for_user', return_value=session):
        with pytest.raises(UploadSessionError, match='必须按顺序上传'):
            service.upload_chunk('user-1', {
                'sessionId': session.id,
                'offset': 3,
                'chunkIndex': 1,
                'totalSize': 5,
                'data': chunk,
            })


def test_complete_upload_streams_chunks_into_final_storage_and_cleans_parts():
    service = ChunkedUploadService()
    user = SimpleNamespace(id='user-1')
    session = _session(
        received_bytes=5,
        received_chunks=[0, 1],
        chunk_hashes={
            '0': hashlib.sha256(b'abc').hexdigest(),
            '1': hashlib.sha256(b'de').hexdigest(),
        },
    )
    saved = {}

    def capture_stream(stream, filename, content_type):
        saved['content'] = stream.read()
        saved['filename'] = filename
        saved['content_type'] = content_type

    with patch('notes.services.chunked_upload_service._session_for_user', return_value=session), \
            patch('notes.services.chunked_upload_service.storage_service.open', side_effect=[io.BytesIO(b'abc'), io.BytesIO(b'de')]), \
            patch('notes.services.chunked_upload_service.storage_service.save_stream', side_effect=capture_stream), \
            patch('notes.services.chunked_upload_service.storage_service.delete') as delete:
        result = service.complete_upload(
            user,
            {'sessionId': session.id, 'sha256': hashlib.sha256(b'abcde').hexdigest()},
        )

    assert result['status'] == 'completed'
    assert result['sha256'] == hashlib.sha256(b'abcde').hexdigest()
    assert saved == {
        'content': b'abcde',
        'filename': 'uploads/files/user-1/up_test/sample.txt',
        'content_type': 'text/plain',
    }
    assert session.sha256 == hashlib.sha256(b'abcde').hexdigest()
    assert delete.call_count == 2


def test_complete_upload_reconciles_a_note_attachment_when_note_id_is_present():
    service = ChunkedUploadService()
    note = SimpleNamespace(id='note-1')
    session = _session(
        note=note,
        received_bytes=5,
        received_chunks=[0, 1],
        chunk_hashes={
            '0': hashlib.sha256(b'abc').hexdigest(),
            '1': hashlib.sha256(b'de').hexdigest(),
        },
    )
    session.user = SimpleNamespace(id='user-1')
    saved = {}

    def capture_stream(stream, filename, content_type):
        saved['content'] = stream.read()
        saved['filename'] = filename
        saved['content_type'] = content_type

    with patch('notes.services.chunked_upload_service._session_for_user', return_value=session), \
            patch('notes.services.chunked_upload_service.storage_service.open', side_effect=[io.BytesIO(b'abc'), io.BytesIO(b'de')]), \
            patch('notes.services.chunked_upload_service.storage_service.save_stream', side_effect=capture_stream), \
            patch('notes.services.chunked_upload_service.storage_service.delete'), \
            patch('notes.services.chunked_upload_service.NoteAttachment') as note_attachment:
        note_attachment.objects.return_value.first.return_value = None
        note_attachment.return_value.id = 'attachment-1'
        result = service.complete_upload(
            'user-1',
            {'sessionId': session.id, 'sha256': hashlib.sha256(b'abcde').hexdigest()},
        )

    assert result['attachmentId'] == 'attachment-1'
    note_attachment.assert_called_once_with(
        note=note,
        user=session.user,
        file_name=session.file_name,
        file_type=session.file_type,
        file_size=session.file_size,
        storage_key=saved['filename'],
    )
    note_attachment.return_value.save.assert_called_once_with()


def test_complete_upload_requires_a_whole_file_sha256():
    service = ChunkedUploadService()
    session = _session(
        received_bytes=5,
        received_chunks=[0, 1],
        chunk_hashes={
            '0': hashlib.sha256(b'abc').hexdigest(),
            '1': hashlib.sha256(b'de').hexdigest(),
        },
    )

    with patch('notes.services.chunked_upload_service._session_for_user', return_value=session), \
            patch('notes.services.chunked_upload_service.storage_service.open', side_effect=[io.BytesIO(b'abc'), io.BytesIO(b'de')]), \
            patch('notes.services.chunked_upload_service.storage_service.save_stream'):
        with pytest.raises(UploadSessionError, match='完整性校验值不能为空'):
            service.complete_upload('user-1', {'sessionId': session.id})


def test_complete_upload_rejects_a_corrupted_stored_chunk():
    service = ChunkedUploadService()
    session = _session(
        received_bytes=5,
        received_chunks=[0, 1],
        chunk_hashes={
            '0': hashlib.sha256(b'abc').hexdigest(),
            '1': hashlib.sha256(b'de').hexdigest(),
        },
    )

    with patch('notes.services.chunked_upload_service._session_for_user', return_value=session), \
            patch('notes.services.chunked_upload_service.storage_service.open', side_effect=[io.BytesIO(b'abX'), io.BytesIO(b'de')]), \
            patch('notes.services.chunked_upload_service.storage_service.save_stream'):
        with pytest.raises(UploadSessionError, match='分片完整性校验失败'):
            service.complete_upload(
                'user-1',
                {'sessionId': session.id, 'sha256': hashlib.sha256(b'abXde').hexdigest()},
            )


def test_upload_status_exposes_the_server_authoritative_offset():
    service = ChunkedUploadService()
    session = _session(received_bytes=3, received_chunks=[0])
    user = SimpleNamespace(id='user-1')

    with patch('notes.services.chunked_upload_service._session_for_user', return_value=session):
        result = service.get_status(user, session.id)

    assert result['sessionId'] == session.id
    assert result['uploadedBytes'] == 3
    assert result['status'] == 'uploading'


def _download_session(**overrides):
    values = {
        'id': 'up_test',
        'status': 'completed',
        'final_storage_key': 'uploads/files/user-1/up_test/sample.txt',
        'file_size': 5,
        'file_type': 'text/plain',
        'file_name': 'sample.txt',
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_chunked_download_serves_a_single_byte_range_without_overfetching():
    factory = APIRequestFactory()
    request = factory.get(
        '/api/v1/files/upload/up_test/download/',
        HTTP_RANGE='bytes=1-3',
    )
    user = SimpleNamespace(id='user-1', pk='user-1', is_authenticated=True)
    force_authenticate(request, user=user)

    with patch(
        'notes.views.chunked_upload.chunked_upload_service.get_download',
        return_value=_download_session(),
    ), patch(
        'notes.views.chunked_upload.storage_service.open_range',
        return_value=io.BytesIO(b'bcd'),
    ) as open_range:
        response = chunked_upload_download(request, 'up_test')

    assert response.status_code == 206
    assert response['Accept-Ranges'] == 'bytes'
    assert response['Content-Range'] == 'bytes 1-3/5'
    assert response['Content-Length'] == '3'
    assert b''.join(response.streaming_content) == b'bcd'
    open_range.assert_called_once_with(
        'uploads/files/user-1/up_test/sample.txt',
        1,
        3,
    )


def test_chunked_download_rejects_an_unsatisfiable_range_with_416():
    factory = APIRequestFactory()
    request = factory.get(
        '/api/v1/files/upload/up_test/download/',
        HTTP_RANGE='bytes=9-10',
    )
    user = SimpleNamespace(id='user-1', pk='user-1', is_authenticated=True)
    force_authenticate(request, user=user)

    with patch(
        'notes.views.chunked_upload.chunked_upload_service.get_download',
        return_value=_download_session(),
    ):
        response = chunked_upload_download(request, 'up_test')

    assert response.status_code == 416
    assert response['Content-Range'] == 'bytes */5'
