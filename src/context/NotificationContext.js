
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNotification } from '../hooks/useNotification';
import { StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';

const NotificationContext = createContext({
    notifications: [],
    unreadCount: 0,
    isConnected: false,
    markAsRead: () => { },
});

export const useNotificationContext = () => useContext(NotificationContext);

const buildNotificationText = (notification) => {
    const parts = [
        notification?.title,
        notification?.message,
        notification?.body,
        notification?.description,
    ].filter(Boolean);

    return parts.join(' | ');
};

export const NotificationProvider = ({ children }) => {
    const { notifications, unreadCount, isConnected, markAsRead } = useNotification();
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [latestMessage, setLatestMessage] = useState('');

    const shouldSuppressSnackbar = (notification) => {
        const messageParts = [
            notification?.title,
            notification?.message,
            notification?.body,
            notification?.description,
        ].filter(Boolean);
        const message = messageParts.join(' | ');

        if (!message) {
            return true;
        }

        const normalized = String(message).toLowerCase();
        const sanitized = normalized.replace(/\s+/g, '');
        const networkErrorPhrases = [
            '获取群组邀请失败',
            '获取群组列表失败',
            '获取群组详情失败',
            '获取群组成员失败',
            '获取群组创建失败',
            '获取群组加入失败',
            '获取群组更新失败',
            '获取群组删除失败',
            '加载同步设置失败',
            '同步设置更新失败',
            '清空离线队列失败',
            '加载同步设置失败，请稍后重试',
            '同步设置加载失败，请稍后重试',
            '网络错误且无缓存',
            '无法完成请求',
            '离线状态下无法完成请求',
            'network error',
            'network connection failed',
            'request timed out',
            'no internet',
            'offline',
        ];
        const networkKeywords = [
            'api网络错误',
            '网络连接失败',
            '请求超时',
            '网络错误',
            '无网络连接',
        ];
        const notificationNoisePhrases = [
            '获取群组邀请失败',
            '获取群组列表失败',
            '获取群组详情失败',
            '获取群组成员失败',
            '邀请成员失败',
            '邀请用户失败',
            '创建群组失败',
            '更新群组失败',
            '删除群组失败',
            '加入群组失败',
            '生成加入码失败',
            '获取屏幕共享列表失败',
            '创建屏幕共享失败',
            '加入屏幕共享失败',
            '暂停屏幕共享失败',
            '恢复屏幕共享失败',
            '结束屏幕共享失败',
            '获取群组通知失败',
            '获取群组消息失败',
            '获取群组列表失败:',
            '获取群组邀请失败:',
            '加载同步设置失败',
            '同步设置更新失败',
            '清空离线队列失败',
        ];
        const groupFailurePattern = /群组.*失败|获取群组.*失败|邀请.*失败|加入.*失败|创建群组.*失败|更新群组.*失败|删除群组.*失败/;
        const rawErrorPattern = /error[:：]|网络错误|网络连接失败|无法完成请求|离线状态下无法完成请求/;

        // 只屏蔽明确的网络错误提示，避免误伤普通通知内容。
        const looksLikeNetworkError = networkKeywords.some(keyword => normalized.includes(keyword.toLowerCase()));
        const looksLikeRawNetworkFailure = networkErrorPhrases.some(keyword => normalized.includes(keyword.toLowerCase()));
        const looksLikeNotificationNoise = notificationNoisePhrases.some(keyword => sanitized.includes(keyword.toLowerCase().replace(/\s+/g, '')));
        const explicitlyMarkedNetworkError = normalized.includes('networkerror') || normalized.includes('isnetworkerror');
        const looksLikeGroupFailure = groupFailurePattern.test(message);
        const looksLikeRawErrorText = rawErrorPattern.test(normalized);
        return looksLikeNetworkError || looksLikeRawNetworkFailure || looksLikeNotificationNoise || explicitlyMarkedNetworkError || looksLikeGroupFailure || looksLikeRawErrorText;
    };

    const shouldDisplaySnackbar = (notification) => {
        const message = buildNotificationText(notification);
        if (!message) {
            return false;
        }

        const normalized = message.toLowerCase();
        const compact = normalized.replace(/\s+/g, '');

        const suppressedPhrases = [
            '获取群组邀请失败',
            '获取群组列表失败',
            '获取群组详情失败',
            '获取群组成员失败',
            '邀请成员失败',
            '邀请用户失败',
            '创建群组失败',
            '更新群组失败',
            '删除群组失败',
            '加入群组失败',
            '生成加入码失败',
            '获取屏幕共享列表失败',
            '创建屏幕共享失败',
            '加入屏幕共享失败',
            '暂停屏幕共享失败',
            '恢复屏幕共享失败',
            '结束屏幕共享失败',
            '网络错误且无缓存',
            '无法完成请求',
            '离线状态下无法完成请求',
            '加载同步设置失败',
            '同步设置更新失败',
            '清空离线队列失败',
        ];
        const suppressedKeywords = [
            'network error',
            'network connection failed',
            'request timed out',
            'no internet',
            'offline',
            '网络错误',
            '网络连接失败',
            '请求超时',
            '无网络连接',
        ];

        const groupFailurePattern = /群组.*失败|获取群组.*失败|邀请.*失败|加入.*失败|创建群组.*失败|更新群组.*失败|删除群组.*失败/;
        const rawErrorPattern = /error[:：]|网络错误|网络连接失败|无法完成请求|离线状态下无法完成请求/;

        return !(
            suppressedPhrases.some(phrase => compact.includes(phrase.replace(/\s+/g, '').toLowerCase()))
            || suppressedKeywords.some(keyword => normalized.includes(keyword.toLowerCase()))
            || groupFailurePattern.test(message)
            || rawErrorPattern.test(normalized)
        );
    };

    // Show snackbar when a new notification arrives
    useEffect(() => {
        if (notifications.length > 0) {
            const newest = notifications[0];
            // Only show if it's recent (optional timestamp check could go here)
            if (shouldSuppressSnackbar(newest) || !shouldDisplaySnackbar(newest)) {
                setSnackbarVisible(false);
                setLatestMessage('');
                return;
            }
            const message = newest.message || newest.title || 'New Notification';
            setLatestMessage(message);
            setSnackbarVisible(true);
        }
    }, [notifications]);

    const onDismissSnackbar = () => setSnackbarVisible(false);

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, isConnected, markAsRead }}>
            {children}
            <Snackbar
                visible={snackbarVisible}
                onDismiss={onDismissSnackbar}
                duration={3000}
                action={{
                    label: 'Close',
                    onPress: onDismissSnackbar,
                }}
                style={styles.snackbar}
            >
                {latestMessage}
            </Snackbar>
        </NotificationContext.Provider>
    );
};

const styles = StyleSheet.create({
    snackbar: {
        marginBottom: 20,
        zIndex: 9999,
    },
});
