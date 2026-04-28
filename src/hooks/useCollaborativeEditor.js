/**
 * useCollaborativeEditor Hook
 *
 * Combines useCollaboration (WebSocket) with useCRDT (Conflict Resolution)
 * for a complete collaborative editing experience.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import useCollaboration from './useCollaboration';
import useCRDT from './useCRDT';
import realmService from '../services/database/realmService';

/**
 * Collaborative Editor Hook
 *
 * @param {string} noteId - Note ID to collaborate on
 * @param {string} authToken - Authentication token
 * @param {string} initialText - Initial text content
 */
const useCollaborativeEditor = (noteId, authToken, initialText = '') => {
    const clientId = useRef(realmService.createObjectId()).current;

    const [isInitialized, setIsInitialized] = useState(false);
    // Ref for sendEdit to break cyclic dependency
    const sendEditRef = useRef(null);
    const [remoteChanges, setRemoteChanges] = useState([]);

    // CRDT hook for conflict resolution (Defined before useCollaboration to pass callback)
    const {
        text,
        version,
        insert,
        deleteText,
        applyRemoteOperation,
        setTextDirect,
        getPendingOperations,
        clearPendingOperations,
        handleTextChange,
        hasPendingOperations,
    } = useCRDT(initialText, clientId, (operation) => {
        // Send local operations to server via ref
        if (sendEditRef.current) {
            sendEditRef.current(operation.type, operation.position, operation.content, operation.length);
        }
    });

    /**
     * Handle incoming edit from WebSocket
     */
    const handleRemoteEdit = useCallback((userId, editData) => {
        if (userId === clientId) { return; } // Skip own edits

        const remoteOp = {
            type: editData.operation,
            position: editData.position,
            content: editData.content || '',
            length: editData.length || 0,
            clientId: userId,
            timestamp: Date.now(),
            id: `${userId}-${editData.timestamp || Date.now()}`,
        };

        applyRemoteOperation(remoteOp);
        setRemoteChanges(prev => [...prev.slice(-50), remoteOp]); // Keep last 50 changes
    }, [clientId, applyRemoteOperation]);

    // Collaboration hook for WebSocket
    const {
        isConnected,
        isConnecting,
        collaborators,
        cursors,
        error: wsError,
        connect,
        disconnect,
        sendCursor,
        sendEdit,
        sendSelection,
        collaboratorCount,
    } = useCollaboration(noteId, authToken, handleRemoteEdit);

    // Update ref when sendEdit changes
    useEffect(() => {
        sendEditRef.current = sendEdit;
    }, [sendEdit]);


    /**
     * Handle text input change
     * This should be called by the text editor component
     */
    const onTextChange = useCallback((newText, cursorPosition) => {
        const ops = handleTextChange(newText, cursorPosition);
        return ops;
    }, [handleTextChange]);

    /**
     * Handle cursor position change
     */
    const onCursorChange = useCallback((position, line, column) => {
        if (isConnected) {
            sendCursor(position, line, column);
        }
    }, [isConnected, sendCursor]);

    /**
     * Handle selection change
     */
    const onSelectionChange = useCallback((start, end) => {
        if (isConnected) {
            sendSelection(start, end);
        }
    }, [isConnected, sendSelection]);

    /**
     * Initialize with server state
     */
    const initializeFromServer = useCallback((serverText, serverVersion) => {
        setTextDirect(serverText, serverVersion);
        setIsInitialized(true);
    }, [setTextDirect]);

    /**
     * Get collaborative editing state
     */
    const getState = useCallback(() => ({
        text,
        version,
        isConnected,
        isInitialized,
        collaboratorCount,
        hasPendingOperations,
    }), [text, version, isConnected, isInitialized, collaboratorCount, hasPendingOperations]);

    /**
     * Get other users' cursor positions for rendering
     */
    const getRemoteCursors = useCallback(() => {
        return Object.entries(cursors)
            .filter(([userId]) => userId !== clientId)
            .map(([userId, cursor]) => ({
                userId,
                ...cursor,
                user: collaborators[userId],
            }));
    }, [cursors, collaborators, clientId]);

    /**
     * Get collaborator info with colors
     */
    const getCollaboratorsWithColors = useCallback(() => {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        ];

        return Object.entries(collaborators)
            .filter(([userId]) => userId !== clientId)
            .map(([userId, info], index) => ({
                userId,
                ...info,
                color: colors[index % colors.length],
                cursor: cursors[userId],
            }));
    }, [collaborators, cursors, clientId]);

    return {
        // Text state
        text,
        version,

        // Connection state
        isConnected,
        isConnecting,
        isInitialized,
        error: wsError,

        // Collaborators
        collaborators: getCollaboratorsWithColors(),
        remoteCursors: getRemoteCursors(),
        collaboratorCount,

        // Operations
        onTextChange,
        onCursorChange,
        onSelectionChange,
        insert,
        deleteText,

        // Control
        connect,
        disconnect,
        initializeFromServer,

        // State helpers
        getState,
        hasPendingOperations,
        recentRemoteChanges: remoteChanges.slice(-10),

        // For advanced usage
        handleRemoteEdit,
        getPendingOperations,
        clearPendingOperations,
        clientId,
    };
};

export default useCollaborativeEditor;
