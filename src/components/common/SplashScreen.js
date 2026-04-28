/**
 * 品牌加载屏幕组件
 *
 * 应用启动时显示的品牌加载动画
 *
 * 使用方法:
 * <SplashScreen onFinish={() => setIsReady(true)} />
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, ANIMATION } from '../../theme/tokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * 品牌加载屏幕
 */
export const SplashScreen = ({ onFinish, minDuration = 2000 }) => {
    const { colors, dark } = useTheme();

    const logoScale = useRef(new Animated.Value(0.5)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const progressWidth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // 动画序列
        Animated.sequence([
            // Logo淡入并放大
            Animated.parallel([
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.spring(logoScale, {
                    toValue: 1,
                    friction: 5,
                    tension: 100,
                    useNativeDriver: true,
                }),
            ]),
            // 文字淡入
            Animated.timing(textOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            // 进度条
            Animated.timing(progressWidth, {
                toValue: 1,
                duration: minDuration - 800,
                useNativeDriver: false,
            }),
        ]).start(() => {
            // 完成后回调
            if (onFinish) {
                onFinish();
            }
        });
    }, []);

    const backgroundColor = dark ? '#0F172A' : '#F8FAFC';
    const primaryColor = colors.primary || '#6366F1';
    const textColor = dark ? '#F1F5F9' : '#1E293B';
    const subtitleColor = dark ? '#94A3B8' : '#64748B';

    return (
        <View style={[styles.container, { backgroundColor }]}>
            {/* 背景装饰 */}
            <View style={styles.backgroundDecoration}>
                <View style={[styles.circle, styles.circle1, { backgroundColor: primaryColor }]} />
                <View style={[styles.circle, styles.circle2, { backgroundColor: primaryColor }]} />
            </View>

            {/* Logo */}
            <Animated.View style={[
                styles.logoContainer,
                {
                    opacity: logoOpacity,
                    transform: [{ scale: logoScale }],
                },
            ]}>
                <View style={[styles.logoIcon, { backgroundColor: primaryColor }]}>
                    <Text style={styles.logoEmoji}>🏝️</Text>
                </View>
            </Animated.View>

            {/* 品牌名称 */}
            <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
                <Text style={[styles.title, { color: textColor }]}>零屿笔记</Text>
                <Text style={[styles.subtitle, { color: subtitleColor }]}>ZeroIsle Notes</Text>
                <Text style={[styles.tagline, { color: subtitleColor }]}>智能协作，知识随行</Text>
            </Animated.View>

            {/* 加载进度条 */}
            <View style={styles.progressContainer}>
                <Animated.View
                    style={[
                        styles.progressBar,
                        {
                            backgroundColor: primaryColor,
                            width: progressWidth.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                            }),
                        },
                    ]}
                />
            </View>
        </View>
    );
};

/**
 * 简化的加载指示器
 */
export const LoadingOverlay = ({ visible, message = '加载中...' }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: visible ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [visible]);

    if (!visible) {return null;}

    return (
        <Animated.View style={[styles.overlay, { opacity }]}>
            <View style={styles.loadingBox}>
                <View style={styles.spinner} />
                <Text style={styles.loadingText}>{message}</Text>
            </View>
        </Animated.View>
    );
};

/**
 * 页面加载占位符
 */
export const PageLoadingPlaceholder = ({ message }) => {
    const { colors, dark } = useTheme();
    const pulseAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <View style={[styles.pageLoading, { backgroundColor: dark ? '#0F172A' : '#F8FAFC' }]}>
            <Animated.View style={[styles.loadingIcon, { opacity: pulseAnim }]}>
                <Text style={{ fontSize: 48 }}>📝</Text>
            </Animated.View>
            {message && (
                <Text style={[styles.pageLoadingText, { color: dark ? '#94A3B8' : '#64748B' }]}>
                    {message}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backgroundDecoration: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    circle: {
        position: 'absolute',
        borderRadius: 1000,
        opacity: 0.1,
    },
    circle1: {
        width: SCREEN_WIDTH * 1.5,
        height: SCREEN_WIDTH * 1.5,
        top: -SCREEN_WIDTH * 0.5,
        right: -SCREEN_WIDTH * 0.5,
    },
    circle2: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
        bottom: -SCREEN_WIDTH * 0.3,
        left: -SCREEN_WIDTH * 0.3,
    },
    logoContainer: {
        marginBottom: SPACING.xl,
    },
    logoIcon: {
        width: 100,
        height: 100,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    logoEmoji: {
        fontSize: 48,
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: SPACING.xxxl,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        letterSpacing: 2,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 4,
        marginBottom: SPACING.md,
    },
    tagline: {
        fontSize: 14,
    },
    progressContainer: {
        position: 'absolute',
        bottom: 100,
        left: SPACING.xxxl,
        right: SPACING.xxxl,
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 2,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingBox: {
        backgroundColor: '#fff',
        padding: SPACING.lg,
        borderRadius: 16,
        alignItems: 'center',
        minWidth: 120,
    },
    spinner: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#6366F1',
        borderTopColor: 'transparent',
    },
    loadingText: {
        marginTop: SPACING.sm,
        fontSize: 14,
        color: '#64748B',
    },
    pageLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingIcon: {
        marginBottom: SPACING.md,
    },
    pageLoadingText: {
        fontSize: 14,
    },
});

export default SplashScreen;
