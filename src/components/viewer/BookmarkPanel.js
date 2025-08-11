import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, StyleSheet, FlatList, Alert } from 'react-native';
import { getBookmarks, addBookmark, updateBookmark, removeBookmark } from '../../services/bookmarkService';

// 书签面板：列表、添加、重命名、删除、跳转（无prompt，使用内联重命名输入框）
export default function BookmarkPanel({ visible, onClose, docId, onJump }) {
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

  useEffect(() => { if (visible) reload(); }, [visible, docId]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const item = await addBookmark(docId, { name: name.trim() });
    setName('');
    setList(prev => [...prev, item]);
  };
  
  const handleDelete = async (id) => {
    Alert.alert(
      "删除书签",
      "确定要删除这个书签吗？",
      [
        { text: "取消", style: "cancel" },
        { 
          text: "删除", 
          style: "destructive",
          onPress: async () => {
            await removeBookmark(docId, id);
            reload();
          }
        }
      ]
    );
  };
  
  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) return;
    
    Alert.alert(
      "批量删除书签",
      `确定要删除选中的 ${selectedItems.length} 个书签吗？`,
      [
        { text: "取消", style: "cancel" },
        { 
          text: "删除", 
          style: "destructive",
          onPress: async () => {
            for (const id of selectedItems) {
              await removeBookmark(docId, id);
            }
            setSelectedItems([]);
            reload();
          }
        }
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
    if (!editId) return;
    await updateBookmark(docId, editId, { name: editName.trim() || '未命名书签' });
    setEditId(null); setEditName('');
    reload();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mask}>
        <View style={styles.panel}>
          <Text style={styles.title}>书签管理</Text>
          <View style={styles.row}>
            <TextInput 
              value={name} 
              onChangeText={setName} 
              placeholder="书签名称" 
              style={styles.input} 
            />
            <TouchableOpacity 
              style={styles.btn} 
              onPress={handleAdd}
            >
              <Text style={styles.btnText}>添加</Text>
            </TouchableOpacity>
          </View>
          
          {list.length > 0 && (
            <>
              <View style={styles.listHeader}>
                <View style={styles.listHeaderLeft}>
                  <Text style={styles.listHeaderText}>书签列表</Text>
                  <TouchableOpacity 
                    style={styles.selectAllBtn} 
                    onPress={toggleSelectAll}
                  >
                    <Text style={styles.selectAllText}>
                      {selectedItems.length === list.length ? '取消全选' : '全选'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {selectedItems.length > 0 && (
                  <TouchableOpacity 
                    style={styles.batchDeleteBtn} 
                    onPress={handleBatchDelete}
                  >
                    <Text style={styles.batchDeleteText}>删除选中({selectedItems.length})</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.tipText}>提示：长按书签项可快速选择</Text>
            </>
          )}
          
          <FlatList
            data={list}
            keyExtractor={item => item.id}
            ListEmptyComponent={<Text style={styles.emptyText}>暂无书签</Text>}
            style={styles.bookmarkList}
            showsVerticalScrollIndicator={true}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                delayLongPress={300}
                onLongPress={() => toggleSelect(item.id)}
                style={[
                  styles.itemRow,
                  selectedItems.includes(item.id) && styles.selectedItem
                ]}
              >
                <TouchableOpacity 
                  style={styles.selectBox} 
                  onPress={() => toggleSelect(item.id)}
                >
                  <View style={[
                    styles.checkbox,
                    selectedItems.includes(item.id) && styles.checkboxSelected
                  ]}>
                    {selectedItems.includes(item.id) && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
                
                {editId === item.id ? (
                  <View style={{ flex:1, flexDirection:'row', alignItems:'center' }}>
                    <TextInput 
                      style={[styles.input, { marginRight:8 }]} 
                      value={editName} 
                      onChangeText={setEditName} 
                    />
                    <TouchableOpacity 
                      style={styles.btn} 
                      onPress={submitEdit}
                    >
                      <Text style={styles.btnText}>保存</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.itemName}>{item.name}</Text>
                )}
                
                <View style={styles.itemOps}>
                  <TouchableOpacity
                    style={styles.op}
                    onPress={() => {
                      console.log('Jump to bookmark:', item);
                      try {
                        if (onJump) {
                          const payload = { id: item.id, page: item.page ?? 1, offsetY: item.offsetY ?? 0, name: item.name };
                          console.log('onJump invoking with:', payload);
                          onJump(payload);
                        } else {
                          console.error('onJump callback is not provided!');
                        }
                      } catch (err) {
                        console.error('onJump error:', err);
                      }
                    }}
                  >
                    <Text style={styles.opText}>跳转</Text>
                  </TouchableOpacity>
                  
                  {editId === item.id ? (
                    <TouchableOpacity 
                      style={styles.op} 
                      onPress={() => { setEditId(null); setEditName(''); }}
                    >
                      <Text style={styles.opText}>取消</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.op} 
                      onPress={() => startEdit(item)}
                    >
                      <Text style={styles.opText}>重命名</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={[styles.op, styles.deleteOp]} 
                    onPress={() => handleDelete(item.id)}
                  >
                    <Text style={styles.deleteText}>删除</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />
          
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.clearSelectBtn} 
              onPress={() => setSelectedItems([])}
              disabled={selectedItems.length === 0}
            >
              <Text style={[
                styles.clearSelectText, 
                selectedItems.length === 0 && styles.disabledText
              ]}>
                清除选择
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.btn, {alignSelf:'flex-end'}]} 
              onPress={() => {
                if (editId) {
                  Alert.alert(
                    "未保存的更改",
                    "您有未保存的编辑内容，确定要关闭吗？",
                    [
                      { text: "取消", style: "cancel" },
                      { text: "确定", onPress: onClose }
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
  mask: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' },
  panel: { width:'90%', maxHeight:'80%', backgroundColor:'#fff', borderRadius:12, padding:16, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  title: { fontSize:20, fontWeight:'700', marginBottom:16, color: '#333' },
  row: { flexDirection:'row', alignItems:'center', marginBottom:16 },
  input: { flex:1, borderWidth:1, borderColor:'#ddd', borderRadius:8, paddingHorizontal:12, height:40, fontSize: 15 },
  btn: { backgroundColor:'#2f80ed', paddingHorizontal:14, paddingVertical:10, borderRadius:8, marginLeft:10 },
  btnText: { color:'#fff', fontWeight: '600' },
  
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
  listHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  listHeaderText: { fontSize: 16, fontWeight: '600', color: '#555', marginRight: 10 },
  selectAllBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#e8f0fe', borderRadius: 4, borderWidth: 1, borderColor: '#c6d8f0' },
  selectAllText: { color: '#2f80ed', fontSize: 12 },
  batchDeleteBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ff6b6b', borderRadius: 6 },
  batchDeleteText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bookmarkList: { maxHeight: 300 },
  tipText: { fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 8 },
  
  itemRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:1, borderColor:'#eee', marginVertical: 2 },
  selectedItem: { backgroundColor: 'rgba(47, 128, 237, 0.1)' },
  selectBox: { marginRight: 10, padding: 4 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: '#aaa', borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#2f80ed', borderColor: '#2f80ed' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  
  itemName: { fontSize:15, flex: 1, color: '#333' },
  itemOps: { flexDirection:'row' },
  op: { paddingHorizontal:10, paddingVertical:6, backgroundColor:'#f1f3f5', borderRadius:8, marginLeft:8, borderWidth: 1, borderColor: '#e0e0e0' },
  opText: { color: '#555', fontSize: 13 },
  deleteOp: { backgroundColor: '#fff0f0', borderColor: '#ffcdd2' },
  deleteText: { color: '#e53935', fontSize: 13 },
  
  footer: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyText: { textAlign: 'center', padding: 20, color: '#999', fontStyle: 'italic' },
  clearSelectBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#ddd' },
  clearSelectText: { color: '#666' },
  disabledText: { color: '#ccc' }
});

