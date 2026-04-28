/**
 * Toast辅助工具
 *
 * 提供静态方法来显示Toast通知
 *
 * 使用方法:
 * import { showToast } from '@/components/common/ToastHelper';
 * showToast.success('操作成功');
 * showToast.error('操作失败');
 * showToast.info('提示信息');
 * showToast.warning('警告信息');
 */

import { store } from '../../redux/store';

// 检查uiSlice是否存在并包含showToast action
let showToastAction = null;
try {
    const uiSlice = require('../../redux/slices/uiSlice');
    showToastAction = uiSlice.showToast;
} catch (e) {
    console.warn('uiSlice not found, Toast helper will not work');
}

/**
 * 显示Toast消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型: 'success' | 'error' | 'info' | 'warning'
 * @param {number} duration - 显示时长(毫秒)，默认3000
 */
const show = (message, type = 'info', duration = 3000) => {
    if (!showToastAction) {
        console.warn('Toast action not available');
        return;
    }

    store.dispatch(showToastAction({
        message,
        type,
        duration,
    }));
};

/**
 * 静态Toast方法集合
 */
export const showToast = {
    /**
     * 显示成功消息
     * @param {string} message - 消息内容
     * @param {number} duration - 显示时长
     */
    success: (message, duration) => show(message, 'success', duration),

    /**
     * 显示错误消息
     * @param {string} message - 消息内容
     * @param {number} duration - 显示时长
     */
    error: (message, duration) => show(message, 'error', duration),

    /**
     * 显示信息消息
     * @param {string} message - 消息内容
     * @param {number} duration - 显示时长
     */
    info: (message, duration) => show(message, 'info', duration),

    /**
     * 显示警告消息
     * @param {string} message - 消息内容
     * @param {number} duration - 显示时长
     */
    warning: (message, duration) => show(message, 'warning', duration),

    /**
     * 通用显示方法
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型
     * @param {number} duration - 显示时长
     */
    show,
};

export default showToast;
