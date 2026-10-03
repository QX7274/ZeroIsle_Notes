/**
 * 手感面板（HandWrite Feel Panel）
 *
 * 职责：把"按手感与手势"从一句口号变成用户真能拖的东西。
 * 面板只做三件事：读当前手感 → 用户改 → 立刻把归一化后的载荷下发给父组件。
 *
 * 几个刻意的设计决定：
 * 1) 面板状态全部放在组件内部（父组件只透传 toolConfig），
 *    这样拖动滑块不会触发整条工具栏重渲染（工具栏里有大量弹窗与列表）。
 * 2) 拖动节流 60ms：父组件的 setToolConfig 每次都 JSON.stringify 全量配置，
 *    60Hz 的 onValueChange 直接打过去会造成明显卡顿；但节流不能丢最终值，
 *    所以 onSlidingComplete 时再无条件补发一次最终值。
 * 3) 预览用 react-native-svg 的 Path 就地画，不引入任何新依赖。
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../theme/tokens';
import {
  HAND_FEEL_PRESET_ORDER,
  HAND_FEEL_PRESETS,
  HAND_FEEL_STROKE_RANGE,
  buildHandFeelPatch,
  getHandFeelDefaults,
  getHandFeelPreset,
  getPenProfileLabel,
  normalizeHandFeelState,
} from './handFeel';

// 滑块拖动下发的最小间隔。取 60ms 是"既跟手又不把桥打爆"的折中：
// 父组件每次都序列化全量配置，频率再高只会在低端机上丢帧。
export const SLIDER_THROTTLE_MS = 60;

// 触摸目标下限：iOS/Android 无障碍指南一致要求的 44pt
const MIN_TOUCH_SIZE = 44;

/** 预览笔迹：一条带缓弯的曲线，能同时反映粗细与不透明度。 */
const PREVIEW_PATH = 'M 8 46 C 34 10, 62 62, 88 30 S 140 8, 168 40';

const SLIDER_ROWS = [
  {
    key: 'pressureSensitivity',
    label: '压感',
    hint: '低压感=力度变化小，高压感=笔迹随力度明显变化',
    step: 0.05,
  },
  { key: 'velocitySensitivity', label: '速度灵敏度', hint: '越快越细/越淡的敏感程度', step: 0.05 },
  { key: 'smoothing', label: '平滑', hint: '越高笔迹越顺滑，但会略微迟滞', step: 0.05 },
  { key: 'taperIn', label: '起笔', hint: '落笔处的收窄程度', step: 0.05 },
  { key: 'taperOut', label: '收笔', hint: '抬笔处的收窄程度', step: 0.05 },
  { key: 'opacity', label: '不透明度', hint: '荧光笔默认 40%，便于叠色', step: 0.05 },
];

const formatUnitValue = (value) => `${Math.round(value * 100)}%`;

