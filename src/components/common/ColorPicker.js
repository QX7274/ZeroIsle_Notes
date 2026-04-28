/**
 * 企业级颜色选择器组件 (升级版)
 *
 * 功能特性:
 * 1. HSV 2D 色板 (饱和度/明度)
 * 2. Hue 色相滑块
 * 3. 屏幕取色器 (Eyedropper)集成
 * 4. HEX 颜色输入/显示
 * 5. 最近使用颜色历史
 * 6. 预设颜色网格
 * 7. 触觉反馈
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Pressable,
  TextInput,
  Platform,
  Vibration,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '../../context/ThemeContext';
import {
  hsvToRgb,
  rgbToHsv,
  isValidColor,
} from '../../utils/colorUtils';
import screenUtilsBridge from '../../native/screenUtilsBridge'; // 取色器桥接

// 存储键
const STORAGE_KEYS = {
  RECENT_COLORS: '@zeroislenotes:picker_recent_colors',
};

// 预定义颜色（保留占位，当前版本未展示预设色网格）

const ColorPicker = ({
  visible,
  onClose,
  onColorChange,
  initialColor = '#2196F3',
  showEyedropper = true,
}) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  const normalizeToHex = useCallback((color) => {
    if (!isValidColor(color) || typeof color !== 'string') {return null;}
    const c = color.trim();
    if (/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(c)) {
      return (c.length === 4
        ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
        : c).toUpperCase();
    }

    const match = c.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i);
    if (match) {
      const r = Math.max(0, Math.min(255, Number(match[1]) || 0));
      const g = Math.max(0, Math.min(255, Number(match[2]) || 0));
      const b = Math.max(0, Math.min(255, Number(match[3]) || 0));
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
    }

    return null;
  }, []);

  const clampPercent = useCallback((n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) {return 0;}
    return Math.max(0, Math.min(100, num));
  }, []);

  // 状态
  const [activeColor, setActiveColor] = useState('#2196F3');
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [value, setValue] = useState(100);
  const [hexInput, setHexInput] = useState('');
  const [recentColors, setRecentColors] = useState([]);
  const [isPickingColor, setIsPickingColor] = useState(false);

  // 初始化颜色状态
  useEffect(() => {
    if (visible) {
      const safeColor = normalizeToHex(initialColor) || '#2196F3';
      setActiveColor(safeColor);
      setHexInput(safeColor);

      const hsv = rgbToHsv(safeColor);
      setHue(Number.isFinite(hsv.h) ? hsv.h : 0);
      setSaturation(clampPercent(hsv.s));
      setValue(clampPercent(hsv.v));

      loadRecentColors();
    }
  }, [visible, initialColor, normalizeToHex, clampPercent]);

  // 加载最近颜色
  const loadRecentColors = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_COLORS);
      if (saved) {
        const parsed = JSON.parse(saved);
        const normalized = Array.isArray(parsed)
          ? parsed.map((c) => normalizeToHex(c)).filter(Boolean)
          : [];
        setRecentColors(normalized);
      }
    } catch (error) {
      console.warn('加载最近颜色失败:', error);
    }
  };

  // 保存最近颜色
  const saveRecentColor = async (color) => {
    try {
      let newRecent = [color, ...recentColors.filter(c => c !== color)].slice(0, 16);
      setRecentColors(newRecent);
      await AsyncStorage.setItem(STORAGE_KEYS.RECENT_COLORS, JSON.stringify(newRecent));
    } catch (error) {
      console.warn('保存最近颜色失败:', error);
    }
  };

  // 触觉反馈
  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(10);
    }
  };

  // 处理HEX输入
  const handleHexChange = (text) => {
    const cleaned = text.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const prefixed = `#${cleaned}`;
    setHexInput(prefixed);

    if (cleaned.length === 3 || cleaned.length === 6) {
      const safeColor = normalizeToHex(prefixed);
      if (safeColor) {
        const hsv = rgbToHsv(safeColor);
        setHue(Number.isFinite(hsv.h) ? hsv.h : 0);
        setSaturation(clampPercent(hsv.s));
        setValue(clampPercent(hsv.v));
        setActiveColor(safeColor);
      }
    }
  };

  // 根据HSV更新当前颜色
  const updateColorFromHSV = useCallback((h, s, v) => {
    const safeH = Number.isFinite(Number(h)) ? Number(h) : 0;
    const safeS = clampPercent(s);
    const safeV = clampPercent(v);
    const color = hsvToRgb(safeH, safeS, safeV);
    setActiveColor(color);
    setHexInput(color.toUpperCase());
  }, [clampPercent]);

  // 2D色板交互
  const handleBoardTouch = (event) => {
    const boardSize = 260;
    const locationX = Number(event?.nativeEvent?.locationX);
    const locationY = Number(event?.nativeEvent?.locationY);

    const safeX = Number.isFinite(locationX) ? locationX : 0;
    const safeY = Number.isFinite(locationY) ? locationY : 0;

    // 限制范围
    const x = Math.max(0, Math.min(boardSize, safeX));
    const y = Math.max(0, Math.min(boardSize, safeY));

    // 计算 Saturation (x轴) 和 Value (y轴)
    const newS = clampPercent((x / boardSize) * 100);
    const newV = clampPercent(100 - (y / boardSize) * 100);

    setSaturation(newS);
    setValue(newV);
    updateColorFromHSV(hue, newS, newV);
  };

  // 处理确认
  const handleConfirm = () => {
    saveRecentColor(activeColor);
    onColorChange(activeColor);
    onClose();
  };

  // 处理屏幕取色
  const handleEyedropper = async () => {
    if (isPickingColor) {return;}

    setIsPickingColor(true);

    try {
      const color = await screenUtilsBridge.pickColor();
      const safeColor = normalizeToHex(color);

      if (!safeColor) {
        Alert.alert('取色失败', '未获取到有效颜色，请重试');
        return;
      }

      const hsv = rgbToHsv(safeColor);
      setHue(Number.isFinite(hsv.h) ? hsv.h : 0);
      setSaturation(clampPercent(hsv.s));
      setValue(clampPercent(hsv.v));
      setActiveColor(safeColor);
      setHexInput(safeColor);

      await saveRecentColor(safeColor);
      onColorChange(safeColor);
      triggerHaptic();
    } catch (error) {
      console.warn('取色失败:', error);
      Alert.alert('取色失败', '无法启动取色器，请稍后再试');
    } finally {
      setIsPickingColor(false);
    }
  };

  const safeHue = Number.isFinite(Number(hue)) ? Number(hue) : 0;
  const safeSaturation = clampPercent(saturation);
  const safeValue = clampPercent(value);

  const hueColor = hsvToRgb(safeHue, 100, 100);
  const boardSize = 260;
  const cursorX = (safeSaturation / 100) * boardSize;
  const cursorY = (1 - safeValue / 100) * boardSize;

  if (!visible) {return null;}

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={e => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>选择颜色</Text>
            {showEyedropper && (
              <TouchableOpacity
                style={[
                  styles.iconButton,
                  { borderColor: colors.border },
                  isPickingColor && styles.iconButtonDisabled,
                ]}
                onPress={handleEyedropper}
                disabled={isPickingColor}
                accessibilityRole="button"
                accessibilityLabel="屏幕取色器"
                accessibilityHint="从屏幕拾取颜色并回填当前颜色"
                accessibilityState={{ disabled: isPickingColor, busy: isPickingColor }}
              >
                {isPickingColor ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <MaterialCommunityIcons name="eyedropper" size={20} color={colors.text} />
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* 2D 色板区域 */}
          <View
            style={[styles.boardContainer, { width: boardSize, height: boardSize }]}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(e) => {
              handleBoardTouch(e);
              triggerHaptic();
            }}
            onResponderMove={handleBoardTouch}
          >
            {/* 基础色相背景 */}
            <View style={[styles.boardLayer, { backgroundColor: hueColor }]} />

            {/* 白色饱和度渐变 (左->右) */}
            <Svg width="100%" height="100%" style={styles.boardLayer}>
              <Defs>
                <LinearGradient id="sat" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FFF" stopOpacity="1" />
                  <Stop offset="1" stopColor="#FFF" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#sat)" />
            </Svg>

            {/* 黑色明度渐变 (上->下) */}
            <Svg width="100%" height="100%" style={styles.boardLayer}>
              <Defs>
                <LinearGradient id="val" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000" stopOpacity="0" />
                  <Stop offset="1" stopColor="#000" stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#val)" />
            </Svg>

            {/* 光标 */}
            <View style={[
              styles.cursor,
              {
                left: Number.isFinite(cursorX) ? cursorX - 10 : 0,
                top: Number.isFinite(cursorY) ? cursorY - 10 : 0,
                backgroundColor: activeColor,
                borderColor: safeValue > 50 ? '#000' : '#FFF',
              },
            ]} />
          </View>

          {/* 色相滑块 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderBackground}>
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="rainbow" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#FF0000" />
                    <Stop offset="0.17" stopColor="#FFFF00" />
                    <Stop offset="0.33" stopColor="#00FF00" />
                    <Stop offset="0.5" stopColor="#00FFFF" />
                    <Stop offset="0.67" stopColor="#0000FF" />
                    <Stop offset="0.83" stopColor="#FF00FF" />
                    <Stop offset="1" stopColor="#FF0000" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#rainbow)" rx={4} />
              </Svg>
            </View>
            <Slider
              style={styles.slider}
              value={hue}
              minimumValue={0}
              maximumValue={360}
              onValueChange={(val) => {
                setHue(val);
                updateColorFromHSV(val, saturation, value);
              }}
              minimumTrackTintColor="transparent"
              maximumTrackTintColor="transparent"
              thumbTintColor={colors.text} // 或特定滑块颜色
            />
          </View>

          {/* HEX 输入和预览 */}
          <View style={styles.inputRow}>
            <View style={[styles.previewBox, { backgroundColor: activeColor, borderColor: colors.border }]} />
            <Text style={[styles.hashText, { color: colors.textSecondary }]}>#</Text>
            <TextInput
              style={[styles.hexInput, { color: colors.text, borderColor: colors.border }]}
              value={hexInput.replace('#', '')}
              onChangeText={handleHexChange}
              maxLength={6}
              autoCapitalize="characters"
            />
          </View>

          {/* 最近使用颜色 */}
          {recentColors.length > 0 && (
            <View style={styles.recentContainer}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>最近使用</Text>
              <View style={styles.swatchGrid}>
                {recentColors.map((c, i) => (
                  <TouchableOpacity
                    key={`recent-${i}`}
                    style={[styles.swatch, { backgroundColor: c, borderColor: colors.border }]}
                    onPress={() => {
                      setActiveColor(c);
                      setHexInput(c);
                      const h = rgbToHsv(c);
                      setHue(h.h);
                      setSaturation(h.s);
                      setValue(h.v);
                      triggerHaptic();
                    }}
                  />
                ))}
              </View>
            </View>
          )}

          {/* 底部按钮 */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.footerButton, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={{ color: colors.text }}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerButton, styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
            >
              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>确定</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 300,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.6,
  },
  boardContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    alignSelf: 'center',
  },
  boardLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cursor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    position: 'absolute',
    transform: [{ translateX: 0 }, { translateY: 0 }], // 使用left/top定位
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 3,
  },
  sliderContainer: {
    height: 30,
    marginBottom: 16,
    justifyContent: 'center',
  },
  sliderBackground: {
    position: 'absolute',
    left: 0, right: 0, top: 10,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 12,
  },
  hashText: {
    fontSize: 16,
    marginRight: 4,
  },
  hexInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  recentContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    marginBottom: 8,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  footerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  confirmButton: {
    borderWidth: 0,
  },
});

export default ColorPicker;
