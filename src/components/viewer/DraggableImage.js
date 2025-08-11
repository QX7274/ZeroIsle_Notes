import React, { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, PanResponder, TouchableOpacity } from 'react-native';

// 浮动可拖拽图片组件（无底部按钮/无图层操作）
// - 支持拖拽移动
// - 角点拖拽缩放
// - 点击选中，在右上角展示红色×删除按钮
export default function DraggableImage({
  id,
  uri,
  initial = { x: 20, y: 20 },
  zIndex = 10,
  onMove,
  onRemove,
  onResize,
  deselectSignal, // 父级用于强制取消选中的计数器（每次递增触发取消）
  size = 180,
  initialScale = 1,
}) {
  const [pos, setPos] = useState(initial);
  const [scale, setScale] = useState(initialScale);
  const [selected, setSelected] = useState(false);

  useEffect(() => setPos(initial), [initial?.x, initial?.y]);
  useEffect(() => setSelected(false), [deselectSignal]);

  // 拖拽移动
  const moveResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dx * g.dx + g.dy * g.dy > 4,
    onPanResponderGrant: (e) => {
      setSelected(true);
      moveOffset.current = { x: e.nativeEvent.pageX - pos.x, y: e.nativeEvent.pageY - pos.y };
    },
    onPanResponderMove: (e) => {
      const next = { x: e.nativeEvent.pageX - moveOffset.current.x, y: e.nativeEvent.pageY - moveOffset.current.y };
      setPos(next);
      onMove?.(id, next);
    },
    onPanResponderRelease: () => {},
  })).current;
  const moveOffset = useRef({ x: 0, y: 0 });

  // 角点缩放（四角）
  const startSize = useRef(size * scale);
  const createResizeResponder = () => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { setSelected(true); startSize.current = size * scale; },
    onPanResponderMove: (_, g) => {
      const base = Math.max(60, startSize.current + g.dx + g.dy);
      const s = base / size;
      const clamped = Math.max(0.3, Math.min(4, s));
      setScale(clamped);
      onResize?.(id, { scale: clamped });
    },
    onPanResponderRelease: () => {},
  });
  const resizeBR = useRef(createResizeResponder()).current;
  const resizeTR = useRef(createResizeResponder()).current;
  const resizeBL = useRef(createResizeResponder()).current;
  const resizeTL = useRef(createResizeResponder()).current;

  return (
    <View style={[styles.wrap, { left: pos.x, top: pos.y, zIndex }]} pointerEvents="box-none">
      <View
        style={styles.box}
        {...moveResponder.panHandlers}
        onStartShouldSetResponder={() => true}
        onResponderGrant={() => setSelected(true)}
      >
        <Image source={{ uri }} style={{ width: size * scale, height: size * scale, borderRadius: 6 }} resizeMode="contain" />
        {/* 删除按钮（仅选中时显示）*/}
        {selected && (
          <TouchableOpacity style={styles.close} onPress={() => onRemove?.(id)}>
            <View style={styles.closeInnerX}>
              <View style={styles.bar1} />
              <View style={styles.bar2} />
            </View>
          </TouchableOpacity>
        )}
        {/* 四角缩放手柄 */}
        <View style={[styles.handle, { right: -8, bottom: -8 }]} {...resizeBR.panHandlers} />
        <View style={[styles.handle, { right: -8, top: -8 }]} {...resizeTR.panHandlers} />
        <View style={[styles.handle, { left: -8, bottom: -8 }]} {...resizeBL.panHandlers} />
        <View style={[styles.handle, { left: -8, top: -8 }]} {...resizeTL.panHandlers} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  box: { position: 'relative' },
  handle: { position: 'absolute', width: 16, height: 16, backgroundColor: '#0080ff', borderRadius: 8 },
  close: { position: 'absolute', right: -8, top: -8, width: 18, height: 18, borderRadius: 9, backgroundColor: 'red', alignItems: 'center', justifyContent: 'center' },
  closeInnerX: { position:'relative', width:12, height:12 },
  bar1: { position:'absolute', left:1, right:1, top:5, height:2, backgroundColor:'#fff', transform:[{ rotate:'45deg' }] },
  bar2: { position:'absolute', left:1, right:1, top:5, height:2, backgroundColor:'#fff', transform:[{ rotate:'-45deg' }] },
});
