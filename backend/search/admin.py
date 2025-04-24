from django.contrib import admin
from .models import SearchHistory, SearchResult


class SearchResultInline(admin.TabularInline):
    model = SearchResult
    extra = 0
    readonly_fields = ('result_type', 'result_id', 'title', 'preview', 'relevance', 'created_at')


@admin.register(SearchHistory)
class SearchHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'query', 'search_type', 'created_at')
    list_filter = ('search_type', 'created_at')
    search_fields = ('query', 'user__username')
    readonly_fields = ('user', 'query', 'search_type', 'created_at')
    inlines = [SearchResultInline]


@admin.register(SearchResult)
class SearchResultAdmin(admin.ModelAdmin):
    list_display = ('id', 'search_history', 'result_type', 'title', 'relevance', 'created_at')
    list_filter = ('result_type', 'created_at')
    search_fields = ('title', 'preview')
    readonly_fields = ('search_history', 'result_type', 'result_id', 'title', 'preview', 'relevance', 'created_at')
