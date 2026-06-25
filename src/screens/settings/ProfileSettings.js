import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
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

const ENTRY_PALETTE_MAP = {
  Reminder: {
    background: '#EAF3FF',
    border: 'rgba(45,107,255,0.18)',
    iconBg: '#DCEAFF',
    shadow: '#2D6BFF',
    icon: '#2D6BFF',
  },
  Groups: {
    background: '#E8FBF4',
    border: 'rgba(20,184,166,0.18)',
    iconBg: '#D7F7ED',
    shadow: '#14B8A6',
    icon: '#14B8A6',
  },
  MindMap: {
    background: '#F2EDFF',
    border: 'rgba(139,92,246,0.18)',
    iconBg: '#E5DBFF',
    shadow: '#8B5CF6',
    icon: '#8B5CF6',
  },
  KnowledgeGraph: {
    background: '#FFF4E0',
    border: 'rgba(245,158,11,0.18)',
    iconBg: '#FFE9BF',
    shadow: '#F59E0B',
    icon: '#F59E0B',
  },
  PersonalActivity: {
    background: '#FFEAF5',
    border: 'rgba(236,72,153,0.18)',
    iconBg: '#FFD9EA',
    shadow: '#EC4899',
    icon: '#EC4899',
  },
  KnowledgeBase: {
    background: '#EAF9F2',
    border: 'rgba(16,185,129,0.18)',
    iconBg: '#D9F6E5',
    shadow: '#10B981',
    icon: '#10B981',
  },
};

const ProfileSettings = ({ navigation }) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
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
  const isWideEntryLayout = width >= 960;
  const entryCardWidth = isWideEntryLayout ? '31.5%' : '48.2%';
  const entryCardMinHeight = isWideEntryLayout ? 182 : 156;

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
      background: '#EAF3FF',
      border: 'rgba(45,107,255,0.18)',
      iconBg: '#DCEAFF',
      shadow: '#2D6BFF',
      icon: '#2D6BFF',
    };

    return (
      <Pressable
        key={entry.key}
        style={({ pressed }) => [
          styles.itemBtn,
          {
            width: entryCardWidth,
            minHeight: entryCardMinHeight,
            backgroundColor: palette.background,
            shadowColor: palette.shadow,
            borderColor: palette.border,
            transform: [{ translateY: pressed ? 1 : 0 }, { scale: pressed ? 0.985 : 1 }],
            opacity: pressed ? 0.97 : 1,
          },
        ]}
        onPress={() => navigateWithGuard(entry.key)}
        disabled={interactionBusy}
        testID={`entry.${entry.key === 'Groups' ? 'group' : entry.key === 'MindMap' ? 'mindMap' : entry.key === 'KnowledgeGraph' ? 'knowledgeGraph' : entry.key === 'PersonalActivity' ? 'activity' : entry.key === 'KnowledgeBase' ? 'knowledgeBase' : 'reminder'}.profile`}
      >
        <View style={styles.itemContent}>
          <View style={[styles.itemIconWrap, { backgroundColor: palette.iconBg }]}>
            <Icon name={entry.icon} size={22} color={palette.icon} />
          </View>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{entry.label}</Text>
          <Text style={[styles.itemHint, { color: colors.textSecondary }]} numberOfLines={2}>
            {entry.hint}
          </Text>
        </View>
      </Pressable>
    );
  }, [colors.text, colors.textSecondary, entryCardMinHeight, entryCardWidth, interactionBusy, navigateWithGuard]);

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
            <View>
              <Text variant="h3">功能中心</Text>
              <Text variant="caption" style={styles.sectionCaption}>常用功能入口</Text>
            </View>
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
  avatarContainer: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, marginBottom: 14 },
  avatar: { width: 104, height: 104, borderRadius: 52 },
  avatarActionBtn: {
    marginTop: 10,
    minHeight: 34,
    paddingHorizontal: 12,
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
  sectionCaption: { color: '#718096', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 },
  itemBtn: {
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  itemContent: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'flex-start' },
  itemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    marginBottom: 12,
  },
  itemTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4, letterSpacing: 0.1 },
  itemHint: { fontSize: 12, lineHeight: 17, opacity: 0.9 },
  actionRow: { padding: 10, flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { width: '48%', minHeight: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(76,141,255,0.22)', backgroundColor: 'rgba(255,255,255,0.94)' },
});

export default ProfileSettings;
