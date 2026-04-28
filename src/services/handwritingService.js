/**
 * 手写体验增强服务
 *
 * 提供手写输入的高级功能：
 * - 笔锋效果
 * - 笔迹平滑
 * - 手势识别
 * - 撤销/重做栈管理
 * - Palm Rejection（误触拒绝）
 */

import { Platform } from 'react-native';

// 笔触类型配置
export const PenTypes = {
    BALLPOINT: {
        id: 'ballpoint',
        name: '圆珠笔',
        minWidth: 1,
        maxWidth: 3,
        smoothing: 0.5,
        taper: { start: 0.1, end: 0.1 },
        pressureCurve: 'linear',
    },
    FOUNTAIN: {
        id: 'fountain',
        name: '钢笔',
        minWidth: 1,
        maxWidth: 6,
        smoothing: 0.7,
        taper: { start: 0.2, end: 0.15 },
        pressureCurve: 'quadratic',
    },
    BRUSH: {
        id: 'brush',
        name: '毛笔',
        minWidth: 2,
        maxWidth: 15,
        smoothing: 0.8,
        taper: { start: 0.3, end: 0.25 },
        pressureCurve: 'exponential',
    },
    MARKER: {
        id: 'marker',
        name: '马克笔',
        minWidth: 8,
        maxWidth: 12,
        smoothing: 0.3,
        taper: { start: 0, end: 0 },
        pressureCurve: 'flat',
    },
    PENCIL: {
        id: 'pencil',
        name: '铅笔',
        minWidth: 0.5,
        maxWidth: 2,
        smoothing: 0.4,
        taper: { start: 0.05, end: 0.05 },
        pressureCurve: 'linear',
        texture: true,
    },
    CALLIGRAPHY: {
        id: 'calligraphy',
        name: '书法笔',
        minWidth: 1,
        maxWidth: 12,
        smoothing: 0.9,
        taper: { start: 0.4, end: 0.35 },
        pressureCurve: 'exponential',
        angleSensitive: true,
    },
};

// 手势类型
export const GestureTypes = {
    TAP: 'tap',
    DOUBLE_TAP: 'double_tap',
    LONG_PRESS: 'long_press',
    SWIPE_LEFT: 'swipe_left',
    SWIPE_RIGHT: 'swipe_right',
    SWIPE_UP: 'swipe_up',
    SWIPE_DOWN: 'swipe_down',
    PINCH: 'pinch',
    ROTATE: 'rotate',
    TWO_FINGER_TAP: 'two_finger_tap',
    THREE_FINGER_TAP: 'three_finger_tap',
    SCRATCH_OUT: 'scratch_out', // 划掉删除
    CIRCLE_SELECT: 'circle_select', // 圈选
    LINE_BREAK: 'line_break', // 换行手势
};

