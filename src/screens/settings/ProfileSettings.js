import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
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
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';

const ENTRY_PALETTE_MAP = {
  Reminder: { tint: 'rgba(76,141,255,0.10)', accent: 'rgba(76,141,255,0.22)', iconBg: 'rgba(76,141,255,0.14)', shadow: '#4C8DFF', label: '#1F5FBF' },
  Groups: { tint: 'rgba(155,89,255,0.10)', accent: 'rgba(155,89,255,0.22)', iconBg: 'rgba(155,89,255,0.14)', shadow: '#9B59FF', label: '#6A35D3' },
  MindMap: { tint: 'rgba(17,170,144,0.10)', accent: 'rgba(17,170,144,0.22)', iconBg: 'rgba(17,170,144,0.14)', shadow: '#11AA90', label: '#0B7D67' },
  KnowledgeGraph: { tint: 'rgba(245,158,11,0.10)', accent: 'rgba(245,158,11,0.22)', iconBg: 'rgba(245,158,11,0.14)', shadow: '#F59E0B', label: '#B26A00' },
  PersonalActivity: { tint: 'rgba(59,130,246,0.10)', accent: 'rgba(59,130,246,0.22)', iconBg: 'rgba(59,130,246,0.14)', shadow: '#3B82F6', label: '#2456B5' },
  KnowledgeBase: { tint: 'rgba(236,72,153,0.10)', accent: 'rgba(236,72,153,0.22)', iconBg: 'rgba(236,72,153,0.14)', shadow: '#EC4899', label: '#B91C5A' },
};

