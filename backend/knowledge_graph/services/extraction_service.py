"""
知识提取服务
提供实体识别、关系抽取、概念提取等知识提取功能
"""

import logging
import re
from typing import List, Dict, Tuple, Set
from pathlib import Path
import jieba
import jieba.posseg as pseg
from collections import defaultdict, Counter

logger = logging.getLogger(__name__)

class ExtractionService:
    """
    知识提取服务
    从文本中提取实体、关系、概念等知识元素
    """

    def __init__(self):
        """初始化服务"""
        # 加载停用词
        self.stopwords = self._load_stopwords()

        # 实体类型映射
        self.entity_types = {
            'nr': 'PERSON',       # 人名
            'ns': 'LOCATION',     # 地名
            'nt': 'ORGANIZATION', # 组织机构名
            'nz': 'OTHER',        # 其他专名
            'n': 'NOUN',          # 名词
        }

        # 组织机构后缀（用于纠正规则）
        self.organization_suffixes = [
            '公司', '集团', '大学', '学院', '研究院', '研究所', '银行', '医院', '中心', '委员会',
            '局', '厂', '协会', '实验室', '有限', '股份', '科技'
        ]

        # 已知组织机构词典（轻量规则）
        self.organization_lexicon = {'华为', '阿里巴巴', '腾讯', '百度', '字节跳动', '清华大学', '北京大学'}


        # 关系模式（基于规则）
        self.relation_patterns = [
            (r'(.+?)是(.+?)的(.+)', 'is_a'),
            (r'(.+?)属于(.+)', 'belongs_to'),
            (r'(.+?)包含(.+)', 'contains'),
            (r'(.+?)导致(.+)', 'causes'),
            (r'(.+?)影响(.+)', 'affects'),
            (r'(.+?)位于(.+)', 'located_in'),
            (r'(.+?)由(.+?)组成', 'composed_of'),
            (r'(.+?)用于(.+)', 'used_for'),
        ]

        # 领域词增强，减少“深度学习”等被错误切分
        for domain_word in ['深度学习', '机器学习', '人工智能', '计算机科学', '知识图谱']:
            jieba.add_word(domain_word)


    def _load_stopwords(self) -> Set[str]:
        """加载停用词"""
        stopwords = set()
        try:
            # 尝试从文件加载（相对当前文件路径）
            stopword_file = Path(__file__).resolve().parent.parent / 'data' / 'stopwords.txt'
            with open(stopword_file, 'r', encoding='utf-8') as f:
                for line in f:
                    stopwords.add(line.strip())
        except FileNotFoundError:
            # 使用默认停用词
            stopwords = {
                '的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
                '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
                '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '个'
            }
            # 补充关键领域词，避免被停用词或词典问题影响
            stopwords -= {'深度学习', '机器学习', '人工智能', '计算机科学', '知识图谱'}
            logger.warning("停用词文件未找到，使用默认停用词")

        return stopwords

    def extract_entities(self, text: str) -> List[Dict[str, str]]:
        """
        提取命名实体

        Args:
            text: 输入文本

        Returns:
            实体列表，每个实体包含 name, type, pos 等信息
        """
        if not isinstance(text, str):
            raise TypeError("text must be a string")

        entities = []

        # 使用jieba进行词性标注
        words = pseg.cut(text)

        for word, flag in words:
            # 跳过停用词和短词
            if word in self.stopwords or len(word) < 2:
                continue

            # 根据词性识别实体类型
            entity_type = self.entity_types.get(flag[:2], None)

            if entity_type:
                entities.append({
                    'name': word,
                    'type': entity_type,
                    'pos': flag
                })

        # 基于关系抽取结果补充实体，减少“深度学习”等遗漏
        for rel in self.extract_relations(text):
            for candidate in (rel.get('subject', ''), rel.get('object', '')):
                if candidate and len(candidate) >= 2 and candidate not in self.stopwords:
                    entities.append({
                        'name': candidate,
                        'type': 'NOUN',
                        'pos': 'kg_rule'
                    })

        # 去重，保留第一次出现的实体
        seen = set()
        unique_entities = []
        for entity in entities:
            if entity['name'] not in seen:
                seen.add(entity['name'])
                unique_entities.append(entity)

        # 实体类型纠正：组织机构后缀优先
        for entity in unique_entities:
            if entity['name'] in self.organization_lexicon:
                entity['type'] = 'ORGANIZATION'
            elif any(entity['name'].endswith(suffix) for suffix in self.organization_suffixes):
                entity['type'] = 'ORGANIZATION'

        return unique_entities

        return unique_entities

    def extract_relations(self, text: str) -> List[Dict[str, str]]:
        """
        提取实体间的关系

        Args:
            text: 输入文本

        Returns:
            关系列表，每个关系包含 subject, relation, object 等信息
        """
        if not isinstance(text, str):
            raise TypeError("text must be a string")

        relations = []

        # 将文本按句子分割
        # 句子与分句切分：避免关系跨越逗号/分号造成客体污染
        sentences = re.split(r'[。！？\n；;，,]', text)

        for sentence in sentences:
            if not sentence.strip():
                continue

            # 使用规则匹配关系
            for pattern, relation_type in self.relation_patterns:
                matches = re.finditer(pattern, sentence)
                for match in matches:
                    groups = match.groups()
                    if len(groups) >= 2:
                        relations.append({
                            'subject': groups[0].strip(),
                            'relation': relation_type,
                            'object': groups[-1].strip(),
                            'context': sentence.strip()
                        })

        return relations

    def extract_concepts(self, text: str, top_k: int = 20) -> List[Dict[str, any]]:
        """
        提取核心概念和术语

        Args:
            text: 输入文本
            top_k: 返回前k个概念

        Returns:
            概念列表，包含概念名称和重要性分数
        """
        if not isinstance(text, str):
            raise TypeError("text must be a string")

        # 分词
        words = jieba.cut(text)

        # 统计词频
        word_freq = Counter()
        for word in words:
            # 过滤停用词和短词
            if word not in self.stopwords and len(word) >= 2:
                word_freq[word] += 1

        # 获取词性标注
        words_with_pos = pseg.cut(text)

        # 计算概念分数（考虑词频和词性）
        concept_scores = {}
        for word, flag in words_with_pos:
            if word not in self.stopwords and len(word) >= 2:
                # 名词和专有名词权重更高
                weight = 2.0 if flag.startswith('n') else 1.0
                score = word_freq[word] * weight

                if word in concept_scores:
                    concept_scores[word] = max(concept_scores[word], score)
                else:
                    concept_scores[word] = score

        # 排序并取前k个
        sorted_concepts = sorted(
            concept_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )[:top_k]

        # 格式化结果
        concepts = [
            {
                'name': concept,
                'score': score,
                'frequency': word_freq[concept]
            }
            for concept, score in sorted_concepts
        ]

        return concepts

    def extract_triples(self, text: str) -> List[Tuple[str, str, str]]:
        """
        提取三元组 (主体, 关系, 客体)

        Args:
            text: 输入文本

        Returns:
            三元组列表
        """
        triples = []

        # 提取实体
        entities = self.extract_entities(text)
        entity_names = {e['name'] for e in entities}

        # 提取关系
        relations = self.extract_relations(text)

        # 构建三元组
        for relation in relations:
            subject = relation['subject']
            obj = relation['object']
            rel = relation['relation']

            # 检查主体和客体是否为已识别的实体；若不是，优先匹配已识别实体子串
            if subject not in entity_names:
                candidates = [name for name in entity_names if name in subject]
                if candidates:
                    subject = max(candidates, key=len)
                else:
                    subject_words = jieba.lcut(subject)
                    subject = max(subject_words, key=len) if subject_words else subject

            if obj not in entity_names:
                candidates = [name for name in entity_names if name in obj]
                if candidates:
                    obj = max(candidates, key=len)
                else:
                    obj_words = jieba.lcut(obj)
                    obj = max(obj_words, key=len) if obj_words else obj

            triples.append((subject, rel, obj))

        return triples

    def extract_keywords(self, text: str, top_k: int = 10) -> List[Dict[str, any]]:
        """
        提取关键词（使用TF-IDF和TextRank结合）

        Args:
            text: 输入文本
            top_k: 返回前k个关键词

        Returns:
            关键词列表
        """
        if not isinstance(text, str):
            raise TypeError("text must be a string")

        import jieba.analyse

        # 使用TF-IDF提取关键词
        tfidf_keywords = jieba.analyse.extract_tags(
            text,
            topK=top_k,
            withWeight=True
        )

        # 使用TextRank提取关键词
        textrank_keywords = jieba.analyse.textrank(
            text,
            topK=top_k,
            withWeight=True
        )

        # 合并两种方法的结果
        keyword_scores = defaultdict(float)

        for word, weight in tfidf_keywords:
            keyword_scores[word] += weight

        for word, weight in textrank_keywords:
            keyword_scores[word] += weight

        # 归一化分数
        max_score = max(keyword_scores.values()) if keyword_scores else 1.0

        keywords = [
            {
                'word': word,
                'score': score / max_score,
                'method': 'combined'
            }
            for word, score in sorted(
                keyword_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )[:top_k]
        ]

        return keywords

    def extract_from_note(self, note) -> Dict[str, any]:
        """
        从笔记中提取知识

        Args:
            note: 笔记对象

        Returns:
            提取的知识字典
        """
        # 合并标题和内容
        text = f"{note.title}\n{note.content}"

        # 提取各种知识元素
        result = {
            'note_id': str(note.id),
            'note_title': note.title,
            'entities': self.extract_entities(text),
            'relations': self.extract_relations(text),
            'concepts': self.extract_concepts(text, top_k=15),
            'keywords': self.extract_keywords(text, top_k=10),
            'triples': self.extract_triples(text),
        }

        return result

    def batch_extract(self, notes: List) -> List[Dict[str, any]]:
        """
        批量提取笔记的知识

        Args:
            notes: 笔记列表

        Returns:
            提取结果列表
        """
        results = []

        for note in notes:
            try:
                result = self.extract_from_note(note)
                results.append(result)
            except Exception as e:
                logger.error(f"提取笔记 {note.id} 的知识失败: {str(e)}")
                continue

        return results

    def merge_entities(self, entities_list: List[List[Dict]]) -> List[Dict[str, any]]:
        """
        合并多个实体列表，统计频率

        Args:
            entities_list: 实体列表的列表

        Returns:
            合并后的实体列表，包含频率信息
        """
        entity_freq = defaultdict(lambda: {'count': 0, 'types': set()})

        for entities in entities_list:
            for entity in entities:
                name = entity['name']
                entity_type = entity['type']

                entity_freq[name]['count'] += 1
                entity_freq[name]['types'].add(entity_type)

        # 格式化结果
        merged_entities = [
            {
                'name': name,
                'count': info['count'],
                'types': list(info['types']),
                'primary_type': sorted(info['types'])[0] if info['types'] else 'OTHER'
            }
            for name, info in sorted(
                entity_freq.items(),
                key=lambda x: x[1]['count'],
                reverse=True
            )
        ]

        return merged_entities




