"""分片上传在**真实本地存储**上的端到端集成测试（GAP-007 的「真实存储/流式落盘」部分）。

与 `test_chunked_upload_contract.py` 的区别：
后者把 `storage_service.save_bytes/open/save_stream/open_range` 全部 mock 掉，只验证调用契约；
本文件**不 mock storage**，用 Django `FileSystemStorage`（`MEDIA_ROOT` 指向 pytest 的 tmp_path）
真实落盘、真实读盘，验证：

1. `complete_upload` 把磁盘上的分片流式拼装成最终文件（内容与 SHA-256 一致，分片文件被清理）；
2. 多兆字节文件在真实磁盘上按分片完成；
3. 下载视图从**磁盘**读取字节并正确处理 Range（206 / 416 / 完整下载）。

仍然 mock 的只有 `_session_for_user`（会话持久化依赖 mongomock/mongoengine），这是刻意的：
本文件要证明的是**存储层**，不是会话仓储。
"""

import hashlib
import io
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.test import override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from common.services.storage_service import storage_service
from notes.services.chunked_upload_service import ChunkedUploadService
from notes.views.chunked_upload import chunked_upload_download


CHUNK_PREFIX = 'uploads/chunks/user-1/up_local'
FINAL_KEY = 'uploads/files/user-1/up_local/payload.bin'


def _session(**overrides):
    values = {
        'id': 'up_local',
        'status': 'uploading',
        'user': SimpleNamespace(id='user-1', pk='user-1'),
        'note': None,
        'attachment_id': None,
        'file_size': 0,
        'chunk_size': 0,
        'received_bytes': 0,
        'received_chunks': [],
        'chunk_hashes': {},
        'storage_prefix': CHUNK_PREFIX,
        'file_name': 'payload.bin',
        'file_type': 'application/octet-stream',
        'final_storage_key': None,
        'sha256': None,
        'error': None,
    }
    values.update(overrides)

    def _save():
        return None

    values['save'] = _save
    return SimpleNamespace(**values)


def _write_chunks(session, chunks):
    """把分片真实写入本地存储，并同步会话状态（模拟 chunk 接口已完成的写入）。"""
    session.chunk_size = len(chunks[0]) if chunks else 0
    session.file_size = sum(len(c) for c in chunks)
    session.received_bytes = session.file_size
    session.received_chunks = list(range(len(chunks)))
    session.chunk_hashes = {}
    for index, chunk in enumerate(chunks):
        key = f'{session.storage_prefix}/{index:08d}.part'
        storage_service.save_bytes(chunk, key, 'application/octet-stream')
        session.chunk_hashes[str(index)] = hashlib.sha256(chunk).hexdigest()
    return b''.join(chunks)


@override_settings(OBJECT_STORAGE_PROVIDER='none')
def test_complete_upload_streams_chunks_into_a_real_file_on_disk(tmp_path):
    with override_settings(MEDIA_ROOT=str(tmp_path)):
        service = ChunkedUploadService()
        chunks = [b'alpha-', b'beta-', b'gamma']
        session = _session()
        expected = _write_chunks(session, chunks)
        expected_sha = hashlib.sha256(expected).hexdigest()

        # 分片确实落在了真实磁盘上
        for index in range(len(chunks)):
            part = tmp_path / CHUNK_PREFIX / f'{index:08d}.part'
            assert part.exists(), f'分片未真实落盘: {part}'

        with patch('notes.services.chunked_upload_service._session_for_user', return_value=session):
            result = service.complete_upload('user-1', {
                'sessionId': session.id,
                'sha256': expected_sha,
            })

        assert result['status'] == 'completed'
        assert result['sha256'] == expected_sha

        final_path = tmp_path / session.final_storage_key
        assert final_path.exists(), '最终文件未真实落盘'
        assert final_path.read_bytes() == expected

        # 分片文件在完成后被清理
        for index in range(len(chunks)):
            assert not (tmp_path / CHUNK_PREFIX / f'{index:08d}.part').exists()


@override_settings(OBJECT_STORAGE_PROVIDER='none')
def test_complete_upload_handles_multi_megabyte_payload_on_disk(tmp_path):
    with override_settings(MEDIA_ROOT=str(tmp_path)):
        service = ChunkedUploadService()
        chunk_size = 2 * 1024 * 1024
        chunks = [bytes([index + 1]) * chunk_size for index in range(4)]
        session = _session()
        expected = _write_chunks(session, chunks)
        expected_sha = hashlib.sha256(expected).hexdigest()
        assert len(expected) == 8 * 1024 * 1024

        with patch('notes.services.chunked_upload_service._session_for_user', return_value=session):
            result = service.complete_upload('user-1', {
                'sessionId': session.id,
                'sha256': expected_sha,
            })

        assert result['status'] == 'completed'
        final_path = tmp_path / session.final_storage_key
        assert final_path.stat().st_size == 8 * 1024 * 1024
        with final_path.open('rb') as handle:
            assert hashlib.sha256(handle.read()).hexdigest() == expected_sha


