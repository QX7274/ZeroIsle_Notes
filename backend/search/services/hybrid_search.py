"""
Hybrid Search Adapter

Provides a unified interface for switching between:
1. Local TF-IDF vector search (fast, offline)
2. Cloud vector search (Milvus/Pinecone - semantic, accurate)

Strategy is determined by:
- User subscription tier (Free = Local only)
- Network availability
- Query type (semantic queries prefer cloud)
"""

import logging
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from enum import Enum

from django.conf import settings

logger = logging.getLogger(__name__)


class SearchBackend(Enum):
    LOCAL = "local"  # TF-IDF based
    CLOUD = "cloud"  # Vector DB (Milvus/Pinecone)
    HYBRID = "hybrid"  # Combine both


@dataclass
class SearchResult:
    """Unified search result"""
    id: str
    title: str
    content_preview: str
    score: float
    source: SearchBackend
    metadata: Dict[str, Any] = None


class HybridSearchAdapter:
    """
    Hybrid search adapter that routes queries to appropriate backend.
    """

    def __init__(self):
        self.local_service = None
        self.cloud_service = None
        self._cloud_available = False
        self._initialize()

    def _initialize(self):
        """Initialize search backends"""
        # Initialize local service (always available)
        try:
            from search.services.vector_service import VectorService
            self.local_service = VectorService()
            logger.info("[HybridSearch] Local search initialized")
        except Exception as e:
            logger.error(f"[HybridSearch] Failed to init local search: {e}")

        # Initialize cloud service if configured
        self._init_cloud_service()

    def _init_cloud_service(self):
        """Initialize cloud vector database connection"""
        vector_db_provider = getattr(settings, 'VECTOR_DB_PROVIDER', 'none')

        if vector_db_provider == 'milvus':
            self._init_milvus()
        elif vector_db_provider == 'pinecone':
            self._init_pinecone()
        else:
            logger.info("[HybridSearch] No cloud vector DB configured")
            self._cloud_available = False

    def _init_milvus(self):
        """Initialize Milvus connection"""
        try:
            milvus_host = getattr(settings, 'MILVUS_HOST', 'localhost')
            milvus_port = getattr(settings, 'MILVUS_PORT', 19530)

            # Lazy import to avoid requiring milvus in all environments
            from pymilvus import connections, Collection

            connections.connect(
                alias="default",
                host=milvus_host,
                port=milvus_port,
                timeout=10
            )

            self.cloud_service = {
                'type': 'milvus',
                'collection': Collection(getattr(settings, 'MILVUS_COLLECTION', 'notes')),
            }
            self._cloud_available = True
            logger.info(f"[HybridSearch] Milvus connected at {milvus_host}:{milvus_port}")

        except Exception as e:
            logger.warning(f"[HybridSearch] Milvus unavailable: {e}")
            self._cloud_available = False

    def _init_pinecone(self):
        """Initialize Pinecone connection"""
        try:
            api_key = getattr(settings, 'PINECONE_API_KEY', None)
            environment = getattr(settings, 'PINECONE_ENVIRONMENT', None)
            index_name = getattr(settings, 'PINECONE_INDEX', 'notes')

            if not api_key:
                raise ValueError("PINECONE_API_KEY not configured")

            # Lazy import
            import pinecone

            pinecone.init(api_key=api_key, environment=environment)
            index = pinecone.Index(index_name)

            self.cloud_service = {
                'type': 'pinecone',
                'index': index,
            }
            self._cloud_available = True
            logger.info(f"[HybridSearch] Pinecone connected to index: {index_name}")

        except Exception as e:
            logger.warning(f"[HybridSearch] Pinecone unavailable: {e}")
            self._cloud_available = False

    def search(
        self,
        query: str,
        user_id: str,
        limit: int = 20,
        backend: SearchBackend = SearchBackend.HYBRID,
        user_tier: str = "free",
    ) -> List[SearchResult]:
        """
        Perform hybrid search across local and/or cloud backends.

        Args:
            query: Search query string
            user_id: User ID for filtering results
            limit: Maximum results to return
            backend: Which backend(s) to use
            user_tier: User subscription tier (free/pro)

        Returns:
            List of SearchResult objects
        """
        results = []

        # Determine effective backend based on tier and availability
        effective_backend = self._resolve_backend(backend, user_tier)

        try:
            if effective_backend in (SearchBackend.LOCAL, SearchBackend.HYBRID):
                local_results = self._search_local(query, user_id, limit)
                results.extend(local_results)

            if effective_backend in (SearchBackend.CLOUD, SearchBackend.HYBRID):
                if self._cloud_available:
                    cloud_results = self._search_cloud(query, user_id, limit)
                    results.extend(cloud_results)

            # Merge and deduplicate if hybrid
            if effective_backend == SearchBackend.HYBRID:
                results = self._merge_results(results, limit)

            return results[:limit]

        except Exception as e:
            logger.error(f"[HybridSearch] Search failed: {e}")
            # Fallback to local only
            return self._search_local(query, user_id, limit)

    def _resolve_backend(self, requested: SearchBackend, user_tier: str) -> SearchBackend:
        """Resolve which backend to actually use"""
        # If cloud requested, check availability AND permissions
        if requested == SearchBackend.CLOUD or requested == SearchBackend.HYBRID:
            if not self._cloud_available:
                logger.warning("[HybridSearch] Cloud requested but unavailable, using local")
                return SearchBackend.LOCAL
            
            # Note: user_tier passed in might be just a string, 
            # Ideally we check feature gate here if we had the user object.
            # But the caller passes user_tier.
            # We assume user_tier is correct effective tier.
            
            # Simple tier check
            if user_tier == 'free':
                return SearchBackend.LOCAL

        return requested

    def _search_local(self, query: str, user_id: str, limit: int) -> List[SearchResult]:
        """Perform local TF-IDF search"""
        results = []

        try:
            from search.services.search_service import SearchService
            search_service = SearchService()

            raw_results = search_service.search(
                query=query,
                user_id=user_id,
                page_size=limit,
            )

            for item in raw_results.get('results', []):
                results.append(SearchResult(
                    id=str(item.get('id', '')),
                    title=item.get('title', ''),
                    content_preview=item.get('content_preview', '')[:200],
                    score=item.get('relevance_score', 0.0),
                    source=SearchBackend.LOCAL,
                ))

        except Exception as e:
            logger.error(f"[HybridSearch] Local search error: {e}")

        return results

    def _search_cloud(self, query: str, user_id: str, limit: int) -> List[SearchResult]:
        """Perform cloud vector search"""
        results = []

        if not self.cloud_service:
            return results

        try:
            # Generate embedding for query
            query_embedding = self._generate_embedding(query)

            if self.cloud_service['type'] == 'milvus':
                results = self._search_milvus(query_embedding, user_id, limit)
            elif self.cloud_service['type'] == 'pinecone':
                results = self._search_pinecone(query_embedding, user_id, limit)

        except Exception as e:
            logger.error(f"[HybridSearch] Cloud search error: {e}")

        return results

    def _generate_embedding(self, text: str) -> List[float]:
        """Generate text embedding using configured model"""
        # Placeholder - in production use sentence-transformers or OpenAI
        # For now, return dummy vector
        import hashlib
        hash_val = int(hashlib.md5(text.encode()).hexdigest(), 16)
        return [(hash_val >> i) % 256 / 255.0 for i in range(384)]

    def _search_milvus(self, embedding: List[float], user_id: str, limit: int) -> List[SearchResult]:
        """Search Milvus collection"""
        collection = self.cloud_service['collection']
        
        search_params = {"metric_type": "COSINE", "params": {"nprobe": 10}}
        
        results_raw = collection.search(
            data=[embedding],
            anns_field="embedding",
            param=search_params,
            limit=limit,
            expr=f'user_id == "{user_id}"',
            output_fields=["id", "title", "content_preview"]
        )

        results = []
        for hits in results_raw:
            for hit in hits:
                results.append(SearchResult(
                    id=str(hit.entity.get('id')),
                    title=hit.entity.get('title', ''),
                    content_preview=hit.entity.get('content_preview', '')[:200],
                    score=hit.score,
                    source=SearchBackend.CLOUD,
                ))

        return results

    def _search_pinecone(self, embedding: List[float], user_id: str, limit: int) -> List[SearchResult]:
        """Search Pinecone index"""
        index = self.cloud_service['index']

        results_raw = index.query(
            vector=embedding,
            top_k=limit,
            filter={"user_id": user_id},
            include_metadata=True,
        )

        results = []
        for match in results_raw.get('matches', []):
            metadata = match.get('metadata', {})
            results.append(SearchResult(
                id=match['id'],
                title=metadata.get('title', ''),
                content_preview=metadata.get('content_preview', '')[:200],
                score=match['score'],
                source=SearchBackend.CLOUD,
            ))

        return results

    def _merge_results(self, results: List[SearchResult], limit: int) -> List[SearchResult]:
        """Merge and deduplicate results from multiple backends"""
        seen_ids = set()
        merged = []

        # Sort by score descending
        results.sort(key=lambda x: x.score, reverse=True)

        for result in results:
            if result.id not in seen_ids:
                seen_ids.add(result.id)
                merged.append(result)

            if len(merged) >= limit:
                break

        return merged

    @property
    def is_cloud_available(self) -> bool:
        """Check if cloud search is available"""
        return self._cloud_available


# Singleton instance
hybrid_search = HybridSearchAdapter()
