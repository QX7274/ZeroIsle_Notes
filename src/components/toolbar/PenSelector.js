/**
 * 笔触选择器组件
 *
 * 提供丰富的笔触选择界面，包括：
 * - 笔触类型选择
 * - 粗细调节
 * - 透明度调节
 * - 笔触预览
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    Dimensions,
} from 'react-native';
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';
import { PenTypes } from '../../services/handwritingService';
import { SPACING, RADIUS } from '../../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 笔触图标
const PenIcons = {
    ballpoint: ({ color, size }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"
                fill={color}
            />
        </Svg>
    ),
    fountain: ({ color, size }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M19.46 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0L14 4.99l3.75 3.75 1.71-1.7z"
                fill={color}
            />
            <Path
                d="M3 17.25V21h3.75L16.81 10.94l-3.75-3.75L3 17.25z"
                fill={color}
            />
            <Path d="M14.5 3l-1.5 1.5 3 3 1.5-1.5" fill={color} opacity={0.6} />
        </Svg>
    ),
    brush: ({ color, size }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 00-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41z"
                fill={color}
            />
        </Svg>
    ),
    marker: ({ color, size }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Rect x="4" y="6" width="16" height="12" rx="2" fill={color} opacity={0.3} />
            <Path
                d="M16 4h-2l-8 8v4h4l8-8V6c0-1.1-.9-2-2-2zm-1.46 9.12L8 19.58 4.42 16l6.46-6.54 4.12 4.12z"
                fill={color}
            />
        </Svg>
    ),
    pencil: ({ color, size }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"
                fill={color}
                opacity={0.7}
            />
            <Path d="M3 21h18v-2H3v2z" fill={color} opacity={0.3} />
        </Svg>
    ),
    calligraphy: ({ color, size }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"
                fill={color}
                opacity={0.5}
            />
            <Path
                d="M12 4L6 20h2l1.5-4h5l1.5 4h2L12 4zm-1.2 10L12 9l1.2 5h-2.4z"
                fill={color}
            />
        </Svg>
    ),
};

/**
 * 笔触预览
 */
const StrokePreview = ({ penType, color, strokeWidth, opacity }) => {
    // 生成预览路径
    const generatePreviewPath = useCallback(() => {
        const points = [];
        const width = 200;
        const height = 60;

        for (let i = 0; i <= 100; i++) {
            const x = (i / 100) * width;
            // 添加一些波动模拟手写
            const wave = Math.sin(i * 0.1) * 10;
            const y = height / 2 + wave;
            points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
        }

        return points.join(' ');
    }, []);

    const pathD = useMemo(() => generatePreviewPath(), [generatePreviewPath]);

    return (
        <View style={styles.previewContainer}>
            <Svg width={200} height={60}>
                <Defs>
                    <LinearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={color} stopOpacity={opacity * 0.5} />
                        <Stop offset="0.3" stopColor={color} stopOpacity={opacity} />
                        <Stop offset="0.7" stopColor={color} stopOpacity={opacity} />
                        <Stop offset="1" stopColor={color} stopOpacity={opacity * 0.5} />
                    </LinearGradient>
                </Defs>
                <Path
                    d={pathD}
                    stroke="url(#strokeGradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                />
            </Svg>
        </View>
    );
};

/**
 * 笔触选择器
 */
