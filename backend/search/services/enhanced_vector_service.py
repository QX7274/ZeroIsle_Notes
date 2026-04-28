"""
增强向量服务
使用Sentence Transformers实现真正的语义搜索
支持多种嵌入模型和向量存储后端
"""

import logging
import numpy as np
import pickle
import os
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from django.conf import settings
import threading

logger = logging.getLogger('backend')


class EmbeddingModel:
    """
    嵌入模型抽象基类
    """
    def encode(self, texts: List[str]) -> np.ndarray:
        raise NotImplementedError
    
    def get_dimension(self) -> int:
        raise NotImplementedError


class TfidfEmbedding(EmbeddingModel):
    """
    TF-IDF嵌入模型（轻量级，无需GPU）
    """
    def __init__(self, max_features: int = 1000):
        from sklearn.feature_extraction.text import TfidfVectorizer
        self.vectorizer = TfidfVectorizer(
            max_features=max_features,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.95
        )
        self._is_fitted = False
        self._dimension = max_features
    
    def fit(self, texts: List[str]):
        """拟合词汇表"""
        if texts:
            self.vectorizer.fit(texts)
            self._is_fitted = True
            self._dimension = len(self.vectorizer.vocabulary_)
    
    def encode(self, texts: List[str]) -> np.ndarray:
        if not self._is_fitted:
            raise ValueError("TF-IDF模型未拟合，请先调用fit方法")
        return self.vectorizer.transform(texts).toarray()
    
    def get_dimension(self) -> int:
        return self._dimension
    
    def is_fitted(self) -> bool:
        return self._is_fitted


class SentenceTransformerEmbedding(EmbeddingModel):
    """
    Sentence Transformers嵌入模型（高质量语义嵌入）
    
    推荐模型:
    - 'paraphrase-multilingual-MiniLM-L12-v2': 多语言，384维
    - 'all-MiniLM-L6-v2': 英文，384维，速度快
    - 'text2vec-base-chinese': 中文，768维
    """
    def __init__(self, model_name: str = 'paraphrase-multilingual-MiniLM-L12-v2'):
        self.model_name = model_name
        self._model = None
        self._dimension = None
        self._lock = threading.Lock()
    
    def _load_model(self):
        """懒加载模型"""
        if self._model is None:
            with self._lock:
                if self._model is None:
                    try:
                        from sentence_transformers import SentenceTransformer
                        logger.info(f"加载Sentence Transformer模型: {self.model_name}")
                        self._model = SentenceTransformer(self.model_name)
                        self._dimension = self._model.get_sentence_embedding_dimension()
                        logger.info(f"模型加载成功，维度: {self._dimension}")
                    except ImportError:
                        logger.error("sentence-transformers未安装，请运行: pip install sentence-transformers")
                        raise
                    except Exception as e:
                        logger.error(f"加载模型失败: {e}")
                        raise
    
    def encode(self, texts: List[str]) -> np.ndarray:
        self._load_model()
        return self._model.encode(texts, convert_to_numpy=True)
    
    def get_dimension(self) -> int:
        self._load_model()
        return self._dimension


class VectorStore:
    """
    向量存储抽象基类
    """
    def add(self, ids: List[str], vectors: np.ndarray, metadata: List[Dict] = None):
        raise NotImplementedError
    
    def search(self, query_vector: np.ndarray, top_k: int = 10) -> List[Tuple[str, float]]:
        raise NotImplementedError
    
    def delete(self, ids: List[str]):
        raise NotImplementedError


