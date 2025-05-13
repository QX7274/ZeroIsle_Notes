"""
思维导图模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from mind_map.views.mind_map_views import (
    MindMapViewSet,
    MindMapNodeViewSet,
    MindMapEdgeViewSet,
    MongoMindMapViewSet
)
from mind_map.views.template_views import MongoMindMapTemplateViewSet
from mind_map.views.generator_views import (
    generate_from_text,
    generate_from_note,
    expand_node,
    optimize_mind_map,
    convert_to_outline,
    export_to_image
)

# 创建路由器
router = DefaultRouter()
router.register(r'maps', MindMapViewSet, basename='mind-map')
router.register(r'nodes', MindMapNodeViewSet, basename='mind-map-node')
router.register(r'edges', MindMapEdgeViewSet, basename='mind-map-edge')

# 创建MongoDB路由器
mongo_router = DefaultRouter()
mongo_router.register(r'maps', MongoMindMapViewSet, basename='mongo-mind-map')
mongo_router.register(r'templates', MongoMindMapTemplateViewSet, basename='mongo-mind-map-template')

# 生成器API路径
generator_urls = [
    path('generate/text/', generate_from_text, name='generate-from-text'),
    path('generate/note/<str:note_id>/', generate_from_note, name='generate-from-note'),
    path('expand-node/', expand_node, name='expand-node'),
    path('optimize/', optimize_mind_map, name='optimize-mind-map'),
    path('to-outline/', convert_to_outline, name='convert-to-outline'),
    path('export/', export_to_image, name='export-to-image'),
]

urlpatterns = [
    # 路由器URL
    path('', include(router.urls)),

    # MongoDB路由器URL
    path('mongo/', include(mongo_router.urls)),

    # 生成器URL
    path('generator/', include(generator_urls)),
]
