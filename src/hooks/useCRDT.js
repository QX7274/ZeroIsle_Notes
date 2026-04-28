/**
 * CRDT (Conflict-free Replicated Data Type) Hook
 *
 * Implements a simple Operational Transformation (OT) based text CRDT
 * for real-time collaborative editing without conflicts.
 *
 * This is a lightweight implementation suitable for React Native.
 * For production, consider using Yjs or Automerge.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Operation Types
 */
const OperationType = {
    INSERT: 'insert',
    DELETE: 'delete',
    RETAIN: 'retain',
};

/**
 * Creates an operation object
 */
const createOperation = (type, position, content = '', length = 0, clientId = '', seq = 0) => ({
    type,
    position,
    content,
    length,
    clientId,
    seq,
    timestamp: Date.now(),
    id: `${clientId}-${seq}-${Date.now()}`,
});

/**
 * Transform operation A against operation B
 * Returns transformed A that can be applied after B
 */
const transformOperation = (opA, opB) => {
    // Same operation, no transform needed
    if (opA.id === opB.id) {return opA;}

    const transformedA = { ...opA };

    if (opB.type === OperationType.INSERT) {
        // B inserted text before A's position
        if (opB.position <= opA.position) {
            transformedA.position += opB.content.length;
        }
    } else if (opB.type === OperationType.DELETE) {
        // B deleted text
        if (opB.position + opB.length <= opA.position) {
            // Deletion is completely before A
            transformedA.position -= opB.length;
        } else if (opB.position < opA.position && opB.position + opB.length > opA.position) {
            // Deletion overlaps with A's position
            transformedA.position = opB.position;
        }
        // If deletion is after A, no change needed
    }

    return transformedA;
};

/**
 * Apply operation to text
 */
const applyOperation = (text, operation) => {
    switch (operation.type) {
        case OperationType.INSERT:
            return (
                text.slice(0, operation.position) +
                operation.content +
                text.slice(operation.position)
            );
        case OperationType.DELETE:
            return (
                text.slice(0, operation.position) +
                text.slice(operation.position + operation.length)
            );
        case OperationType.RETAIN:
            return text;
        default:
            return text;
    }
};

/**
 * useCRDT Hook
 *
 * Provides conflict-free text editing with operational transformation
 *
 * @param {string} initialText - Initial text content
 * @param {string} clientId - Unique client identifier
 * @param {function} onLocalOperation - Callback when local operation is created (for syncing)
 */
