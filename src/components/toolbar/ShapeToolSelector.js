/**
 * 形状绘制工具组件
 *
 * 提供各种形状的绘制功能：
 * - 基础形状（矩形、圆形、三角形等）
 * - 高级形状（箭头、星形、多边形等）
 * - 手绘风格形状
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    Dimensions,
} from 'react-native';
import Svg, {
    Path,
    Rect,
    Circle,
    Polygon,
    Line,
    G,
    Defs,
    Marker,
} from 'react-native-svg';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 形状类型
export const ShapeTypes = {
    // 基础形状
    RECTANGLE: {
        id: 'rectangle',
        name: '矩形',
        category: 'basic',
    },
    ROUNDED_RECT: {
        id: 'rounded_rect',
        name: '圆角矩形',
        category: 'basic',
    },
    CIRCLE: {
        id: 'circle',
        name: '圆形',
        category: 'basic',
    },
    ELLIPSE: {
        id: 'ellipse',
        name: '椭圆',
        category: 'basic',
    },
    TRIANGLE: {
        id: 'triangle',
        name: '三角形',
        category: 'basic',
    },
    LINE: {
        id: 'line',
        name: '直线',
        category: 'basic',
    },

    // 高级形状
    ARROW: {
        id: 'arrow',
        name: '箭头',
        category: 'advanced',
    },
    DOUBLE_ARROW: {
        id: 'double_arrow',
        name: '双向箭头',
        category: 'advanced',
    },
    STAR: {
        id: 'star',
        name: '星形',
        category: 'advanced',
    },
    PENTAGON: {
        id: 'pentagon',
        name: '五边形',
        category: 'advanced',
    },
    HEXAGON: {
        id: 'hexagon',
        name: '六边形',
        category: 'advanced',
    },
    DIAMOND: {
        id: 'diamond',
        name: '菱形',
        category: 'advanced',
    },

    // 特殊形状
    HEART: {
        id: 'heart',
        name: '心形',
        category: 'special',
    },
    CLOUD: {
        id: 'cloud',
        name: '云朵',
        category: 'special',
    },
    SPEECH_BUBBLE: {
        id: 'speech_bubble',
        name: '对话框',
        category: 'special',
    },
    CALLOUT: {
        id: 'callout',
        name: '标注',
        category: 'special',
    },
};

// 形状预览图标
const ShapeIcons = {
    rectangle: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Rect
                x="3" y="5" width="18" height="14"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    rounded_rect: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Rect
                x="3" y="5" width="18" height="14" rx="4"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    circle: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Circle
                cx="12" cy="12" r="9"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    ellipse: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Circle
                cx="12" cy="12" rx="10" ry="6"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    triangle: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Polygon
                points="12,3 22,21 2,21"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    line: ({ color, size }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Line
                x1="4" y1="20" x2="20" y2="4"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
            />
        </Svg>
    ),
    arrow: ({ color, size }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M4 12h16M14 6l6 6-6 6"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </Svg>
    ),
    double_arrow: ({ color, size }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M4 12h16M8 6l-4 6 4 6M16 6l4 6-4 6"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </Svg>
    ),
    star: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Polygon
                points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    pentagon: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Polygon
                points="12,2 22,9 18,21 6,21 2,9"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    hexagon: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Polygon
                points="12,2 20,6 20,18 12,22 4,18 4,6"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    diamond: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Polygon
                points="12,2 22,12 12,22 2,12"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    heart: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    cloud: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    speech_bubble: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2z"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
    callout: ({ color, size, fill }) => (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h6l2 4 2-4h6c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                stroke={color}
                strokeWidth="2"
                fill={fill ? color : 'none'}
                opacity={fill ? 0.3 : 1}
            />
        </Svg>
    ),
};

/**
 * 形状工具选择器
 */
