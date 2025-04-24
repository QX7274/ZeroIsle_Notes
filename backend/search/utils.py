"""搜索工具函数"""

import os
import tempfile
import speech_recognition as sr
from PIL import Image
import pytesseract
import jieba
import jieba.analyse
from django.db.models import Q
from django.conf import settings
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from notes.models import Note, Tag
from knowledge_graph.models import KnowledgeNode, KnowledgeEdge


def search_notes(user, query, limit=20):
    """
    搜索笔记
    """
    # 分词
    keywords = jieba.cut_for_search(query)
    keywords = [k for k in keywords if len(k) > 1]
    
    # 构建查询
    q_objects = Q()
    for keyword in keywords:
        q_objects |= Q(title__icontains=keyword)
        q_objects |= Q(content__icontains=keyword)
        q_objects |= Q(tags__name__icontains=keyword)
    
    # 执行查询
    notes = Note.objects.filter(q_objects, user=user).distinct()
    
    # 计算相关度
    results = []
    for note in notes[:limit]:
        # 提取预览内容
        preview = extract_preview(note.content, query)
        
        # 计算相关度分数
        relevance = calculate_relevance(query, note.title, note.content)
        
        # 获取标签
        tags = [tag.name for tag in note.tags.all()]
        
        results.append({
            'id': note.id,
            'title': note.title,
            'preview': preview,
            'type': 'note',
            'relevance': relevance,
            'tags': tags,
            'updatedAt': note.updated_at.isoformat(),
            'createdAt': note.created_at.isoformat(),
        })
    
    return results


def search_tags(user, query, limit=20):
    """
    搜索标签
    """
    # 分词
    keywords = jieba.cut_for_search(query)
    keywords = [k for k in keywords if len(k) > 1]
    
    # 构建查询
    q_objects = Q()
    for keyword in keywords:
        q_objects |= Q(name__icontains=keyword)
    
    # 执行查询
    tags = Tag.objects.filter(q_objects, notes__user=user).distinct()
    
    # 计算相关度
    results = []
    for tag in tags[:limit]:
        # 计算相关度分数
        relevance = calculate_relevance(query, tag.name, '')
        
        # 获取相关笔记数量
        note_count = tag.notes.filter(user=user).count()
        
        results.append({
            'id': tag.id,
            'title': tag.name,
            'preview': f'包含 {note_count} 篇笔记',
            'type': 'tag',
            'relevance': relevance,
            'updatedAt': tag.updated_at.isoformat(),
            'createdAt': tag.created_at.isoformat(),
        })
    
    return results


def search_knowledge_nodes(user, query, limit=20):
    """
    搜索知识节点
    """
    # 分词
    keywords = jieba.cut_for_search(query)
    keywords = [k for k in keywords if len(k) > 1]
    
    # 构建查询
    q_objects = Q()
    for keyword in keywords:
        q_objects |= Q(title__icontains=keyword)
        q_objects |= Q(description__icontains=keyword)
    
    # 执行查询
    nodes = KnowledgeNode.objects.filter(q_objects, user=user).distinct()
    
    # 计算相关度
    results = []
    for node in nodes[:limit]:
        # 提取预览内容
        preview = extract_preview(node.description or '', query)
        
        # 计算相关度分数
        relevance = calculate_relevance(query, node.title, node.description or '')
        
        results.append({
            'id': node.id,
            'title': node.title,
            'preview': preview,
            'type': 'knowledge',
            'nodeType': node.type,
            'relevance': relevance,
            'updatedAt': node.updated_at.isoformat(),
            'createdAt': node.created_at.isoformat(),
        })
    
    return results