const ProfileSettings = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [inlineStatus, setInlineStatus] = useState('');
  const interactionBusy = isLoading || isUploading;
  const profileState = interactionBusy ? 'busy' : 'ready';

  useEffect(() => {
    if (!user) {
      return;
    }
    setUsername(user.username || '');
    setBio(user.bio || '');
    setAvatar(user.avatar || null);
  }, [user]);

  const handleSelectAvatar = async () => {
    try {
      Haptics.lightFeedback();
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 500,
        maxHeight: 500,
      });
      if (result.didCancel) {
        return;
      }
      if (result.errorCode) {
        setError(`选择图片失败: ${result.errorMessage}`);
        return;
      }
      if (!result.assets?.length) {
        return;
      }
      const selectedImage = result.assets[0];
      setIsUploading(true);

      const localAvatarUri = selectedImage.uri;
      setAvatar(localAvatarUri);
      dispatch(setUserInfo({ ...user, avatar: localAvatarUri, avatarLocal: localAvatarUri }));

      const formData = new FormData();
      formData.append('avatar', {
        uri: selectedImage.uri,
        type: selectedImage.type,
        name: selectedImage.fileName || 'avatar.jpg',
      });

      userApi.uploadAvatar(formData).then((response) => {
        if (!response.success) {
          return;
        }
        const avatarUrl = response.data.avatar_url || response.data.avatar;
        setAvatar(avatarUrl);
        dispatch(setUserInfo({ ...user, avatar: avatarUrl, avatarLocal: null }));
      }).catch(() => {});

      setInlineStatus('头像已更新，本地已生效');
      setError('');
    } catch (err) {
      setError(err.message || '上传头像失败，请稍后重试');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (interactionBusy) {
      return;
    }
    if (!username.trim()) {
      setError('用户名不能为空');
      return;
    }
    try {
      setIsLoading(true);
      setError('');
      setInlineStatus('');
      Haptics.mediumFeedback();
      const updatedUserInfo = { ...user, username: username.trim(), bio: bio.trim() };
      dispatch(setUserInfo(updatedUserInfo));
      userApi.updateProfile({ username: username.trim(), bio: bio.trim() }).catch(() => {});
      setInlineStatus('个人资料已保存，本地已生效');
    } catch (err) {
      setError(err.message || '保存个人资料失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateWithGuard = useCallback((routeName) => {
    if (interactionBusy) {
      return;
    }
    Haptics.lightFeedback();
    navigation.navigate(routeName);
  }, [interactionBusy, navigation]);

  const functionEntries = [
    { key: 'Reminder', label: '日程', icon: 'event', hint: '提醒与安排' },
    { key: 'Groups', label: '群组', icon: 'groups', hint: '协作与分享' },
    { key: 'MindMap', label: '思维导图', icon: 'device-hub', hint: '结构化思考' },
    { key: 'KnowledgeGraph', label: '知识图谱', icon: 'hub', hint: '关系网络' },
    { key: 'PersonalActivity', label: '零屿空间', icon: 'dashboard', hint: '个人活动' },
    { key: 'KnowledgeBase', label: '知识库', icon: 'library-books', hint: '资料沉淀' },
  ];

  const renderFunctionEntry = useCallback((entry) => {
    const palette = ENTRY_PALETTE_MAP[entry.key] || {
      tint: 'rgba(76,141,255,0.10)',
      accent: 'rgba(76,141,255,0.22)',
      iconBg: 'rgba(76,141,255,0.14)',
      shadow: '#4C8DFF',
      label: colors.text,
    };

    return (
      <Pressable
        key={entry.key}
        style={({ pressed }) => [
          styles.itemBtn,
          {
            backgroundColor: pressed ? 'rgba(255,255,255,0.98)' : palette.tint,
            borderColor: palette.accent,
            shadowColor: palette.shadow,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
        onPress={() => navigateWithGuard(entry.key)}
        disabled={interactionBusy}
        testID={`entry.${entry.key === 'Groups' ? 'group' : entry.key === 'MindMap' ? 'mindMap' : entry.key === 'KnowledgeGraph' ? 'knowledgeGraph' : entry.key === 'PersonalActivity' ? 'activity' : entry.key === 'KnowledgeBase' ? 'knowledgeBase' : 'reminder'}.profile`}
      >
        <View style={[styles.itemAccentBar, { backgroundColor: palette.label }]} />
        <View style={styles.itemTopRow}>
          <View style={[styles.itemIconWrap, { backgroundColor: palette.iconBg, borderColor: palette.accent }]}>
            <Icon name={entry.icon} size={20} color={palette.label} />
          </View>
          <Icon name="chevron-right" size={18} color={palette.label} />
        </View>
        <View style={styles.itemTextWrap}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{entry.label}</Text>
          <Text style={[styles.itemHint, { color: colors.textSecondary }]} numberOfLines={2}>
            {entry.hint}
          </Text>
        </View>
      </Pressable>
    );
  }, [colors.text, colors.textSecondary, interactionBusy, navigateWithGuard]);

  return (
    <View style={[styles.page, styles.pageBackground]} testID={`state.profile.state.${profileState}`}>
      <View testID="state.profile.visibility.visible" />
      <View testID={`state.profile.interactionBusy.visibility.${interactionBusy ? 'visible' : 'hidden'}`} />
      <View testID={`state.profile.uploading.visibility.${isUploading ? 'visible' : 'hidden'}`} />
      <View testID={`state.profile.error.visibility.${error ? 'visible' : 'hidden'}`} />
      <View testID={`state.profile.inlineStatus.visibility.${inlineStatus ? 'visible' : 'hidden'}`} />
      <View testID={`state.profile.avatar.visibility.${avatar ? 'visible' : 'hidden'}`} />
      <View testID="list.profile.functions" />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, styles.glassCard]}>
          <Text variant="h2" size="large">个人资料</Text>
          <ScreenHeaderBackButton
            onPress={() => !interactionBusy && navigation.goBack()}
            testID="action.profile.back"
            style={styles.backButton}
          />
        </View>

        <View style={[styles.avatarContainer, styles.glassCard]}>
          <View testID="action.profile.selectAvatar">
            {isUploading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <Image source={avatar ? { uri: avatar } : defaultAvatar} style={styles.avatar} />
            )}
          </View>
          <TouchableOpacity
            style={styles.avatarActionBtn}
            onPress={handleSelectAvatar}
            disabled={interactionBusy}
            testID="action.profile.changeAvatar"
          >
            <Icon name="photo-camera" size={16} color={colors.primary} />
            <Text style={[styles.avatarActionText, { color: colors.primary }]}>更换头像</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.formCard, styles.glassCard]}>
          <Input label="用户名" placeholder="请输入用户名" value={username} onChangeText={setUsername} />
          <Input label="个人简介" placeholder="介绍一下自己吧" value={bio} onChangeText={setBio} multiline numberOfLines={4} style={styles.bioInput} />
          {error ? <Text variant="caption" color="error" testID="state.profile.error">{error}</Text> : null}
          {inlineStatus ? <Text variant="caption" style={{ color: colors.primary }} testID="state.profile.inlineStatus">{inlineStatus}</Text> : null}
        </View>

        <View style={[styles.functionCard, styles.glassCard]}>
          <View style={styles.sectionHead}>
            <Text variant="h3">功能中心</Text>
            <Text variant="caption" style={{ color: colors.textSecondary }}>常用功能入口</Text>
          </View>
          <View style={styles.grid}>
            {functionEntries.map((entry) => renderFunctionEntry(entry))}
          </View>
        </View>

        <View style={[styles.actionRow, styles.glassCard]}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleSaveProfile} disabled={interactionBusy} testID="action.profile.save">
            {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.primary }}>保存资料</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigateWithGuard('Settings')} disabled={interactionBusy} testID="entry.settings.profile">
            <Text style={{ color: colors.primary }}>应用设置</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageBackground: { backgroundColor: '#F3F8FF' },
  scrollContent: { padding: 16, paddingBottom: 28 },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: 'rgba(76,141,255,0.18)',
    borderWidth: 1,
    borderRadius: 16,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  header: { padding: 14, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: {
    width: 40,
    height: 40,
  },
  avatarContainer: { alignItems: 'center', padding: 16, marginBottom: 14 },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarActionBtn: {
    marginTop: 14,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.20)',
    backgroundColor: 'rgba(255,255,255,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActionText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  formCard: { padding: 14, marginBottom: 14 },
  bioInput: { height: 100, textAlignVertical: 'top' },
  functionCard: { padding: 14, marginBottom: 14 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 6 },
  itemBtn: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
    alignItems: 'flex-start',
    minHeight: 84,
    justifyContent: 'flex-start',
  },
  itemIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.12)',
  },
  itemAccentBar: { height: 4, borderRadius: 999, marginBottom: 8, opacity: 0.92 },
  itemTopRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  itemTextWrap: { flex: 1, width: '100%' },
  itemTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  itemHint: { fontSize: 12, lineHeight: 16 },
  actionRow: { padding: 10, flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { width: '48%', minHeight: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(76,141,255,0.22)', backgroundColor: 'rgba(255,255,255,0.94)' },
});

export default ProfileSettings;
