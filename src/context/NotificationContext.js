
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
        const networkKeywords = [
            'api网络错误',
            '网络连接失败',
            '请求超时',
            '网络错误',
            '无网络连接',
            'network error',
            'network connection failed',
            'request timed out',
            'no internet',
            'offline',
        ];

        // 只屏蔽明确的网络错误提示，避免误伤普通通知内容。
        const looksLikeNetworkError = networkKeywords.some(keyword => normalized.includes(keyword.toLowerCase()));
        const explicitlyMarkedNetworkError = normalized.includes('networkerror') || normalized.includes('isnetworkerror');
        return looksLikeNetworkError || explicitlyMarkedNetworkError;
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
