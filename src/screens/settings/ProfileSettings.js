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
  Alert,
} from 'react-native';
import defaultAvatar from '../../assets/images/logo.png';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import { Input, GradientButton } from '../../components/common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../../utils/haptics';
import userApi from '../../services/api/userApi';
import { launchImageLibrary } from 'react-native-image-picker';

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

      if (result.didCancel) return;

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

        // 调用上传API
        const response = await userApi.uploadAvatar(formData);

        if (response.success) {
          // 更新头像
          setAvatar(response.data.avatar_url);

          // 更新Redux中的用户信息
          dispatch({
            type: 'UPDATE_USER',
            payload: { avatar: response.data.avatar_url }
          });
        } else {
          throw new Error(response.message || '上传头像失败');
        }

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
      Haptics.mediumFeedback();

      // 调用更新个人资料API
      const response = await userApi.updateProfile({
        username,
        bio,
      });

      if (response.success) {
        // 更新用户信息
        dispatch({ type: 'UPDATE_USER', payload: { username, bio } });
      } else {
        throw new Error(response.message || '更新个人资料失败');
      }

      // 显示成功提示
      Alert.alert('成功', '个人资料已更新');

      // 返回上一页
      navigation.goBack();
    } catch (err) {
      setError(err.message || '更新个人资料失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text
            variant="h2"
            size="large"
            style={styles.headerTitle}
          >
            个人资料
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              style={[styles.avatarWrapper, { backgroundColor: colors.card }]}
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
            <Text
              variant="body"
              size="medium"
              style={styles.avatarHint}
            >
              点击更换头像
            </Text>
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

            <GradientButton
              title="保存资料"
              onPress={handleSaveProfile}
              loading={isLoading}
              style={styles.submitButton}
            />

            <TouchableOpacity
              style={[styles.settingsButton, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={() => navigation.navigate('Settings')}
            >
              <Icon name="settings" size={20} color="#fff" style={styles.settingsIcon} />
              <Text style={styles.settingsButtonText}>应用设置</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
  avatarHint: {
    marginTop: 8,
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
  submitButton: {
    marginTop: 8,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  settingsIcon: {
    marginRight: 8,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileSettings;
