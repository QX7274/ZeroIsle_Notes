"""
向量服务
"""

import logging
import numpy as np
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger('backend')

class VectorService:
    """
    向量服务类
    处理文本向量化和相似度计算
    """
    
    def __init__(self):
        """初始化"""
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        self.is_fitted = False
    
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
            text = title
            if content:
                text = title + " " + title + " " + content
            
            # 如果向量化器未拟合，先拟合
            if not self.is_fitted:
                self.vectorizer.fit([text])
                self.is_fitted = True
            
            # 转换为向量
            vector = self.vectorizer.transform([text])
            
            # 序列化向量
            serialized_vector = pickle.dumps(vector)
            
            return serialized_vector
        except Exception as e:
            logger.error(f"生成向量失败: {e}")
            return None
    
    def calculate_similarity(self, vector1, vector2):
        """
        计算相似度
        
        Args:
            vector1: 向量1
            vector2: 向量2
            
        Returns:
            float: 相似度
        """
        try:
            # 反序列化向量
            v1 = pickle.loads(vector1)
            v2 = pickle.loads(vector2)
            
            # 计算余弦相似度
            similarity = cosine_similarity(v1, v2)[0][0]
            
            return float(similarity)
        except Exception as e:
            logger.error(f"计算相似度失败: {e}")
            return 0.0
