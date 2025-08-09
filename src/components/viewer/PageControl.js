import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Platform, PanResponder, Dimensions } from 'react-native';

// 一个可拖拽的页码控件（含输入框、上下页按钮），带“一”形拖拽标记
const PageControl = ({
  total = 1,
  current = 1,
  onPrev,
  onNext,
  onSubmitPage,
  storageKey = 'viewer_pagecontrol_pos',
  style,
}) => {
  const [value, setValue] = useState(String(current));
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  // 恢复位置
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { offlineStorageService } = require('../../services/offline');
        const saved = await offlineStorageService.getItem(storageKey);
        if (!cancelled && saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') { setPos(parsed); return; }
        }
      } catch {}
      // 默认放在底部居中偏上的位置
      if (!cancelled) {
        const { width, height } = Dimensions.get('window');
        const def = { x: Math.max(16, width / 2 - 100), y: Math.max(16, height - 120) };
        setPos(def);
      }
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // 保存位置
  const persistPos = async (p) => {
    try {
      const { offlineStorageService } = require('../../services/offline');
      await offlineStorageService.setItem(storageKey, JSON.stringify(p));
    } catch {}
  };

  // 同步输入框
  useEffect(() => setValue(String(current)), [current]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, g) => g.numberActiveTouches === 1,
      onMoveShouldSetPanResponder: (_, g) => g.dx * g.dx + g.dy * g.dy > 9,
      onPanResponderGrant: (e) => {
        dragging.current = true;
        offset.current = { x: e.nativeEvent.pageX - pos.x, y: e.nativeEvent.pageY - pos.y };
      },
      onPanResponderMove: (e) => {
        if (!dragging.current) return;
        const next = { x: e.nativeEvent.pageX - offset.current.x, y: e.nativeEvent.pageY - offset.current.y };
        setPos(next);
      },
      onPanResponderRelease: () => {
        if (!dragging.current) return;
        dragging.current = false;
        persistPos(pos);
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => { dragging.current = false; },
    })
  ).current;

  return (
    <View style={[styles.wrapper, { transform: [{ translateX: pos.x }, { translateY: pos.y }] }]} pointerEvents="box-none">
      {/* “一”形拖拽标记 */}
      <View style={styles.dragHandle} {...pan.panHandlers} />

      {/* 控件本体 */}
      <View style={[styles.container, style]}>
        <TouchableOpacity onPress={onPrev} style={styles.navBtn}>
          <Text style={styles.navText}>{'<'}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={value}
          onChangeText={setValue}
          onSubmitEditing={() => {
            const n = parseInt(value, 10);
            if (!isNaN(n)) onSubmitPage?.(n);
          }}
          onBlur={() => {
            const n = parseInt(value, 10);
            if (!isNaN(n)) onSubmitPage?.(n);
          }}
        />
        <Text style={styles.sep}>/ {total}</Text>
        <TouchableOpacity onPress={onNext} style={styles.navBtn}>
          <Text style={styles.navText}>{'>'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 25,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 24,
    height: 4,
    borderRadius: 2,
    marginBottom: 6,
    backgroundColor: '#AAB4BE',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#cadff0ff',
    borderRadius: 8,
    paddingVertical: 0,
    paddingHorizontal: 1,
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  navText: { fontSize: 14, color: '#222' },
  input: {
    paddingHorizontal: 20,
    maxWidth: 60,
    height: Platform.OS === 'ios' ? 28 : 32,
    minWidth: 40,
    borderRadius: 6,
    backgroundColor: '#fff',
    textAlign: 'center',
    marginHorizontal: 4,
  },
  sep: { fontSize: 12, color: '#333', fontWeight: '500', marginRight: 8 },
});

export default PageControl;

