"""
无限画布URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from canvas.views import (
    CanvasViewSet,
    CanvasElementViewSet,
    CanvasConnectionViewSet
)

router = DefaultRouter()
router.register(r'canvases', CanvasViewSet, basename='canvas')
router.register(r'elements', CanvasElementViewSet, basename='canvas-element')
router.register(r'connections', CanvasConnectionViewSet, basename='canvas-connection')

urlpatterns = [
    path('', include(router.urls)),
    # 兼容前端API调用
    path('import/', CanvasViewSet.as_view({'post': 'import_canvas'}), name='canvas-import'),
]