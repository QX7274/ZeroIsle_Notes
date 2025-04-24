/**
 * 知识图谱节点详情屏幕
 * 用于查看和编辑知识图谱中的节点详情
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';

// 导入Redux相关
import {
  selectNodes,
  selectEdges,
  selectIsLoading,
  createNode,
  createEdge,
} from '../../redux/slices/knowledgeGraphSlice';

// 导入常量和工具函数
import { colors } from '../../utils/constants/colors';
import { dimensions } from '../../utils/constants/dimensions';

// 导入组件
import { Button, Loading, Toast } from '../../components/common';

/**
 * 知识图谱节点详情屏幕组件
 */
const NodeDetailScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();
  
  // 从路由参数获取节点ID
  const { nodeId } = route.params || {};
  
  // 从Redux获取状态
  const nodes = useSelector(selectNodes);
  const edges = useSelector(selectEdges);
  const isLoading = useSelector(selectIsLoading);
  
  // 本地状态
  const [node, setNode] = useState(null);
  const [relatedNodes, setRelatedNodes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNode, setEditedNode] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showAddRelation, setShowAddRelation] = useState(false);
  const [selectedRelationType, setSelectedRelationType] = useState('related');
  const [selectedTargetNode, setSelectedTargetNode] = useState(null);
  
  // 加载节点数据
  useEffect(() => {
    if (nodeId && nodes.length > 0) {
      const foundNode = nodes.find(n => n.id === nodeId);
      if (foundNode) {
        setNode(foundNode);
        setEditedNode(foundNode);
        
        // 查找相关节点
        const nodeRelations = edges.filter(
          edge => edge.source === nodeId || edge.target === nodeId
        );
        
        const relatedNodeIds = new Set();
        nodeRelations.forEach(relation => {
          if (relation.source === nodeId) {
            relatedNodeIds.add(relation.target);
          } else {
            relatedNodeIds.add(relation.source);
          }
        });
        
        const relatedNodesData = nodes.filter(n => relatedNodeIds.has(n.id));
        setRelatedNodes(relatedNodesData);
      } else {
        setToastMessage('未找到节点数据');
        setTimeout(() => navigation.goBack(), 2000);
      }
    }
  }, [nodeId, nodes, edges]);
  
  // 切换编辑模式
  const toggleEditMode = () => {
    if (isEditing) {
      // 退出编辑模式，询问是否保存
      Alert.alert(
        '保存更改',
        '是否保存对节点的修改？',
        [
          {
            text: '取消',
            style: 'cancel',
            onPress: () => {
              // 取消编辑，恢复原始数据
              setEditedNode(node);
              setIsEditing(false);
            },
          },
          {
            text: '保存',
            onPress: saveNodeChanges,
          },
        ],
      );
    } else {
      // 进入编辑模式
      setIsEditing(true);
    }
  };
  
  // 保存节点更改
  const saveNodeChanges = async () => {
    try {
      // 这里应该调用API保存节点更改
      // 临时模拟保存成功
      setNode(editedNode);
      setIsEditing(false);
      setToastMessage('节点更新成功');
    } catch (error) {
      setToastMessage('保存失败: ' + error.message);
    }
  };
  
  // 处理节点属性变化
  const handleNodeChange = (field, value) => {
    setEditedNode(prev => ({
      ...prev,
      [field]: value,
    }));
  };
  
  // 添加关系
  const addRelation = async () => {
    if (!selectedTargetNode) {
      setToastMessage('请选择目标节点');
      return;
    }
    
    try {
      const relationData = {
        source: nodeId,
        target: selectedTargetNode.id,
        type: selectedRelationType,
        label: getRelationLabel(selectedRelationType),
      };
      
      await dispatch(createEdge(relationData)).unwrap();
      
      setShowAddRelation(false);
      setSelectedTargetNode(null);
      setToastMessage('关系添加成功');
    } catch (error) {
      setToastMessage('添加关系失败: ' + error.message);
    }
  };
  
  // 获取关系标签
  const getRelationLabel = (type) => {
    switch (type) {
      case 'related':
        return '相关';
      case 'parent':
        return '父级';
      case 'child':
        return '子级';
      case 'reference':
        return '引用';
      default:
        return '相关';
    }
  };
  
  // 删除节点
  const deleteNode = () => {
    Alert.alert(
      '删除节点',
      '确定要删除此节点吗？此操作不可撤销，相关的连接也将被删除。',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              // 这里应该调用API删除节点
              // 临时模拟删除成功
              setToastMessage('节点已删除');
              setTimeout(() => navigation.goBack(), 1000);
            } catch (error) {
              setToastMessage('删除失败: ' + error.message);
            }
          },
        },
      ],
    );
  };
  
  // 渲染加载状态
  if (isLoading) {
    return <Loading text="加载节点数据中..." />;
  }
  
  // 渲染节点未找到状态
  if (!node) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={50} color={colors.error} />
          <Text style={styles.errorText}>未找到节点数据</Text>
          <Button title="返回" onPress={() => navigation.goBack()} />
        </View>
        
        {toastMessage ? (
          <Toast 
            message={toastMessage} 
            onDismiss={() => setToastMessage('')} 
            type="error" 
          />
        ) : null}
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* 节点基本信息 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>基本信息</Text>
            <TouchableOpacity onPress={toggleEditMode}>
              <Icon 
                name={isEditing ? 'check' : 'edit'} 
                size={24} 
                color={colors.primary} 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.infoContainer}>
            {/* 节点类型 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>类型:</Text>
              {isEditing ? (
                <View style={styles.typeSelector}>
                  {['note', 'tag', 'category', 'concept'].map(type => (
                    <TouchableOpacity 
                      key={type}
                      style={[
                        styles.typeOption, 
                        editedNode.type === type && styles.selectedTypeOption
                      ]}
                      onPress={() => handleNodeChange('type', type)}
                    >
                      <Text 
                        style={[
                          styles.typeOptionText,
                          editedNode.type === type && styles.selectedTypeOptionText
                        ]}
                      >
                        {type === 'note' ? '笔记' : 
                         type === 'tag' ? '标签' : 
                         type === 'category' ? '分类' : '概念'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View 
                  style={[
                    styles.typeTag, 
                    { backgroundColor: getNodeColorByType(node.type) }
                  ]}
                >
                  <Text style={styles.typeTagText}>
                    {node.type === 'note' ? '笔记' : 
                     node.type === 'tag' ? '标签' : 
                     node.type === 'category' ? '分类' : '概念'}
                  </Text>
                </View>
              )}
            </View>
            
            {/* 节点标题 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>标题:</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={editedNode.label || editedNode.title || ''}
                  onChangeText={(text) => handleNodeChange('label', text)}
                  placeholder="输入节点标题"
                />
              ) : (
                <Text style={styles.infoValue}>
                  {node.label || node.title || '无标题'}
                </Text>
              )}
            </View>
            
            {/* 节点描述 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>描述:</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editedNode.description || ''}
                  onChangeText={(text) => handleNodeChange('description', text)}
                  placeholder="输入节点描述"
                  multiline
                  numberOfLines={4}
                />
              ) : (
                <Text style={styles.infoValue}>
                  {node.description || '无描述'}
                </Text>
              )}
            </View>
            
            {/* 如果是笔记类型，显示笔记链接 */}
            {node.type === 'note' && node.noteId && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>笔记链接:</Text>
                <TouchableOpacity 
                  style={styles.noteLink}
                  onPress={() => navigation.navigate('NoteDetail', { noteId: node.noteId })}
                >
                  <Text style={styles.noteLinkText}>查看笔记</Text>
                  <Icon name="arrow-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        
        {/* 节点关系 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>关联关系</Text>
            <TouchableOpacity onPress={() => setShowAddRelation(!showAddRelation)}>
              <Icon 
                name={showAddRelation ? 'close' : 'add'} 
                size={24} 
                color={colors.primary} 
              />
            </TouchableOpacity>
          </View>
          
          {/* 添加关系表单 */}
          {showAddRelation && (
            <View style={styles.addRelationContainer}>
              <Text style={styles.addRelationTitle}>添加新关系</Text>
              
              <View style={styles.relationTypeSelector}>
                <Text style={styles.relationTypeLabel}>关系类型:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['related', 'parent', 'child', 'reference'].map(type => (
                    <TouchableOpacity 
                      key={type}
                      style={[
                        styles.relationTypeOption, 
                        selectedRelationType === type && styles.selectedRelationTypeOption
                      ]}
                      onPress={() => setSelectedRelationType(type)}
                    >
                      <Text 
                        style={[
                          styles.relationTypeOptionText,
                          selectedRelationType === type && styles.selectedRelationTypeOptionText
                        ]}
                      >
                        {getRelationLabel(type)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
              <Text style={styles.targetNodeLabel}>目标节点:</Text>
              <ScrollView style={styles.targetNodeList}>
                {nodes
                  .filter(n => n.id !== nodeId)
                  .map(targetNode => (
                    <TouchableOpacity 
                      key={targetNode.id}
                      style={[
                        styles.targetNodeItem, 
                        selectedTargetNode?.id === targetNode.id && styles.selectedTargetNodeItem
                      ]}
                      onPress={() => setSelectedTargetNode(targetNode)}
                    >
                      <View 
                        style={[
                          styles.targetNodeTypeIndicator, 
                          { backgroundColor: getNodeColorByType(targetNode.type) }
                        ]} 
                      />
                      <Text style={styles.targetNodeTitle}>
                        {targetNode.label || targetNode.title || `节点${targetNode.id}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
              
              <Button 
                title="添加关系" 
                onPress={addRelation} 
                disabled={!selectedTargetNode}
                style={styles.addRelationButton}
              />
            </View>
          )}
          
          {/* 关联节点列表 */}
          {relatedNodes.length > 0 ? (
            <View style={styles.relatedNodesContainer}>
              {relatedNodes.map(relatedNode => {
                // 查找关系类型
                const relation = edges.find(
                  edge => (edge.source === nodeId && edge.target === relatedNode.id) ||
                         (edge.source === relatedNode.id && edge.target === nodeId)
                );
                
                const relationType = relation ? relation.type || 'related' : 'related';
                const relationLabel = relation ? relation.label || getRelationLabel(relationType) : getRelationLabel('related');
                
                return (
                  <TouchableOpacity 
                    key={relatedNode.id}
                    style={styles.relatedNodeItem}
                    onPress={() => navigation.push('NodeDetail', { nodeId: relatedNode.id })}
                  >
                    <View style={styles.relatedNodeHeader}>
                      <View 
                        style={[
                          styles.relatedNodeTypeIndicator, 
                          { backgroundColor: getNodeColorByType(relatedNode.type) }
                        ]} 
                      />
                      <Text style={styles.relatedNodeTitle}>
                        {relatedNode.label || relatedNode.title || `节点${relatedNode.id}`}
                      </Text>
                    </View>
                    
                    <View style={styles.relationInfo}>
                      <Text style={styles.relationLabel}>{relationLabel}</Text>
                      <Icon name="arrow-forward" size={16} color={colors.text} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyRelationsText}>暂无关联节点</Text>
          )}
        </View>
        
        {/* 危险操作区域 */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerSectionTitle}>危险操作</Text>
          <Button 
            title="删除节点" 
            onPress={deleteNode} 
            style={styles.deleteButton}
            textStyle={styles.deleteButtonText}
          />
        </View>
      </ScrollView>
      
      {/* Toast消息 */}
      {toastMessage ? (
        <Toast 
          message={toastMessage} 
          onDismiss={() => setToastMessage('')} 
          type={toastMessage.includes('失败') ? 'error' : 'success'} 
        />
      ) : null}
    </View>
  );
};

// 根据节点类型获取颜色
const getNodeColorByType = (type) => {
  switch (type) {
    case 'note':
      return colors.primary;
    case 'tag':
      return colors.accent;
    case 'category':
      return colors.success;
    case 'concept':
      return colors.warning;
    default:
      return colors.textLight;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  infoContainer: {
    marginBottom: 10,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  typeOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedTypeOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeOptionText: {
    color: colors.text,
    fontSize: 14,
  },
  selectedTypeOptionText: {
    color: colors.white,
  },
  typeTag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  typeTagText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  noteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundLight,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  noteLinkText: {
    color: colors.primary,
    marginRight: 4,
    fontSize: 14,
    fontWeight: 'bold',
  },
  addRelationContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addRelationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  relationTypeSelector: {
    marginBottom: 12,
  },
  relationTypeLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  relationTypeOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  selectedRelationTypeOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  relationTypeOptionText: {
    color: colors.text,
    fontSize: 14,
  },
  selectedRelationTypeOptionText: {
    color: colors.white,
  },
  targetNodeLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  targetNodeList: {
    maxHeight: 200,
    marginBottom: 12,
  },
  targetNodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
  selectedTargetNodeItem: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundLight,
  },
  targetNodeTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  targetNodeTitle: {
    fontSize: 14,
    color: colors.text,
  },
  addRelationButton: {
    marginTop: 8,
  },
  relatedNodesContainer: {
    marginTop: 8,
  },
  relatedNodeItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
  relatedNodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  relatedNodeTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  relatedNodeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  relationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  relationLabel: {
    fontSize: 14,
    color: colors.textLight,
  },
  emptyRelationsText: {
    fontSize: 14,
    color: colors.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  dangerSection: {
    marginTop: 20,
    marginBottom: 40,
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
  },
  dangerSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  deleteButtonText: {
    color: colors.white,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginVertical: 20,
  },
});

export default NodeDetailScreen;