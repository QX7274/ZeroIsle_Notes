
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNotification } from '../hooks/useNotification';
import { View, Text, StyleSheet } from 'react-native';
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

    // Show snackbar when a new notification arrives
    useEffect(() => {
        if (notifications.length > 0) {
            const newest = notifications[0];
            // Only show if it's recent (optional timestamp check could go here)
            setLatestMessage(newest.message || 'New Notification');
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
                style={{ marginBottom: 20, zIndex: 9999 }} // Ensure it's on top
            >
                {latestMessage}
            </Snackbar>
        </NotificationContext.Provider>
    );
};
