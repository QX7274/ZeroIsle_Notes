import base64
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from voice_recognition.views.transcription import transcribe_audio


class TranscribeAudioResponseContractTests(SimpleTestCase):
    def test_transcribe_audio_renders_json_with_unconfigured_transcription_metadata(self):
        """The endpoint must not leak mocked or non-JSON model metadata."""
        factory = APIRequestFactory()
        request = factory.post(
            "/api/v1/voice-recognition/transcribe/",
            {
                "audio_base64": base64.b64encode(b"RIFF" + b"\x00" * 100).decode("ascii"),
                "language": "zh",
                "engine": "whisper",
            },
            format="json",
        )
        force_authenticate(request, user=MagicMock(is_authenticated=True))

        with patch("voice_recognition.views.transcription.WhisperService") as service_cls, patch(
            "voice_recognition.views.transcription.AudioFile"
        ) as audio_file_cls, patch(
            "voice_recognition.views.transcription.Transcription"
        ) as transcription_cls, patch(
            "voice_recognition.views.transcription.Language"
        ) as language_cls, patch(
            "voice_recognition.views.transcription.get_mongo_user",
            return_value=MagicMock(),
        ):
            service_cls.return_value.transcribe.return_value = {
                "status": "completed",
                "text": "hello",
                "segments": [],
                "duration": 1.25,
            }
            language_cls.objects.get.return_value = MagicMock()
            audio_file = audio_file_cls.return_value
            transcription = transcription_cls.return_value

            response = transcribe_audio(request)
            response.render()

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data["created_at"], str)
