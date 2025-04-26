/**
 * 知识图谱节点编辑组件
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../common';
import { createNode, updateNode } from '../../redux/slices/knowledgeGraphSlice';

/**
 * 知识图谱节点编辑组件
 * @param {Object} node - 节点对象（编辑时传入）
 * @param {Function} onSave - 保存回调
 * @param {Function} onCancel - 取消回调
 * @param {boolean} visible - 是否可见
 */
const NodeEditor = ({
  node = null,
  onSave,
  onCancel,
  visible = false,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();
  const { isLoading } = useSelector(state => state.knowledgeGraph);
  
  // 节点状态
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('concept');
  const [properties, setProperties] = useState([]);
  
  // 初始化状态
  useEffect(() => {
    if (node) {
      setTitle(node.title || '');
      setDescription(node.description || '');
      setType(node.type || 'concept');
      
      // 转换属性对象为数组
      if (node.properties) {
        const propsArray = Object.entries(node.properties).map(([key, value]) => ({
          key,
          value: String(value),
        }));
        setProperties(propsArray);
      } else {
        setProperties([]);
      }
    } else {
      // 新建节点时重置状态
      setTitle('');
      setDescription('');
      setType('concept');
      setProperties([]);
    }
  }, [node, visible]);
  
  // 添加属性
  const addProperty = () => {
    setProperties([...properties, { key: '', value: '' }]);
  };
  
  // 更新属性
  const updateProperty = (index, field, value) => {
    const updatedProperties = [...properties];
    updatedProperties[index][field] = value;
    setProperties(updatedProperties);
  };
  
  // 删除属性
  const removeProperty = (index) => {
    const updatedProperties = [...properties];
    updatedProperties.splice(index, 1);
    setProperties(updatedProperties);
  };
  
  // 处理保存
  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入节点标题');
      return;
    }
    
    try {
      // 将属性数组转换为对象
      const propertiesObject = {};
      properties.forEach(prop => {
        if (prop.key.trim() && prop.value.trim()) {
          propertiesObject[prop.key.trim()] = prop.value.trim();
        }
      });
      
      const nodeData = {
        title: title.trim(),
        description: description.trim(),
        type,
        properties: propertiesObject,
      };
      
      let result;
      if (node?.id) {
        // 更新节点
        result = await dispatch(updateNode({
          id: node.id,
          nodeData,
        })).unwrap();
      } else {
        // 创建节点
        result = await dispatch(createNode(nodeData)).unwrap();
      }
      
      onSave && onSave(result);
    } catch (error) {
      Alert.alert('错误', error.message || '保存节点失败');
    }
  };
  
  // 节点类型选项
  const nodeTypes = [
    { value: 'concept', label: '概念' },
    { value: 'entity', label: '实体' },
    { value: 'note', label: '笔记' },
    { value: 'tag', label: '标签' },
    { value: 'category', label: '分类' },
    { value: 'question', label: '问题' },
    { value: 'answer', label: '答案' },
    { value: 'custom', label: '自定义' },
  ];
  
  // 获取节点类型颜色
  const getNodeTypeColor = (nodeType) => {
    switch (nodeType) {
      case 'concept': return colors.primary;
      case 'entity': return colors.success;
      case 'note': return colors.info;
      case 'tag': return colors.warning;
      case 'category': return colors.error;
      case 'question': return '#9C27B0'; // 紫色
      case 'answer': return '#00BCD4'; // 青色
      case 'custom': return '#607D8B'; // 蓝灰色
      default: return colors.primary;
    }
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text
              variant="heading"
              level="h5"
              style={styles.title}
            >
              {node?.id ? '编辑节点' : '创建节点'}
            </Text>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onCancel}
            >
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.content}>
            <View style={styles.formGroup}>
              <Text
                variant="body"
                size="medium"
                bold
                style={styles.label}
              >
                标题
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border }
                ]}
                value={title}
                onChangeText={setTitle}
                placeholder="输入节点标题"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text
                variant="body"
                size="medium"
                bold
                style={styles.label}
              >
                描述
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  { color: colors.text, borderColor: colors.border }
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="输入节点描述"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text
                variant="body"
                size="medium"
                bold
                style={styles.label}
              >
                节点类型
              </Text>
              <View style={styles.nodeTypesContainer}>
                {nodeTypes.map(nodeType => (
                  <TouchableOpacity
                    key={nodeType.value}
                    style={[
                      styles.nodeTypeButton,
                      type === nodeType.value && styles.selectedNodeType,
                      type === nodeType.value && { borderColor: getNodeTypeColor(nodeType.value) }
                    ]}
                    onPress={() => setType(nodeType.value)}
                  >
                    <View
                      style={[
                        styles.nodeTypeColor,
                        { backgroundColor: getNodeTypeColor(nodeType.value) }
                      ]}
                    />
                    <Text
                      variant="body"
                      size="small"
                      color={type === nodeType.value ? 'primary' : 'text'}
                    >
                      {nodeType.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <View style={styles.propertiesHeader}>
                <Text
                  variant="body"
                  size="medium"
                  bold
                  style={styles.label}
                >
                  属性
                </Text>
                <TouchableOpacity
                  style={[styles.addPropertyButton, { backgroundColor: colors.primary }]}
                  onPress={addProperty}
                >
                  <Icon name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              {properties.length === 0 ? (
                <Text
                  variant="body"
                  size="small"
                  color="hint"
                  style={styles.noPropertiesText}
                >
                  点击"+"按钮添加属性
                </Text>
              ) : (
                properties.map((property, index) => (
                  <View key={index} style={styles.propertyRow}>
                    <TextInput
                      style={[
                        styles.propertyKey,
                        { color: colors.text, borderColor: colors.border }
                      ]}
                      value={property.key}
                      onChangeText={(value) => updateProperty(index, 'key', value)}
                      placeholder="属性名"
                      placeholderTextColor={colors.textSecondary}
                    />
                    <TextInput
                      style={[
                        styles.propertyValue,
                        { color: colors.text, borderColor: colors.border }
                      ]}
                      value={property.value}
                      onChangeText={(value) => updateProperty(index, 'value', value)}
                      placeholder="属性值"
                      placeholderTextColor={colors.textSecondary}
                    />
                    <TouchableOpacity
                      style={[styles.removePropertyButton, { backgroundColor: colors.error }]}
                      onPress={() => removeProperty(index)}
                    >
                      <Icon name="remove" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
          
          <View style={styles.footer}>
            <Button
              title="取消"
              onPress={onCancel}
              type="outline"
              style={styles.cancelButton}
            />
            <Button
              title={isLoading ? '保存中...' : '保存'}
              onPress={handleSave}
              disabled={isLoading}
              style={styles.saveButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
  },
  nodeTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  nodeTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 8,
    marginBottom: 8,
  },
  selectedNodeType: {
    borderWidth: 1,
  },
  nodeTypeColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  propertiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addPropertyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPropertiesText: {
    textAlign: 'center',
    padding: 16,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  propertyKey: {
    flex: 2,
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    fontSize: 16,
    marginRight: 8,
  },
  propertyValue: {
    flex: 3,
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    fontSize: 16,
    marginRight: 8,
  },
  removePropertyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
  },
  saveButton: {
    flex: 1,
    marginLeft: 8,
  },
});

export default NodeEditor;
