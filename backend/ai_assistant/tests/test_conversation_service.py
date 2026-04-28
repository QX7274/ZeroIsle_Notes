from unittest import TestCase, mock

# Mock Django settings for standalone run
from django.conf import settings
if not settings.configured:
    settings.configure(INSTALLED_APPS=['django.contrib.contenttypes', 'django.contrib.auth', 'ai_assistant'])

from ..services.conversation_service import ConversationService

class ConversationServiceTests(TestCase):

    @mock.patch.dict(ConversationService.provider_routing, {'test-model-': 'test_provider'})
    def test_get_provider_routes_correctly(self):
        """Test that the service routes to the correct provider based on model name."""
        service = ConversationService()
        service.providers = {'test_provider': mock.MagicMock()}
        
        provider = service._get_provider('test-model-alpha')
        self.assertIsNotNone(provider)
        self.assertIs(provider, service.providers['test_provider'])

    def test_get_provider_falls_back_to_default(self):
        """Test that the service falls back to the default provider if no route matches."""
        service = ConversationService()
        # Assume 'openai' is the default
        service.providers = {'openai': mock.MagicMock()}
        
        provider = service._get_provider('unknown-model')
        self.assertIsNotNone(provider)
        self.assertIs(provider, service.providers['openai'])

    @mock.patch('ai_assistant.services.conversation_service.tool_registry')
    def test_send_message_handles_tool_calls(self, mock_tool_registry):
        """Test the full tool-calling workflow."""
        service = ConversationService()

        # Mock provider and conversation objects
        mock_provider = mock.MagicMock()
        mock_conversation = mock.MagicMock()
        mock_user = mock.MagicMock()

        # 1. First call to provider returns a tool call
        mock_provider.chat_completion.side_effect = [
            {
                'tool_calls': [{'id': 'call123', 'function': {'name': 'get_weather', 'arguments': '{"location": "Boston"}'}}],
                'usage': {'prompt_tokens': 10, 'completion_tokens': 5}
            },
            # 2. Second call (with tool result) returns the final text response
            {
                'content': 'The weather in Boston is 72 degrees.',
                'usage': {'prompt_tokens': 25, 'completion_tokens': 15}
            }
        ]
        service._get_provider = mock.MagicMock(return_value=mock_provider)

        # Mock the tool function
        mock_get_weather = mock.MagicMock(return_value='{"temperature": 72}')
        mock_tool_registry.get.return_value = {'function': mock_get_weather}

        # Execute the send_message method
        service.send_message(mock_conversation, "What's the weather in Boston?", mock_user)

        # Assertions
        # - The conversation should have had three messages added: assistant (tool call), tool (result), assistant (final answer)
        self.assertEqual(mock_conversation.add_message.call_count, 3)

        # - Check the tool call message
        mock_conversation.add_message.assert_any_call(
            role='assistant', content=None, tool_calls=mock.ANY, tokens=5
        )

        # - Check that the correct tool was called with the correct arguments
        mock_tool_registry.get.assert_called_with('get_weather')
        mock_get_weather.assert_called_with(location='Boston')

        # - Check the tool result message
        mock_conversation.add_message.assert_any_call(
            role='tool', content='{"temperature": 72}', tool_call_id='call123'
        )

        # - Check the final text message from the assistant
        mock_conversation.add_message.assert_any_call(
            'assistant', 'The weather in Boston is 72 degrees.'
        )

        # - The provider's chat_completion should have been called twice
        self.assertEqual(mock_provider.chat_completion.call_count, 2)

