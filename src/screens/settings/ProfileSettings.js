/**
 * 个人资料设置页面
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,

} from 'react-native';

import defaultAvatar from '../../assets/images/logo.png';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import { Input } from '../../components/common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../../utils/haptics';
import userApi from '../../services/api/userApi';
import { launchImageLibrary } from 'react-native-image-picker';
import { setUserInfo } from '../../redux/slices/authSlice';

const ProfileSettings = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);

  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [inlineStatus, setInlineStatus] = useState('');




  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setBio(user.bio || '');
      setAvatar(user.avatar || null);
    }
  }, [user]);

  // 选择头像
  const handleSelectAvatar = async () => {
    try {
      Haptics.lightFeedback();

      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 500,
        maxHeight: 500,
      });

      if (result.didCancel) {return;}

      if (result.errorCode) {
        setError('选择图片失败: ' + result.errorMessage);
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];

        // 上传头像
        setIsUploading(true);

        // 创建表单数据
        const formData = new FormData();
        formData.append('avatar', {
          uri: selectedImage.uri,
          type: selectedImage.type,
          name: selectedImage.fileName || 'avatar.jpg',
        });

        // 先保存本地URI到Redux（优先本地）
        const localAvatarUri = selectedImage.uri;
        setAvatar(localAvatarUri);
        dispatch(setUserInfo({
          ...user,
          avatar: localAvatarUri,
          avatarLocal: localAvatarUri, // 标记为本地URI
        }));

        // 后台上传到服务器（不阻塞用户）
        userApi.uploadAvatar(formData).then(response => {
          if (response.success) {
            const avatarUrl = response.data.avatar_url || response.data.avatar;
            // 上传成功后更新为服务器URL
            setAvatar(avatarUrl);
            dispatch(setUserInfo({
              ...user,
              avatar: avatarUrl,
              avatarLocal: null, // 清除本地标记
            }));
            console.log('头像已上传到服务器');
          } else {
            console.warn('头像上传到服务器失败，但本地已保存:', response.message);
          }
        }).catch(err => {
          console.warn('头像上传到服务器失败，但本地已保存:', err);
        });

        setInlineStatus('头像已更新，本地已生效');

        setIsUploading(false);
      }
    } catch (err) {
      setIsUploading(false);
      setError(err.message || '上传头像失败，请稍后重试');
    }
  };

  // 保存个人资料
  const handleSaveProfile = async () => {
    if (!username.trim()) {
      setError('用户名不能为空');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setInlineStatus('');
      Haptics.mediumFeedback();

      const updatedUserInfo = {
        ...user,
        username: username.trim(),
        bio: bio.trim(),
      };

      // 1. 优先保存到本地Redux状态
      dispatch(setUserInfo(updatedUserInfo));

      // 2. 尝试同步到后端API（不阻塞用户操作）
      userApi.updateProfile({
        username: username.trim(),
        bio: bio.trim(),
      }).then(response => {
        if (response.success) {
          console.log('个人资料已同步到服务器');
        } else {
          console.warn('同步到服务器失败，但本地已保存:', response.message);
        }
      }).catch(err => {
        console.warn('同步到服务器失败，但本地已保存:', err);
      });

      // 使用页内提示，避免阻断流程
      setInlineStatus('个人资料已保存，本地已生效');
    } catch (err) {
      console.error('保存个人资料失败:', err);
      setError(err.message || '保存个人资料失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="screen.profile"
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text
            variant="h2"
            size="large"
            style={[styles.headerTitle, { marginLeft: 0 }]}
          >
            个人资料
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.avatarContainer}>
            {/* 头像包装器 */}
            <View style={[styles.avatarWrapper, { backgroundColor: colors.card }]}>

            <TouchableOpacity
              style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
              onPress={handleSelectAvatar}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <>
                  {avatar ? (
                    <Image
                      source={{ uri: avatar }}
                      style={styles.avatar}
                    />
                  ) : (
                    <Image
                      source={defaultAvatar}
                      style={styles.avatar}
                    />
                  )}
                  <View style={[styles.editIconContainer, { backgroundColor: colors.primary }]}>
                    <Icon name="edit" size={16} color="#fff" />
                  </View>
                </>
              )}
            </TouchableOpacity>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Input
                label="用户名"
                placeholder="请输入用户名"
                value={username}
                onChangeText={setUsername}
              />
            </View>

            <View style={styles.inputContainer}>
              <Input
                label="个人简介"
                placeholder="介绍一下自己吧"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                style={styles.bioInput}
              />
            </View>

            {error ? (
              <Text
                variant="caption"
                color="error"
                style={styles.errorText}
              >
                {error}
              </Text>
            ) : null}
            {inlineStatus ? (
              <Text
                variant="caption"
                style={[styles.successText, { color: colors.primary }]}
                testID="state.profile.inlineStatus"
              >
                {inlineStatus}
              </Text>
            ) : null}

            {/* 功能中心区域 */}
            <View style={styles.functionsCenter}>
              <Text
                variant="h3"
                style={[styles.sectionTitle, { color: colors.text }]}
              >
                功能中心
              </Text>
              <View style={styles.functionsGrid}>
                {/* 日程 */}
                <TouchableOpacity
                  style={[styles.functionButton, {
                    backgroundColor: colors.card,
                    borderColor: colors.primary + '30',
                  }]}
                  onPress={() => {
                    Haptics.lightFeedback();
                    navigation.navigate('Reminder');
                  }}
                  activeOpacity={0.7}
                  testID="entry.reminder.profile"
                >
                  <View style={[styles.functionIconContainer, { backgroundColor: '#E0F7FA' }]}>
                    <Icon name="schedule" size={18} color="#0097A7" />
                  </View>
                  <Text style={[styles.functionButtonText, { color: '#0097A7', fontWeight: 'normal' }]}>日程</Text>
                </TouchableOpacity>

                {/* 群组 */}
                <TouchableOpacity
                  style={[styles.functionButton, {
                    backgroundColor: colors.card,
                    borderColor: colors.primary + '30',
                  }]}
                  onPress={() => {
                    Haptics.lightFeedback();
                    navigation.navigate('Groups');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.functionIconContainer, { backgroundColor: '#E8EAF6' }]}>
                    <Icon name="group" size={18} color="#3F51B5" />
                  </View>
                  <Text style={[styles.functionButtonText, { color: '#3F51B5', fontWeight: 'normal' }]}>群组</Text>
                </TouchableOpacity>

                {/* 思维导图 */}
                <TouchableOpacity
                  style={[styles.functionButton, {
                    backgroundColor: colors.card,
                    borderColor: colors.primary + '30',
                  }]}
                  onPress={() => {
                    Haptics.lightFeedback();
                    navigation.navigate('MindMap');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.functionIconContainer, { backgroundColor: '#FCE4EC' }]}>
                    <Icon name="account-tree" size={18} color="#E91E63" />
                  </View>
                  <Text style={[styles.functionButtonText, { color: '#E91E63', fontWeight: 'normal' }]}>思维导图</Text>
                </TouchableOpacity>

                {/* 知识图谱 */}
                <TouchableOpacity
                  style={[styles.functionButton, {
                    backgroundColor: colors.card,
                    borderColor: colors.primary + '30',
                  }]}
                  onPress={() => {
                    Haptics.lightFeedback();
                    navigation.navigate('KnowledgeGraph');
                  }}
                  activeOpacity={0.7}
                  testID="entry.knowledgeGraph.profile"
                >
                  <View style={[styles.functionIconContainer, { backgroundColor: '#FFE8CC' }]}>
                    <Icon name="hub" size={18} color="#FF9500" />
                  </View>
                  <Text style={[styles.functionButtonText, { color: '#FF9500', fontWeight: 'normal' }]}>知识图谱</Text>
                </TouchableOpacity>

                {/* 零屿空间 */}
                <TouchableOpacity
                  style={[styles.functionButton, {
                    backgroundColor: colors.card,
                    borderColor: '#3b82f6' + '40',
                  }]}
                  onPress={() => {
                    Haptics.lightFeedback();
                    navigation.navigate('PersonalActivity');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.functionIconContainer, { backgroundColor: '#DBEAFE' }]}>
                    <Icon name="auto-awesome" size={18} color="#3b82f6" />
                  </View>
                  <Text style={[styles.functionButtonText, { color: '#3b82f6', fontWeight: 'normal' }]}>零屿空间</Text>
                </TouchableOpacity>

                {/* 知识库 */}
                <TouchableOpacity
                  style={[styles.functionButton, {
                    backgroundColor: colors.card,
                    borderColor: '#4CAF50' + '30',
                  }]}
                  onPress={() => {
                    Haptics.lightFeedback();
                    navigation.navigate('KnowledgeBase');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.functionIconContainer, { backgroundColor: '#C8E6C9' }]}>
                    <Icon name="auto-stories" size={18} color="#4CAF50" />
                  </View>
                  <Text style={[styles.functionButtonText, { color: '#4CAF50', fontWeight: 'normal' }]}>知识库</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.actionButton, {
                  backgroundColor: colors.card,
                  borderColor: colors.primary + '30',
                }]}
                onPress={handleSaveProfile}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <View style={[styles.actionIconContainer, { backgroundColor: colors.primary + '15' }]}>
                      <Icon name="save" size={18} color={colors.primary} />
                    </View>
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>保存资料</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, {
                  backgroundColor: colors.card,
                  borderColor: colors.primary + '30',
                }]}
                onPress={() => {
                  Haptics.lightFeedback();
                  navigation.navigate('Settings');
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Icon name="settings" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.actionButtonText, { color: colors.primary }]}>应用设置</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  animatedBg: {
    position: 'absolute',
    width: '200%',
    height: '200%',
    opacity: 0.3,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginLeft: 16,
  },
  headerTitle: {
    flex: 0,
  },
  content: {
    flex: 1,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarAnimatedBg: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    justifyContent: 'center',
    alignItems: 'center',
    top: -20,
  },

  avatarGlowGradient: {
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    marginBottom: 16,
  },
  successText: {
    marginBottom: 16,
  },
  functionsCenter: {
    marginBottom: 24,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  functionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 20, // 减少间距，使行间距和列间距一致
  },
  functionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    minHeight: 40,
    minWidth: '48%',
    maxWidth: '48%',
  },
  functionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  functionButtonText: {
    fontSize: 13,
    fontWeight: '400', // 与个人简介字体一致，不加粗
    letterSpacing: 0.2,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    minHeight: 40,
  },
  actionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default ProfileSettings;
