"""无限画布URL配置"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'canvases', views.CanvasViewSet, basename='canvas')
router.register(r'elements', views.CanvasElementViewSet, basename='canvas-element')
router.register(r'connections', views.CanvasConnectionViewSet, basename='canvas-connection')

urlpatterns = [
    path('', include(router.urls)),
]