const HandFeelPanel = forwardRef(({ visible: visibleProp = false, onClose, toolConfig, onChange }, ref) => {
  const { colors } = useTheme();

  // 开关状态默认自持：工具栏只需通过 ref.open() 打开，就无需为它新增顶层 useState
  // （工具栏顶层多一个 state 会让每次开关都重渲染整条工具栏 + 全部弹窗）。
  // 调用方若显式传 visible（Lead 集成时可能这么做），则退化为受控模式。
  const [visible, setVisible] = useState(Boolean(visibleProp));

  // 当前完整手感状态（7 项）。内部持有，父组件无需关心。
  const [values, setValues] = useState(() => normalizeHandFeelState(toolConfig));
  // 记录命中/手动改动的预设，用于按钮高亮（手工改任意滑块即视为离开预设）
  const [activePresetId, setActivePresetId] = useState(null);

  // 拖动节流的时间戳与"是否已经开过面板"。用 ref 而非 state：
  // 它们只影响"下一次要不要下发"，改了也不需要重渲染。
  // 初值取 -Infinity 而不是 0：0 会被当成"上一帧刚下发过"，
  // 让时间戳起点（或被单测打桩的 0）下的第一次拖动被无谓地吃掉。
  const lastEmitAtRef = useRef(Number.NEGATIVE_INFINITY);
  const openedRef = useRef(false);
  const lastPenProfileRef = useRef(null);
  // onChange 用 ref 持有，避免父组件每次渲染换函数引用时把 emit 的闭包打散
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setVisible(Boolean(visibleProp));
  }, [visibleProp]);

  // 对外的命令式接口：工具栏在插入区里用 ref 开合，保持"面板状态在面板内部"。
  useImperativeHandle(ref, () => ({
    open: () => setVisible(true),
    close: () => setVisible(false),
  }), []);

  const handleClose = useCallback(() => {
    setVisible(false);
    onClose?.();
  }, [onClose]);

  const penProfile = useMemo(
    () => normalizeHandFeelState(toolConfig).penProfile,
    [toolConfig]
  );

  // 只在"面板刚打开"或"面板开着时笔型被外部切换"这两种情况下用父配置回灌，
  // 否则拖动过程中父组件的回传会把正在拖的值弹回去，出现滑块抖动。
  useEffect(() => {
    if (!visible) {
      openedRef.current = false;
      return;
    }

    if (!openedRef.current || lastPenProfileRef.current !== penProfile) {
      openedRef.current = true;
      lastPenProfileRef.current = penProfile;
      setValues(normalizeHandFeelState(toolConfig));
      setActivePresetId(null);
    }
  }, [visible, penProfile, toolConfig]);

  const emit = useCallback((patch, options = {}) => {
    const { throttle = false } = options;
    const payload = buildHandFeelPatch(values, patch);

    setValues((prev) => ({ ...prev, ...payload }));
    setActivePresetId(options.presetId ?? null);

    if (!throttle) {
      lastEmitAtRef.current = Date.now();
      onChangeRef.current?.(payload);
      return;
    }

    const now = Date.now();
    if (now - lastEmitAtRef.current < SLIDER_THROTTLE_MS) {
      // 节流窗口内的中间值直接丢弃：最终值会由 onSlidingComplete 补发，
      // 不会出现"松手后原生还是旧值"的丢帧问题。
      return;
    }

    lastEmitAtRef.current = now;
    onChangeRef.current?.(payload);
  }, [values]);

  const handleSliderChange = useCallback((key, value) => {
    emit({ [key]: value }, { throttle: true });
  }, [emit]);

  // 抬手时无条件补发最终值：这是节流策略的收口，保证松手后一定对齐
  const handleSliderComplete = useCallback((key, value) => {
    emit({ [key]: value }, { throttle: false });
  }, [emit]);

  const handlePresetPress = useCallback((presetId) => {
    const presetValues = getHandFeelPreset(presetId);
    if (!presetValues) {
      return;
    }

    // 预设是一次性整体下发：手柄参数之间是互相影响的，只改一半会更不像该预设
    emit(presetValues, { presetId });
  }, [emit]);

  // 重置按"当前笔型"恢复，而不是回到固定的一组数字：
  // 用户切到马克笔后点重置，期望的是马克笔的默认手感。
  const handleResetPress = useCallback(() => {
    emit(getHandFeelDefaults(penProfile), { presetId: null });
  }, [emit, penProfile]);

  const themeStyles = useMemo(() => ({
    sheet: { backgroundColor: colors.card || colors.background || '#FFFFFF' },
    title: { color: colors.text },
    secondaryText: { color: colors.textSecondary || colors.text },
    border: { borderBottomColor: colors.border || colors.outline || '#DDDDDD' },
    track: colors.border || colors.outline || '#DDDDDD',
    previewBox: { backgroundColor: colors.primary + '14' },
  }), [colors]);

  const sliderProps = {
    minimumTrackTintColor: colors.primary,
    maximumTrackTintColor: themeStyles.track,
    thumbTintColor: colors.primary,
    style: styles.slider,
  };

  return (
    <Modal
      testID="hand-feel-modal"
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View testID="hand-feel-panel" style={[styles.sheet, themeStyles.sheet]}>
          <View style={[styles.header, themeStyles.border]}>
            <View>
              <Text style={[styles.title, themeStyles.title]}>手感</Text>
              {/* 面板必须让用户知道"现在调的是哪支笔" */}
              <Text testID="hand-feel-profile" style={[styles.subtitle, themeStyles.secondaryText]}>
                当前笔型：{getPenProfileLabel(penProfile)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityLabel="关闭手感面板"
              accessibilityRole="button"
            >
              <Text style={{ color: colors.primary }}>完成</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 实时笔迹预览：粗细/不透明度用真实值画，所见即所得 */}
            <View style={[styles.section, themeStyles.border]}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.sectionTitle, themeStyles.title]}>笔迹预览</Text>
                <Text testID="hand-feel-preview-value" style={[styles.sliderValue, themeStyles.secondaryText]}>
                  {values.strokeWidth}px · {formatUnitValue(values.opacity)}
                </Text>
              </View>
              <View
                testID="hand-feel-preview"
                style={[styles.previewBox, themeStyles.previewBox]}
              >
                <Svg width="100%" height={72} viewBox="0 0 176 72">
                  <Path
                    d={PREVIEW_PATH}
                    stroke={colors.primary}
                    strokeWidth={values.strokeWidth}
                    strokeOpacity={values.opacity}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              </View>
            </View>

            {/* 4 个整体预设 */}
            <View style={[styles.section, themeStyles.border]}>
              <Text style={[styles.sectionTitle, themeStyles.title]}>手感预设</Text>
              <View style={styles.presetRow}>
                {HAND_FEEL_PRESET_ORDER.map((presetId) => {
                  const preset = HAND_FEEL_PRESETS[presetId];
                  const isActive = activePresetId === presetId;

                  return (
                    <TouchableOpacity
                      key={presetId}
                      testID={`hand-feel-preset-${presetId}`}
                      onPress={() => handlePresetPress(presetId)}
                      style={[
                        styles.presetButton,
                        { borderColor: isActive ? colors.primary : themeStyles.track },
                        isActive && { backgroundColor: colors.primary + '20' },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`手感预设${preset.label}`}
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={[styles.presetLabel, { color: isActive ? colors.primary : colors.text }]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 逐项微调 */}
            <View style={[styles.section, themeStyles.border]}>
              {SLIDER_ROWS.map((row) => (
                <View key={row.key} style={styles.sliderRow}>
                  <View style={styles.sliderHeader}>
                    <Text style={[styles.sectionTitle, themeStyles.title]}>{row.label}</Text>
                    <Text style={[styles.sliderValue, themeStyles.secondaryText]}>
                      {formatUnitValue(values[row.key])}
                    </Text>
                  </View>
                  <Slider
                    testID={`hand-feel-slider-${row.key}`}
                    accessibilityLabel={row.label}
                    minimumValue={0}
                    maximumValue={1}
                    step={row.step}
                    value={values[row.key]}
                    onValueChange={(next) => handleSliderChange(row.key, next)}
                    onSlidingComplete={(next) => handleSliderComplete(row.key, next)}
                    {...sliderProps}
                  />
                </View>
              ))}

              {/* 粗细沿用工具栏的 1~50 口径 */}
              <View style={styles.sliderRow}>
                <View style={styles.sliderHeader}>
                  <Text style={[styles.sectionTitle, themeStyles.title]}>粗细</Text>
                  <Text style={[styles.sliderValue, themeStyles.secondaryText]}>
                    {values.strokeWidth}px
                  </Text>
                </View>
                <Slider
                  testID="hand-feel-slider-strokeWidth"
                  accessibilityLabel="笔触粗细"
                  minimumValue={HAND_FEEL_STROKE_RANGE.min}
                  maximumValue={HAND_FEEL_STROKE_RANGE.max}
                  step={HAND_FEEL_STROKE_RANGE.step}
                  value={values.strokeWidth}
                  onValueChange={(next) => handleSliderChange('strokeWidth', next)}
                  onSlidingComplete={(next) => handleSliderComplete('strokeWidth', next)}
                  {...sliderProps}
                />
              </View>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                testID="hand-feel-reset"
                onPress={handleResetPress}
                style={[
                  styles.resetButton,
                  { borderColor: themeStyles.track },
                ]}
                accessibilityRole="button"
                accessibilityLabel="重置为默认手感"
              >
                <Text style={[styles.resetLabel, { color: colors.primary }]}>
                  重置为默认（{getPenProfileLabel(penProfile)}）
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '86%',
    // Android 底部手势条会压住"完成/重置"，留出安全边距
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: SPACING.xxs,
  },
  closeButton: {
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sliderRow: {
    marginTop: SPACING.xs,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: MIN_TOUCH_SIZE,
  },
  previewBox: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
  },
  presetButton: {
    minHeight: MIN_TOUCH_SIZE,
    minWidth: 72,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  resetButton: {
    minHeight: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  resetLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});

// 便于 React DevTools / 报错栈识别（forwardRef 组件默认显示为 Anonymous）
HandFeelPanel.displayName = 'HandFeelPanel';

export default HandFeelPanel;
