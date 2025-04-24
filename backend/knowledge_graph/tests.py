from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import KnowledgeNode, KnowledgeEdge
from .utils import find_shortest_path, find_related_concepts, analyze_knowledge_structure

User = get_user_model()


class KnowledgeGraphAPITestCase(TestCase):
    """知识图谱API测试"""
    
    def setUp(self):
        # 创建测试用户
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        
        # 创建测试客户端
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        # 创建测试节点
        self.node1 = KnowledgeNode.objects.create(
            title='节点1',
            description='测试节点1',
            type='concept',
            user=self.user
        )
        
        self.node2 = KnowledgeNode.objects.create(
            title='节点2',
            description='测试节点2',
            type='concept',
            user=self.user
        )
        
        self.node3 = KnowledgeNode.objects.create(
            title='节点3',
            description='测试节点3',
            type='concept',
            user=self.user
        )
        
        # 创建测试边
        self.edge1 = KnowledgeEdge.objects.create(
            source=self.node1,
            target=self.node2,
            type='related',
            user=self.user
        )
        
        self.edge2 = KnowledgeEdge.objects.create(
            source=self.node2,
            target=self.node3,
            type='include',
            user=self.user
        )
    
    def test_get_knowledge_graph(self):
        """测试获取知识图谱"""
        url = reverse('knowledge-graph')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['nodes']), 3)
        self.assertEqual(len(response.data['edges']), 2)
    
    def test_find_path(self):
        """测试查找路径"""
        url = reverse('knowledge-graph') + 'find_path/'
        data = {
            'source_id': self.node1.id,
            'target_id': self.node3.id
        }
        
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('path', response.data)
    
    def test_analyze_knowledge_structure(self):
        """测试分析知识结构"""
        url = reverse('knowledge-graph') + 'analyze/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('central_nodes', response.data)
        self.assertIn('components', response.data)
    
    def test_get_related_concepts(self):
        """测试获取相关概念"""
        url = reverse('knowledge-node-related-concepts', args=[self.node1.id])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) > 0)


class KnowledgeGraphUtilsTestCase(TestCase):
    """知识图谱工具函数测试"""
    
    def setUp(self):
        # 创建测试用户
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        
        # 创建测试节点
        self.node1 = KnowledgeNode.objects.create(
            title='节点1',
            description='测试节点1',
            type='concept',
            user=self.user
        )
        
        self.node2 = KnowledgeNode.objects.create(
            title='节点2',
            description='测试节点2',
            type='concept',
            user=self.user
        )
        
        self.node3 = KnowledgeNode.objects.create(
            title='节点3',
            description='测试节点3',
            type='concept',
            user=self.user
        )
        
        # 创建测试边
        self.edge1 = KnowledgeEdge.objects.create(
            source=self.node1,
            target=self.node2,
            type='related',
            user=self.user
        )
        
        self.edge2 = KnowledgeEdge.objects.create(
            source=self.node2,
            target=self.node3,
            type='include',
            user=self.user
        )
    
    def test_find_shortest_path(self):
        """测试查找最短路径"""
        path = find_shortest_path(self.user, self.node1.id, self.node3.id)
        
        self.assertIsNotNone(path)
        self.assertEqual(len(path), 3)  # 应该有3个节点
    
    def test_find_related_concepts(self):
        """测试查找相关概念"""
        related = find_related_concepts(self.user, self.node1.id, max_depth=2)
        
        self.assertTrue(len(related) > 0)
        self.assertEqual(related[0]['depth'], 0)  # 第一个应该是源节点
    
    def test_analyze_knowledge_structure(self):
        """测试分析知识结构"""
        analysis = analyze_knowledge_structure(self.user)
        
        self.assertIn('central_nodes', analysis)
        self.assertIn('components', analysis)
        self.assertTrue(len(analysis['components']) > 0)