const useCRDT = (initialText = '', clientId = '', onLocalOperation = null) => {
    const [text, setText] = useState(initialText);
    const [vectorClock, setVectorClock] = useState({ [clientId]: 0 });

    // Operation history for conflict resolution
    const operationHistoryRef = useRef([]);
    const pendingOperationsRef = useRef([]);
    const acknowledgedVersionRef = useRef(0);
    const localSeqRef = useRef(0);

    /**
     * Insert text at position
     */
    const insert = useCallback((position, content) => {
        if (!content) {return;}

        localSeqRef.current += 1;
        const seq = localSeqRef.current;

        const operation = createOperation(
            OperationType.INSERT,
            position,
            content,
            0,
            clientId,
            seq
        );

        // Apply locally
        setText(prevText => applyOperation(prevText, operation));
        setVectorClock(prev => ({ ...prev, [clientId]: seq }));

        // Add to history
        operationHistoryRef.current.push(operation);
        pendingOperationsRef.current.push(operation);

        // Notify for syncing
        if (onLocalOperation) {
            onLocalOperation(operation);
        }

        return operation;
    }, [clientId, onLocalOperation]);

    /**
     * Delete text at position
     */
    const deleteText = useCallback((position, length) => {
        if (length <= 0) {return;}

        localSeqRef.current += 1;
        const seq = localSeqRef.current;

        const operation = createOperation(
            OperationType.DELETE,
            position,
            '',
            length,
            clientId,
            seq
        );

        // Apply locally
        setText(prevText => applyOperation(prevText, operation));
        setVectorClock(prev => ({ ...prev, [clientId]: seq }));

        // Add to history
        operationHistoryRef.current.push(operation);
        pendingOperationsRef.current.push(operation);

        // Notify for syncing
        if (onLocalOperation) {
            onLocalOperation(operation);
        }

        return operation;
    }, [clientId, onLocalOperation]);

    /**
     * Apply remote operation (from other clients)
     */
    const applyRemoteOperation = useCallback((remoteOp) => {
        // Skip our own operations
        if (remoteOp.clientId === clientId) {
            // Mark as acknowledged
            pendingOperationsRef.current = pendingOperationsRef.current.filter(
                op => op.id !== remoteOp.id
            );
            acknowledgedVersionRef.current++;
            return;
        }

        // Transform against pending local operations
        let transformedOp = remoteOp;
        for (const pendingOp of pendingOperationsRef.current) {
            transformedOp = transformOperation(transformedOp, pendingOp);
        }

        // Update vector clock for this client
        setVectorClock(prev => ({
            ...prev,
            [remoteOp.clientId]: Math.max(prev[remoteOp.clientId] || 0, remoteOp.seq || 0),
        }));

        // Apply the transformed operation
        setText(prevText => applyOperation(prevText, transformedOp));
        operationHistoryRef.current.push(transformedOp);
    }, [clientId]);

    /**
     * Apply multiple remote operations
     */
    const applyRemoteOperations = useCallback((operations) => {
        operations.forEach(op => applyRemoteOperation(op));
    }, [applyRemoteOperation]);

    /**
     * Set text directly (for initial sync)
     */
    const setTextDirect = useCallback((newText, newVectorClock = {}) => {
        setText(newText);
        setVectorClock(newVectorClock);
        localSeqRef.current = newVectorClock[clientId] || 0;
        operationHistoryRef.current = [];
        pendingOperationsRef.current = [];
        acknowledgedVersionRef.current = 0; // Simplified for now
    }, [clientId]);

    /**
     * Get pending operations for syncing
     */
    const getPendingOperations = useCallback(() => {
        return [...pendingOperationsRef.current];
    }, []);

    /**
     * Clear pending operations (after sync confirmation)
     */
    const clearPendingOperations = useCallback((acknowledgedIds) => {
        pendingOperationsRef.current = pendingOperationsRef.current.filter(
            op => !acknowledgedIds.includes(op.id)
        );
    }, []);

    /**
     * Generate diff operations between two texts
     */
    const generateDiff = useCallback((oldText, newText, cursorPosition) => {
        // Simple character-by-character diff for now
        // For production, use a proper diff algorithm

        const ops = [];
        let oldIndex = 0;
        let newIndex = 0;

        // Find common prefix
        while (oldIndex < oldText.length &&
            newIndex < newText.length &&
            oldText[oldIndex] === newText[newIndex]) {
            oldIndex++;
            newIndex++;
        }

        // Find common suffix
        let oldEnd = oldText.length;
        let newEnd = newText.length;
        while (oldEnd > oldIndex &&
            newEnd > newIndex &&
            oldText[oldEnd - 1] === newText[newEnd - 1]) {
            oldEnd--;
            newEnd--;
        }

        // Delete removed characters
        if (oldEnd > oldIndex) {
            ops.push(createOperation(
                OperationType.DELETE,
                oldIndex,
                '',
                oldEnd - oldIndex,
                clientId
            ));
        }

        // Insert added characters
        if (newEnd > newIndex) {
            ops.push(createOperation(
                OperationType.INSERT,
                oldIndex,
                newText.slice(newIndex, newEnd),
                0,
                clientId
            ));
        }

        return ops;
    }, [clientId]);

    /**
     * Handle text change (from text input)
     * Generates and applies operations automatically
     */
    const handleTextChange = useCallback((newText, cursorPosition) => {
        const ops = generateDiff(text, newText, cursorPosition);

        // Apply operations
        ops.forEach(op => {
            if (op.type === OperationType.INSERT) {
                insert(op.position, op.content);
            } else if (op.type === OperationType.DELETE) {
                deleteText(op.position, op.length);
            }
        });

        return ops;
    }, [text, generateDiff, insert, deleteText]);

    return {
        // State
        text,
        vectorClock,

        // Operations
        insert,
        deleteText,
        applyRemoteOperation,
        applyRemoteOperations,

        // Sync helpers
        setTextDirect,
        getPendingOperations,
        clearPendingOperations,
        handleTextChange,
        generateDiff,

        // Info
        hasPendingOperations: pendingOperationsRef.current.length > 0,
    };
};

export { OperationType, createOperation, transformOperation, applyOperation };
export default useCRDT;