@override_settings(OBJECT_STORAGE_PROVIDER='none')
def test_download_reads_real_bytes_and_serves_a_byte_range(tmp_path):
    with override_settings(MEDIA_ROOT=str(tmp_path)):
        payload = b'0123456789'
        storage_service.save_bytes(payload, FINAL_KEY, 'application/octet-stream')

        session = _session(
            status='completed',
            file_size=len(payload),
            final_storage_key=FINAL_KEY,
        )

        factory = APIRequestFactory()
        request = factory.get(
            '/api/v1/files/upload/up_local/download/',
            HTTP_RANGE='bytes=2-5',
        )
        user = SimpleNamespace(id='user-1', pk='user-1', is_authenticated=True)
        force_authenticate(request, user=user)

        with patch(
            'notes.views.chunked_upload.chunked_upload_service.get_download',
            return_value=session,
        ):
            response = chunked_upload_download(request, 'up_local')

        assert response.status_code == 206
        assert response['Content-Range'] == 'bytes 2-5/10'
        assert response['Content-Length'] == '4'
        assert b''.join(response.streaming_content) == payload[2:6]


@override_settings(OBJECT_STORAGE_PROVIDER='none')
def test_download_serves_the_whole_real_file_without_a_range(tmp_path):
    with override_settings(MEDIA_ROOT=str(tmp_path)):
        payload = b'real-disk-payload'
        storage_service.save_bytes(payload, FINAL_KEY, 'application/octet-stream')
        session = _session(
            status='completed',
            file_size=len(payload),
            final_storage_key=FINAL_KEY,
        )

        factory = APIRequestFactory()
        request = factory.get('/api/v1/files/upload/up_local/download/')
        user = SimpleNamespace(id='user-1', pk='user-1', is_authenticated=True)
        force_authenticate(request, user=user)

        with patch(
            'notes.views.chunked_upload.chunked_upload_service.get_download',
            return_value=session,
        ):
            response = chunked_upload_download(request, 'up_local')

        assert response.status_code == 200
        assert b''.join(response.streaming_content) == payload


@override_settings(OBJECT_STORAGE_PROVIDER='none')
def test_download_rejects_an_out_of_range_request_against_a_real_file(tmp_path):
    with override_settings(MEDIA_ROOT=str(tmp_path)):
        payload = b'short'
        storage_service.save_bytes(payload, FINAL_KEY, 'application/octet-stream')
        session = _session(
            status='completed',
            file_size=len(payload),
            final_storage_key=FINAL_KEY,
        )

        factory = APIRequestFactory()
        request = factory.get(
            '/api/v1/files/upload/up_local/download/',
            HTTP_RANGE='bytes=99-120',
        )
        user = SimpleNamespace(id='user-1', pk='user-1', is_authenticated=True)
        force_authenticate(request, user=user)

        with patch(
            'notes.views.chunked_upload.chunked_upload_service.get_download',
            return_value=session,
        ):
            response = chunked_upload_download(request, 'up_local')

        assert response.status_code == 416
        assert response['Content-Range'] == 'bytes */5'


@override_settings(OBJECT_STORAGE_PROVIDER='none')
def test_open_range_positions_the_stream_and_the_caller_bounds_the_read(tmp_path):
    """记录 open_range 的真实契约（本地分支）。

    本地分支只做 seek（S3 分支返回的是服务端已限长的 Body），
    **读取长度由调用方限制** —— 下载视图的 body() 正是按 content_length 截断的。
    这里按同一契约断言，避免把「调用方限长」误当成存储层职责。
    """
    with override_settings(MEDIA_ROOT=str(tmp_path)):
        payload = bytes(range(256)) * 4
        storage_service.save_bytes(payload, FINAL_KEY, 'application/octet-stream')

        range_start, range_end = 10, 19
        stream = storage_service.open_range(FINAL_KEY, range_start, range_end)
        try:
            # 与 views.chunked_upload.body() 相同的限长读取方式
            remaining = range_end - range_start + 1
            chunks = []
            while remaining > 0:
                block = stream.read(min(1024 * 1024, remaining))
                if not block:
                    break
                chunks.append(block)
                remaining -= len(block)
        finally:
            stream.close()

        assert b''.join(chunks) == payload[range_start:range_end + 1]

        with pytest.raises(ValueError):
            storage_service.open_range(FINAL_KEY, 5, 1)
