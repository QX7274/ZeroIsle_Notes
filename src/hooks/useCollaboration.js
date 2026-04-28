/**
 * 协作编辑Hook
 *
 * 提供WebSocket连接管理和协作状态管理
 *
 * 使用方法:
 * const {
 *   isConnected,
 *   collaborators,
 *   cursors,
 *   connect,
 *   disconnect,
 *   sendCursor,
 *   sendEdit,
 * } = useCollaboration(noteId, authToken);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';

const WS_BASE_URL = __DEV__
    ? 'ws://localhost:8000'
    : 'wss://api.zeroislenotes.com';

/**
 * 协作状态Hook
 */
/**
 * 协作状态Hook
 */
export const useCollaboration = (noteId, authToken, onEditReceived) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [collaborators, setCollaborators] = useState({});
    const [cursors, setCursors] = useState({});
    const [error, setError] = useState(null);

    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const heartbeatIntervalRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;

    /**
     * 连接WebSocket
     */
    const connect = useCallback(() => {
        if (!noteId || !authToken || wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        setIsConnecting(true);
        setError(null);

        const wsUrl = `${WS_BASE_URL}/ws/notes/${noteId}/collaborate/?token=${authToken}`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[Collaboration] WebSocket connected');
                setIsConnected(true);
                setIsConnecting(false);
                reconnectAttemptsRef.current = 0;

                // 启动心跳
                startHeartbeat();
            };

            ws.onclose = (event) => {
                console.log('[Collaboration] WebSocket closed:', event.code);
                setIsConnected(false);
                setIsConnecting(false);
                stopHeartbeat();

                // 致命错误不重连 (4001: 无效用户, 4002: 无效笔记ID, 4003: 无权限)
                if (event.code >= 4000 && event.code <= 4009) {
                    console.error('[Collaboration] Fatal error, not reconnecting:', event.code);
                    setError('连接被拒绝 (权限或无效ID)');
                    return;
                }

                // 尝试重连（非正常关闭时）
                if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                    console.log(`[Collaboration] Reconnecting in ${delay}ms...`);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptsRef.current++;
                        connect();
                    }, delay);
                }
            };

            ws.onerror = (event) => {
                console.error('[Collaboration] WebSocket error:', event);
                setError('连接错误');
            };

            ws.onmessage = (event) => {
                handleMessage(JSON.parse(event.data));
            };

        } catch (err) {
            console.error('[Collaboration] Connection failed:', err);
            setIsConnecting(false);
            setError('连接失败');
        }
    }, [noteId, authToken, onEditReceived]);


    /**
     * 断开连接
     */
    const disconnect = useCallback(() => {
        stopHeartbeat();

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        if (wsRef.current) {
            wsRef.current.close(1000);
            wsRef.current = null;
        }

        setIsConnected(false);
        setCollaborators({});
        setCursors({});
    }, []);

    /**
     * 启动心跳
     */
    const startHeartbeat = () => {
        heartbeatIntervalRef.current = setInterval(() => {
            sendMessage({ type: 'heartbeat' });
        }, 30000);
    };

    /**
     * 停止心跳
     */
    const stopHeartbeat = () => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
    };

    /**
     * 发送消息
     */
    const sendMessage = useCallback((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    /**
     * 处理接收到的消息
     */
    const handleMessage = (data) => {
        switch (data.type) {
            case 'session_state':
                setCollaborators(data.users || {});
                setCursors(data.cursors || {});
                break;

            case 'user_joined':
                setCollaborators(prev => ({
                    ...prev,
                    [data.user_id]: data.user_info,
                }));
                break;

            case 'user_left':
                setCollaborators(prev => {
                    const updated = { ...prev };
                    delete updated[data.user_id];
                    return updated;
                });
                setCursors(prev => {
                    const updated = { ...prev };
                    delete updated[data.user_id];
                    return updated;
                });
                break;

            case 'cursor_update':
                setCursors(prev => ({
                    ...prev,
                    [data.user_id]: data.cursor,
                }));
                break;

            case 'edit':
                // 触发编辑事件，由父组件处理
                if (onEditReceived) {
                    onEditReceived(data.user_id, data.edit);
                }
                break;

            case 'selection_update':
                // 选区更新
                break;

            case 'heartbeat_ack':
                // 心跳确认
                break;

            default:
                console.log('[Collaboration] Unknown message type:', data.type);
        }
    };

    /**
     * 发送光标位置
     */
    const sendCursor = useCallback((position, line, column) => {
        sendMessage({
            type: 'cursor',
            position,
            line,
            column,
        });
    }, [sendMessage]);

    /**
     * 发送编辑操作
     */
    const sendEdit = useCallback((operation, position, content, length) => {
        sendMessage({
            type: 'edit',
            operation,
            position,
            content,
            length,
        });
    }, [sendMessage]);

    /**
     * 发送选区更新
     */
    const sendSelection = useCallback((start, end) => {
        sendMessage({
            type: 'selection',
            start,
            end,
        });
    }, [sendMessage]);

    // 自动连接和断开
    useEffect(() => {
        if (noteId && authToken) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [noteId, authToken]);

    // 处理应用状态变化
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active' && !isConnected && noteId && authToken) {
                connect();
            } else if (nextAppState === 'background') {
                // 可选：后台时断开连接节省资源
            }
        });

        return () => {
            subscription.remove();
        };
    }, [isConnected, noteId, authToken, connect]);

    return {
        isConnected,
        isConnecting,
        collaborators,
        cursors,
        error,
        connect,
        disconnect,
        sendCursor,
        sendEdit,
        sendSelection,
        collaboratorCount: Object.keys(collaborators).length,
    };
};

export default useCollaboration;
