import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { getVersions } from '../../../services/api/noteVersionApi';

// A simple right-side drawer implemented via Modal
// Props:
// - noteId (string)
// - visible (bool)
// - onRequestClose () => void
// - onRestore (versionId) => void
// - onCompare (fromId, toId) => void
// - theme (optional)
export default function VersionHistoryDrawer({ noteId, visible, onRequestClose, onRestore, onCompare, theme }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]); // store version ids

  const load = useCallback(async (p = page) => {
    if (!noteId) {return;}
    try {
      setLoading(true);
      setError(null);
      const res = await getVersions(noteId, { page: p, pageSize });
      setItems(res.items || []);
      setTotal(res.total || 0);
      setPage(res.page || p);
      setPageSize(res.pageSize || pageSize);
    } catch (e) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [noteId, page, pageSize]);

  useEffect(() => {
    if (visible) {load(1);}
  }, [visible]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const exists = prev.includes(id);
      if (exists) {return prev.filter(x => x !== id);}
      if (prev.length >= 2) {return [prev[1], id];}
      return [...prev, id];
    });
  };

  const compare = () => {
    if (selected.length !== 2) {return;}
    onCompare && onCompare(selected[0], selected[1]);
  };

  const restore = (id) => {
    onRestore && onRestore(id);
  };

  const themed = (base) => {
    if (!theme) {return base;}
    return {
      ...base,
      backgroundColor: base.backgroundColor || theme.colors?.card,
      color: base.color || theme.colors?.text,
      borderColor: theme.colors?.border,
    };
  };

  const renderItem = ({ item }) => {
    const isSel = selected.includes(item.id);
    return (
      <TouchableOpacity style={[styles.row, isSel && styles.rowSelected]} onPress={() => toggleSelect(item.id)}>
        <View style={{ flex: 1 }}>
          <Text style={themed(styles.title)}>v{item.version_number} {item.is_auto_save ? '· (Auto)' : ''}</Text>
          <Text style={themed(styles.desc)} numberOfLines={1}>{item.description || '无说明'}</Text>
          <Text style={themed(styles.meta)} numberOfLines={1}>{new Date(item.created_at).toLocaleString?.() || ''}</Text>
        </View>
        <TouchableOpacity style={styles.restoreBtn} onPress={() => restore(item.id)}>
          <Text style={styles.restoreBtnText}>恢复</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const canPrev = page > 1;
  const canNext = page * pageSize < total;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <View style={themed(styles.panel)}>
          <View style={themed(styles.header)}>
            <Text style={themed(styles.headerTitle)}>历史版本</Text>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={() => load(page)} style={styles.headerBtn}><Text>刷新</Text></TouchableOpacity>
              <TouchableOpacity onPress={onRequestClose} style={styles.headerBtn}><Text>关闭</Text></TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.center}><ActivityIndicator /></View>
          ) : error ? (
            <View style={styles.center}><Text style={{ color: 'red' }}>{error}</Text></View>
          ) : (
            <>
              <FlatList
                data={items}
                keyExtractor={(it) => String(it.id)}
                renderItem={renderItem}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<View style={styles.center}><Text>暂无版本</Text></View>}
              />
              <View style={styles.footer}>
                <View style={styles.pager}>
                  <TouchableOpacity disabled={!canPrev} onPress={() => { if (canPrev) {load(page - 1);} }} style={[styles.pagerBtn, !canPrev && styles.disabled]}>
                    <Text>{'‹ 上一页'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.pageText}>{page} / {Math.max(1, Math.ceil((total || 0) / (pageSize || 1)))}</Text>
                  <TouchableOpacity disabled={!canNext} onPress={() => { if (canNext) {load(page + 1);} }} style={[styles.pagerBtn, !canNext && styles.disabled]}>
                    <Text>{'下一页 ›'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity disabled={selected.length !== 2} onPress={compare} style={[styles.compareBtn, selected.length !== 2 && styles.disabled]}>
                  <Text style={styles.compareBtnText}>对比选中</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  panel: {
    width: '85%',
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderColor: '#ddd',
    paddingBottom: 8,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
    backgroundColor: '#F2F3F5',
    borderRadius: 6,
  },
  list: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'center',
  },
  rowSelected: {
    backgroundColor: '#F6F8FF',
    borderRadius: 6,
    paddingHorizontal: 6,
  },
  title: {
    fontWeight: '600',
  },
  desc: {
    opacity: 0.8,
    marginTop: 2,
  },
  meta: {
    opacity: 0.6,
    marginTop: 2,
    fontSize: 12,
  },
  restoreBtn: {
    backgroundColor: '#FFE8E6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  restoreBtnText: {
    color: '#B00020',
    fontWeight: '600',
  },
  sep: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 6,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pagerBtn: {
    backgroundColor: '#F2F3F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  compareBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#2F54EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  compareBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  center: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
