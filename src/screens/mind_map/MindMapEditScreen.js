/**
 * 思维导图编辑屏幕
 * 用于编辑和查看思维导图
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { Button, Toast } from '../../components/common';
import MindMapToolbar from '../../components/mind_map/MindMapToolbar';
import MindMapView from '../../components/mind_map/MindMapView';
import mindMapApi from '../../services/api/mindMapApi';
import analyticsService from '../../services/analytics/analyticsService';
import mindMapService from '../../services/ai/mindMapService';

const { width, height } = Dimensions.get('window');

const MindMapEditScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { mindMapId, title: routeTitle, isExample, nodes: routeNodes, edges: routeEdges, layoutType: routeLayoutType, theme: routeTheme } = route.params || {};

  // 状态
  const [mindMap, setMindMap] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [nodeTitle, setNodeTitle] = useState('');
  const [nodeContent, setNodeContent] = useState('');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showLayoutOptions, setShowLayoutOptions] = useState(false);
  const [layoutType, setLayoutType] = useState('tree');
  const [theme, setTheme] = useState('default');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // 引用
  const mindMapViewRef = useRef(null);

  // 加载思维导图
  const loadMindMap = async () => {
    try {
      setLoading(true);

      const response = await mindMapApi.getMindMap(mindMapId);
      if (!response.success) {
        throw new Error(response.message || '加载思维导图失败');
      }
      const data = response.data;

      setMindMap(data);
      setTitle(data.title);
      setDescription(data.description || '');
      setLayoutType(data.layout_type || 'tree');
      setTheme(data.theme || 'default');

      // 处理节点和边
      if (data.data && typeof data.data === 'object') {
        if (Array.isArray(data.data.nodes)) {
          setNodes(data.data.nodes);
        }
        if (Array.isArray(data.data.edges)) {
          setEdges(data.data.edges);
        }
      } else if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
      }

      analyticsService.trackEvent('view_mind_map', { id: mindMapId });
    } catch (err) {
      console.error('加载思维导图失败:', err);
      Alert.alert('错误', '加载思维导图失败，请稍后重试');
      analyticsService.trackError(err, { action: 'load_mind_map' });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // 首次加载
  useEffect(() => {
    if (isExample && routeNodes && routeEdges) {
      // 处理示例数据
      setTitle(routeTitle || '示例思维导图');
      setNodes(routeNodes);
      setEdges(routeEdges);
      setLayoutType(routeLayoutType || 'tree');
      setTheme(routeTheme || 'default');
      setLoading(false);
    } else if (mindMapId) {
      loadMindMap();
    } else {
      setLoading(false);
    }
  }, [mindMapId, isExample, routeNodes, routeEdges]);

  // 保存思维导图
  const saveMindMap = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入思维导图标题');
      return;
    }

    try {
      setSaving(true);

      // 如果是示例思维导图，提示用户
      if (isExample) {
        Alert.alert(
          '保存示例思维导图',
          '您正在编辑示例思维导图。是否要将其保存为新的思维导图？',
          [
            { text: '取消', style: 'cancel', onPress: () => setSaving(false) },
            {
              text: '保存',
              onPress: async () => {
                try {
                  const mindMapData = {
                    title: title.trim(),
                    description: description.trim(),
                    layout_type: layoutType,
                    theme: theme,
                    data: {
                      nodes,
                      edges
                    }
                  };

                  // 创建新思维导图
                  const response = await apiService.post('/mind-map/maps/', mindMapData);
                  navigation.setParams({
                    mindMapId: response.data.id,
                    isExample: false
                  });
                  showToastMessage('思维导图已创建');
                  analyticsService.trackEvent('save_mind_map', { id: response.data.id, from_example: true });
                } catch (err) {
                  console.error('保存思维导图失败:', err);
                  Alert.alert('错误', '保存思维导图失败，请稍后重试');
                  analyticsService.trackError(err, { action: 'save_mind_map' });
                } finally {
                  setSaving(false);
                }
              }
            }
          ]
        );
        return;
      }

      const mindMapData = {
        title: title.trim(),
        description: description.trim(),
        layout_type: layoutType,
        theme: theme,
        data: {
          nodes,
          edges
        }
      };

      let response;

      if (mindMapId && !isExample) {
        // 更新现有思维导图
        response = await mindMapApi.updateMindMap(mindMapId, mindMapData);
        if (!response.success) {
          throw new Error(response.message || '更新思维导图失败');
        }
        showToastMessage('思维导图已保存');
      } else {
        // 创建新思维导图
        response = await mindMapApi.createMindMap(mindMapData);
        if (!response.success) {
          throw new Error(response.message || '创建思维导图失败');
        }
        navigation.setParams({ mindMapId: response.data.id });
        showToastMessage('思维导图已创建');
      }

      analyticsService.trackEvent('save_mind_map', { id: response.data.id });
    } catch (err) {
      console.error('保存思维导图失败:', err);
      Alert.alert('错误', '保存思维导图失败，请稍后重试');
      analyticsService.trackError(err, { action: 'save_mind_map' });
    } finally {
      setSaving(false);
    }
  };

  // 添加节点
  const handleAddNode = (parentId = null) => {
    const newNode = {
      id: `node-${Date.now()}`,
      title: '新节点',
      content: '',
      parent_id: parentId,
      x: 0,
      y: 0
    };

    setNodes([...nodes, newNode]);

    if (parentId) {
      const newEdge = {
        id: `edge-${Date.now()}`,
        source: parentId,
        target: newNode.id,
        style: 'solid'
      };

      setEdges([...edges, newEdge]);
    }

    // 选中新节点进行编辑
    setSelectedNode(newNode);
    setNodeTitle(newNode.title);
    setNodeContent(newNode.content || '');
    setShowNodeEditor(true);
  };

  // 编辑节点
  const handleEditNode = (node) => {
    setSelectedNode(node);
    setNodeTitle(node.title);
    setNodeContent(node.content || '');
    setShowNodeEditor(true);
  };

  // 保存节点编辑
  const handleSaveNodeEdit = () => {
    if (!nodeTitle.trim()) {
      Alert.alert('提示', '请输入节点标题');
      return;
    }

    const updatedNodes = nodes.map(node => {
      if (node.id === selectedNode.id) {
        return {
          ...node,
          title: nodeTitle.trim(),
          content: nodeContent.trim()
        };
      }
      return node;
    });

    setNodes(updatedNodes);
    setShowNodeEditor(false);
    setSelectedNode(null);
  };

  // 删除节点
  const handleDeleteNode = (nodeId) => {
    // 找到要删除的节点的所有子节点
    const childNodeIds = findAllChildNodeIds(nodeId);
    const allNodesToDelete = [nodeId, ...childNodeIds];

    // 过滤掉要删除的节点
    const updatedNodes = nodes.filter(node => !allNodesToDelete.includes(node.id));

    // 过滤掉与要删除的节点相关的边
    const updatedEdges = edges.filter(edge =>
      !allNodesToDelete.includes(edge.source) && !allNodesToDelete.includes(edge.target)
    );

    setNodes(updatedNodes);
    setEdges(updatedEdges);

    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode(null);
      setShowNodeEditor(false);
    }
  };

  // 查找所有子节点ID
  const findAllChildNodeIds = (nodeId) => {
    const childIds = [];

    const findChildren = (id) => {
      const directChildren = edges
        .filter(edge => edge.source === id)
        .map(edge => edge.target);

      directChildren.forEach(childId => {
        childIds.push(childId);
        findChildren(childId);
      });
    };

    findChildren(nodeId);
    return childIds;
  };

  // 导出思维导图
  const handleExport = async (format) => {
    try {
      setShowExportOptions(false);

      const mindMapData = {
        nodes,
        edges,
        layout_type: layoutType,
        theme: theme
      };

      const result = await mindMapService.exportToImage(mindMapData, format);

      // 处理导出结果
      if (result) {
        showToastMessage(`思维导图已导出为${format.toUpperCase()}格式`);
        analyticsService.trackEvent('export_mind_map', { format });
      }
    } catch (err) {
      console.error('导出思维导图失败:', err);
      Alert.alert('错误', '导出思维导图失败，请稍后重试');
      analyticsService.trackError(err, { action: 'export_mind_map' });
    }
  };

  // 更改布局
  const handleChangeLayout = (newLayout) => {
    setLayoutType(newLayout);
    setShowLayoutOptions(false);

    // 通知MindMapView更新布局
    if (mindMapViewRef.current) {
      mindMapViewRef.current.updateLayout(newLayout);
    }
  };

  // 显示提示消息
  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // 从笔记生成思维导图
  const handleGenerateFromNote = () => {
    // 导航到笔记选择页面
    navigation.navigate('NoteList', {
      selectionMode: true,
      onNoteSelected: async (note) => {
        try {
          setLoading(true);

          const result = await mindMapService.generateFromNote(note.id);

          if (result) {
            // 更新思维导图数据
            setNodes(result.nodes || []);
            setEdges(result.edges || []);
            setTitle(result.title || `基于 ${note.title} 的思维导图`);

            showToastMessage('已从笔记生成思维导图');
            analyticsService.trackEvent('generate_mind_map_from_note', { noteId: note.id });
          }
        } catch (err) {
          console.error('从笔记生成思维导图失败:', err);
          Alert.alert('错误', '从笔记生成思维导图失败，请稍后重试');
          analyticsService.trackError(err, { action: 'generate_mind_map_from_note' });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="思维导图标题"
            placeholderTextColor={colors.placeholder}
          />
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowLayoutOptions(true)}
          >
            <Icon name="view-quilt" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowExportOptions(true)}
          >
            <Icon name="save-alt" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={saveMindMap}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>保存</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 工具栏 */}
      <MindMapToolbar
        onAddNode={() => handleAddNode()}
        onGenerateFromNote={handleGenerateFromNote}
      />

      {/* 思维导图内容 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            加载思维导图...
          </Text>
        </View>
      ) : (
        <MindMapView
          ref={mindMapViewRef}
          nodes={nodes}
          edges={edges}
          layoutType={layoutType}
          theme={theme}
          onNodePress={handleEditNode}
          onNodeLongPress={(node) => {
            Alert.alert(
              '节点操作',
              `选择对"${node.title}"的操作`,
              [
                { text: '取消', style: 'cancel' },
                { text: '编辑', onPress: () => handleEditNode(node) },
                { text: '添加子节点', onPress: () => handleAddNode(node.id) },
                {
                  text: '删除',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      '确认删除',
                      '删除此节点将同时删除其所有子节点，确定要继续吗？',
                      [
                        { text: '取消', style: 'cancel' },
                        {
                          text: '删除',
                          style: 'destructive',
                          onPress: () => handleDeleteNode(node.id)
                        }
                      ]
                    );
                  }
                }
              ]
            );
          }}
        />
      )}

      {/* 节点编辑模态框 */}
      <Modal
        visible={showNodeEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNodeEditor(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              编辑节点
            </Text>

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder="节点标题"
              placeholderTextColor={colors.placeholder}
              value={nodeTitle}
              onChangeText={setNodeTitle}
            />

            <TextInput
              style={[
                styles.textArea,
                { borderColor: colors.border, color: colors.text }
              ]}
              placeholder="节点内容（可选）"
              placeholderTextColor={colors.placeholder}
              value={nodeContent}
              onChangeText={setNodeContent}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.background }]}
                onPress={() => setShowNodeEditor(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  取消
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveNodeEdit}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  保存
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 导出选项模态框 */}
      <Modal
        visible={showExportOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportOptions(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              导出思维导图
            </Text>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => handleExport('png')}
            >
              <Icon name="image" size={24} color={colors.primary} />
              <Text style={[styles.exportOptionText, { color: colors.text }]}>
                导出为PNG图片
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => handleExport('svg')}
            >
              <Icon name="code" size={24} color={colors.primary} />
              <Text style={[styles.exportOptionText, { color: colors.text }]}>
                导出为SVG矢量图
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => {
                setShowExportOptions(false);
                // 实现导出为大纲的功能
              }}
            >
              <Icon name="format-list-bulleted" size={24} color={colors.primary} />
              <Text style={[styles.exportOptionText, { color: colors.text }]}>
                导出为文本大纲
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => setShowExportOptions(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                取消
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 布局选项模态框 */}
      {/* 布局选项模态框 */}
      <Modal
        visible={showLayoutOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLayoutOptions(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              选择布局
            </Text>

            <ScrollView style={styles.optionsScrollView}>
              <TouchableOpacity
                style={[
                  styles.layoutOption,
                  layoutType === 'tree' && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => handleChangeLayout('tree')}
              >
                <Icon
                  name="account-tree"
                  size={24}
                  color={layoutType === 'tree' ? colors.primary : colors.text}
                />
                <Text
                  style={[
                    styles.layoutOptionText,
                    { color: layoutType === 'tree' ? colors.primary : colors.text }
                  ]}
                >
                  树形布局
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.layoutOption,
                  layoutType === 'radial' && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => handleChangeLayout('radial')}
              >
                <Icon
                  name="radio-button-unchecked"
                  size={24}
                  color={layoutType === 'radial' ? colors.primary : colors.text}
                />
                <Text
                  style={[
                    styles.layoutOptionText,
                    { color: layoutType === 'radial' ? colors.primary : colors.text }
                  ]}
                >
                  放射状布局
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.layoutOption,
                  layoutType === 'horizontal' && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => handleChangeLayout('horizontal')}
              >
                <Icon
                  name="swap-horiz"
                  size={24}
                  color={layoutType === 'horizontal' ? colors.primary : colors.text}
                />
                <Text
                  style={[
                    styles.layoutOptionText,
                    { color: layoutType === 'horizontal' ? colors.primary : colors.text }
                  ]}
                >
                  水平布局
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.layoutOption,
                  layoutType === 'vertical' && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => handleChangeLayout('vertical')}
              >
                <Icon
                  name="swap-vert"
                  size={24}
                  color={layoutType === 'vertical' ? colors.primary : colors.text}
                />
                <Text
                  style={[
                    styles.layoutOptionText,
                    { color: layoutType === 'vertical' ? colors.primary : colors.text }
                  ]}
                >
                  垂直布局
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.layoutOption,
                  layoutType === 'force' && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => handleChangeLayout('force')}
              >
                <Icon
                  name="bubble-chart"
                  size={24}
                  color={layoutType === 'force' ? colors.primary : colors.text}
                />
                <Text
                  style={[
                    styles.layoutOptionText,
                    { color: layoutType === 'force' ? colors.primary : colors.text }
                  ]}
                >
                  力导向布局
                </Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                主题样式
              </Text>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  theme === 'default' && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => setTheme('default')}
              >
                <View style={[styles.themeColorPreview, { backgroundColor: colors.primary }]} />
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: theme === 'default' ? colors.primary : colors.text }
                  ]}
                >
                  默认主题
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  theme === 'colorful' && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => setTheme('colorful')}
              >
                <View style={styles.colorfulPreview}>
                  <View style={[styles.colorDot, { backgroundColor: '#4285F4' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#EA4335' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#FBBC05' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#34A853' }]} />
                </View>
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: theme === 'colorful' ? colors.primary : colors.text }
                  ]}
                >
                  多彩主题
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  theme === 'minimal' && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => setTheme('minimal')}
              >
                <View style={[styles.themeColorPreview, {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border
                }]} />
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: theme === 'minimal' ? colors.primary : colors.text }
                  ]}
                >
                  简约主题
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  theme === 'pastel' && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => setTheme('pastel')}
              >
                <View style={styles.colorfulPreview}>
                  <View style={[styles.colorDot, { backgroundColor: '#B5EAD7' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#C7CEEA' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#FFDAC1' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#FFB7B2' }]} />
                </View>
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: theme === 'pastel' ? colors.primary : colors.text }
                  ]}
                >
                  柔和主题
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  theme === 'dark' && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => setTheme('dark')}
              >
                <View style={styles.colorfulPreview}>
                  <View style={[styles.colorDot, { backgroundColor: '#2C3E50' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#34495E' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#8E44AD' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#2980B9' }]} />
                </View>
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: theme === 'dark' ? colors.primary : colors.text }
                  ]}
                >
                  深色主题
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  theme === 'professional' && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => setTheme('professional')}
              >
                <View style={styles.colorfulPreview}>
                  <View style={[styles.colorDot, { backgroundColor: '#1A237E' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#0D47A1' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#01579B' }]} />
                  <View style={[styles.colorDot, { backgroundColor: '#006064' }]} />
                </View>
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: theme === 'professional' ? colors.primary : colors.text }
                  ]}
                >
                  专业主题
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.background }]}
                onPress={() => setShowLayoutOptions(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  取消
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  // 应用当前选择的布局和主题
                  if (mindMapViewRef.current) {
                    mindMapViewRef.current.updateLayout(layoutType);
                  }
                  setShowLayoutOptions(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  应用
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 提示消息 */}
      {showToast && (
        <Toast message={toastMessage} />
      )}
    </View>
  );
};

// 样式
const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 16,
  },
  titleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: width * 0.8,
    padding: 24,
    borderRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 120,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalButtonText: {
    fontWeight: 'bold',
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exportOptionText: {
    marginLeft: 16,
    fontSize: 16,
  },
  layoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  layoutOptionText: {
    marginLeft: 16,
    fontSize: 16,
  },
  optionsScrollView: {
    maxHeight: height * 0.5,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  themeOptionText: {
    marginLeft: 16,
    fontSize: 16,
  },
  themeColorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  colorfulPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MindMapEditScreen;
