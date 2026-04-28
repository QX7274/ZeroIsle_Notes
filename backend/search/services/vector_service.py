"""
向量服务
使用单例模式确保向量空间一致性
"""

import logging
import numpy as np
import pickle
import os
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from django.conf import settings

logger = logging.getLogger('backend')

class VectorService:
    """
    向量服务类
    处理文本向量化和相似度计算
    使用单例模式和持久化词表确保向量空间一致性
    """

    _instance = None
    _vectorizer = None
    _is_fitted = False
    _vocabulary_path = None

    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super(VectorService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """初始化向量器"""
        # 设置词表存储路径
        if hasattr(settings, 'VECTOR_VOCABULARY_PATH'):
            self._vocabulary_path = settings.VECTOR_VOCABULARY_PATH
        else:
            # 默认路径
            base_dir = Path(settings.BASE_DIR) if hasattr(settings, 'BASE_DIR') else Path('.')
            self._vocabulary_path = base_dir / 'data' / 'vector_vocabulary.pkl'

        # 确保目录存在
        os.makedirs(os.path.dirname(self._vocabulary_path), exist_ok=True)

        # 创建向量器
        self._vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=1,  # 最小文档频率
            max_df=0.95  # 最大文档频率
        )

        # 尝试加载已保存的词表
        self._load_vocabulary()

    def _load_vocabulary(self):
        """加载已保存的词表"""
        try:
            if os.path.exists(self._vocabulary_path):
                with open(self._vocabulary_path, 'rb') as f:
                    vocabulary_data = pickle.load(f)
                    self._vectorizer.vocabulary_ = vocabulary_data['vocabulary']
                    self._vectorizer.idf_ = vocabulary_data['idf']
                    self._is_fitted = True
                    logger.info(f"成功加载词表，词汇量: {len(self._vectorizer.vocabulary_)}")
            else:
                logger.info("词表文件不存在，将在首次使用时创建")
        except Exception as e:
            logger.error(f"加载词表失败: {e}")
            self._is_fitted = False

    def _save_vocabulary(self):
        """保存词表"""
        try:
            if self._is_fitted and hasattr(self._vectorizer, 'vocabulary_'):
                vocabulary_data = {
                    'vocabulary': self._vectorizer.vocabulary_,
                    'idf': self._vectorizer.idf_
                }
                with open(self._vocabulary_path, 'wb') as f:
                    pickle.dump(vocabulary_data, f)
                logger.info(f"成功保存词表到: {self._vocabulary_path}")
        except Exception as e:
            logger.error(f"保存词表失败: {e}")
    
    def generate_vector(self, title, content=None):
        """
        生成向量

        Args:
            title: 标题
            content: 内容

        Returns:
            bytes: 序列化的向量
        """
        try:
            # 组合文本，标题权重更高
            text = title if title else ""
            if content:
                text = title + " " + title + " " + content

            # 如果文本为空，返回None
            if not text.strip():
                logger.warning("文本为空，无法生成向量")
                return None

            # 如果向量化器未拟合，返回None，强制要求先构建词汇表
            if not self._is_fitted:
                logger.error("向量器未拟合，无法生成向量。请先运行一个完整的语料库来构建词汇表。")
                return None

            # 转换为向量
            vector = self._vectorizer.transform([text])

            # 序列化向量
            serialized_vector = pickle.dumps(vector)

            return serialized_vector
        except Exception as e:
            logger.error(f"生成向量失败: {e}")
            return None

    def fit_corpus(self, texts):
        """
        使用语料库拟合向量器

        Args:
            texts: 文本列表

        Returns:
            bool: 是否成功
        """
        try:
            if not texts:
                logger.warning("语料库为空")
                return False

            logger.info(f"开始拟合向量器，语料库大小: {len(texts)}")
            self._vectorizer.fit(texts)
            self._is_fitted = True
            self._save_vocabulary()
            logger.info(f"向量器拟合完成，词汇量: {len(self._vectorizer.vocabulary_)}")
            return True
        except Exception as e:
            logger.error(f"拟合向量器失败: {e}")
            return False
    
    def calculate_similarity(self, vector1, vector2):
        """
        计算相似度

        Args:
            vector1: 向量1（序列化的稀疏矩阵）
            vector2: 向量2（序列化的稀疏矩阵）

        Returns:
            float: 相似度（0-1之间）
        """
        try:
            if not vector1 or not vector2:
                return 0.0

            # 反序列化向量
            v1 = pickle.loads(vector1)
            v2 = pickle.loads(vector2)

            # 检查向量维度是否一致
            if v1.shape[1] != v2.shape[1]:
                logger.warning(f"向量维度不一致: {v1.shape[1]} vs {v2.shape[1]}")
                return 0.0

            # 计算余弦相似度
            similarity = cosine_similarity(v1, v2)[0][0]

            return float(similarity)
        except Exception as e:
            logger.error(f"计算相似度失败: {e}")
            return 0.0

    def is_fitted(self):
        """检查向量器是否已拟合"""
        return self._is_fitted

    def get_vocabulary_size(self):
        """获取词汇表大小"""
        if self._is_fitted and hasattr(self._vectorizer, 'vocabulary_'):
            return len(self._vectorizer.vocabulary_)
        return 0