class HandwritingService {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50;
        this.currentPenType = PenTypes.FOUNTAIN;
        this.palmRejectionEnabled = true;
        this.palmRejectionThreshold = 30; // 触摸面积阈值
        this.gestureRecognizer = new GestureRecognizer();
        this.strokeSmoother = new StrokeSmoother();
    }

    /**
     * 设置笔触类型
     */
    setPenType(penTypeId) {
        const penType = Object.values(PenTypes).find(p => p.id === penTypeId);
        if (penType) {
            this.currentPenType = penType;
        }
    }

    /**
     * 处理触摸点，应用压感和笔锋效果
     */
    processPoint(point, prevPoints = []) {
        const pen = this.currentPenType;

        // Palm Rejection
        if (this.palmRejectionEnabled && this.isPalmTouch(point)) {
            return null;
        }

        // 获取压力值
        const pressure = this.normalizePressure(point.force || point.pressure || 0.5);

        // 计算速度
        const speed = this.calculateSpeed(point, prevPoints);

        // 应用压力曲线
        const adjustedPressure = this.applyPressureCurve(pressure, pen.pressureCurve);

        // 计算动态宽度
        const width = this.calculateWidth(adjustedPressure, speed, pen);

        // 应用笔锋效果
        const position = prevPoints.length / 100; // 简化的位置估算
        const taperedWidth = this.applyTaper(width, position, pen.taper);

        return {
            ...point,
            pressure: adjustedPressure,
            width: taperedWidth,
            speed,
            timestamp: point.timestamp || Date.now(),
        };
    }

    /**
     * 检测是否为手掌误触
     */
    isPalmTouch(point) {
        if (!point) {return false;}

        // 检查触摸面积
        const touchArea = point.majorRadius || point.radiusMajor || 0;
        if (touchArea > this.palmRejectionThreshold) {
            return true;
        }

        // 检查触摸类型（如果可用）
        if (point.touchType === 'palm' || point.touchType === 'unknown') {
            return true;
        }

        return false;
    }

    /**
     * 标准化压力值到 0-1
     */
    normalizePressure(pressure) {
        if (Platform.OS === 'ios') {
            // iOS 压力值通常在 0-6.67 之间
            return Math.min(1, pressure / 6.67);
        } else {
            // Android 压力值通常在 0-1 之间
            return Math.max(0, Math.min(1, pressure));
        }
    }

    /**
     * 计算触摸点速度
     */
    calculateSpeed(point, prevPoints) {
        if (prevPoints.length === 0) {return 0;}

        const lastPoint = prevPoints[prevPoints.length - 1];
        const dx = point.x - lastPoint.x;
        const dy = point.y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const dt = (point.timestamp || Date.now()) - (lastPoint.timestamp || Date.now());
        if (dt <= 0) {return 0;}

        return distance / dt; // 像素/毫秒
    }

    /**
     * 应用压力曲线
     */
    applyPressureCurve(pressure, curveType) {
        switch (curveType) {
            case 'linear':
                return pressure;
            case 'quadratic':
                return pressure * pressure;
            case 'exponential':
                return Math.pow(pressure, 1.5);
            case 'flat':
                return 0.8; // 固定压力
            default:
                return pressure;
        }
    }

    /**
     * 计算动态宽度
     */
    calculateWidth(pressure, speed, pen) {
        const { minWidth, maxWidth } = pen;

        // 基于压力的宽度
        let width = minWidth + (maxWidth - minWidth) * pressure;

        // 速度影响：速度越快越细
        const speedFactor = Math.max(0.5, 1 - speed * 0.05);
        width *= speedFactor;

        return Math.max(minWidth, Math.min(maxWidth, width));
    }

    /**
     * 应用笔锋效果
     */
    applyTaper(width, position, taper) {
        const { start, end } = taper;

        if (position < start) {
            // 起笔渐入
            const t = position / start;
            return width * (0.3 + 0.7 * t);
        } else if (position > 1 - end) {
            // 收笔渐出
            const t = (1 - position) / end;
            return width * (0.3 + 0.7 * t);
        }

        return width;
    }

    /**
     * 平滑笔画
     */
    smoothStroke(points) {
        return this.strokeSmoother.smooth(points, this.currentPenType.smoothing);
    }

    /**
     * 识别手势
     */
    recognizeGesture(points) {
        return this.gestureRecognizer.recognize(points);
    }

    /**
     * 添加操作到撤销栈
     */
    pushToUndoStack(action) {
        this.undoStack.push(action);
        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift();
        }
        // 新操作清空重做栈
        this.redoStack = [];
    }

    /**
     * 撤销
     */
    undo() {
        if (this.undoStack.length === 0) {return null;}

        const action = this.undoStack.pop();
        this.redoStack.push(action);
        return action;
    }

    /**
     * 重做
     */
    redo() {
        if (this.redoStack.length === 0) {return null;}

        const action = this.redoStack.pop();
        this.undoStack.push(action);
        return action;
    }

    /**
     * 检查是否可撤销
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * 检查是否可重做
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * 清空历史
     */
    clearHistory() {
        this.undoStack = [];
        this.redoStack = [];
    }
}

/**
 * 笔画平滑器
 */