const PenSelector = ({
    visible,
    onClose,
    selectedPen,
    onSelectPen,
    strokeWidth,
    onStrokeWidthChange,
    opacity,
    onOpacityChange,
    color,
}) => {
    const { colors, dark } = useTheme();
    const [localStrokeWidth, setLocalStrokeWidth] = useState(strokeWidth);
    const [localOpacity, setLocalOpacity] = useState(opacity);

    const penTypes = useMemo(() => Object.values(PenTypes), []);

    useEffect(() => {
        setLocalStrokeWidth(strokeWidth);
    }, [strokeWidth]);

    useEffect(() => {
        setLocalOpacity(opacity);
    }, [opacity]);

    const handlePenSelect = useCallback((pen) => {
        onSelectPen(pen);
    }, [onSelectPen]);

    const handleStrokeWidthChange = useCallback((value) => {
        setLocalStrokeWidth(value);
        onStrokeWidthChange?.(value);
    }, [onStrokeWidthChange]);

    const handleOpacityChange = useCallback((value) => {
        setLocalOpacity(value);
        onOpacityChange?.(value);
    }, [onOpacityChange]);

    const modalBg = dark ? '#1E293B' : '#FFFFFF';
    const textColor = dark ? '#F1F5F9' : '#1E293B';
    const borderColor = dark ? '#334155' : '#E2E8F0';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
                    {/* 标题栏 */}
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: textColor }]}>选择笔触</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={{ color: colors.primary }}>完成</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* 笔触预览 */}
                        <View style={[styles.section, { borderBottomColor: borderColor }]}>
                            <Text style={[styles.sectionTitle, { color: textColor }]}>预览</Text>
                            <StrokePreview
                                penType={selectedPen}
                                color={color}
                                strokeWidth={localStrokeWidth}
                                opacity={localOpacity}
                            />
                        </View>

                        {/* 笔触类型 */}
                        <View style={[styles.section, { borderBottomColor: borderColor }]}>
                            <Text style={[styles.sectionTitle, { color: textColor }]}>笔触类型</Text>
                            <View style={styles.penGrid}>
                                {penTypes.map((pen) => {
                                    const isSelected = selectedPen?.id === pen.id;
                                    const IconComponent = PenIcons[pen.id];

                                    return (
                                        <TouchableOpacity
                                            key={pen.id}
                                            style={[
                                                styles.penItem,
                                                isSelected && {
                                                    backgroundColor: colors.primary + '20',
                                                    borderColor: colors.primary,
                                                },
                                                { borderColor: borderColor },
                                            ]}
                                            onPress={() => handlePenSelect(pen)}
                                        >
                                            {IconComponent && (
                                                <IconComponent
                                                    color={isSelected ? colors.primary : textColor}
                                                    size={28}
                                                />
                                            )}
                                            <Text
                                                style={[
                                                    styles.penName,
                                                    { color: isSelected ? colors.primary : textColor },
                                                ]}
                                            >
                                                {pen.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* 粗细调节 */}
                        <View style={[styles.section, { borderBottomColor: borderColor }]}>
                            <View style={styles.sliderHeader}>
                                <Text style={[styles.sectionTitle, { color: textColor }]}>粗细</Text>
                                <Text style={[styles.sliderValue, { color: textColor }]}>
                                    {Math.round(localStrokeWidth)}px
                                </Text>
                            </View>
                            <Slider
                                style={styles.slider}
                                minimumValue={selectedPen?.minWidth || 1}
                                maximumValue={selectedPen?.maxWidth || 20}
                                value={localStrokeWidth}
                                onValueChange={handleStrokeWidthChange}
                                minimumTrackTintColor={colors.primary}
                                maximumTrackTintColor={borderColor}
                                thumbTintColor={colors.primary}
                            />
                            <View style={styles.sliderLabels}>
                                <Text style={[styles.sliderLabel, { color: textColor }]}>细</Text>
                                <Text style={[styles.sliderLabel, { color: textColor }]}>粗</Text>
                            </View>
                        </View>

                        {/* 透明度调节 */}
                        <View style={styles.section}>
                            <View style={styles.sliderHeader}>
                                <Text style={[styles.sectionTitle, { color: textColor }]}>透明度</Text>
                                <Text style={[styles.sliderValue, { color: textColor }]}>
                                    {Math.round(localOpacity * 100)}%
                                </Text>
                            </View>
                            <Slider
                                style={styles.slider}
                                minimumValue={0.1}
                                maximumValue={1}
                                value={localOpacity}
                                onValueChange={handleOpacityChange}
                                minimumTrackTintColor={colors.primary}
                                maximumTrackTintColor={borderColor}
                                thumbTintColor={colors.primary}
                            />
                            <View style={styles.sliderLabels}>
                                <Text style={[styles.sliderLabel, { color: textColor }]}>淡</Text>
                                <Text style={[styles.sliderLabel, { color: textColor }]}>浓</Text>
                            </View>
                        </View>

                        {/* 笔触特性说明 */}
                        {selectedPen && (
                            <View style={[styles.section, styles.featuresSection]}>
                                <Text style={[styles.sectionTitle, { color: textColor }]}>特性</Text>
                                <View style={styles.featuresList}>
                                    <View style={styles.featureItem}>
                                        <View style={[styles.featureDot, { backgroundColor: colors.primary }]} />
                                        <Text style={[styles.featureText, { color: textColor }]}>
                                            平滑度: {Math.round(selectedPen.smoothing * 100)}%
                                        </Text>
                                    </View>
                                    <View style={styles.featureItem}>
                                        <View style={[styles.featureDot, { backgroundColor: colors.primary }]} />
                                        <Text style={[styles.featureText, { color: textColor }]}>
                                            笔锋效果: {selectedPen.taper.start > 0 ? '有' : '无'}
                                        </Text>
                                    </View>
                                    {selectedPen.texture && (
                                        <View style={styles.featureItem}>
                                            <View style={[styles.featureDot, { backgroundColor: colors.primary }]} />
                                            <Text style={[styles.featureText, { color: textColor }]}>
                                                纹理效果
                                            </Text>
                                        </View>
                                    )}
                                    {selectedPen.angleSensitive && (
                                        <View style={styles.featureItem}>
                                            <View style={[styles.featureDot, { backgroundColor: colors.primary }]} />
                                            <Text style={[styles.featureText, { color: textColor }]}>
                                                角度敏感
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        maxHeight: '80%',
        paddingBottom: 34, // Safe area
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    closeButton: {
        padding: SPACING.xs,
    },
    section: {
        padding: SPACING.md,
        borderBottomWidth: 1,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: SPACING.sm,
    },
    previewContainer: {
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: RADIUS.md,
    },
    penGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -SPACING.xs,
    },
    penItem: {
        width: (SCREEN_WIDTH - SPACING.md * 2 - SPACING.xs * 6) / 3,
        alignItems: 'center',
        padding: SPACING.md,
        margin: SPACING.xs,
        borderRadius: RADIUS.md,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    penName: {
        fontSize: 12,
        marginTop: SPACING.xs,
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sliderValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sliderLabel: {
        fontSize: 12,
        opacity: 0.6,
    },
    featuresSection: {
        borderBottomWidth: 0,
    },
    featuresList: {
        marginTop: SPACING.xs,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },
    featureDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: SPACING.sm,
    },
    featureText: {
        fontSize: 13,
    },
});

export default PenSelector;
