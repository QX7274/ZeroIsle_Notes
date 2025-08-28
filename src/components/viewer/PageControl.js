import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Platform, PanResponder, Dimensions, Keyboard } from 'react-native';

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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const originalPos = useRef(pos);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        // 只有在输入框获得焦点时才移动控件
        if (isInputFocused) {
          setKeyboardHeight(e.endCoordinates.height);
          const { height } = Dimensions.get('window');
          setPos(prev => ({
            ...prev,
            y: height - e.endCoordinates.height - 100
          }));
        }
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsInputFocused(false);
        // 键盘隐藏后，始终回到底部中央位置
        const { width, height } = Dimensions.get('window');
        const bottomCenterPos = {
          x: Math.max(16, width / 2 - 70),
          y: Math.max(16, height - 120)
        };
        setPos(bottomCenterPos);
        // 保存新位置
        persistPos(bottomCenterPos);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [isInputFocused]);

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
      // 默认放在底部居中的位置，确保可见
      if (!cancelled) {
        const { width, height } = Dimensions.get('window');
        // 底部居中位置，上移到更合适的位置
        const def = {
          x: Math.max(16, width / 2 - 60),
          y: Math.max(16, height - 200) // 上移80像素，确保在可见区域内
        };
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
  useEffect(() => {
    setValue(String(current));
  }, [current]);

  // 监听屏幕方向变化，调整位置（但不在键盘操作时）
  useEffect(() => {
    const updatePosition = () => {
      // 如果键盘正在显示或输入框获得焦点，不调整位置
      if (keyboardHeight > 0 || isInputFocused) {
        return;
      }

      const { width, height } = Dimensions.get('window');
      const orientation = width > height ? 'landscape' : 'portrait';
      // 确保控件在底部居中，上移到更合适的位置
      const newPos = orientation === 'portrait'
        ? { x: Math.max(16, width / 2 - 70), y: Math.max(16, height - 200) }
        : { x: Math.max(16, width / 2 - 70), y: Math.max(16, height - 200) };
      setPos(newPos);
      persistPos(newPos);
    };

    const dimensionsListener = Dimensions.addEventListener('change', updatePosition);

    return () => {
      dimensionsListener.remove();
    };
  }, [keyboardHeight, isInputFocused]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, g) => g.numberActiveTouches === 1,
      onMoveShouldSetPanResponder: (_, g) => g.dx * g.dx + g.dy * g.dy > 9,
      onPanResponderGrant: (e) => {
        dragging.current = true;
        offset.current = { x: e.nativeEvent.locationX - pos.x, y: e.nativeEvent.locationY - pos.y };
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
        <View style={styles.pageInfoContainer}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={value}
              onChangeText={setValue}
              onFocus={() => setIsInputFocused(true)}
              onSubmitEditing={() => {
                const n = parseInt(value, 10);
                if (!isNaN(n)) onSubmitPage?.(n);
                setIsInputFocused(false);
              }}
              onBlur={() => {
                const n = parseInt(value, 10);
                if (!isNaN(n)) onSubmitPage?.(n);
                setIsInputFocused(false);
              }}
              underlineColorAndroid="transparent"
              selectionColor="#222"
            />
          </View>
          <Text style={styles.sep}>/ {total}</Text>
        </View>
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
    height: 3,
    borderRadius: 2,
    marginBottom: 8,
    backgroundColor: '#AAB4BE',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#cadff0ff', // 默认背景色
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 0,
    height: 24,
    minWidth: 120,
    width: 'auto',
    overflow: 'hidden',
  },
  pageInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  inputContainer: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
    backgroundColor: 'transparent',
    marginLeft: 0,
    marginRight: 0,
    flex: 0,
  },
  navBtn: {
    paddingVertical: 0,
    width: 24,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
  navText: { 
    fontSize: 12, 
    color: '#222',
    textAlign: 'center',
  },
  input: {
    paddingHorizontal: 0,
    maxWidth: 36,
    height: '100%',
    minWidth: 36,
    borderRadius: 4,
    backgroundColor: 'transparent',
    textAlign: 'center',
    marginRight: 0,
    marginLeft: 0,
    color: '#222',
    fontWeight: '500',
    fontSize: 12,
    textAlignVertical: 'center',
    overflow: 'visible',
    width: 36,
    padding: 0,
  },

  sep: { 
    fontSize: 12, 
    color: '#333', 
    fontWeight: '500', 
    marginLeft: 4, 
    marginRight: 0,
    textAlign: 'left',
    minWidth: 36,
    display: 'flex',
    height: '100%',
    textAlignVertical: 'center',
    lineHeight: 24,
  },
});

export default PageControl;

