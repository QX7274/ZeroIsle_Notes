
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { getToken } from '../services/auth/tokenService'; // Adjust path as needed
import { API_URL } from '../config'; // Adjust path as needed

const WS_BASE_URL = __DEV__
    ? 'ws://localhost:8000'
    : 'wss://api.zeroislenotes.com';

export const useNotification = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    const connect = useCallback(async () => {
        const token = await getToken();
        if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

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
