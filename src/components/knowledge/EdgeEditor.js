/**
 * 知识图谱关系编辑组件
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
import { UnifiedSearchBar } from '../search';
import { createEdge, updateEdge } from '../../redux/slices/knowledgeGraphSlice';

/**
 * 知识图谱关系编辑组件
 * @param {Object} edge - 关系对象（编辑时传入）
 * @param {Array} nodes - 可选的节点列表
 * @param {Function} onSave - 保存回调
 * @param {Function} onCancel - 取消回调
 * @param {boolean} visible - 是否可见
 * @param {Object} sourceNode - 源节点（创建时可选）
 * @param {Object} targetNode - 目标节点（创建时可选）
 */
const EdgeEditor = ({
  edge = null,
  nodes = [],
  onSave,
  onCancel,
  visible = false,
  sourceNode = null,
  targetNode = null,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();
  const { isLoading } = useSelector(state => state.knowledgeGraph);

  // 关系状态
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [type, setType] = useState('related');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('1.0');
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [showTargetSelector, setShowTargetSelector] = useState(false);
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [searchText, setSearchText] = useState('');

  // 初始化状态
  useEffect(() => {
    if (edge) {
      setSourceId(edge.source?.id || edge.source || '');
      setTargetId(edge.target?.id || edge.target || '');
      setType(edge.type || 'related');
      setLabel(edge.label || '');
      setDescription(edge.description || '');
      setWeight(String(edge.weight || 1.0));
    } else {
      // 新建关系时重置状态
      setSourceId(sourceNode?.id || '');
      setTargetId(targetNode?.id || '');
      setType('related');
      setLabel('');
      setDescription('');
      setWeight('1.0');
    }
  }, [edge, visible, sourceNode, targetNode]);

  // 过滤节点
  useEffect(() => {
    if (showSourceSelector || showTargetSelector) {
      if (!searchText) {
        setFilteredNodes(nodes);
      } else {
        const filtered = nodes.filter(node =>
          node.title.toLowerCase().includes(searchText.toLowerCase()) ||
          node.description?.toLowerCase().includes(searchText.toLowerCase())
        );
        setFilteredNodes(filtered);
      }
    }
  }, [nodes, searchText, showSourceSelector, showTargetSelector]);

  // 处理保存
  const handleSave = async () => {
    if (!sourceId) {
      Alert.alert('提示', '请选择源节点');
      return;
    }

    if (!targetId) {
      Alert.alert('提示', '请选择目标节点');
      return;
    }

    if (sourceId === targetId) {
      Alert.alert('提示', '源节点和目标节点不能相同');
      return;
    }

    try {
      const edgeData = {
        source: sourceId,
        target: targetId,
        type,
        label: label.trim(),
        description: description.trim(),
        weight: parseFloat(weight) || 1.0,
      };

      let result;
      if (edge?.id) {
        // 更新关系
        result = await dispatch(updateEdge({
          id: edge.id,
          edgeData,
        })).unwrap();
      } else {
        // 创建关系
        result = await dispatch(createEdge(edgeData)).unwrap();
      }

      onSave && onSave(result);
    } catch (error) {
      Alert.alert('错误', error.message || '保存关系失败');
    }
  };

  // 关系类型选项
  const edgeTypes = [
    { value: 'related', label: '相关' },
    { value: 'includes', label: '包含' },
    { value: 'causes', label: '导致' },
    { value: 'supports', label: '支持' },
    { value: 'opposes', label: '反对' },
    { value: 'precedes', label: '先于' },
    { value: 'follows', label: '后于' },
    { value: 'custom', label: '自定义' },
  ];

  // 获取关系类型颜色
  const getEdgeTypeColor = (edgeType) => {
    switch (edgeType) {
      case 'related': return colors.primary;
      case 'includes': return colors.success;
      case 'causes': return colors.warning;
      case 'supports': return colors.info;
      case 'opposes': return colors.error;
      case 'precedes': return '#9C27B0'; // 紫色
      case 'follows': return '#00BCD4'; // 青色
      case 'custom': return '#607D8B'; // 蓝灰色
      default: return colors.primary;
    }
  };

  // 获取节点名称
  const getNodeTitle = (nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    return node ? node.title : '未选择';
  };

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

  // 渲染节点选择器
  const renderNodeSelector = (isSource) => {
    const title = isSource ? '选择源节点' : '选择目标节点';
    const currentId = isSource ? sourceId : targetId;

    return (
      <Modal
        visible={isSource ? showSourceSelector : showTargetSelector}
        transparent
        animationType="slide"
        onRequestClose={() => isSource ? setShowSourceSelector(false) : setShowTargetSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.selectorContainer, { backgroundColor: colors.card }]}>
            <View style={styles.selectorHeader}>
              <Text
                variant="heading"
                level="h5"
                style={styles.selectorTitle}
              >
                {title}
              </Text>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => isSource ? setShowSourceSelector(false) : setShowTargetSelector(false)}
              >
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <UnifiedSearchBar
                searchScope="knowledge_graph"
                placeholder="搜索节点"
                style={styles.searchBar}
                onSearch={(results) => {
                  if (results && results.length > 0) {
                    setFilteredNodes(results);
                  }
                }}
              />
            </View>

            <ScrollView style={styles.nodesList}>
              {filteredNodes.length === 0 ? (
                <Text
                  variant="body"
                  size="medium"
                  color="hint"
                  style={styles.noNodesText}
                >
                  {searchText ? '没有找到匹配的节点' : '暂无节点'}
                </Text>
              ) : (
                filteredNodes.map(node => (
                  <TouchableOpacity
                    key={node.id}
                    style={[
                      styles.nodeItem,
                      node.id === currentId && styles.selectedNodeItem,
                      node.id === currentId && { borderColor: getNodeTypeColor(node.type) },
                    ]}
                    onPress={() => {
                      if (isSource) {
                        setSourceId(node.id);
                        setShowSourceSelector(false);
                      } else {
                        setTargetId(node.id);
                        setShowTargetSelector(false);
                      }
                      setSearchText('');
                    }}
                  >
                    <View
                      style={[
                        styles.nodeTypeIndicator,
                        { backgroundColor: getNodeTypeColor(node.type) },
                      ]}
                    />
                    <View style={styles.nodeInfo}>
                      <Text
                        variant="body"
                        size="medium"
                        bold
                        color={node.id === currentId ? 'primary' : 'text'}
                      >
                        {node.title}
                      </Text>
                      {node.description ? (
                        <Text
                          variant="body"
                          size="small"
                          color="hint"
                          numberOfLines={1}
                        >
                          {node.description}
                        </Text>
                      ) : null}
                    </View>
                    {node.id === currentId && (
                      <Icon name="check" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
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
              {edge?.id ? '编辑关系' : '创建关系'}
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
                源节点
              </Text>
              <TouchableOpacity
                style={[
                  styles.nodeSelector,
                  { borderColor: colors.border },
                ]}
                onPress={() => {
                  setShowSourceSelector(true);
                  setSearchText('');
                }}
              >
                <View
                  style={[
                    styles.nodeSelectorIndicator,
                    { backgroundColor: sourceId ? getNodeTypeColor(nodes.find(n => n.id === sourceId)?.type) : colors.border },
                  ]}
                />
                <Text
                  variant="body"
                  size="medium"
                  color={sourceId ? 'text' : 'hint'}
                >
                  {sourceId ? getNodeTitle(sourceId) : '选择源节点'}
                </Text>
                <Icon name="arrow-drop-down" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text
                variant="body"
                size="medium"
                bold
                style={styles.label}
              >
                目标节点
              </Text>
              <TouchableOpacity
                style={[
                  styles.nodeSelector,
                  { borderColor: colors.border },
                ]}
                onPress={() => {
                  setShowTargetSelector(true);
                  setSearchText('');
                }}
              >
                <View
                  style={[
                    styles.nodeSelectorIndicator,
                    { backgroundColor: targetId ? getNodeTypeColor(nodes.find(n => n.id === targetId)?.type) : colors.border },
                  ]}
                />
                <Text
                  variant="body"
                  size="medium"
                  color={targetId ? 'text' : 'hint'}
                >
                  {targetId ? getNodeTitle(targetId) : '选择目标节点'}
                </Text>
                <Icon name="arrow-drop-down" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text
                variant="body"
                size="medium"
                bold
                style={styles.label}
              >
                关系类型
              </Text>
              <View style={styles.edgeTypesContainer}>
                {edgeTypes.map(edgeType => (
                  <TouchableOpacity
                    key={edgeType.value}
                    style={[
                      styles.edgeTypeButton,
                      type === edgeType.value && styles.selectedEdgeType,
                      type === edgeType.value && { borderColor: getEdgeTypeColor(edgeType.value) },
                    ]}
                    onPress={() => setType(edgeType.value)}
                  >
                    <View
                      style={[
                        styles.edgeTypeColor,
                        { backgroundColor: getEdgeTypeColor(edgeType.value) },
                      ]}
                    />
                    <Text
                      variant="body"
                      size="small"
                      color={type === edgeType.value ? 'primary' : 'text'}
                    >
                      {edgeType.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text
                variant="body"
                size="medium"
                bold
                style={styles.label}
              >
                标签
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={label}
                onChangeText={setLabel}
                placeholder="输入关系标签（可选）"
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
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="输入关系描述（可选）"
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
                权重
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={weight}
                onChangeText={setWeight}
                placeholder="输入关系权重（默认1.0）"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
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

      {renderNodeSelector(true)}
      {renderNodeSelector(false)}
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
  nodeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
  },
  nodeSelectorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  edgeTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  edgeTypeButton: {
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
  selectedEdgeType: {
    borderWidth: 1,
  },
  edgeTypeColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
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
  selectorContainer: {
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
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectorTitle: {
    flex: 1,
  },
  searchContainer: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBar: {
    marginVertical: 0,
  },
  nodesList: {
    padding: 8,
    maxHeight: 400,
  },
  nodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  selectedNodeItem: {
    borderWidth: 1,
  },
  nodeTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  nodeInfo: {
    flex: 1,
  },
  noNodesText: {
    textAlign: 'center',
    padding: 16,
  },
});

export default EdgeEditor;
