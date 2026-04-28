"""
增强AI服务
提供提示词链、智能上下文管理和多模型编排功能
"""

import logging
from typing import List, Dict, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class AIModel(Enum):
    """支持的AI模型"""
    GPT4 = "gpt-4"
    GPT4_TURBO = "gpt-4-turbo"
    GPT35_TURBO = "gpt-3.5-turbo"
    MOONSHOT = "moonshot-v1-8k"
    ZHIPU_GLM4 = "glm-4"
    QIANFAN_ERNIE = "ERNIE-Bot-4"
    XUNFEI_SPARK = "spark-v3"


@dataclass
class PromptStep:
    """提示词链中的单个步骤"""
    name: str
    prompt_template: str
    model: AIModel = AIModel.GPT35_TURBO
    temperature: float = 0.7
    max_tokens: int = 2000
    output_key: str = "result"
    input_mapping: Dict[str, str] = field(default_factory=dict)
    post_processor: Optional[Callable] = None


@dataclass
class ChainContext:
    """提示词链上下文"""
    variables: Dict[str, Any] = field(default_factory=dict)
    history: List[Dict] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class PromptChainService:
    """
    提示词链服务
    
    支持多步骤提示词执行，每个步骤可以使用不同的模型和参数。
    支持步骤间数据传递和后处理。
    
    使用方法:
        chain = PromptChainService()
        
        # 定义步骤
        chain.add_step(PromptStep(
            name="分析",
            prompt_template="分析以下内容：{{content}}",
            model=AIModel.GPT4,
            output_key="analysis"
        ))
        
        chain.add_step(PromptStep(
            name="总结", 
            prompt_template="基于分析结果生成总结：{{analysis}}",
            model=AIModel.GPT35_TURBO,
            output_key="summary"
        ))
        
        # 执行链
        result = await chain.execute({"content": "原始内容"})
    """
    
    def __init__(self):
        self.steps: List[PromptStep] = []
        self._providers = {}
    
    def add_step(self, step: PromptStep) -> 'PromptChainService':
        """添加步骤"""
        self.steps.append(step)
        return self
    
    def clear_steps(self):
        """清空步骤"""
        self.steps = []
    
    async def execute(self, initial_variables: Dict[str, Any]) -> ChainContext:
        """
        执行提示词链
        
        Args:
            initial_variables: 初始变量
            
        Returns:
            ChainContext: 执行上下文
        """
        context = ChainContext(variables=initial_variables.copy())
        
        for i, step in enumerate(self.steps):
            logger.info(f"执行提示词链步骤 {i+1}/{len(self.steps)}: {step.name}")
            
            try:
                # 渲染提示词
                prompt = self._render_prompt(step.prompt_template, context.variables, step.input_mapping)
                
                # 调用AI模型
                response = await self._call_model(
                    model=step.model,
                    prompt=prompt,
                    temperature=step.temperature,
                    max_tokens=step.max_tokens
                )
                
                # 后处理
                if step.post_processor:
                    response = step.post_processor(response)
                
                # 存储结果
                context.variables[step.output_key] = response
                context.history.append({
                    'step': step.name,
                    'prompt': prompt,
                    'response': response,
                    'model': step.model.value,
                    'timestamp': timezone.now().isoformat()
                })
                
            except Exception as e:
                logger.error(f"步骤 {step.name} 执行失败: {e}")
                context.metadata['error'] = str(e)
                context.metadata['failed_step'] = step.name
                raise
        
        return context
    
    def _render_prompt(self, template: str, variables: Dict, mapping: Dict) -> str:
        """渲染提示词模板"""
        # 应用映射
        render_vars = variables.copy()
        for target, source in mapping.items():
            if source in variables:
                render_vars[target] = variables[source]
        
        # 替换变量
        rendered = template
        for key, value in render_vars.items():
            rendered = rendered.replace(f"{{{{{key}}}}}", str(value))
        
        return rendered
    
    async def _call_model(self, model: AIModel, prompt: str, temperature: float, max_tokens: int) -> str:
        """调用AI模型"""
        # 根据模型选择提供者
        if model in [AIModel.GPT4, AIModel.GPT4_TURBO, AIModel.GPT35_TURBO]:
            return await self._call_openai(model.value, prompt, temperature, max_tokens)
        elif model == AIModel.MOONSHOT:
            return await self._call_moonshot(prompt, temperature, max_tokens)
        elif model == AIModel.ZHIPU_GLM4:
            return await self._call_zhipu(prompt, temperature, max_tokens)
        else:
            # 默认使用OpenAI兼容接口
            return await self._call_openai(model.value, prompt, temperature, max_tokens)
    
    async def _call_openai(self, model: str, prompt: str, temperature: float, max_tokens: int) -> str:
        """调用OpenAI API"""
        try:
            from ai_assistant.services.openai_service import OpenAIService
            service = OpenAIService()
            response = await service.chat_completion_async(
                messages=[{"role": "user", "content": prompt}],
                model=model,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.get('content', '')
        except Exception as e:
            logger.error(f"OpenAI调用失败: {e}")
            # 回退到同步调用
            return self._call_openai_sync(model, prompt, temperature, max_tokens)
    
    def _call_openai_sync(self, model: str, prompt: str, temperature: float, max_tokens: int) -> str:
        """同步调用OpenAI API"""
        try:
            from ai_assistant.services.openai_service import OpenAIService
            service = OpenAIService()
            response = service.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model=model,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.get('content', '')
        except Exception as e:
            logger.error(f"OpenAI同步调用失败: {e}")
            return f"调用失败: {str(e)}"
    
    async def _call_moonshot(self, prompt: str, temperature: float, max_tokens: int) -> str:
        """调用Moonshot API"""
        try:
            from ai_assistant.services.moonshot_service import MoonshotService
            service = MoonshotService()
            return service.generate(prompt, temperature=temperature, max_tokens=max_tokens)
        except Exception as e:
            logger.error(f"Moonshot调用失败: {e}")
            return f"调用失败: {str(e)}"
    
    async def _call_zhipu(self, prompt: str, temperature: float, max_tokens: int) -> str:
        """调用智谱API"""
        try:
            from ai_assistant.services.zhipu_service import ZhipuService
            service = ZhipuService()
            return service.generate(prompt, temperature=temperature, max_tokens=max_tokens)
        except Exception as e:
            logger.error(f"智谱调用失败: {e}")
            return f"调用失败: {str(e)}"


class SmartContextManager:
    """
    智能上下文管理器
    
    自动管理对话上下文，支持：
    - 上下文压缩
    - 重要信息提取
    - Token限制管理
    """
    
    def __init__(self, max_tokens: int = 4000):
        self.max_tokens = max_tokens
        self.messages: List[Dict] = []
        self.summary: Optional[str] = None
        self._token_count = 0
    
    def add_message(self, role: str, content: str):
        """添加消息"""
        self.messages.append({
            'role': role,
            'content': content,
            'timestamp': timezone.now().isoformat()
        })
        
        # 估算token数
        self._token_count += len(content) // 4
        
        # 如果超过限制，压缩上下文
        if self._token_count > self.max_tokens * 0.8:
            self._compress_context()
    
    def get_context(self, include_summary: bool = True) -> List[Dict]:
        """获取上下文消息"""
        context = []
        
        if include_summary and self.summary:
            context.append({
                'role': 'system',
                'content': f"之前对话摘要：{self.summary}"
            })
        
        context.extend(self.messages)
        return context
    
    def _compress_context(self):
        """压缩上下文"""
        if len(self.messages) < 4:
            return
        
        # 保留最近的消息
        recent_messages = self.messages[-4:]
        old_messages = self.messages[:-4]
        
        # 从旧消息提取摘要（简化版本）
        old_content = "\n".join([m['content'][:200] for m in old_messages])
        self.summary = f"历史对话包含{len(old_messages)}条消息，主要讨论：{old_content[:500]}..."
        
        # 更新消息列表
        self.messages = recent_messages
        self._token_count = sum(len(m['content']) // 4 for m in self.messages)
        
        logger.info(f"上下文已压缩，保留{len(self.messages)}条消息")
    
    def clear(self):
        """清空上下文"""
        self.messages = []
        self.summary = None
        self._token_count = 0


class AITaskOrchestrator:
    """
    AI任务编排器
    
    根据任务类型自动选择最佳模型和参数
    """
    
    # 任务类型到模型的映射
    TASK_MODEL_MAP = {
        'summarize': AIModel.GPT35_TURBO,
        'analyze': AIModel.GPT4,
        'creative': AIModel.GPT4_TURBO,
        'translate': AIModel.GPT35_TURBO,
        'code': AIModel.GPT4,
        'chat': AIModel.GPT35_TURBO,
    }
    
    # 任务类型到参数的映射
    TASK_PARAMS = {
        'summarize': {'temperature': 0.3, 'max_tokens': 1000},
        'analyze': {'temperature': 0.5, 'max_tokens': 2000},
        'creative': {'temperature': 0.9, 'max_tokens': 2000},
        'translate': {'temperature': 0.2, 'max_tokens': 1500},
        'code': {'temperature': 0.1, 'max_tokens': 3000},
        'chat': {'temperature': 0.7, 'max_tokens': 1000},
    }
    
    def get_model_for_task(self, task_type: str) -> AIModel:
        """获取任务对应的模型"""
        return self.TASK_MODEL_MAP.get(task_type, AIModel.GPT35_TURBO)
    
    def get_params_for_task(self, task_type: str) -> Dict:
        """获取任务对应的参数"""
        return self.TASK_PARAMS.get(task_type, {'temperature': 0.7, 'max_tokens': 1000})
    
    async def execute_task(self, task_type: str, prompt: str, user_context: Optional[Dict] = None) -> str:
        """
        执行AI任务
        
        Args:
            task_type: 任务类型
            prompt: 提示词
            user_context: 用户上下文
            
        Returns:
            str: AI响应
        """
        model = self.get_model_for_task(task_type)
        params = self.get_params_for_task(task_type)
        
        chain = PromptChainService()
        chain.add_step(PromptStep(
            name=task_type,
            prompt_template=prompt,
            model=model,
            **params,
            output_key="result"
        ))
        
        context = await chain.execute({'prompt': prompt, **(user_context or {})})
        return context.variables.get('result', '')


# 预定义提示词模板
PRESET_PROMPTS = {
    'summarize_note': """
请总结以下笔记的核心内容，提取关键点：

{{content}}

请按以下格式输出：
1. 一句话概述
2. 关键要点（3-5点）
3. 相关主题标签
""",
    
    'expand_idea': """
请帮我扩展以下想法，提供更详细的分析和建议：

{{idea}}

请从以下角度分析：
1. 背景和意义
2. 具体实施建议
3. 可能的挑战和解决方案
4. 下一步行动建议
""",
    
    'generate_outline': """
请为以下主题生成一个详细的大纲：

主题：{{topic}}

要求：
1. 包含3-5个主要章节
2. 每个章节包含2-3个子点
3. 使用清晰的层级结构
""",
    
    'improve_writing': """
请帮我改进以下文本的表达，使其更加清晰、专业：

{{text}}

请：
1. 保持原意不变
2. 改进措辞和结构
3. 修正语法错误
4. 提供修改后的版本
""",
}


# 全局服务实例
_chain_service = None
_orchestrator = None


def get_chain_service() -> PromptChainService:
    """获取提示词链服务"""
    global _chain_service
    if _chain_service is None:
        _chain_service = PromptChainService()
    return _chain_service


def get_orchestrator() -> AITaskOrchestrator:
    """获取任务编排器"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AITaskOrchestrator()
    return _orchestrator
