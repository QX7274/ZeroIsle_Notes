from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/notes/', include('notes.urls')),
    path('api/reminders/', include('reminder.urls')),
    path('api/knowledge-graph/', include('knowledge_graph.urls')),
    path('api/search/', include('search.urls')),
    path('api/community/', include('community.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)