class StrokeSmoother {
    /**
     * 使用移动平均+Bezier曲线平滑
     */
    smooth(points, smoothingFactor = 0.5) {
        if (points.length < 3) {return points;}

        const windowSize = Math.max(3, Math.floor(5 * smoothingFactor));
        const smoothed = [];

        for (let i = 0; i < points.length; i++) {
            const start = Math.max(0, i - Math.floor(windowSize / 2));
            const end = Math.min(points.length, i + Math.floor(windowSize / 2) + 1);

            let sumX = 0, sumY = 0, sumWeight = 0;

            for (let j = start; j < end; j++) {
                const distance = Math.abs(j - i);
                const weight = 1 / (1 + distance * smoothingFactor);
                sumX += points[j].x * weight;
                sumY += points[j].y * weight;
                sumWeight += weight;
            }

            smoothed.push({
                ...points[i],
                x: sumX / sumWeight,
                y: sumY / sumWeight,
            });
        }

        return smoothed;
    }
}

/**
 * 手势识别器
 */
class GestureRecognizer {
    constructor() {
        this.minSwipeDistance = 50;
        this.maxTapDuration = 300;
        this.doubleTapInterval = 300;
        this.lastTapTime = 0;
    }

    /**
     * 识别手势
     */
    recognize(points) {
        if (!points || points.length < 2) {return null;}

        const first = points[0];
        const last = points[points.length - 1];
        const duration = last.timestamp - first.timestamp;
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 检测划掉删除（快速往返笔画）
        if (this.isScratchOut(points)) {
            return { type: GestureTypes.SCRATCH_OUT, points };
        }

        // 检测圈选
        if (this.isCircleSelect(points)) {
            return { type: GestureTypes.CIRCLE_SELECT, points };
        }

        // 检测点击
        if (distance < 10 && duration < this.maxTapDuration) {
            const now = Date.now();
            if (now - this.lastTapTime < this.doubleTapInterval) {
                this.lastTapTime = 0;
                return { type: GestureTypes.DOUBLE_TAP, x: first.x, y: first.y };
            }
            this.lastTapTime = now;
            return { type: GestureTypes.TAP, x: first.x, y: first.y };
        }

        // 检测滑动
        if (distance > this.minSwipeDistance) {
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;

            if (angle > -45 && angle < 45) {
                return { type: GestureTypes.SWIPE_RIGHT, distance, angle };
            } else if (angle > 45 && angle < 135) {
                return { type: GestureTypes.SWIPE_DOWN, distance, angle };
            } else if (angle < -45 && angle > -135) {
                return { type: GestureTypes.SWIPE_UP, distance, angle };
            } else {
                return { type: GestureTypes.SWIPE_LEFT, distance, angle };
            }
        }

        return null;
    }

    /**
     * 检测划掉删除手势
     */
    isScratchOut(points) {
        if (points.length < 10) {return false;}

        // 计算方向变化次数
        let directionChanges = 0;
        for (let i = 2; i < points.length; i++) {
            const dx1 = points[i - 1].x - points[i - 2].x;
            const dx2 = points[i].x - points[i - 1].x;

            if (dx1 * dx2 < 0) {
                directionChanges++;
            }
        }

        // 如果水平方向变化超过3次，认为是划掉手势
        return directionChanges >= 3;
    }

    /**
     * 检测圈选手势
     */
    isCircleSelect(points) {
        if (points.length < 20) {return false;}

        const first = points[0];
        const last = points[points.length - 1];

        // 检查起点和终点是否接近
        const closureDistance = Math.sqrt(
            Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)
        );

        // 计算轨迹总长度
        let totalLength = 0;
        for (let i = 1; i < points.length; i++) {
            totalLength += Math.sqrt(
                Math.pow(points[i].x - points[i - 1].x, 2) +
                Math.pow(points[i].y - points[i - 1].y, 2)
            );
        }

        // 如果轨迹形成闭合（起终点接近且轨迹够长），认为是圈选
        return closureDistance < 50 && totalLength > 100;
    }
}

// 导出单例
export const handwritingService = new HandwritingService();

export default handwritingService;
