
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

export const NotificationProvider = ({ children }) => {
    const { notifications, unreadCount, isConnected, markAsRead } = useNotification();
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [latestMessage, setLatestMessage] = useState('');

    const shouldSuppressSnackbar = (message) => {
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
        ];

        // 只屏蔽明确的网络错误提示，避免误伤普通通知内容。
        const looksLikeNetworkError = networkKeywords.some(keyword => normalized.includes(keyword.toLowerCase()));
        const looksLikeRawNetworkFailure = networkErrorPhrases.some(keyword => normalized.includes(keyword.toLowerCase()));
        const looksLikeNotificationNoise = notificationNoisePhrases.some(keyword => sanitized.includes(keyword.toLowerCase().replace(/\s+/g, '')));
        const explicitlyMarkedNetworkError = normalized.includes('networkerror') || normalized.includes('isnetworkerror');
        return looksLikeNetworkError || looksLikeRawNetworkFailure || looksLikeNotificationNoise || explicitlyMarkedNetworkError;
    };

    // Show snackbar when a new notification arrives
    useEffect(() => {
        if (notifications.length > 0) {
            const newest = notifications[0];
            // Only show if it's recent (optional timestamp check could go here)
            const message = newest.message || 'New Notification';
            if (shouldSuppressSnackbar(message)) {
                setSnackbarVisible(false);
                setLatestMessage('');
                return;
            }
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
