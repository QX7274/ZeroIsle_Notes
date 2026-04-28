/**
 * Lottie动画组件
 *
 * 封装Lottie动画，提供常用的加载、成功、错误等预设动画
 *
 * 使用方法:
 * import { LottieAnimation, LoadingAnimation, SuccessAnimation } from '@/components/common/LottieAnimation';
 *
 * <LoadingAnimation size={100} />
 * <SuccessAnimation onFinish={() => console.log('done')} />
 * <LottieAnimation source={require('./custom.json')} autoPlay loop />
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

/**
 * 基础Lottie动画组件
 */
export const LottieAnimation = ({
    source,
    autoPlay = true,
    loop = true,
    speed = 1,
    style,
    size,
    onFinish,
    colorFilters,
    ...props
}) => {
    const animationRef = useRef(null);

    useEffect(() => {
        if (autoPlay && animationRef.current) {
            animationRef.current.play();
        }
    }, [autoPlay]);

    const handleAnimationFinish = useCallback((isCancelled) => {
        if (!isCancelled && onFinish) {
            onFinish();
        }
    }, [onFinish]);

    const sizeStyle = size ? { width: size, height: size } : {};

    return (
        <LottieView
            ref={animationRef}
            source={source}
            autoPlay={autoPlay}
            loop={loop}
            speed={speed}
            style={[styles.animation, sizeStyle, style]}
            onAnimationFinish={handleAnimationFinish}
            colorFilters={colorFilters}
            {...props}
        />
    );
};

/**
 * 加载动画
 */
export const LoadingAnimation = ({ size = 80, color, style, ...props }) => {
    // 使用内联的简单加载动画JSON（避免外部依赖）
    const loadingSource = {
        v: '5.5.7',
        fr: 60,
        ip: 0,
        op: 120,
        w: 200,
        h: 200,
        nm: 'Loading',
        ddd: 0,
        assets: [],
        layers: [{
            ddd: 0,
            ind: 1,
            ty: 4,
            nm: 'Circle',
            sr: 1,
            ks: {
                o: { a: 0, k: 100 },
                r: { a: 1, k: [{ t: 0, s: [0] }, { t: 120, s: [360] }] },
                p: { a: 0, k: [100, 100] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
            },
            shapes: [{
                ty: 'el',
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [60, 60] },
            }, {
                ty: 'st',
                c: { a: 0, k: color ? hexToRgb(color) : [0.38, 0.42, 0.95, 1] },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 6 },
                lc: 2,
                d: [{ n: 'd', v: { a: 0, k: 60 } }, { n: 'g', v: { a: 0, k: 100 } }, { n: 'o', v: { a: 0, k: 0 } }],
            }],
            ip: 0, op: 120,
        }],
    };

    return (
        <LottieAnimation
            source={loadingSource}
            size={size}
            loop
            style={style}
            {...props}
        />
    );
};

/**
 * 成功动画（打勾）
 */
export const SuccessAnimation = ({ size = 100, style, onFinish, ...props }) => {
    const successSource = {
        v: '5.5.7',
        fr: 60,
        ip: 0,
        op: 60,
        w: 200,
        h: 200,
        nm: 'Success',
        ddd: 0,
        assets: [],
        layers: [{
            ddd: 0,
            ind: 1,
            ty: 4,
            nm: 'Check',
            sr: 1,
            ks: {
                o: { a: 0, k: 100 },
                r: { a: 0, k: 0 },
                p: { a: 0, k: [100, 100] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
            },
            shapes: [{
                ty: 'sh',
                ks: {
                    a: 1,
                    k: [{
                        t: 0,
                        s: [{ v: [[-30, 0], [-30, 0], [-30, 0]] }],
                    }, {
                        t: 20,
                        s: [{ v: [[-30, 0], [-10, 20], [-10, 20]] }],
                    }, {
                        t: 40,
                        s: [{ v: [[-30, 0], [-10, 20], [30, -20]] }],
                    }],
                },
            }, {
                ty: 'st',
                c: { a: 0, k: [0.06, 0.72, 0.38, 1] },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 8 },
                lc: 2,
                lj: 2,
            }],
            ip: 0, op: 60,
        }],
    };

    return (
        <LottieAnimation
            source={successSource}
            size={size}
            loop={false}
            style={style}
            onFinish={onFinish}
            {...props}
        />
    );
};

/**
 * 错误动画（叉号）
 */
export const ErrorAnimation = ({ size = 100, style, onFinish, ...props }) => {
    const errorSource = {
        v: '5.5.7',
        fr: 60,
        ip: 0,
        op: 60,
        w: 200,
        h: 200,
        nm: 'Error',
        ddd: 0,
        assets: [],
        layers: [{
            ddd: 0,
            ind: 1,
            ty: 4,
            nm: 'Cross',
            sr: 1,
            ks: {
                o: { a: 0, k: 100 },
                r: { a: 0, k: 0 },
                p: { a: 0, k: [100, 100] },
                a: { a: 0, k: [0, 0] },
                s: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 20, s: [110, 110] }, { t: 30, s: [100, 100] }] },
            },
            shapes: [{
                ty: 'gr',
                it: [{
                    ty: 'sh',
                    ks: { a: 0, k: { v: [[-25, -25], [25, 25]] } },
                }, {
                    ty: 'sh',
                    ks: { a: 0, k: { v: [[25, -25], [-25, 25]] } },
                }, {
                    ty: 'st',
                    c: { a: 0, k: [0.93, 0.26, 0.21, 1] },
                    o: { a: 0, k: 100 },
                    w: { a: 0, k: 8 },
                    lc: 2,
                }, {
                    ty: 'tr',
                    p: { a: 0, k: [0, 0] },
                }],
            }],
            ip: 0, op: 60,
        }],
    };

    return (
        <LottieAnimation
            source={errorSource}
            size={size}
            loop={false}
            style={style}
            onFinish={onFinish}
            {...props}
        />
    );
};

/**
 * 空状态动画
 */
export const EmptyAnimation = ({ size = 150, style, ...props }) => {
    // 简单的浮动动画
    return (
        <View style={[styles.emptyContainer, { width: size, height: size }, style]}>
            <View style={styles.emptyBox} />
        </View>
    );
};

/**
 * 下拉刷新动画
 */
export const PullToRefreshAnimation = ({ size = 60, progress = 0, style, ...props }) => {
    return (
        <View style={[styles.pullContainer, { width: size, height: size }, style]}>
            <View style={[
                styles.pullCircle,
                {
                    transform: [{ rotate: `${progress * 360}deg` }],
                    opacity: Math.min(progress, 1),
                },
            ]} />
        </View>
    );
};

// 辅助函数
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
        1,
    ] : [0.38, 0.42, 0.95, 1];
};

const styles = StyleSheet.create({
    animation: {
        width: 100,
        height: 100,
    },
    emptyContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyBox: {
        width: '60%',
        height: '40%',
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    pullContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    pullCircle: {
        width: '60%',
        height: '60%',
        borderRadius: 100,
        borderWidth: 3,
        borderColor: '#6366F1',
        borderTopColor: 'transparent',
    },
});

export default LottieAnimation;
