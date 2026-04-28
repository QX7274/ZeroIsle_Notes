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

  // 角点缩放（四角）- 优化缩放体验
  const startSize = useRef(size * scale);
  const startPos = useRef({ x: 0, y: 0 });
  const createResizeResponder = () => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dx * g.dx + g.dy * g.dy > 0.5, // 进一步降低阈值
    onPanResponderGrant: (evt) => {
      setSelected(true);
      startSize.current = size * scale;
      startPos.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
    },
    onPanResponderMove: (evt, g) => {
      // 使用距离变化来计算缩放，提供更自然的缩放体验
      const currentPos = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
      const distance = Math.sqrt(
        Math.pow(currentPos.x - startPos.current.x, 2) +
        Math.pow(currentPos.y - startPos.current.y, 2)
      );

      // 根据拖拽方向决定缩放方向
      const direction = (g.dx + g.dy) > 0 ? 1 : -1;
      const scaleFactor = 2.0; // 优化缩放敏感度
      const deltaScale = (distance * direction * scaleFactor) / 100;

      const newScale = Math.max(0.1, Math.min(8, scale + deltaScale * 0.01)); // 扩大缩放范围
      setScale(newScale);
      onResize?.(id, { scale: newScale });
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
        {/* 删除按钮（仅选中时显示）- 移动到顶部居中 */}
        {selected && (
          <TouchableOpacity style={styles.closeTopCenter} onPress={() => onRemove?.(id)}>
            <View style={styles.closeInnerX}>
              <View style={styles.bar1} />
              <View style={styles.bar2} />
            </View>
          </TouchableOpacity>
        )}
        {/* 四角缩放手柄 - 增大尺寸提高操作性 */}
        {selected && (
          <>
            <View style={[styles.handle, { right: -10, bottom: -10 }]} {...resizeBR.panHandlers} />
            <View style={[styles.handle, { right: -10, top: -10 }]} {...resizeTR.panHandlers} />
            <View style={[styles.handle, { left: -10, bottom: -10 }]} {...resizeBL.panHandlers} />
            <View style={[styles.handle, { left: -10, top: -10 }]} {...resizeTL.panHandlers} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  box: { position: 'relative' },
  handle: { position: 'absolute', width: 20, height: 20, backgroundColor: '#0080ff', borderRadius: 10, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 },
  close: { position: 'absolute', right: -12, top: -12, width: 20, height: 20, borderRadius: 10, backgroundColor: 'red', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 },
  closeTopCenter: {
    position: 'absolute',
    left: '50%',
    top: -12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'red',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    marginLeft: -10, // 居中偏移
  },
  closeInnerX: { position:'relative', width:12, height:12 },
  bar1: { position:'absolute', left:1, right:1, top:5, height:2, backgroundColor:'#fff', transform:[{ rotate:'45deg' }] },
  bar2: { position:'absolute', left:1, right:1, top:5, height:2, backgroundColor:'#fff', transform:[{ rotate:'-45deg' }] },
});
