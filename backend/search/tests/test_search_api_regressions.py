"""Regression tests for the public search endpoint contracts."""

from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import resolve

from search.views.search import SearchViewSet
from search.services.search_service import SearchService


class SearchEndpointRoutingRegressionTests(SimpleTestCase):
    """Keep legacy search endpoint paths on their legacy response contracts."""

    def test_suggestions_path_uses_legacy_suggestions_action(self):
        match = resolve('/api/v1/search/suggestions/')

        self.assertIs(match.func.cls, SearchViewSet)
        self.assertEqual(match.func.actions, {'get': 'suggestions'})

    def test_clear_history_path_accepts_post_and_delete(self):
        match = resolve('/api/v1/search/clear-history/')

        self.assertIs(match.func.cls, SearchViewSet)
        self.assertEqual(
            match.func.actions,
            {'post': 'clear_history', 'delete': 'clear_history'},
        )

    def test_history_path_uses_legacy_history_action(self):
        match = resolve('/api/v1/search/history/')

        self.assertIs(match.func.cls, SearchViewSet)
        self.assertEqual(match.func.actions, {'get': 'history'})

    def test_search_service_is_lazy(self):
        with patch('search.views.search.SearchService') as service_cls:
            SearchViewSet()

        service_cls.assert_not_called()

    def test_search_service_does_not_load_vector_model_on_init(self):
        with patch('search.services.search_service.EnhancedVectorService') as vector_service:
            SearchService()

        vector_service.get_instance.assert_not_called()
