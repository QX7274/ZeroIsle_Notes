from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'records', views.SyncViewSet, basename='sync-record')
router.register(r'configs', views.SyncConfigViewSet, basename='sync-config')

urlpatterns = [
    path('', include(router.urls)),
]
