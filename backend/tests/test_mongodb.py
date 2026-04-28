"""
测试MongoDB连接
"""

from pymongo import MongoClient
from datetime import datetime
import unittest
import mongomock

class TestMongoDB(unittest.TestCase):
    """测试MongoDB连接"""
    
    def setUp(self):
        """测试前准备"""
        self.client = mongomock.MongoClient()
        self.db = self.client['zeroislenotes_test']
    
    def tearDown(self):
        """测试后清理"""
        self.client.close()
    
    def test_connection(self):
        """测试连接"""
        # 获取所有集合名称
        collections = self.db.list_collection_names()
        print(f"MongoDB连接成功！数据库中的集合有: {collections}")
        
        # 确保连接成功
        self.assertIsNotNone(collections)
    
    def test_insert_and_find(self):
        """测试插入和查询"""
        # 创建测试集合
        test_collection = self.db['test_collection']
        
        # 插入测试数据
        test_data = {
            'name': 'Test Document',
            'created_at': datetime.now()
        }
        
        result = test_collection.insert_one(test_data)
        inserted_id = result.inserted_id
        
        # 查询测试数据
        found_data = test_collection.find_one({'_id': inserted_id})
        
        # 验证数据
        self.assertIsNotNone(found_data)
        self.assertEqual(found_data['name'], 'Test Document')
        
        # 清理测试数据
        test_collection.delete_one({'_id': inserted_id})

if __name__ == '__main__':
    unittest.main()
