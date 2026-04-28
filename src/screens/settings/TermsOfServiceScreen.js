/**
 * Terms of Service Screen
 *
 * Displays the application's Terms of Service.
 */

import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

const TermsOfServiceScreen = ({ navigation }) => {
    const { theme, isDark } = useTheme();

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
    });


    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>服务条款</Text>
                <Text style={styles.lastUpdated}>最后更新: 2026年1月1日</Text>

                <Text style={styles.sectionTitle}>1. 服务概述</Text>
                <Text style={styles.paragraph}>
                    欢迎使用零屿笔记。本应用是一款智能笔记管理工具，提供笔记创建、编辑、同步、AI辅助等功能。
                    使用本服务即表示您同意遵守以下条款。
                </Text>

                <Text style={styles.sectionTitle}>2. 账户注册</Text>
                <Text style={styles.paragraph}>
                    您需要注册账户才能使用完整功能。注册时请提供真实、准确的信息。
                    您有责任保护账户安全，并对账户下的所有活动负责。
                </Text>

                <Text style={styles.sectionTitle}>3. 用户内容</Text>
                <Text style={styles.paragraph}>
                    您保留对您创建的所有内容的所有权。我们不会在未经您许可的情况下访问、使用或分享您的私人内容。
                    您同意不发布违法、侵权或有害的内容。
                </Text>

                <Text style={styles.sectionTitle}>4. 隐私保护</Text>
                <Text style={styles.paragraph}>
                    我们重视您的隐私。详情请参阅我们的《隐私政策》。
                    您可以随时导出您的数据或删除您的账户。
                </Text>

                <Text style={styles.sectionTitle}>5. 订阅与付款</Text>
                <Text style={styles.paragraph}>
                    部分高级功能需要订阅。订阅将自动续费，您可以随时取消。
                    取消订阅后，您仍可使用至当前计费周期结束。
                </Text>

                <Text style={styles.sectionTitle}>6. 服务变更</Text>
                <Text style={styles.paragraph}>
                    我们可能会更新或修改服务功能。重大变更将提前通知用户。
                    我们保留在必要时终止或暂停服务的权利。
                </Text>

                <Text style={styles.sectionTitle}>7. 免责声明</Text>
                <Text style={styles.paragraph}>
                    服务按"现状"提供，我们不对服务的不间断或无错误作出保证。
                    对于因使用本服务导致的任何损失，我们的责任限于您已支付的费用。
                </Text>

                <Text style={styles.sectionTitle}>8. 联系我们</Text>
                <Text style={styles.paragraph}>
                    如有任何问题，请联系 support@zeroislenotes.com
                </Text>
            </ScrollView>
        </View>
    );
};


export default TermsOfServiceScreen;
