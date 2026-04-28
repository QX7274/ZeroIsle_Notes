"""
AI处理视图
提供笔记中AI工具的API端点
"""

import logging
import json
from django.http import JsonResponse, StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from ..throttling import UserMinuteRateThrottle, UserDayRateThrottle
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.api_response import APIResponse
from common.error_codes import INVALID_INPUT, INTERNAL_ERROR
from ..services.text_processing_service import TextProcessingService
from ..services.openai_service import OpenAIService

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([UserMinuteRateThrottle, UserDayRateThrottle])
def process_ai(request):
    """
    AI处理API（统一入口）
    - 文本类工具：summarize/translate/analyze/rewrite/grammar/simplify/math_formula/extract_keywords/code_recognition/sentiment
    - 生成类工具：generate（使用 OpenAIService.generate_content）
    """
    user = request.user
    data = request.data

    tool = (data.get('tool') or 'summarize').strip()

    try:
        if tool == 'generate':
            # 生成内容：接受 prompt/type/length
            prompt = data.get('prompt') or data.get('text', '')  # 兼容将文本作为提示
            if not prompt:
                return APIResponse.error(
                    message='提示不能为空',
                    code=INVALID_INPUT,
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            gen_type = data.get('type', 'text')
            gen_length = data.get('length', 'medium')
            stream = bool(data.get('stream', False))

            if stream:
                # 流式输出（SSE）
                svc = OpenAIService()
                system_prompt = '你是一个中文写作助手，请按要求逐步输出内容片段。'
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ]
                try:
                    stream_resp = svc.chat_completion(messages=messages, model="gpt-3.5-turbo", stream=True)
                except Exception as e:
                    logger.error(f"获取流式响应失败: {e}")
                    return APIResponse.error(
                        message=f'获取流式响应失败: {str(e)}',
                        code=INTERNAL_ERROR,
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

                def event_stream():
                    try:
                        for chunk in stream_resp:
                            try:
                                # v1 SDK: chunk.choices[0].delta.content 可能为None
                                choice = getattr(chunk, 'choices', [None])[0]
                                delta = getattr(choice, 'delta', None)
                                content = getattr(delta, 'content', None) if delta else None
                                if content:
                                    yield f"data: {{\"content\": {json.dumps(content)} }}\n\n"
                            except Exception as inner_e:
                                logger.warning(f"解析流式分片失败: {inner_e}")
                        # 结束事件
                        yield "event: done\n data: {}\n\n"
                    except Exception as outer_e:
                        logger.error(f"流式输出错误: {outer_e}")
                        # 发送错误事件
                        yield f"event: error\n data: {json.dumps(str(outer_e))}\n\n"

                return StreamingHttpResponse(event_stream(), content_type='text/event-stream')
            else:
                svc = OpenAIService()
                result = svc.generate_content(prompt=prompt, type=gen_type, length=gen_length)
                return APIResponse.success(data=result, message='生成成功')
        else:
            # 文本处理路径：需要 text
            text = data.get('text', '')
            if not text:
                return APIResponse.error(
                    message='文本不能为空',
                    code=INVALID_INPUT,
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            # 情感统一映射为 sentiment 任务
            task_map = {
                'analyze_sentiment': 'sentiment'
            }
            task = task_map.get(tool, tool)

            svc = TextProcessingService()
            result = svc.process_text(text=text, task=task)
            return APIResponse.success(data=result, message='处理成功')

    except Exception as e:
        logger.error(f"AI处理错误: {str(e)}")
        # 主链路兜底：第三方AI不可用时返回可展示结果，避免阻塞前端流程
        fallback_text = 'AI服务暂时不可用，请稍后重试。'
        return APIResponse.success(
            data={
                'result': fallback_text,
                'fallback': True,
                'error_detail': str(e),
                'tool': tool,
            },
            message='处理成功（降级模式）'
        )
