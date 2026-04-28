/**
 * 协作者头像组件
 *
 * 显示当前协作编辑的用户头像列表
 *
 * 使用方法:
 * <CollaboratorAvatars collaborators={collaborators} maxDisplay={3} />
 */

import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { SPACING, RADIUS, ELEVATION, SIZE } from '../../theme/tokens';

/**
 * 单个头像组件
 */
const Avatar = ({ user, size = 'sm', style }) => {
    const sizeValue = SIZE.avatar[size] || SIZE.avatar.sm;
    const fontSize = sizeValue * 0.4;

    // 获取首字母
    const getInitials = (username) => {
        if (!username) {return '?';}
        return username.charAt(0).toUpperCase();
    };

    return (
        <View style={[
            styles.avatar,
            {
                width: sizeValue,
                height: sizeValue,
                borderRadius: sizeValue / 2,
                backgroundColor: user.color || '#6366F1',
            },
            style,
        ]}>
            {user.avatar ? (
                <Image
                    source={{ uri: user.avatar }}
                    style={[styles.avatarImage, { borderRadius: sizeValue / 2 }]}
                />
            ) : (
                <Text style={[styles.initials, { fontSize }]}>
                    {getInitials(user.username)}
                </Text>
            )}

            {/* 在线状态指示器 */}
            <View style={[
                styles.onlineIndicator,
                {
                    width: sizeValue * 0.3,
                    height: sizeValue * 0.3,
                    borderRadius: sizeValue * 0.15,
                },
            ]} />
        </View>
    );
};

/**
 * 溢出计数组件
 */
const OverflowCount = ({ count, size = 'sm' }) => {
    const sizeValue = SIZE.avatar[size] || SIZE.avatar.sm;
    const fontSize = sizeValue * 0.35;

    return (
        <View style={[
            styles.overflowCount,
            {
                width: sizeValue,
                height: sizeValue,
                borderRadius: sizeValue / 2,
            },
        ]}>
            <Text style={[styles.overflowText, { fontSize }]}>+{count}</Text>
        </View>
    );
};

/**
 * 协作者头像列表组件
 */
export const CollaboratorAvatars = ({
    collaborators = {},
    maxDisplay = 3,
    size = 'sm',
    onPress,
    style,
}) => {
    const collaboratorList = Object.entries(collaborators).map(([id, info]) => ({
        id,
        ...info,
    }));

    const displayList = collaboratorList.slice(0, maxDisplay);
    const overflowCount = Math.max(0, collaboratorList.length - maxDisplay);

    if (collaboratorList.length === 0) {
        return null;
    }

    return (
        <TouchableOpacity
            style={[styles.container, style]}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={0.7}
        >
            <View style={styles.avatarStack}>
                {displayList.map((user, index) => (
                    <Avatar
                        key={user.id}
                        user={user}
                        size={size}
                        style={{
                            marginLeft: index > 0 ? -SIZE.avatar[size] * 0.3 : 0,
                            zIndex: displayList.length - index,
                        }}
                    />
                ))}

                {overflowCount > 0 && (
                    <OverflowCount
                        count={overflowCount}
                        size={size}
                        style={{ marginLeft: -SIZE.avatar[size] * 0.3 }}
                    />
                )}
            </View>

            {collaboratorList.length > 0 && (
                <Text style={styles.countText}>
                    {collaboratorList.length}人协作中
                </Text>
            )}
        </TouchableOpacity>
    );
};

/**
 * 协作状态栏组件
 */
export const CollaborationStatusBar = ({
    isConnected,
    isConnecting,
    collaborators = {},
    onPress,
    style,
}) => {
    const collaboratorCount = Object.keys(collaborators).length;

    const getStatusColor = () => {
        if (isConnecting) {return '#F59E0B';}
        if (isConnected) {return '#10B981';}
        return '#EF4444';
    };

    const getStatusText = () => {
        if (isConnecting) {return '连接中...';}
        if (isConnected) {
            if (collaboratorCount > 0) {
                return `${collaboratorCount}人在线`;
            }
            return '已连接';
        }
        return '未连接';
    };

    return (
        <TouchableOpacity
            style={[styles.statusBar, style]}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={0.8}
        >
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.statusText}>{getStatusText()}</Text>

            {isConnected && collaboratorCount > 0 && (
                <CollaboratorAvatars
                    collaborators={collaborators}
                    maxDisplay={3}
                    size="xs"
                    style={{ marginLeft: SPACING.sm }}
                />
            )}
        </TouchableOpacity>
    );
};

/**
 * 协作光标标签组件
 */
export const CollaboratorCursorLabel = ({ user, style }) => {
    if (!user) {return null;}

    return (
        <View style={[
            styles.cursorLabel,
            { backgroundColor: user.color || '#6366F1' },
            style,
        ]}>
            <Text style={styles.cursorLabelText}>{user.username}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarStack: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        ...ELEVATION.sm,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    initials: {
        color: '#fff',
        fontWeight: '600',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#10B981',
        borderWidth: 2,
        borderColor: '#fff',
    },
    overflowCount: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#6B7280',
        borderWidth: 2,
        borderColor: '#fff',
        ...ELEVATION.sm,
    },
    overflowText: {
        color: '#fff',
        fontWeight: '600',
    },
    countText: {
        marginLeft: SPACING.sm,
        fontSize: 12,
        color: '#6B7280',
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: RADIUS.full,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: SPACING.xs,
    },
    statusText: {
        fontSize: 12,
        color: '#6B7280',
    },
    cursorLabel: {
        paddingHorizontal: SPACING.xs,
        paddingVertical: 2,
        borderRadius: RADIUS.xs,
    },
    cursorLabelText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '500',
    },
});

export default CollaboratorAvatars;
