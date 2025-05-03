"""
自动分类服务
提供基于内容的自动分类、关键词提取和内容整合功能
"""

import logging
import jieba
import jieba.analyse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from collections import Counter
from django.utils import timezone
import uuid

from notes.mongodb_models import Note, Category, Tag
from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge
from ai_assistant.services import TextProcessingService

logger = logging.getLogger(__name__)

class AutoClassificationService:
    """
    自动分类服务
    提供基于内容的自动分类、关键词提取和内容整合功能
    """
    
    def __init__(self):
        """初始化服务"""
        self.text_processing_service = TextProcessingService()
        
        # 加载停用词
        self.stopwords = set()
        try:
            with open('knowledge_graph/data/stopwords.txt', 'r', encoding='utf-8') as f:
                for line in f:
                    self.stopwords.add(line.strip())
        except Exception as e:
            logger.warning(f"加载停用词失败: {e}")
    
    def classify_note(self, note, categories=None, threshold=0.3):
        """
        自动分类笔记
        
        Args:
            note: 笔记对象
            categories: 可选的分类列表，如果为None则使用用户的所有分类
            threshold: 分类阈值，相似度高于此值才会分类
            
        Returns:
            dict: 分类结果，包含推荐的分类及其相似度
        """
        try:
            # 获取笔记内容
            title = note.title
            content = note.content
            
            # 如果没有提供分类列表，获取用户的所有分类
            if categories is None:
                categories = Category.objects.filter(user=note.user, is_deleted=False)
            
            # 如果没有分类，返回空结果
            if not categories:
                return {'categories': []}
            
            # 提取笔记的特征
            note_text = f"{title} {title} {content}"  # 标题权重加倍
            note_features = self._extract_text_features(note_text)
            
            # 计算与每个分类的相似度
            similarities = []
            for category in categories:
                # 获取分类下的笔记
                category_notes = Note.objects.filter(
                    user=note.user,
                    category=category,
                    is_deleted=False
                )
                
                # 如果分类下没有笔记，使用分类名称和描述
                if not category_notes:
                    category_text = f"{category.name} {category.description or ''}"
                    category_features = self._extract_text_features(category_text)
                else:
                    # 合并分类下所有笔记的内容
                    category_texts = []
                    for cat_note in category_notes:
                        category_texts.append(f"{cat_note.title} {cat_note.content}")
                    
                    category_text = " ".join(category_texts)
                    category_features = self._extract_text_features(category_text)
                
                # 计算相似度
                similarity = self._calculate_similarity(note_features, category_features)
                
                if similarity > threshold:
                    similarities.append({
                        'category': category,
                        'similarity': similarity
                    })
            
            # 按相似度排序
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            
            # 构建结果
            result = {
                'categories': [
                    {
                        'id': str(item['category'].id),
                        'name': item['category'].name,
                        'similarity': item['similarity']
                    } for item in similarities
                ]
            }
            
            return result
        except Exception as e:
            logger.error(f"自动分类笔记失败: {e}")
            return {'categories': [], 'error': str(e)}
    
    def extract_keywords(self, text, title=None, count=10):
        """
        提取关键词
        
        Args:
            text: 文本内容
            title: 标题（可选）
            count: 关键词数量
            
        Returns:
            list: 关键词列表
        """
        try:
            # 如果有标题，将标题权重加倍
            if title:
                text = f"{title} {title} {text}"
            
            # 使用jieba提取关键词
            keywords = jieba.analyse.extract_tags(text, topK=count, withWeight=True)
            
            # 使用TextRank算法提取关键词
            textrank_keywords = jieba.analyse.textrank(text, topK=count, withWeight=True)
            
            # 合并两种算法的结果
            keyword_dict = {}
            for word, weight in keywords:
                keyword_dict[word] = weight
            
            for word, weight in textrank_keywords:
                if word in keyword_dict:
                    keyword_dict[word] = (keyword_dict[word] + weight) / 2
                else:
                    keyword_dict[word] = weight
            
            # 按权重排序
            sorted_keywords = sorted(keyword_dict.items(), key=lambda x: x[1], reverse=True)
            
            # 返回前count个关键词
            return [word for word, _ in sorted_keywords[:count]]
        except Exception as e:
            logger.error(f"提取关键词失败: {e}")
            return []
    
    def extract_main_topic(self, text, title=None):
        """
        提取主题
        
        Args:
            text: 文本内容
            title: 标题（可选）
            
        Returns:
            str: 主题
        """
        try:
            # 如果文本太短，直接返回标题或文本前20个字符
            if len(text) < 100:
                return title or text[:20]
            
            # 使用AI服务提取主题
            try:
                result = self.text_processing_service.process_text(
                    text=text[:1000],  # 限制长度，避免请求过大
                    task='extract_topic'
                )
                return result.get('result', '')
            except Exception as e:
                logger.warning(f"使用AI服务提取主题失败: {e}")
                
                # 回退到关键词提取
                keywords = self.extract_keywords(text, title, 3)
                return ' '.join(keywords)
        except Exception as e:
            logger.error(f"提取主题失败: {e}")
            return title or ''
    
    def suggest_tags(self, note, existing_tags=None, count=10):
        """
        推荐标签
        
        Args:
            note: 笔记对象
            existing_tags: 已有的标签列表
            count: 推荐标签数量
            
        Returns:
            list: 推荐的标签列表
        """
        try:
            # 获取笔记内容
            title = note.title
            content = note.content
            
            # 提取关键词作为标签
            keywords = self.extract_keywords(content, title, count * 2)
            
            # 过滤已有的标签
            if existing_tags:
                existing_tag_names = [tag.name for tag in existing_tags]
                keywords = [kw for kw in keywords if kw not in existing_tag_names]
            
            # 获取用户常用的标签
            user_tags = Tag.objects.filter(user=note.user).order_by('-usage_count')[:50]
            user_tag_names = [tag.name for tag in user_tags]
            
            # 计算用户标签与关键词的相似度
            similar_tags = []
            for tag_name in user_tag_names:
                for keyword in keywords:
                    similarity = self._calculate_string_similarity(tag_name, keyword)
                    if similarity > 0.7:  # 相似度阈值
                        similar_tags.append((tag_name, similarity))
            
            # 按相似度排序
            similar_tags.sort(key=lambda x: x[1], reverse=True)
            
            # 合并结果
            result_tags = [tag for tag, _ in similar_tags]
            
            # 添加新的关键词标签
            for keyword in keywords:
                if keyword not in result_tags and len(result_tags) < count:
                    result_tags.append(keyword)
            
            return result_tags[:count]
        except Exception as e:
            logger.error(f"推荐标签失败: {e}")
            return []
    
    def find_similar_notes(self, note, threshold=0.3, limit=10):
        """
        查找相似笔记
        
        Args:
            note: 笔记对象
            threshold: 相似度阈值
            limit: 返回结果数量限制
            
        Returns:
            list: 相似笔记列表
        """
        try:
            # 获取笔记内容
            title = note.title
            content = note.content
            note_text = f"{title} {title} {content}"  # 标题权重加倍
            
            # 提取笔记的特征
            note_features = self._extract_text_features(note_text)
            
            # 获取用户的所有其他笔记
            other_notes = Note.objects.filter(
                user=note.user,
                is_deleted=False
            ).exclude(id=note.id)
            
            # 计算相似度
            similarities = []
            for other_note in other_notes:
                other_title = other_note.title
                other_content = other_note.content
                other_text = f"{other_title} {other_title} {other_content}"
                
                other_features = self._extract_text_features(other_text)
                similarity = self._calculate_similarity(note_features, other_features)
                
                if similarity > threshold:
                    similarities.append({
                        'note': other_note,
                        'similarity': similarity
                    })
            
            # 按相似度排序
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            
            # 返回前limit个结果
            return similarities[:limit]
        except Exception as e:
            logger.error(f"查找相似笔记失败: {e}")
            return []
    
    def integrate_with_existing_notes(self, note, similar_notes):
        """
        将新笔记整合到现有笔记体系中
        
        Args:
            note: 新笔记
            similar_notes: 相似笔记列表
            
        Returns:
            dict: 整合建议
        """
        try:
            # 如果没有相似笔记，返回空结果
            if not similar_notes:
                return {'suggestions': []}
            
            # 分析相似笔记的分类和标签
            categories = Counter()
            tags = Counter()
            
            for item in similar_notes:
                similar_note = item['note']
                similarity = item['similarity']
                
                # 统计分类
                if similar_note.category:
                    categories[similar_note.category.id] += similarity
                
                # 统计标签
                for tag in similar_note.tags:
                    tags[tag.id] += similarity
            
            # 获取最常见的分类和标签
            top_categories = categories.most_common(3)
            top_tags = tags.most_common(5)
            
            # 构建整合建议
            suggestions = []
            
            # 分类建议
            if top_categories:
                category_ids = [cat_id for cat_id, _ in top_categories]
                category_objects = Category.objects.filter(id__in=category_ids)
                
                for category in category_objects:
                    suggestions.append({
                        'type': 'category',
                        'id': str(category.id),
                        'name': category.name,
                        'confidence': categories[category.id] / sum(categories.values())
                    })
            
            # 标签建议
            if top_tags:
                tag_ids = [tag_id for tag_id, _ in top_tags]
                tag_objects = Tag.objects.filter(id__in=tag_ids)
                
                for tag in tag_objects:
                    suggestions.append({
                        'type': 'tag',
                        'id': str(tag.id),
                        'name': tag.name,
                        'confidence': tags[tag.id] / sum(tags.values())
                    })
            
            # 相关笔记建议
            for item in similar_notes[:3]:  # 最多3个相关笔记建议
                similar_note = item['note']
                suggestions.append({
                    'type': 'related_note',
                    'id': str(similar_note.id),
                    'title': similar_note.title,
                    'confidence': item['similarity']
                })
            
            return {'suggestions': suggestions}
        except Exception as e:
            logger.error(f"整合笔记失败: {e}")
            return {'suggestions': [], 'error': str(e)}
    
    def _extract_text_features(self, text):
        """
        提取文本特征
        
        Args:
            text: 文本内容
            
        Returns:
            dict: 特征字典
        """
        # 分词
        words = jieba.cut(text)
        
        # 过滤停用词
        filtered_words = [word for word in words if word not in self.stopwords and len(word) > 1]
        
        # 统计词频
        word_counts = Counter(filtered_words)
        
        # 提取关键词及其权重
        keywords = jieba.analyse.extract_tags(text, topK=20, withWeight=True)
        keyword_weights = {word: weight for word, weight in keywords}
        
        # 合并特征
        features = {
            'word_counts': dict(word_counts),
            'keyword_weights': keyword_weights,
            'text_length': len(text)
        }
        
        return features
    
    def _calculate_similarity(self, features1, features2):
        """
        计算两个特征的相似度
        
        Args:
            features1: 特征1
            features2: 特征2
            
        Returns:
            float: 相似度
        """
        # 合并词汇表
        all_words = set(features1['word_counts'].keys()) | set(features2['word_counts'].keys())
        
        # 创建词频向量
        vec1 = [features1['word_counts'].get(word, 0) for word in all_words]
        vec2 = [features2['word_counts'].get(word, 0) for word in all_words]
        
        # 计算余弦相似度
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = sum(a * a for a in vec1) ** 0.5
        magnitude2 = sum(b * b for b in vec2) ** 0.5
        
        if magnitude1 * magnitude2 == 0:
            return 0
        
        cosine_similarity = dot_product / (magnitude1 * magnitude2)
        
        # 计算关键词相似度
        keyword_similarity = 0
        common_keywords = set(features1['keyword_weights'].keys()) & set(features2['keyword_weights'].keys())
        
        if common_keywords:
            keyword_similarity = sum(
                features1['keyword_weights'][word] * features2['keyword_weights'][word]
                for word in common_keywords
            ) / len(common_keywords)
        
        # 综合相似度
        similarity = 0.7 * cosine_similarity + 0.3 * keyword_similarity
        
        return similarity
    
    def _calculate_string_similarity(self, str1, str2):
        """
        计算两个字符串的相似度
        
        Args:
            str1: 字符串1
            str2: 字符串2
            
        Returns:
            float: 相似度
        """
        # 如果字符串相同，直接返回1
        if str1 == str2:
            return 1.0
        
        # 如果一个字符串包含另一个，返回较高相似度
        if str1 in str2 or str2 in str1:
            return 0.8
        
        # 计算编辑距离
        len1, len2 = len(str1), len(str2)
        dp = [[0] * (len2 + 1) for _ in range(len1 + 1)]
        
        for i in range(len1 + 1):
            dp[i][0] = i
        
        for j in range(len2 + 1):
            dp[0][j] = j
        
        for i in range(1, len1 + 1):
            for j in range(1, len2 + 1):
                if str1[i-1] == str2[j-1]:
                    dp[i][j] = dp[i-1][j-1]
                else:
                    dp[i][j] = min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]) + 1
        
        # 计算相似度
        max_len = max(len1, len2)
        if max_len == 0:
            return 0
        
        similarity = 1 - dp[len1][len2] / max_len
        
        return similarity