class InMemoryVectorStore(VectorStore):
    """
    内存向量存储（适合小规模数据）
    使用numpy实现高效的余弦相似度搜索
    """
    def __init__(self):
        self.ids: List[str] = []
        self.vectors: Optional[np.ndarray] = None
        self.metadata: List[Dict] = []
        self._lock = threading.Lock()
    
    def add(self, ids: List[str], vectors: np.ndarray, metadata: List[Dict] = None):
        with self._lock:
            if self.vectors is None:
                self.vectors = vectors
            else:
                self.vectors = np.vstack([self.vectors, vectors])
            
            self.ids.extend(ids)
            if metadata:
                self.metadata.extend(metadata)
            else:
                self.metadata.extend([{} for _ in ids])
    
    def search(self, query_vector: np.ndarray, top_k: int = 10) -> List[Tuple[str, float, Dict]]:
        if self.vectors is None or len(self.ids) == 0:
            return []
        
        with self._lock:
            # 归一化查询向量
            query_norm = query_vector / (np.linalg.norm(query_vector) + 1e-8)
            
            # 归一化存储的向量
            norms = np.linalg.norm(self.vectors, axis=1, keepdims=True) + 1e-8
            normalized_vectors = self.vectors / norms
            
            # 计算余弦相似度
            similarities = np.dot(normalized_vectors, query_norm.T).flatten()
            
            # 获取top_k结果
            top_indices = np.argsort(similarities)[::-1][:top_k]
            
            results = []
            for idx in top_indices:
                results.append((
                    self.ids[idx],
                    float(similarities[idx]),
                    self.metadata[idx]
                ))
            
            return results
    
    def delete(self, ids: List[str]):
        with self._lock:
            indices_to_keep = [i for i, id_ in enumerate(self.ids) if id_ not in ids]
            if indices_to_keep:
                self.vectors = self.vectors[indices_to_keep]
                self.ids = [self.ids[i] for i in indices_to_keep]
                self.metadata = [self.metadata[i] for i in indices_to_keep]
            else:
                self.vectors = None
                self.ids = []
                self.metadata = []
    
    def count(self) -> int:
        return len(self.ids)
    
    def save(self, path: str):
        """保存到文件"""
        data = {
            'ids': self.ids,
            'vectors': self.vectors,
            'metadata': self.metadata
        }
        with open(path, 'wb') as f:
            pickle.dump(data, f)
        logger.info(f"向量存储已保存: {path}, 数量: {len(self.ids)}")
    
    def load(self, path: str) -> bool:
        """从文件加载"""
        try:
            if os.path.exists(path):
                with open(path, 'rb') as f:
                    data = pickle.load(f)
                self.ids = data['ids']
                self.vectors = data['vectors']
                self.metadata = data.get('metadata', [{} for _ in self.ids])
                logger.info(f"向量存储已加载: {path}, 数量: {len(self.ids)}")
                return True
        except Exception as e:
            logger.error(f"加载向量存储失败: {e}")
        return False


class FAISSVectorStore(VectorStore):
    """
    FAISS向量存储（高性能，支持大规模数据）
    """
    def __init__(self, dimension: int):
        import faiss
        self.dimension = dimension
        # 使用L2距离
        self.index = faiss.IndexFlatL2(dimension)
        # 维护ID映射
        self.ids: List[str] = []
        self.metadata: List[Dict] = []
        self._lock = threading.Lock()
    
    def add(self, ids: List[str], vectors: np.ndarray, metadata: List[Dict] = None):
        with self._lock:
            # 确保向量类型为float32
            vectors = vectors.astype(np.float32)
            if vectors.shape[1] != self.dimension:
                raise ValueError(f"向量维度不匹配: {vectors.shape[1]} vs {self.dimension}")
            
            self.index.add(vectors)
            self.ids.extend(ids)
            if metadata:
                self.metadata.extend(metadata)
            else:
                self.metadata.extend([{} for _ in ids])
    
    def search(self, query_vector: np.ndarray, top_k: int = 10) -> List[Tuple[str, float, Dict]]:
        if self.index.ntotal == 0:
            return []
            
        with self._lock:
            # FAISS期望query为2D数组
            if len(query_vector.shape) == 1:
                query_vector = query_vector.reshape(1, -1)
            query_vector = query_vector.astype(np.float32)
            
            distances, indices = self.index.search(query_vector, top_k)
            
            results = []
            for j, i in enumerate(indices[0]):
                if i != -1 and i < len(self.ids):
                    # FAISS返回的是距离(L2)，转换为相似度(1/(1+d))或直接使用距离(越小越好)
                    # 这里为了兼容性，我们假设距离越小由上层逻辑处理，或者我们转换成负距离
                    # 为了保持接口一致性(类似cosine similarity 1.0 best)，我们转换一下?
                    # 简单起见，返回 1 / (1 + distance)
                    score = 1.0 / (1.0 + distances[0][j])
                    results.append((
                        self.ids[i],
                        float(score),
                        self.metadata[i]
                    ))
            
            return results

    def delete(self, ids: List[str]):
        """
        FAISS IndexFlatL2 不支持直接删除。
        通常需要重建索引或使用 IDMap。
        这里我们简化为重建索引 (不适合超大数据，但在 MVP 中可用)
        """
        with self._lock:
            indices_to_keep = [i for i, id_ in enumerate(self.ids) if id_ not in ids]
            
            if len(indices_to_keep) == len(self.ids):
                return
            
            if not indices_to_keep:
                self.index.reset()
                self.ids = []
                self.metadata = []
                return

            # 获取保留的向量
            # FAISS不支持直接获取所有向量，所以我们实际上需要维护原始向量
            # 这使得 FAISS 在这里优势减弱，除非使用 IndexIVF 等支持 remove_ids 的索引
            # 为了简单，我们暂不支持高效删除，抛出警告或者使用维护的 vectors (如果内存允许)
            # 在此实现中，我们暂时无法从 index 恢复向量，除非我们在外部存储了它们。
            # 为了实现删除，我们改为重建：但前提是我们要在某处有原始向量。
            pass 
            # TODO: 实现 FAISS 删除逻辑 (需要 IndexIDMap 或外部存储)
            logger.warning("FAISSVectorStore.delete 尚未完全实现 (IndexFlatL2 不支持直接删除)")

    def count(self) -> int:
        return self.index.ntotal
    
    def save(self, path: str):
        import faiss
        data = {
            'ids': self.ids,
            'metadata': self.metadata,
            'index_file': path + '.faiss'
        }
        with open(path, 'wb') as f:
            pickle.dump(data, f)
        faiss.write_index(self.index, path + '.faiss')
        logger.info(f"FAISS索引已保存: {path}")

    def load(self, path: str) -> bool:
        import faiss
        try:
            if os.path.exists(path) and os.path.exists(path + '.faiss'):
                with open(path, 'rb') as f:
                    data = pickle.load(f)
                self.ids = data['ids']
                self.metadata = data.get('metadata', [])
                self.index = faiss.read_index(path + '.faiss')
                return True
        except Exception as e:
            logger.error(f"加载FAISS索引失败: {e}")
        return False

