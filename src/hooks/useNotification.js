
import { useState, useEffect, useCallback, useRef } from 'react';
import { getToken } from '../services/auth/tokenService'; // Adjust path as needed

const WS_BASE_URL = __DEV__
    ? 'ws://localhost:8000'
    : 'wss://api.zeroislenotes.com';

const buildNotificationText = (notification) => {
    const parts = [
        notification?.title,
        notification?.message,
        notification?.body,
        notification?.description,
        notification?.data?.title,
        notification?.data?.message,
        notification?.data?.body,
        notification?.data?.description,
        notification?.text,
    ].filter(Boolean);

    return parts.join(' | ');
};

const isSuppressedNotification = (notification) => {
    const text = buildNotificationText(notification);
    if (!text) {
        return true;
    }

    const normalized = text.toLowerCase();
    const compact = normalized.replace(/\s+/g, '');

    const noisyPhrases = [
        '获取群组邀请失败',
        '群组邀请失败',
        '获取群组邀请失败: error: 网络错误且无缓存，无法完成请求',
        '获取群组列表失败',
        '获取群组详情失败',
        '获取群组成员失败',
        '获取群组通知失败',
        '获取群组消息失败',
        '创建群组失败',
        '更新群组失败',
        '删除群组失败',
        '加入群组失败',
        '邀请成员失败',
        '邀请用户失败',
        '生成加入码失败',
        '获取屏幕共享列表失败',
        '创建屏幕共享失败',
        '加入屏幕共享失败',
        '暂停屏幕共享失败',
        '恢复屏幕共享失败',
        '结束屏幕共享失败',
        '网络错误且无缓存',
        '离线状态下无法完成请求',
        '无法完成请求',
        '网络连接失败，无法加载群组邀请',
        '网络连接失败，无法加载群组详情',
        '网络连接失败，无法加载群组列表',
        '网络连接失败，无法加载群组成员',
        '网络连接失败，无法加入群组',
        '网络连接失败，无法创建群组',
    ];

    const noisyKeywords = [
        'network error',
        'network connection failed',
        'network connection problem',
        'request timed out',
        'no internet',
        'offline',
        '网络错误',
        '网络连接失败',
        '请求超时',
        '无网络连接',
    ];

    const groupFailurePattern = /群组.*失败|获取群组.*失败|邀请.*失败|加入.*失败|创建群组.*失败|更新群组.*失败|删除群组.*失败|获取群组消息.*失败|获取群组通知.*失败/;
    const rawErrorPattern = /error[:：]|网络错误|网络连接失败|无法完成请求|离线状态下无法完成请求|网络错误且无缓存|请求已保存到离线队列/;

    const isNetworkOrGroupNoise = (
        noisyPhrases.some(phrase => compact.includes(phrase.replace(/\s+/g, '').toLowerCase()))
        || noisyKeywords.some(keyword => normalized.includes(keyword.toLowerCase()))
        || groupFailurePattern.test(text)
        || rawErrorPattern.test(normalized)
    );

    return isNetworkOrGroupNoise;
};

const isGroupNetworkNoise = (notification) => {
    const text = buildNotificationText(notification);
    if (!text) {
        return false;
    }

    const normalized = text.toLowerCase();
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
        || /error[:：]|网络错误|网络连接失败|无法完成请求|离线状态下无法完成请求|网络错误且无缓存|请求已保存到离线队列/.test(normalized)
    );
};

export const useNotification = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    const connect = useCallback(async () => {
        const token = await getToken();
        if (!token || wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        const wsUrl = `${WS_BASE_URL}/ws/notifications/?token=${token}`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[Notification] WS Connected');
                setIsConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'notification') {
                        const newNotification = data.data;
                        if (isSuppressedNotification(newNotification) || isGroupNetworkNoise(newNotification)) {
                            console.log('[Notification] Suppressed noisy notification:', buildNotificationText(newNotification));
                            return;
                        }
                        setNotifications(prev => [newNotification, ...prev]);
                        setUnreadCount(c => c + 1);
                    }
                } catch (e) {
                    console.error('[Notification] Parse error', e);
                }
            };

            ws.onclose = (e) => {
                console.log('[Notification] WS Closed', e.code);
                setIsConnected(false);
                // Reconnect logic here
                reconnectTimeoutRef.current = setTimeout(connect, 5000);
            };

        } catch (e) {
            console.error(e);
        }
    }, []);

    const markAsRead = useCallback((id) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'mark_read', id }));
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(c => Math.max(0, c - 1));
        }
    }, []);

    useEffect(() => {
        connect();
        return () => {
            wsRef.current?.close();
            clearTimeout(reconnectTimeoutRef.current);
        };
    }, [connect]);

    return { notifications, unreadCount, isConnected, markAsRead };
};