const ShapeToolSelector = ({
    visible,
    onClose,
    selectedShape,
    onSelectShape,
    strokeWidth,
    onStrokeWidthChange,
    fillEnabled,
    onFillToggle,
    color,
}) => {
    const { colors, dark } = useTheme();

    const shapesByCategory = useMemo(() => {
        const categories = {
            basic: { title: '基础形状', shapes: [] },
            advanced: { title: '高级形状', shapes: [] },
            special: { title: '特殊形状', shapes: [] },
        };

        Object.values(ShapeTypes).forEach(shape => {
            if (categories[shape.category]) {
                categories[shape.category].shapes.push(shape);
            }
        });

        return categories;
    }, []);

    const handleShapeSelect = useCallback((shape) => {
        onSelectShape(shape);
    }, [onSelectShape]);

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
                        <Text style={[styles.modalTitle, { color: textColor }]}>选择形状</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={{ color: colors.primary }}>完成</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* 填充选项 */}
                        <View style={[styles.section, { borderBottomColor: borderColor }]}>
                            <View style={styles.optionRow}>
                                <Text style={[styles.optionLabel, { color: textColor }]}>填充</Text>
                                <TouchableOpacity
                                    style={[
                                        styles.toggleButton,
                                        fillEnabled && { backgroundColor: colors.primary },
                                        { borderColor: colors.primary },
                                    ]}
                                    onPress={onFillToggle}
                                >
                                    <Text style={{
                                        color: fillEnabled ? '#FFFFFF' : colors.primary,
                                        fontSize: 12,
                                    }}>
                                        {fillEnabled ? '开启' : '关闭'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* 各分类形状 */}
                        {Object.entries(shapesByCategory).map(([key, category]) => (
                            <View key={key} style={[styles.section, { borderBottomColor: borderColor }]}>
                                <Text style={[styles.sectionTitle, { color: textColor }]}>
                                    {category.title}
                                </Text>
                                <View style={styles.shapeGrid}>
                                    {category.shapes.map((shape) => {
                                        const isSelected = selectedShape?.id === shape.id;
                                        const IconComponent = ShapeIcons[shape.id];

                                        return (
                                            <TouchableOpacity
                                                key={shape.id}
                                                style={[
                                                    styles.shapeItem,
                                                    isSelected && {
                                                        backgroundColor: colors.primary + '20',
                                                        borderColor: colors.primary,
                                                    },
                                                    { borderColor: borderColor },
                                                ]}
                                                onPress={() => handleShapeSelect(shape)}
                                            >
                                                {IconComponent && (
                                                    <IconComponent
                                                        color={isSelected ? colors.primary : textColor}
                                                        size={32}
                                                        fill={fillEnabled}
                                                    />
                                                )}
                                                <Text
                                                    style={[
                                                        styles.shapeName,
                                                        { color: isSelected ? colors.primary : textColor },
                                                    ]}
                                                >
                                                    {shape.name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

/**
 * 生成形状路径
 */
export const generateShapePath = (shapeType, startPoint, endPoint, options = {}) => {
    const { fill = false, strokeWidth = 2 } = options;

    const minX = Math.min(startPoint.x, endPoint.x);
    const minY = Math.min(startPoint.y, endPoint.y);
    const maxX = Math.max(startPoint.x, endPoint.x);
    const maxY = Math.max(startPoint.y, endPoint.y);
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;

    switch (shapeType) {
        case 'rectangle':
            return `M ${minX} ${minY} L ${maxX} ${minY} L ${maxX} ${maxY} L ${minX} ${maxY} Z`;

        case 'rounded_rect':
            const r = Math.min(width, height) * 0.2;
            return `M ${minX + r} ${minY} L ${maxX - r} ${minY} Q ${maxX} ${minY} ${maxX} ${minY + r} L ${maxX} ${maxY - r} Q ${maxX} ${maxY} ${maxX - r} ${maxY} L ${minX + r} ${maxY} Q ${minX} ${maxY} ${minX} ${maxY - r} L ${minX} ${minY + r} Q ${minX} ${minY} ${minX + r} ${minY} Z`;

        case 'circle':
            const radius = Math.min(width, height) / 2;
            return `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY + radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY - radius} Z`;

        case 'ellipse':
            const rx = width / 2;
            const ry = height / 2;
            return `M ${centerX} ${minY} A ${rx} ${ry} 0 1 1 ${centerX} ${maxY} A ${rx} ${ry} 0 1 1 ${centerX} ${minY} Z`;

        case 'triangle':
            return `M ${centerX} ${minY} L ${maxX} ${maxY} L ${minX} ${maxY} Z`;

        case 'line':
            return `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`;

        case 'arrow':
            const arrowSize = Math.min(20, width * 0.3);
            const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
            const arrowX1 = endPoint.x - arrowSize * Math.cos(angle - Math.PI / 6);
            const arrowY1 = endPoint.y - arrowSize * Math.sin(angle - Math.PI / 6);
            const arrowX2 = endPoint.x - arrowSize * Math.cos(angle + Math.PI / 6);
            const arrowY2 = endPoint.y - arrowSize * Math.sin(angle + Math.PI / 6);
            return `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y} M ${arrowX1} ${arrowY1} L ${endPoint.x} ${endPoint.y} L ${arrowX2} ${arrowY2}`;

        case 'diamond':
            return `M ${centerX} ${minY} L ${maxX} ${centerY} L ${centerX} ${maxY} L ${minX} ${centerY} Z`;

        case 'star':
            return generateStarPath(centerX, centerY, Math.min(width, height) / 2, 5);

        case 'pentagon':
            return generatePolygonPath(centerX, centerY, Math.min(width, height) / 2, 5);

        case 'hexagon':
            return generatePolygonPath(centerX, centerY, Math.min(width, height) / 2, 6);

        case 'heart':
            return generateHeartPath(centerX, centerY, Math.min(width, height) / 2);

        default:
            return `M ${minX} ${minY} L ${maxX} ${minY} L ${maxX} ${maxY} L ${minX} ${maxY} Z`;
    }
};

// 生成星形路径
const generateStarPath = (cx, cy, radius, points = 5) => {
    const innerRadius = radius * 0.4;
    const path = [];

    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const r = i % 2 === 0 ? radius : innerRadius;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        path.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }

    path.push('Z');
    return path.join(' ');
};

// 生成多边形路径
const generatePolygonPath = (cx, cy, radius, sides) => {
    const path = [];

    for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        path.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }

    path.push('Z');
    return path.join(' ');
};

// 生成心形路径
const generateHeartPath = (cx, cy, size) => {
    const s = size;
    return `M ${cx} ${cy + s * 0.3} C ${cx} ${cy - s * 0.3} ${cx - s} ${cy - s * 0.3} ${cx - s} ${cy + s * 0.1} C ${cx - s} ${cy + s * 0.5} ${cx} ${cy + s} ${cx} ${cy + s} C ${cx} ${cy + s} ${cx + s} ${cy + s * 0.5} ${cx + s} ${cy + s * 0.1} C ${cx + s} ${cy - s * 0.3} ${cx} ${cy - s * 0.3} ${cx} ${cy + s * 0.3} Z`;
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
        paddingBottom: 34,
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
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionLabel: {
        fontSize: 14,
    },
    toggleButton: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: RADIUS.md,
        borderWidth: 1,
    },
    shapeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -SPACING.xs,
    },
    shapeItem: {
        width: (SCREEN_WIDTH - SPACING.md * 2 - SPACING.xs * 8) / 4,
        alignItems: 'center',
        padding: SPACING.sm,
        margin: SPACING.xs,
        borderRadius: RADIUS.md,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    shapeName: {
        fontSize: 10,
        marginTop: SPACING.xs,
        textAlign: 'center',
    },
});

export default ShapeToolSelector;