def enhance_search_with_knowledge_graph(user, query, results, depth=1):
    """
    使用知识图谱增强搜索结果
    """
    if not results:
        return results
    
    # 获取已有结果的ID
    existing_ids = {f"{r['type']}-{r['id']}": r for r in results}
    
    # 获取相关节点
    related_nodes = set()
    for result in results:
        if result['type'] == 'note':
            # 查找笔记关联的知识节点
            note_nodes = KnowledgeNode.objects.filter(note_id=result['id'], user=user)
            for node in note_nodes:
                related_nodes.add(node.id)
        elif result['type'] == 'knowledge':
            related_nodes.add(result['id'])
    
    # 查找相关节点的连接节点
    enhanced_nodes = set()
    for node_id in related_nodes:
        # 查找出边
        outgoing_edges = KnowledgeEdge.objects.filter(source_id=node_id, user=user)
        for edge in outgoing_edges:
            enhanced_nodes.add(edge.target_id)
        
        # 查找入边
        incoming_edges = KnowledgeEdge.objects.filter(target_id=node_id, user=user)
        for edge in incoming_edges:
            enhanced_nodes.add(edge.source_id)
    
    # 移除已有节点
    enhanced_nodes = enhanced_nodes - related_nodes
    
    # 查询增强节点
    enhanced_results = []
    for node_id in enhanced_nodes:
        node = KnowledgeNode.objects.get(id=node_id)
        
        # 计算相关度（降低权重）
        relevance = calculate_relevance(query, node.title, node.description or '') * 0.8
        
        # 检查是否已存在
        key = f"knowledge-{node.id}"
        if key not in existing_ids:
            enhanced_results.append({
                'id': node.id,
                'title': node.title,
                'preview': node.description or '通过知识图谱关联',
                'type': 'knowledge',
                'nodeType': node.type,
                'relevance': relevance,
                'updatedAt': node.updated_at.isoformat(),
                'createdAt': node.created_at.isoformat(),
                'matchedText': '通过知识图谱关联',
            })
    
    # 合并结果
    results.extend(enhanced_results)
    return results


def extract_preview(content, query, max_length=200):
    """
    提取预览内容
    """
    if not content:
        return ""
    
    # 分词
    keywords = jieba.cut_for_search(query)
    keywords = [k for k in keywords if len(k) > 1]
    
    # 查找关键词位置
    positions = []
    for keyword in keywords:
        pos = content.lower().find(keyword.lower())
        if pos != -1:
            positions.append(pos)
    
    if not positions:
        # 没有找到关键词，返回内容开头
        return content[:max_length] + "..." if len(content) > max_length else content
    
    # 找到最佳位置
    best_pos = min(positions)
    
    # 提取上下文
    start = max(0, best_pos - max_length // 2)
    end = min(len(content), best_pos + max_length // 2)
    
    preview = content[start:end]
    if start > 0:
        preview = "..." + preview
    if end < len(content):
        preview = preview + "..."
    
    return preview


def calculate_relevance(query, title, content):
    """
    计算相关度分数
    """
    # 分词
    query_words = ' '.join(jieba.cut_for_search(query))
    title_words = ' '.join(jieba.cut_for_search(title))
    content_words = ' '.join(jieba.cut_for_search(content[:1000]))  # 限制内容长度
    
    # 创建TF-IDF向量化器
    vectorizer = TfidfVectorizer()
    
    # 转换为TF-IDF向量
    try:
        tfidf_matrix = vectorizer.fit_transform([query_words, title_words, content_words])
        
        # 计算查询与标题的余弦相似度
        title_similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        
        # 计算查询与内容的余弦相似度
        content_similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[2:3])[0][0]
        
        # 标题权重更高
        relevance = title_similarity * 0.7 + content_similarity * 0.3
        
        # 处理NaN值
        if np.isnan(relevance):
            relevance = 0.0
    except:
        # 处理异常情况
        relevance = 0.0
    
    return float(relevance)


def transcribe_audio(audio_file):
    """
    语音转文本
    """
    # 创建临时文件
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
        temp_path = temp_file.name
        
        # 保存上传的音频文件
        with open(temp_path, 'wb') as f:
            for chunk in audio_file.chunks():
                f.write(chunk)
    
    try:
        # 初始化语音识别器
        recognizer = sr.Recognizer()
        
        # 加载音频文件
        with sr.AudioFile(temp_path) as source:
            audio_data = recognizer.record(source)
            
            # 识别语音
            text = recognizer.recognize_google(audio_data, language='zh-CN')
            return text
    except Exception as e:
        raise e
    finally:
        # 删除临时文件
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def extract_text_from_image(image_file):
    """
    从图像中提取文本
    """
    # 创建临时文件
    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
        temp_path = temp_file.name
        
        # 保存上传的图像文件
        with open(temp_path, 'wb') as f:
            for chunk in image_file.chunks():
                f.write(chunk)
    
    try:
        # 打开图像
        image = Image.open(temp_path)
        
        # 使用Tesseract OCR提取文本
        text = pytesseract.image_to_string(image, lang='chi_sim+eng')
        return text
    except Exception as e:
        raise e
    finally:
        # 删除临时文件
        if os.path.exists(temp_path):
            os.unlink(temp_path)
