import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, StyleSheet, FlatList, Alert } from 'react-native';
import { getBookmarks, addBookmark, updateBookmark, removeBookmark } from '../../services/bookmarkService';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS, ELEVATION, SIZE, BORDER } from '../../theme/tokens';
import Icon from 'react-native-vector-icons/MaterialIcons';

// 书签面板：列表、添加、重命名、删除、跳转（无prompt，使用内联重命名输入框）
// Refactored with Design Tokens
export default function BookmarkPanel({ visible, onClose, docId, onJump }) {
  const { theme } = useTheme();
  // Ensure correct color references
  const colors = theme.colors || theme;

  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);

  const reload = async () => {
    try {
      const response = await getBookmarks(docId);
      console.log('Bookmark data:', response);
      if (typeof response === 'string') {
        const data = JSON.parse(response);
        setList(data);
      } else {
        setList(response);
      }
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
      Alert.alert('错误', '加载书签失败，请稍后重试');
      setList([]);
    }
  };

  useEffect(() => { if (visible) {reload();} }, [visible, docId]);

  const handleAdd = async () => {
    if (!name.trim()) {return;}
    const item = await addBookmark(docId, { name: name.trim() });
    setName('');
    setList(prev => [...prev, item]);
  };

  const handleDelete = async (id) => {
    Alert.alert(
      '删除书签',
      '确定要删除这个书签吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await removeBookmark(docId, id);
            reload();
          },
        },
      ]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) {return;}

    Alert.alert(
      '批量删除书签',
      `确定要删除选中的 ${selectedItems.length} 个书签吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedItems) {
              await removeBookmark(docId, id);
            }
            setSelectedItems([]);
            reload();
          },
        },
      ]
    );
  };

  const toggleSelect = (id) => {
    setSelectedItems(prev =>
      prev.includes(id)
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === list.length) {
      // 如果已经全选，则取消全选
      setSelectedItems([]);
    } else {
      // 否则全选
      setSelectedItems(list.map(item => item.id));
    }
  };

  const startEdit = (item) => { setEditId(item.id); setEditName(item.name); };
  const submitEdit = async () => {
    if (!editId) {return;}
    await updateBookmark(docId, editId, { name: editName.trim() || '未命名书签' });
    setEditId(null); setEditName('');
    reload();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mask}>
        <View style={[styles.panel, { backgroundColor: colors.card || '#fff' }]}>
          <Text style={[styles.title, { color: colors.text }]}>书签管理</Text>
          <View style={styles.row}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="书签名称"
              placeholderTextColor={colors.textSecondary || '#999'}
              style={[styles.input, { borderColor: colors.border || '#ddd', color: colors.text }]}
            />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary || '#2f80ed' }]}
              onPress={handleAdd}
            >
              <Text style={styles.btnText}>添加</Text>
            </TouchableOpacity>
          </View>

          {list.length > 0 && (
            <>
              <View style={styles.listHeader}>
                <View style={styles.listHeaderLeft}>
                  <Text style={[styles.listHeaderText, { color: colors.textSecondary || '#555' }]}>书签列表</Text>
                  <TouchableOpacity
                    style={[styles.selectAllBtn, { backgroundColor: (colors.primary || '#2f80ed') + '10', borderColor: (colors.primary || '#2f80ed') + '40' }]}
                    onPress={toggleSelectAll}
                  >
                    <Text style={[styles.selectAllText, { color: colors.primary || '#2f80ed' }]}>
                      {selectedItems.length === list.length ? '取消全选' : '全选'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {selectedItems.length > 0 && (
                  <TouchableOpacity
                    style={[styles.batchDeleteBtn, { backgroundColor: colors.error || '#ff6b6b' }]}
                    onPress={handleBatchDelete}
                  >
                    <Text style={styles.batchDeleteText}>删除选中({selectedItems.length})</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.tipText, { color: colors.textTertiary || '#888' }]}>提示：长按书签项可快速选择</Text>
            </>
          )}

          <FlatList
            data={list}
            keyExtractor={item => item.id}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无书签</Text>}
            style={styles.bookmarkList}
            showsVerticalScrollIndicator={true}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                delayLongPress={300}
                onLongPress={() => toggleSelect(item.id)}
                style={[
                  styles.itemRow,
                  selectedItems.includes(item.id) && { backgroundColor: (colors.primary || '#2f80ed') + '10' },
                  { borderBottomColor: colors.border || '#eee' },
                ]}
              >
                <TouchableOpacity
                  style={styles.selectBox}
                  onPress={() => toggleSelect(item.id)}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: colors.textSecondary || '#aaa' },
                    selectedItems.includes(item.id) && { backgroundColor: colors.primary || '#2f80ed', borderColor: colors.primary || '#2f80ed' },
                  ]}>
                    {selectedItems.includes(item.id) && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>

                {editId === item.id ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      style={[styles.input, { marginRight: SPACING.sm, borderColor: colors.border, color: colors.text }]}
                      value={editName}
                      onChangeText={setEditName}
                    />
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: colors.primary }]}
                      onPress={submitEdit}
                    >
                      <Text style={styles.btnText}>保存</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                )}

                <View style={styles.itemOps}>
                  <TouchableOpacity
                    style={[styles.op, { backgroundColor: colors.background || '#f1f3f5', borderColor: colors.border || '#e0e0e0' }]}
                    onPress={() => {
                      try {
                        if (onJump) {
                          onJump({ id: item.id, page: item.page ?? 1, offsetY: item.offsetY ?? 0, name: item.name });
                          onClose(); // Optional: close panel on jump
                        }
                      } catch (err) {
                        console.error('onJump error:', err);
                      }
                    }}
                  >
                    <Text style={[styles.opText, { color: colors.textSecondary }]}>跳转</Text>
                  </TouchableOpacity>

                  {editId === item.id ? (
                    <TouchableOpacity
                      style={[styles.op, { backgroundColor: colors.background, borderColor: colors.border }]}
                      onPress={() => { setEditId(null); setEditName(''); }}
                    >
                      <Text style={[styles.opText, { color: colors.textSecondary }]}>取消</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.op, { backgroundColor: colors.background, borderColor: colors.border }]}
                      onPress={() => startEdit(item)}
                    >
                      <Text style={[styles.opText, { color: colors.textSecondary }]}>重命名</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.op, { backgroundColor: (colors.error || '#ff6b6b') + '10', borderColor: (colors.error || '#ff6b6b') + '40' }]}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Text style={[styles.deleteText, { color: colors.error || '#e53935' }]}>删除</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.clearSelectBtn, { borderColor: colors.border }]}
              onPress={() => setSelectedItems([])}
              disabled={selectedItems.length === 0}
            >
              <Text style={[
                styles.clearSelectText,
                { color: colors.textSecondary },
                selectedItems.length === 0 && { color: colors.textTertiary || '#ccc' },
              ]}>
                清除选择
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { alignSelf: 'flex-end', backgroundColor: colors.primary || '#2f80ed' }]}
              onPress={() => {
                if (editId) {
                  Alert.alert(
                    '未保存的更改',
                    '您有未保存的编辑内容，确定要关闭吗？',
                    [
                      { text: '取消', style: 'cancel' },
                      { text: '确定', onPress: onClose },
                    ]
                  );
                } else {
                  onClose();
                }
              }}
            >
              <Text style={styles.btnText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...ELEVATION.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  input: {
    flex: 1,
    borderWidth: BORDER.width.thin,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    height: 40,
    fontSize: 15,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  listHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: SPACING.sm,
  },
  selectAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
    borderWidth: BORDER.width.thin,
  },
  selectAllText: {
    fontSize: 12,
  },
  batchDeleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  batchDeleteText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bookmarkList: {
    maxHeight: 300,
  },
  tipText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
    marginVertical: 2,
  },
  selectBox: {
    marginRight: SPACING.sm,
    padding: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: RADIUS.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemName: {
    fontSize: 15,
    flex: 1,
  },
  itemOps: {
    flexDirection: 'row',
  },
  op: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    marginLeft: SPACING.xs,
    borderWidth: BORDER.width.thin,
  },
  opText: {
    fontSize: 13,
  },
  deleteText: {
    fontSize: 13,
  },
  footer: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
  clearSelectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: BORDER.width.thin,
  },
  clearSelectText: {
    // color inherited
  },
});
