
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNotification } from '../hooks/useNotification';
import { StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';
import notificationService from '../services/notification/notificationService';

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
        notification?.text,
        notification?.data?.title,
        notification?.data?.message,
        notification?.data?.body,
        notification?.data?.description,
        notification?.data?.text,
    ].filter(Boolean);

    return parts.join(' | ');
};

const getNormalizedNotificationText = (notification) => {
    const text = buildNotificationText(notification);
    return String(text || '').toLowerCase().replace(/\s+/g, '');
};

const normalizeMessageText = (value) => String(value || '').toLowerCase().replace(/\s+/g, '');

const NETWORK_FAILURE_SIGNATURES = [
    '获取群组邀请失败',
    '群组邀请失败',
    '获取群组列表失败',
    '获取群组详情失败',
    '获取群组成员失败',
    '获取群组通知失败',
    '获取群组消息失败',
    '获取群组创建失败',
    '获取群组加入失败',
    '获取群组更新失败',
    '获取群组删除失败',
    '邀请成员失败',
    '邀请用户失败',
    '创建群组失败',
    '创建帖子失败',
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
    '网络连接失败，无法加载群组邀请',
    '网络连接失败，无法加载群组详情',
    '网络连接失败，无法加载群组列表',
    '网络连接失败，无法加载群组成员',
    '网络连接失败，无法加入群组',
    '网络连接失败，无法创建群组',
    '离线模式下无法创建帖子',
    '当前账号暂无发帖权限',
    "error:'syncinfo'hasnoproperty'type'",
    'syncinfohasnopropertytype',
];

const NETWORK_KEYWORDS = [
    'networkerror',
    'networkconnectionfailed',
    'requesttimedout',
    'nointernet',
    'offline',
    '网络错误',
    '网络连接失败',
    '请求超时',
    '无网络连接',
];

const isSuppressedMessageText = (value) => {
    const normalized = normalizeMessageText(value);
    if (!normalized) {
        return false;
    }

    const hasSignature = NETWORK_FAILURE_SIGNATURES.some(
        (phrase) => normalized.includes(String(phrase).toLowerCase().replace(/\s+/g, ''))
    );
    const hasKeyword = NETWORK_KEYWORDS.some(
        (keyword) => normalized.includes(String(keyword).toLowerCase())
    );
    const hasGroupFailurePattern = /群组.*失败|获取群组.*失败|邀请.*失败|加入.*失败|创建群组.*失败|更新群组.*失败|删除群组.*失败/.test(normalized);
    const hasRawErrorPattern = /error[:：]|网络错误|网络连接失败|无法完成请求|离线状态下无法完成请求|网络错误且无缓存|请求已保存到离线队列|syncinfo has no property type|syncinfo.*has no property.*type/.test(normalized);

    return hasSignature || hasKeyword || hasGroupFailurePattern || hasRawErrorPattern;
};

const isSuppressedNetworkNotification = (notification) => {
    const normalized = getNormalizedNotificationText(notification);
    if (!normalized) {
        return false;
    }

    return isSuppressedMessageText(normalized);
};

const isGroupNetworkNotification = (notification) => {
    const normalized = getNormalizedNotificationText(notification);
    if (!normalized) {
        return false;
    }

    const compact = normalized.replace(/\s+/g, '');
    return (
        compact.includes('获取群组列表失败')
        || compact.includes('获取群组邀请失败')
        || compact.includes('获取群组详情失败')
        || compact.includes('获取群组成员失败')
        || compact.includes('网络错误且无缓存')
        || compact.includes('离线状态下无法完成请求')
        || compact.includes('无法完成请求')
        || /群组.*失败|获取群组.*失败|邀请.*失败|加入.*失败|创建群组.*失败|更新群组.*失败|删除群组.*失败/.test(normalized)
        || /error[:：]|网络错误|网络连接失败|无法完成请求|离线状态下无法完成请求|网络错误且无缓存|请求已保存到离线队列|syncinfo has no property type|syncinfo.*has no property.*type/.test(normalized)
    );
};

export const NotificationProvider = ({ children }) => {
    const { notifications, unreadCount, isConnected, markAsRead } = useNotification();
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [latestMessage, setLatestMessage] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            notificationService.initialize().catch(error => {
                console.error('NotificationProvider: 通知服务延后初始化失败（已捕获，不阻塞应用）:', error);
            });
        }, 1200);

        return () => clearTimeout(timer);
    }, []);

    const shouldSuppressSnackbar = (notification) => {
        const message = buildNotificationText(notification);
        return !message || isSuppressedNetworkNotification(notification) || isSuppressedMessageText(message);
    };

    const shouldDisplaySnackbar = (notification) => {
        return Boolean(buildNotificationText(notification)) && !isSuppressedNetworkNotification(notification);
    };

    // Show snackbar when a new notification arrives
    useEffect(() => {
        if (notifications.length > 0) {
            const newest = notifications[0];
            // Only show if it's recent (optional timestamp check could go here)
            if (shouldSuppressSnackbar(newest) || isGroupNetworkNotification(newest) || !shouldDisplaySnackbar(newest)) {
                console.log('NotificationContext: 已屏蔽通知 Snackbar:', buildNotificationText(newest));
                setSnackbarVisible(false);
                setLatestMessage('');
                return;
            }
            const message = newest.message || newest.title || newest.body || newest.description || 'New Notification';
            if (isSuppressedMessageText(message)) {
                console.log('NotificationContext: 已按消息文本屏蔽通知 Snackbar:', message);
                setSnackbarVisible(false);
                setLatestMessage('');
                return;
            }
            setLatestMessage(message);
            setSnackbarVisible(true);
        }
    }, [notifications]);

    useEffect(() => {
        if (!snackbarVisible) {
            return;
        }

        if (isSuppressedMessageText(latestMessage)) {
            console.log('NotificationContext: 已收口历史消息 Snackbar:', latestMessage);
            setSnackbarVisible(false);
            setLatestMessage('');
        }
    }, [latestMessage, snackbarVisible]);

    const onDismissSnackbar = () => setSnackbarVisible(false);

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, isConnected, markAsRead }}>
            {children}
            <Snackbar
                visible={snackbarVisible}
                onDismiss={onDismissSnackbar}
                duration={3000}
                action={{
                    label: '关闭',
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
        borderRadius: 14,
        backgroundColor: 'rgba(31,41,55,0.96)',
    },
});
