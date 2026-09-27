"""HTTP endpoints for the Android resumable-upload client."""

from django.http import StreamingHttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.services.storage_service import storage_service
from notes.services.chunked_upload_service import UploadSessionError, chunked_upload_service


class InvalidDownloadRangeError(UploadSessionError):
    status_code = 416

    def __init__(self, total_size):
        super().__init__('请求的文件范围无效')
        self.total_size = total_size


def _error_response(error):
    response = Response(
        {'detail': str(error), 'code': 'UPLOAD_CONTRACT_ERROR'},
        status=getattr(error, 'status_code', 400),
    )
    if hasattr(error, 'total_size'):
        response['Content-Range'] = f'bytes */{error.total_size}'
    return response


def _parse_byte_range(header, total_size):
    if not header:
        return None

    value = str(header).strip()
    if not value.lower().startswith('bytes=') or ',' in value:
        raise InvalidDownloadRangeError(total_size)

    spec = value[6:].strip()
    if '-' not in spec:
        raise InvalidDownloadRangeError(total_size)

    start_value, end_value = spec.split('-', 1)
    try:
        if not start_value:
            suffix_length = int(end_value)
            if suffix_length <= 0:
                raise InvalidDownloadRangeError(total_size)
            start = max(0, total_size - suffix_length)
            end = total_size - 1
        else:
            start = int(start_value)
            end = total_size - 1 if not end_value else int(end_value)
            if start < 0 or start >= total_size or end < start:
                raise InvalidDownloadRangeError(total_size)
            end = min(end, total_size - 1)
    except (TypeError, ValueError) as error:
        raise InvalidDownloadRangeError(total_size) from error

    return start, end


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chunked_upload_init(request):
    try:
        return Response(chunked_upload_service.init_upload(request.user, request.data), status=201)
    except UploadSessionError as error:
        return _error_response(error)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chunked_upload_chunk(request):
    try:
        content_type = (request.content_type or '').split(';', 1)[0].lower()
        if content_type == 'application/octet-stream':
            payload = {
                'sessionId': request.headers.get('X-Upload-Session'),
                'offset': request.headers.get('X-Upload-Offset'),
                'chunkIndex': request.headers.get('X-Upload-Chunk-Index'),
                'totalSize': request.headers.get('X-Upload-Total-Size'),
                'deviceId': request.headers.get('X-Upload-Device-Id'),
                'clientOpId': request.headers.get('X-Upload-Client-Op-Id'),
            }
            result = chunked_upload_service.upload_chunk(
                request.user,
                payload,
                raw_chunk=request.body,
            )
        else:
            result = chunked_upload_service.upload_chunk(request.user, request.data)
        return Response(result)
    except UploadSessionError as error:
        return _error_response(error)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chunked_upload_complete(request):
    try:
        result = chunked_upload_service.complete_upload(request.user, request.data)
        result['url'] = request.build_absolute_uri(
            f"/api/v1/files/upload/{result['sessionId']}/download/"
        )
        result['remoteUrl'] = result['url']
        return Response(result)
    except UploadSessionError as error:
        return _error_response(error)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chunked_upload_cancel(request):
    try:
        return Response(chunked_upload_service.cancel_upload(request.user, request.data))
    except UploadSessionError as error:
        return _error_response(error)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chunked_upload_status(request, session_id):
    try:
        result = chunked_upload_service.get_status(request.user, session_id)
        if result['status'] == 'completed':
            result['url'] = request.build_absolute_uri(
                f"/api/v1/files/upload/{session_id}/download/"
            )
            result['remoteUrl'] = result['url']
        return Response(result)
    except UploadSessionError as error:
        return _error_response(error)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chunked_upload_download(request, session_id):
    try:
        session = chunked_upload_service.get_download(request.user, session_id)
        byte_range = _parse_byte_range(
            request.headers.get('Range'),
            session.file_size,
        )
        if byte_range:
            range_start, range_end = byte_range
            stream = storage_service.open_range(
                session.final_storage_key,
                range_start,
                range_end,
            )
            content_length = range_end - range_start + 1
            response_status = 206
        else:
            stream = storage_service.open(session.final_storage_key)
            content_length = session.file_size
            response_status = 200

        def body():
            remaining = content_length
            try:
                while remaining > 0:
                    block = stream.read(min(1024 * 1024, remaining))
                    if not block:
                        break
                    yield block
                    remaining -= len(block)
            finally:
                close = getattr(stream, 'close', None)
                if close:
                    close()

        response = StreamingHttpResponse(
            body(),
            content_type=session.file_type,
            status=response_status,
        )
        response['Accept-Ranges'] = 'bytes'
        response['Content-Length'] = str(content_length)
        if byte_range:
            response['Content-Range'] = (
                f'bytes {range_start}-{range_end}/{session.file_size}'
            )
        response['Content-Disposition'] = f'attachment; filename="{session.file_name}"'
        return response
    except UploadSessionError as error:
        return _error_response(error)
