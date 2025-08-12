import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Path, Skia, PaintStyle } from '@shopify/react-native-skia';
import { detectInputType, isStylusInput } from '../../utils/inputDetection';

// 轻量的全局手写笔覆盖层：
// - 默认 pointerEvents=none，不阻挡任何交互
// - 仅当检测到触控笔时启用（manualActivation + onTouchesDown判断）
// - 使用 Skia 绘制简单笔迹
export default function GlobalStylusOverlay({
  color = '#000',
  width = 3,
  style,
  onStrokeEnd,
}) {
  const [active, setActive] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const current = useRef(null);

  const isStylusInputWorklet = (evt) => {
    'worklet';
    try {
      const e = evt.allTouches?.[0] || evt;

      // 使用统一的检测逻辑
      // 优先检查明确的touchType属性
      if (e?.touchType === 'stylus' || e?.touchType === 'pen') {
        return true;
      }

      // Android: toolType=2 为 stylus
      if (e?.toolType === 2 || e?.type === 'stylus') {
        return true;
      }

      // 检查压力值 - 触控笔通常有压力感应
      if (typeof e?.pressure === 'number' && e.pressure > 0 && e.pressure < 1) {
        return true;
      }

      // 检查触摸半径 - 触控笔通常更小更精确
      if (typeof e?.radiusX === 'number' && typeof e?.radiusY === 'number') {
        const avgRadius = (e.radiusX + e.radiusY) / 2;
        if (avgRadius < 8) {
          return true;
        }
      }

      // 检查力度值（iOS）
      if (typeof e?.force === 'number' && e.force > 0.3) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  const pan = useMemo(() => Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((evt, state) => {
      'worklet';
      try {
        isStylusInputWorklet(evt) ? state.activate() : state.fail();
      } catch {
        state.fail();
      }
    })
    .onStart((e) => {
      setActive(true);
      const { x, y } = e;
      current.current = { path: `M ${x} ${y}`, pts: [{ x, y }], color, width };
      setStrokes((prev) => [...prev, current.current]);
    })
    .onUpdate((e) => {
      if (!current.current) return;
      const { x, y } = e;
      current.current.pts.push({ x, y });
      current.current.path += ` L ${x} ${y}`;
      // 触发刷新
      setStrokes((prev) => [...prev]);
    })
    .onEnd(() => {
      setActive(false);
      const s = current.current;
      current.current = null;
      onStrokeEnd && onStrokeEnd(s);
    })
    .onFinalize(() => setActive(false))
  , [color, width]);

  return (
    <View pointerEvents={active ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, style]}>
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill}>
          <Canvas style={StyleSheet.absoluteFill}>
            {strokes.map((s, idx) => (
              <Path
                key={idx}
                path={Skia.Path.MakeFromSVGString(s.path)}
                color={s.color}
                style={PaintStyle.Stroke}
                strokeWidth={s.width}
                strokeJoin="round"
                strokeCap="round"
              />
            ))}
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}

