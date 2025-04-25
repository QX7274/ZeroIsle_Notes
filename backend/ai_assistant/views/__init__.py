"""
AI助手模块视图初始化文件
导入所有视图以便在其他地方直接从ai_assistant.views导入
"""

from .conversation import ConversationViewSet
from .message import MessageViewSet
from .prompt_template import PromptTemplateViewSet
from .model_config import ModelConfigViewSet
from .usage_record import UsageRecordViewSet
from .feedback import FeedbackViewSet
