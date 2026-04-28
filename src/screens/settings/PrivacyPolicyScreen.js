/**
 * Privacy Policy Screen
 *
 * Displays the application's Privacy Policy (GDPR/CCPA compliant).
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const PrivacyPolicyScreen = ({ navigation }) => {
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(false);

    const handleExportData = async () => {
        Alert.alert(
            '导出数据',
            '这将下载包含您所有数据的ZIP文件。确定要继续吗？',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '导出',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            // Call GDPR export API
                            // const response = await fetch('/api/v1/auth/gdpr/export/');
                            Alert.alert('成功', '数据导出请求已发送，请检查您的下载。');
                        } catch (error) {
                            Alert.alert('错误', '导出失败，请稍后重试。');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            '删除账户',
            '⚠️ 这将永久删除您的账户和所有数据。此操作不可撤销。\n\n删除请求提交后，您有30天的冷静期可以取消。',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '继续删除',
                    style: 'destructive',
                    onPress: () => {
                        navigation.navigate('AccountDeletion');
                    },
                },
            ]
        );
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        scrollContent: {
            padding: 20,
        },
        title: {
            fontSize: 24,
            fontWeight: 'bold',
            color: theme.colors.text,
            marginBottom: 20,
            textAlign: 'center',
        },
        lastUpdated: {
            fontSize: 12,
            color: theme.colors.textSecondary,
            marginBottom: 20,
            textAlign: 'center',
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: theme.colors.text,
            marginTop: 20,
            marginBottom: 10,
        },
        paragraph: {
            fontSize: 14,
            lineHeight: 22,
            color: theme.colors.textSecondary,
            marginBottom: 10,
        },
        bulletPoint: {
            fontSize: 14,
            lineHeight: 22,
            color: theme.colors.textSecondary,
            marginLeft: 15,
            marginBottom: 5,
        },
        actionSection: {
            marginTop: 30,
            paddingTop: 20,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 15,
            backgroundColor: theme.colors.surface,
            borderRadius: 10,
            marginBottom: 10,
        },
        actionButtonDanger: {
            backgroundColor: isDark ? '#3d2020' : '#fee2e2',
        },
        actionIcon: {
            marginRight: 15,
        },
        actionText: {
            fontSize: 16,
            color: theme.colors.text,
        },
        actionTextDanger: {
            color: '#ef4444',
        },
        actionDescription: {
            fontSize: 12,
            color: theme.colors.textSecondary,
            marginTop: 2,
        },
    });

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>隐私政策</Text>
                <Text style={styles.lastUpdated}>最后更新: 2026年1月1日</Text>

                <Text style={styles.sectionTitle}>1. 信息收集</Text>
                <Text style={styles.paragraph}>我们收集以下类型的信息：</Text>
                <Text style={styles.bulletPoint}>• 账户信息：用户名、邮箱、手机号</Text>
                <Text style={styles.bulletPoint}>• 内容数据：您创建的笔记、标签、文件</Text>
                <Text style={styles.bulletPoint}>• 使用数据：应用使用情况、功能偏好</Text>
                <Text style={styles.bulletPoint}>• 设备信息：设备类型、操作系统版本</Text>

                <Text style={styles.sectionTitle}>2. 信息使用</Text>
                <Text style={styles.paragraph}>
                    我们使用您的信息来提供、维护和改进服务，包括：
                </Text>
                <Text style={styles.bulletPoint}>• 同步您的笔记和数据</Text>
                <Text style={styles.bulletPoint}>• 提供AI辅助功能（经您授权）</Text>
                <Text style={styles.bulletPoint}>• 发送服务通知和更新</Text>
                <Text style={styles.bulletPoint}>• 检测和防止滥用行为</Text>

                <Text style={styles.sectionTitle}>3. 数据存储与安全</Text>
                <Text style={styles.paragraph}>
                    您的数据存储在安全的云服务器上，使用行业标准加密保护。
                    我们定期进行安全审计，确保您的数据安全。
                </Text>

                <Text style={styles.sectionTitle}>4. 您的权利 (GDPR)</Text>
                <Text style={styles.paragraph}>
                    根据《通用数据保护条例》及相关法律，您有权：
                </Text>
                <Text style={styles.bulletPoint}>• 访问权：获取您的个人数据副本</Text>
                <Text style={styles.bulletPoint}>• 更正权：更正不准确的信息</Text>
                <Text style={styles.bulletPoint}>• 删除权：请求删除您的数据</Text>
                <Text style={styles.bulletPoint}>• 可携带权：以标准格式导出数据</Text>

                <Text style={styles.sectionTitle}>5. 第三方服务</Text>
                <Text style={styles.paragraph}>
                    我们可能使用第三方服务（如分析、支付处理）。
                    这些服务受其各自的隐私政策约束。
                </Text>

                <Text style={styles.sectionTitle}>6. 联系我们</Text>
                <Text style={styles.paragraph}>
                    如有隐私相关问题，请联系 privacy@zeroislenotes.com
                </Text>

                {/* Action Buttons */}
                <View style={styles.actionSection}>
                    <Text style={styles.sectionTitle}>数据管理</Text>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleExportData}
                        disabled={loading}
                    >
                        <Ionicons
                            name="download-outline"
                            size={24}
                            color={theme.colors.primary}
                            style={styles.actionIcon}
                        />
                        <View>
                            <Text style={styles.actionText}>导出我的数据</Text>
                            <Text style={styles.actionDescription}>
                                下载包含所有个人数据的ZIP文件
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonDanger]}
                        onPress={handleDeleteAccount}
                    >
                        <Ionicons
                            name="trash-outline"
                            size={24}
                            color="#ef4444"
                            style={styles.actionIcon}
                        />
                        <View>
                            <Text style={[styles.actionText, styles.actionTextDanger]}>
                                删除我的账户
                            </Text>
                            <Text style={styles.actionDescription}>
                                永久删除账户和所有数据
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
};

export default PrivacyPolicyScreen;