class EnhancedVectorService:
    """
    增强向量服务
    
    特性:
    - 支持多种嵌入模型（TF-IDF、Sentence Transformers）
    - 支持多种向量存储后端
    - 语义搜索
    - 批量处理
    - 持久化
    
    使用方法:
        service = EnhancedVectorService.get_instance()
        
        # 添加文档
        service.index_documents([
            {'id': '1', 'title': '标题1', 'content': '内容1'},
            {'id': '2', 'title': '标题2', 'content': '内容2'},
        ])
        
        # 语义搜索
        results = service.semantic_search('查询文本', top_k=5)
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        with self._lock:
            if self._initialized:
                return
            
            # 配置
            self.model_type = getattr(settings, 'VECTOR_MODEL_TYPE', 'tfidf')
            self.model_name = getattr(settings, 'VECTOR_MODEL_NAME', 'paraphrase-multilingual-MiniLM-L12-v2')
            self.store_type = getattr(settings, 'VECTOR_STORE_TYPE', 'memory')
            
            # 初始化嵌入模型
            if self.model_type == 'sentence_transformer':
                self.embedding_model = SentenceTransformerEmbedding(self.model_name)
            else:
                self.embedding_model = TfidfEmbedding()
            
            # 初始化向量存储
            if self.store_type == 'faiss':
                dimension = self.embedding_model.get_dimension()
                self.vector_store = FAISSVectorStore(dimension)
            else:
                self.vector_store = InMemoryVectorStore()
            
            # 设置存储路径
            base_dir = Path(getattr(settings, 'BASE_DIR', '.'))
            self.store_path = base_dir / 'data' / 'vector_store.pkl'
            os.makedirs(self.store_path.parent, exist_ok=True)
            
            # 尝试加载已保存的向量
            self.vector_store.load(str(self.store_path))
            
            self._initialized = True
            logger.info(f"增强向量服务初始化完成，模型类型: {self.model_type}")
    
    @classmethod
    def get_instance(cls) -> 'EnhancedVectorService':
        """获取服务实例"""
        return cls()
    
    def index_documents(self, documents: List[Dict[str, Any]], batch_size: int = 32):
        """
        索引文档
        
        Args:
            documents: 文档列表，每个文档包含 id, title, content
            batch_size: 批处理大小
        """
        if not documents:
            return
        
        logger.info(f"开始索引 {len(documents)} 个文档")
        
        # 如果使用TF-IDF且未拟合，先拟合
        if isinstance(self.embedding_model, TfidfEmbedding) and not self.embedding_model.is_fitted():
            texts = [self._combine_text(doc) for doc in documents]
            self.embedding_model.fit(texts)
        
        # 批量处理
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            
            ids = [doc['id'] for doc in batch]
            texts = [self._combine_text(doc) for doc in batch]
            metadata = [{'title': doc.get('title', ''), 'type': doc.get('type', 'note')} for doc in batch]
            
            try:
                vectors = self.embedding_model.encode(texts)
                self.vector_store.add(ids, vectors, metadata)
            except Exception as e:
                logger.error(f"索引文档批次失败: {e}")
        
        # 保存
        self.vector_store.save(str(self.store_path))
        logger.info(f"索引完成，总数: {self.vector_store.count()}")
    
    def semantic_search(
        self, 
        query: str, 
        top_k: int = 10,
        threshold: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        语义搜索
        
        Args:
            query: 查询文本
            top_k: 返回结果数量
            threshold: 相似度阈值
            
        Returns:
            搜索结果列表
        """
        if not query.strip():
            return []
        
        try:
            # 编码查询
            query_vector = self.embedding_model.encode([query])[0]
            
            # 搜索
            results = self.vector_store.search(query_vector, top_k=top_k)
            
            # 过滤和格式化结果
            formatted_results = []
            for id_, score, metadata in results:
                if score >= threshold:
                    formatted_results.append({
                        'id': id_,
                        'score': round(score, 4),
                        'title': metadata.get('title', ''),
                        'type': metadata.get('type', 'note'),
                    })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"语义搜索失败: {e}")
            return []
    
    def hybrid_search(
        self,
        query: str,
        keyword_results: List[Dict],
        top_k: int = 10,
        keyword_weight: float = 0.6,
        vector_weight: float = 0.4
    ) -> List[Dict[str, Any]]:
        """
        混合搜索（关键词 + 语义）
        
        Args:
            query: 查询文本
            keyword_results: 关键词搜索结果
            top_k: 返回结果数量
            keyword_weight: 关键词权重
            vector_weight: 向量权重
            
        Returns:
            融合排序后的结果
        """
        # 获取语义搜索结果
        vector_results = self.semantic_search(query, top_k=top_k * 2)
        
        # 创建得分映射
        scores = {}
        
        # 处理关键词结果
        max_keyword_score = max([r.get('score', 0) for r in keyword_results], default=1)
        for rank, result in enumerate(keyword_results):
            id_ = result.get('id') or result.get('object_id')
            if id_:
                normalized_score = result.get('score', 0) / max_keyword_score if max_keyword_score > 0 else 0
                scores[id_] = {
                    'keyword_score': normalized_score,
                    'keyword_rank': rank,
                    'vector_score': 0,
                    'data': result
                }
        
        # 处理向量结果
        for rank, result in enumerate(vector_results):
            id_ = result['id']
            if id_ in scores:
                scores[id_]['vector_score'] = result['score']
            else:
                scores[id_] = {
                    'keyword_score': 0,
                    'keyword_rank': len(keyword_results),
                    'vector_score': result['score'],
                    'data': result
                }
        
        # 计算融合得分
        final_results = []
        for id_, data in scores.items():
            fusion_score = (
                keyword_weight * data['keyword_score'] + 
                vector_weight * data['vector_score']
            )
            result = data['data'].copy()
            result['fusion_score'] = round(fusion_score, 4)
            result['keyword_score'] = round(data['keyword_score'], 4)
            result['vector_score'] = round(data['vector_score'], 4)
            final_results.append(result)
        
        # 按融合得分排序
        final_results.sort(key=lambda x: x['fusion_score'], reverse=True)
        
        return final_results[:top_k]
    
    def delete_documents(self, ids: List[str]):
        """删除文档"""
        self.vector_store.delete(ids)
        self.vector_store.save(str(self.store_path))
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            'total_documents': self.vector_store.count(),
            'model_type': self.model_type,
            'embedding_dimension': self.embedding_model.get_dimension() if hasattr(self.embedding_model, 'get_dimension') else None,
        }
    
    def _combine_text(self, doc: Dict) -> str:
        """组合文档文本"""
        title = doc.get('title', '')
        content = doc.get('content', '')
        # 标题权重更高，重复两次
        return f"{title} {title} {content}".strip()


    def generate_vector(self, text: str) -> Optional[bytes]:
        """
        生成向量 (兼容旧API)
        Returns: pickle sequences bytes
        """
        if not text:
            return None
        try:
            vector = self.embedding_model.encode([text])[0]
            # 序列化以兼容旧的数据结构 (mongoDB BinaryField)
            # 但 EnhancedVectorService 内部使用 numpy array
            return pickle.dumps(vector)
        except Exception as e:
            logger.error(f"生成向量失败: {e}")
            return None

    def calculate_similarity(self, vector1_bytes, vector2_bytes) -> float:
        """
        计算相似度 (兼容旧API)
        Args:
            vector1_bytes: pickled bytes or numpy array
            vector2_bytes: pickled bytes or numpy array
        """
        try:
            # 处理可能的输入类型
            v1 = pickle.loads(vector1_bytes) if isinstance(vector1_bytes, (bytes, bytearray)) else vector1_bytes
            v2 = pickle.loads(vector2_bytes) if isinstance(vector2_bytes, (bytes, bytearray)) else vector2_bytes
            
            # 归一化
            norm1 = np.linalg.norm(v1)
            norm2 = np.linalg.norm(v2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
                
            return float(np.dot(v1, v2) / (norm1 * norm2))
        except Exception as e:
            logger.error(f"计算相似度失败: {e}")
            return 0.0

# 便捷函数
def get_vector_service() -> EnhancedVectorService:
    """获取向量服务实例"""
    return EnhancedVectorService.get_instance()
