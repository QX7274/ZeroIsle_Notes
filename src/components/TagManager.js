import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import TagStatistics from './TagStatistics';
import { api } from '../services/api';

const TagManager = () => {
  const navigation = useNavigation();
  const [tags, setTags] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [editTagName, setEditTagName] = useState('');

  useEffect(() => {
    fetchTags();
    fetchStatistics();
  }, []);

  const fetchTags = async () => {
    try {
      const response = await api.get('/tags/');
      setTags(response.data);
    } catch (error) {
      Alert.alert('错误', '获取标签列表失败');
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await api.get('/tags/statistics/');
      setStatistics(response.data);
    } catch (error) {
      Alert.alert('错误', '获取标签统计失败');
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      Alert.alert('错误', '标签名称不能为空');
      return;
    }

    try {
      await api.post('/tags/', { name: newTagName.trim() });
      setNewTagName('');
      fetchTags();
      fetchStatistics();
    } catch (error) {
      Alert.alert('错误', '创建标签失败');
    }
  };

  const handleUpdateTag = async (tagId) => {
    if (!editTagName.trim()) {
      Alert.alert('错误', '标签名称不能为空');
      return;
    }

    try {
      await api.put(`/tags/${tagId}/`, { name: editTagName.trim() });
      setEditingTag(null);
      setEditTagName('');
      fetchTags();
    } catch (error) {
      Alert.alert('错误', '更新标签失败');
    }
  };

  const handleDeleteTag = async (tagId) => {
    try {
      await api.delete(`/tags/${tagId}/`);
      fetchTags();
      fetchStatistics();
    } catch (error) {
      Alert.alert('错误', '删除标签失败');
    }
  };

  const handleSelectTag = (tagId) => {
    navigation.navigate('NoteList', { tagId });
  };

  const renderTag = ({ item }) => (
    <View style={styles.tagItem}>
      {editingTag === item.id ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.editInput}
            value={editTagName}
            onChangeText={setEditTagName}
            placeholder="输入新标签名称"
          />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => handleUpdateTag(item.id)}
          >
            <Text style={styles.buttonText}>保存</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setEditingTag(null);
              setEditTagName('');
            }}
          >
            <Text style={styles.buttonText}>取消</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.tagContent}>
          <TouchableOpacity
            style={styles.tagName}
            onPress={() => handleSelectTag(item.id)}
          >
            <Text style={styles.tagText}>{item.name}</Text>
          </TouchableOpacity>
          <View style={styles.tagActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setEditingTag(item.id);
                setEditTagName(item.name);
              }}
            >
              <Text style={styles.actionText}>编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteTag(item.id)}
            >
              <Text style={styles.actionText}>删除</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <TagStatistics statistics={statistics} />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newTagName}
          onChangeText={setNewTagName}
          placeholder="输入新标签名称"
        />
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateTag}
        >
          <Text style={styles.buttonText}>创建</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={tags}
        renderItem={renderTag}
        keyExtractor={(item) => item.id.toString()}
        style={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  tagItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tagContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagName: {
    flex: 1,
  },
  tagText: {
    fontSize: 16,
    color: '#333',
  },
  tagActions: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginLeft: 8,
  },
  actionText: {
    color: '#666',
    fontSize: 14,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
});

export default TagManager; 