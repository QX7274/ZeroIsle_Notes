"""
无限画布模块序列化器初始化文件
导入所有序列化器以便在其他地方直接从canvas.serializers导入
"""

from .canvas import CanvasSerializer
from .canvas_element import CanvasElementSerializer
from .canvas_connection import CanvasConnectionSerializer
from .canvas_detail import CanvasDetailSerializer
