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
  // 新增：记录当前控件是否因页码输入框聚焦而需要跟随键盘
  const isControlLinkedToKeyboard = useRef(false);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  // 控件自身高度（从styles.container获取，用于计算底部定位）
  const controlHeight = 24; 
  // 底部安全距离（避免贴紧屏幕边缘，可根据需求调整）
  const bottomSafeDistance = 24;
  // 新增：记录控件原始位置（用于键盘隐藏后恢复）
  const originalPosRef = useRef({ x: 0, y: 0 });

  // 同步输入框与当前页码
  useEffect(() => {
    setValue(String(current));
  }, [current]);

  // 初始化位置：优先读取缓存，无缓存则设为底部居中（记录原始位置）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const realmService = require('../../services/database/realmService').default;
        const realm = await realmService.getRealm();
        const item = realm.objects('StorageItem').filtered(`key = "${storageKey}"`);
        const saved = item.length > 0 ? item[0].value : null;
        if (!cancelled && saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            const { width, height } = Dimensions.get('window');
            const validPos = checkAndFixPos(parsed, width, height);
            setPos(validPos);
            originalPosRef.current = validPos; // 记录原始位置
            return;
          }
        }
      } catch {}
      // 默认底部居中位置
      if (!cancelled) {
        const { width, height } = Dimensions.get('window');
        const defPos = getBottomCenterPos(width, height);
        setPos(defPos);
        originalPosRef.current = defPos; // 记录原始位置
      }
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // 屏幕旋转监听：调整位置为底部居中（不影响键盘关联逻辑）
  useEffect(() => {
    const updatePosition = () => {
      // 仅在「未聚焦输入框」且「未关联键盘」时调整位置
      if (isInputFocused || isControlLinkedToKeyboard.current) return;

      const { width, height } = Dimensions.get('window');
      const bottomCenterPos = getBottomCenterPos(width, height);
      setPos(bottomCenterPos);
      originalPosRef.current = bottomCenterPos; // 更新原始位置
      persistPos(bottomCenterPos);
    };

    const dimensionsListener = Dimensions.addEventListener('change', updatePosition);
    return () => {
      dimensionsListener.remove();
    };
  }, [isInputFocused]);

  // 键盘监听：仅在「页码输入框聚焦」时响应（核心优化）
  useEffect(() => {
    // 键盘弹出：仅当输入框聚焦时，才移动控件并标记关联状态
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        // 关键判断：只有页码输入框聚焦，才处理键盘上升
        if (isInputFocused) {
          const keyboardH = e.endCoordinates.height;
          setKeyboardHeight(keyboardH);
          const { height } = Dimensions.get('window');
          // 计算控件上升后的位置（键盘上方 + 20px间距）
          const raisedY = height - keyboardH - controlHeight - 20;
          setPos(prev => ({ ...prev, y: raisedY }));
          isControlLinkedToKeyboard.current = true; // 标记为“与键盘关联”
        }
      }
    );

    // 键盘隐藏：仅当控件与键盘关联时，才恢复原始位置
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        // 只有之前因页码输入框聚焦而移动的控件，才恢复原始位置
        if (isControlLinkedToKeyboard.current) {
          setPos(originalPosRef.current); // 恢复到底部原始位置
          persistPos(originalPosRef.current);
          isControlLinkedToKeyboard.current = false; // 取消关联标记
        }
        setIsInputFocused(false); // 重置输入框聚焦状态
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [isInputFocused]); // 仅依赖输入框聚焦状态，避免无关触发

  // 工具函数1：计算底部居中位置
  const getBottomCenterPos = (screenWidth, screenHeight) => {
    const centerX = Math.max(bottomSafeDistance, screenWidth / 2 - 60); // 水平居中
    const bottomY = screenHeight - controlHeight - bottomSafeDistance; // 垂直贴底
    return { x: centerX, y: bottomY };
  };

  // 工具函数2：检查并修正位置（避免超出屏幕）
  const checkAndFixPos = (targetPos, screenWidth, screenHeight) => {
    const maxX = screenWidth - 120 - bottomSafeDistance; // 右边界（控件宽120）
    const minX = bottomSafeDistance; // 左边界
    const maxY = screenHeight - controlHeight - bottomSafeDistance; // 下边界（贴底）
    const minY = bottomSafeDistance; // 上边界（不允许拖到顶部）

    return {
      x: Math.min(Math.max(targetPos.x, minX), maxX),
      y: Math.min(Math.max(targetPos.y, minY), maxY)
    };
  };

  // 保存位置到缓存
  const persistPos = async (p) => {
    try {
      const realmService = require('../../services/database/realmService').default;
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${storageKey}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(p);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: storageKey,
            value: JSON.stringify(p),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
    } catch {}
  };

  // 拖拽逻辑：添加位置边界限制
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, g) => g.numberActiveTouches === 1,
      onMoveShouldSetPanResponder: (_, g) => g.dx * g.dx + g.dy * g.dy > 9,
      onPanResponderGrant: (e) => {
        dragging.current = true;
        // 计算触摸点与控件左上角的偏移（确保拖拽跟随手指）
        offset.current = { 
          x: e.nativeEvent.locationX, 
          y: e.nativeEvent.locationY 
        };
      },
      onPanResponderMove: (e) => {
        if (!dragging.current) return;
        const { width, height } = Dimensions.get('window');
        // 计算新位置（触摸点坐标 - 偏移量）
        let nextX = e.nativeEvent.pageX - offset.current.x;
        let nextY = e.nativeEvent.pageY - offset.current.y;
        // 修正位置：确保不超出屏幕边界
        const fixedPos = checkAndFixPos({ x: nextX, y: nextY }, width, height);
        setPos(fixedPos);
        // 拖拽时更新原始位置（避免键盘隐藏后恢复到旧位置）
        originalPosRef.current = fixedPos;
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
    <View 
      style={[styles.wrapper, { transform: [{ translateX: pos.x }, { translateY: pos.y }] }]} 
      pointerEvents="box-none"
    >
      {/* “一”形拖拽标记（仅拖拽标记可触发拖拽） */}
      <View style={styles.dragHandle} {...pan.panHandlers} />

      {/* 控件本体 */}
      <View style={[styles.container, style]}>
        {/* 上一页按钮（禁用时灰色） */}
        <TouchableOpacity onPress={onPrev} style={styles.navBtn} disabled={current <= 1}>
          <Text style={[styles.navText, current <= 1 && styles.navTextDisabled]}>{'<'}</Text>
        </TouchableOpacity>

        {/* 页码信息（输入框 + 总页数） */}
        <View style={styles.pageInfoContainer}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={value}
              onChangeText={setValue}
              // 仅点击输入框时，设置聚焦状态
              onFocus={() => setIsInputFocused(true)}
              onSubmitEditing={() => {
                const n = parseInt(value, 10);
                console.log('PageControl: 提交页码输入:', n, '总页数:', total);
                if (!isNaN(n) && n >= 1 && n <= total) {
                  console.log('PageControl: 执行页面跳转到:', n);
                  onSubmitPage?.(n);
                } else {
                  console.log('PageControl: 页码输入无效:', n);
                }
                setIsInputFocused(false);
                Keyboard.dismiss(); // 提交后关闭键盘
              }}
              onBlur={() => {
                const n = parseInt(value, 10);
                console.log('PageControl: 失焦页码输入:', n, '总页数:', total);
                if (!isNaN(n) && n >= 1 && n <= total) {
                  console.log('PageControl: 失焦时执行页面跳转到:', n);
                  onSubmitPage?.(n);
                }
                setIsInputFocused(false); // 失焦时重置状态
              }}
              underlineColorAndroid="transparent"
              selectionColor="#222"
              maxLength={3} // 限制页码输入长度（最多3位）
            />
          </View>
          <Text style={styles.sep}>/ {total}</Text>
        </View>

        {/* 下一页按钮（禁用时灰色） */}
        <TouchableOpacity onPress={onNext} style={styles.navBtn} disabled={current >= total}>
          <Text style={[styles.navText, current >= total && styles.navTextDisabled]}>{'>'}</Text>
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
    zIndex: 25, // 确保在其他控件之上（不被遮挡）
  },
  dragHandle: {
    alignSelf: 'center',
    width: 24,
    height: 3,
    borderRadius: 2,
    marginBottom: 4, // 缩小拖拽标记与控件的间距
    backgroundColor: '#AAB4BE',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#cadff0ff', // 默认背景色（半透明）
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 0,
    height: 24, // 固定控件高度（与代码中controlHeight一致）
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
  navTextDisabled: {
    color: '#999', // 禁用状态颜色（灰色）
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