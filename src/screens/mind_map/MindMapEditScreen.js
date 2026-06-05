/**
 * 思维导图编辑屏幕
 * 本地优先加载与保存
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { Toast } from '../../components/common';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import MindMapToolbar from '../../components/mind_map/MindMapToolbar';
import MindMapView from '../../components/mind_map/MindMapView';
import mindMapApi from '../../services/api/mindMapApi';
import analyticsService from '../../services/analytics/analyticsService';
import mindMapService from '../../services/ai/mindMapService';

const { width, height } = Dimensions.get('window');

const THEME_SWATCHES = {
  default: [null],
  colorful: ['#4285F4', '#EA4335', '#FBBC05', '#34A853'],
  pastel: ['#B5EAD7', '#C7CEEA', '#FFDAC1', '#FFB7B2'],
  dark: ['#2C3E50', '#34495E', '#8E44AD', '#2980B9'],
  professional: ['#1A237E', '#0D47A1', '#01579B', '#006064'],
};

const MindMapEditScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors);
  const { mindMapId } = route.params || {};

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
  const [layoutApplying, setLayoutApplying] = useState(false);


  const mindMapViewRef = useRef(null);

  const showToastMessage = useCallback((message) => {
    setToastMessage(message);
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  }, []);

  const loadMindMap = useCallback(async () => {
    if (!mindMapId) {
      setTitle('未命名思维导图');
      setDescription('');
      setNodes([]);
      setEdges([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await mindMapApi.getMindMapById(mindMapId);

      if (!response.success) {
        throw new Error(response.message || '加载思维导图失败');
      }

      const data = response.data;
      setTitle(data.title || '未命名思维导图');
      setDescription(data.description || '');
      setLayoutType(data.layout_type || 'tree');
      setTheme(data.theme || 'default');
      setNodes(data.nodes || data.data?.nodes || []);
      setEdges(data.edges || data.data?.edges || []);
      analyticsService.trackEvent('view_mind_map', { id: mindMapId, local_first: true });
    } catch (err) {
      console.error('加载思维导图失败:', err);
      setTitle('未命名思维导图');
      setDescription('');
      setNodes([]);
      setEdges([]);
      showToastMessage(err?.message || '加载失败，已切换为空白画布');
      analyticsService.trackError(err, { action: 'load_mind_map' });
    } finally {
      setLoading(false);
    }
  }, [mindMapId, showToastMessage]);

  useEffect(() => {
    loadMindMap();
  }, [loadMindMap]);

  const saveMindMap = async () => {
    if (!title.trim()) {
      showToastMessage('请输入思维导图标题');
      return;
    }

    const mindMapData = {
      title: title.trim(),
      description: description.trim(),
      layout_type: layoutType,
      theme,
      data: {
        nodes,
        edges,
      },
    };

    try {
      setSaving(true);
      const response = mindMapId
        ? await mindMapApi.updateMindMap(mindMapId, mindMapData)
        : await mindMapApi.createMindMap(mindMapData);

      if (!response.success || !response.data?.id) {
        throw new Error(mindMapId ? '更新思维导图失败' : '创建思维导图失败');
      }

      const savedMindMap = response.data;
      setTitle(savedMindMap.title || title);
      setDescription(savedMindMap.description || '');
      setLayoutType(savedMindMap.layout_type || 'tree');
      setTheme(savedMindMap.theme || 'default');
      setNodes(savedMindMap.nodes || savedMindMap.data?.nodes || []);
      setEdges(savedMindMap.edges || savedMindMap.data?.edges || []);

      if (!mindMapId) {
        navigation.setParams({ mindMapId: savedMindMap.id });
      }

      showToastMessage(mindMapId ? '思维导图已保存' : '思维导图已创建');
      analyticsService.trackEvent('save_mind_map', { id: savedMindMap.id, local_first: true });
    } catch (err) {
      console.error('保存思维导图失败:', err);
      showToastMessage(err?.message || '保存思维导图失败，请稍后重试');
      analyticsService.trackError(err, { action: 'save_mind_map' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddNode = (parentId = null) => {
    const newNode = {
      id: `node-${Date.now()}`,
      title: '新节点',
      content: '',
      parent_id: parentId,
      x: 0,
      y: 0,
      type: parentId ? 'topic' : 'root',
    };

    setNodes((current) => [...current, newNode]);

    if (parentId) {
      const newEdge = {
        id: `edge-${Date.now()}`,
        source: parentId,
        target: newNode.id,
        style: 'solid',
        type: 'default',
      };

      setEdges((current) => [...current, newEdge]);
    }

    setSelectedNode(newNode);
    setNodeTitle(newNode.title);
    setNodeContent(newNode.content);
    setShowNodeEditor(true);
  };

  const handleEditNode = (node) => {
    setSelectedNode(node);
    setNodeTitle(node.title || '');
    setNodeContent(node.content || '');
    setShowNodeEditor(true);
  };

  const handleSaveNodeEdit = () => {
    if (!selectedNode) {
      return;
    }

    if (!nodeTitle.trim()) {
      showToastMessage('请输入节点标题');
      return;
    }

    setNodes((current) => current.map((node) => (
      node.id === selectedNode.id
        ? { ...node, title: nodeTitle.trim(), content: nodeContent.trim() }
        : node
    )));
    setShowNodeEditor(false);
    setSelectedNode(null);
  };

  const findAllChildNodeIds = (nodeId) => {
    const childIds = [];

    const findChildren = (id) => {
      const directChildren = edges
        .filter((edge) => edge.source === id)
        .map((edge) => edge.target);

      directChildren.forEach((childId) => {
        childIds.push(childId);
        findChildren(childId);
      });
    };

    findChildren(nodeId);
    return childIds;
  };

  const handleDeleteNode = (nodeId) => {
    const childNodeIds = findAllChildNodeIds(nodeId);
    const allNodesToDelete = [nodeId, ...childNodeIds];

    setNodes((current) => current.filter((node) => !allNodesToDelete.includes(node.id)));
    setEdges((current) => current.filter((edge) => (
      !allNodesToDelete.includes(edge.source) && !allNodesToDelete.includes(edge.target)
    )));

    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setShowNodeEditor(false);
    }
  };

  const handleExport = async (format) => {
    try {
      setShowExportOptions(false);
      const result = await mindMapService.exportToImage({
        nodes,
        edges,
        layout_type: layoutType,
        theme,
      }, format);

      if (result) {
        showToastMessage(`思维导图已导出为 ${format.toUpperCase()}`);
        analyticsService.trackEvent('export_mind_map', { format });
      }
    } catch (err) {
      console.error('导出思维导图失败:', err);
      showToastMessage(err?.message || '导出失败，请稍后重试');
      analyticsService.trackError(err, { action: 'export_mind_map' });
    }
  };

  const handleChangeLayout = (newLayout) => {
    setLayoutType(newLayout);
    if (mindMapViewRef.current?.updateLayout) {
      mindMapViewRef.current.updateLayout(newLayout);
    }
  };

  const applyLayoutAndTheme = () => {
    setLayoutApplying(true);

    try {
      if (mindMapViewRef.current?.updateLayout) {
        mindMapViewRef.current.updateLayout(layoutType);
      }
      showToastMessage('布局与主题已应用');
    } catch (err) {
      console.error('应用布局与主题失败:', err);
      showToastMessage('应用失败，请重试');
      analyticsService.trackError(err, { action: 'apply_layout_theme' });
    } finally {
      setLayoutApplying(false);
      setShowLayoutOptions(false);
    }
  };

  const handleGenerateFromNote = () => {
    navigation.navigate('NoteList', {
      selectionMode: true,
      onNoteSelected: async (note) => {
        try {
          setLoading(true);
          const result = await mindMapService.generateFromNote(note.id);

          if (result) {
            setNodes(result.nodes || []);
            setEdges(result.edges || []);
            setTitle(result.title || `基于 ${note.title} 的思维导图`);
            showToastMessage('已从笔记生成思维导图');
            analyticsService.trackEvent('generate_mind_map_from_note', { noteId: note.id });
          }
        } catch (err) {
          console.error('从笔记生成思维导图失败:', err);
          showToastMessage(err?.message || '生成失败，请稍后重试');
          analyticsService.trackError(err, { action: 'generate_mind_map_from_note' });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <ScreenHeaderBackButton
            onPress={() => navigation.goBack()}
            testID="action.mindMapEdit.back"
            style={styles.backButton}
          />

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

      <MindMapToolbar
        onAddNode={() => handleAddNode()}
        onGenerateFromNote={handleGenerateFromNote}
        onResetZoom={() => mindMapViewRef.current?.resetView?.()}
        onZoomIn={() => mindMapViewRef.current?.zoomIn?.()}
        onZoomOut={() => mindMapViewRef.current?.zoomOut?.()}
      />

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
              `选择对“${node.title}”的操作`,
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
                      '删除此节点将同时删除其所有子节点，确定继续吗？',
                      [
                        { text: '取消', style: 'cancel' },
                        {
                          text: '删除',
                          style: 'destructive',
                          onPress: () => handleDeleteNode(node.id),
                        },
                      ]
                    );
                  },
                },
              ]
            );
          }}
        />
      )}

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
            <Text style={[styles.modalTitle, { color: colors.text }]}>编辑节点</Text>

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder="节点标题"
              placeholderTextColor={colors.placeholder}
              value={nodeTitle}
              onChangeText={setNodeTitle}
            />

            <TextInput
              style={[styles.textArea, { borderColor: colors.border, color: colors.text }]}
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
                <Text style={[styles.modalButtonText, { color: colors.text }]}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveNodeEdit}
              >
                <Text style={styles.modalButtonTextInverse}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showExportOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportOptions(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>导出思维导图</Text>

            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport('png')}>
              <Icon name="image" size={24} color={colors.primary} />
              <Text style={[styles.exportOptionText, { color: colors.text }]}>导出为 PNG 图片</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport('svg')}>
              <Icon name="code" size={24} color={colors.primary} />
              <Text style={[styles.exportOptionText, { color: colors.text }]}>导出为 SVG 矢量图</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => setShowExportOptions(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLayoutOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLayoutOptions(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>选择布局和主题</Text>

            <ScrollView style={styles.optionsScrollView}>
              {[
                ['tree', 'account-tree', '树形布局'],
                ['radial', 'radio-button-unchecked', '放射布局'],
                ['horizontal', 'swap-horiz', '水平布局'],
                ['vertical', 'swap-vert', '垂直布局'],
                ['force', 'bubble-chart', '力导向布局'],
              ].map(([value, icon, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.layoutOption,
                    layoutType === value && { backgroundColor: colors.primaryLight },
                  ]}
                  onPress={() => handleChangeLayout(value)}
                >
                  <Icon name={icon} size={24} color={layoutType === value ? colors.primary : colors.text} />
                  <Text
                    style={[
                      styles.layoutOptionText,
                      { color: layoutType === value ? colors.primary : colors.text },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}

              <View style={styles.divider} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>主题样式</Text>

              {Object.entries(THEME_SWATCHES).map(([themeKey, swatches]) => (
                <TouchableOpacity
                  key={themeKey}
                  style={[
                    styles.themeOption,
                    theme === themeKey && { backgroundColor: colors.primaryLight },
                  ]}
                  onPress={() => setTheme(themeKey)}
                >
                  {themeKey === 'default' ? (
                    <View style={[styles.themeColorPreview, { backgroundColor: colors.primary }]} />
                  ) : themeKey === 'minimal' ? (
                    <View
                      style={[
                        styles.themeColorPreview,
                        { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
                      ]}
                    />
                  ) : (
                    <View style={styles.colorfulPreview}>
                      {swatches.map((color) => (
                        <View key={color} style={[styles.colorDot, { backgroundColor: color }]} />
                      ))}
                    </View>
                  )}

                  <Text
                    style={[
                      styles.themeOptionText,
                      { color: theme === themeKey ? colors.primary : colors.text },
                    ]}
                  >
                    {{
                      default: '默认主题',
                      colorful: '多彩主题',
                      minimal: '简约主题',
                      pastel: '柔和主题',
                      dark: '深色主题',
                      professional: '专业主题',
                    }[themeKey]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.background }]}
                onPress={() => setShowLayoutOptions(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={applyLayoutAndTheme}
                disabled={layoutApplying}
                accessibilityRole="button"
                accessibilityLabel="应用布局与主题"
              >
                {layoutApplying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonTextInverse}>应用</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showToast ? <Toast message={toastMessage} /> : null}
    </SafeAreaView>
  );
};

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
    marginRight: 12,
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
  modalButtonTextInverse: {
    fontWeight: 'bold',
    color: '#fff',
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
  optionsScrollView: {
    maxHeight: height * 0.5,
    marginBottom: 16,
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
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
