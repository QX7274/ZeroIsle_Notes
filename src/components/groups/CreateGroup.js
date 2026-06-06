import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  createGroup,
  selectGroupsError,
  selectGroupsLoading,
  upsertLocalGroup,
} from '../../redux/slices/groupsSlice';
import { SPACING } from '../../utils/constants/dimensions';
import { COLORS } from '../../utils/constants/colors';
import networkErrorService from '../../services/networkErrorService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CreateGroup = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isLoading = useSelector(selectGroupsLoading);
  const error = useSelector(selectGroupsError);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitBusy = isLoading || isSubmitting;
  const pageState = submitBusy ? 'busy' : error ? 'error' : 'ready';
  const submitStateText = submitBusy ? '正在创建群组，请稍候...' : '请确认信息后创建群组';

  const isLikelyNetworkFailure = (err) => {
    if (networkErrorService.isNetworkError(err)) {
      return true;
    }
    const raw = String(err?.message || err || '').toLowerCase();
    return raw.includes('network') || raw.includes('timeout') || raw.includes('failed') || raw.includes('网络');
  };

  const buildLocalGroupFallback = (groupData) => {
    const nowIso = new Date().toISOString();
    const randomSuffix = Math.random().toString(16).slice(2, 8);
    return {
      id: `local-${Date.now()}-${randomSuffix}`,
      name: groupData?.name?.trim?.() || '未命名群组',
      description: groupData?.description?.trim?.() || '',
      member_count: 1,
      created_at: nowIso,
      updated_at: nowIso,
      local_only: true,
      can_invite: false,
      can_generate_join_code: false,
    };
  };

  const validateForm = () => {
    let isValid = true;
    if (!name.trim()) {
      setNameError('群组名称不能为空');
      isValid = false;
    } else if (name.length > 100) {
      setNameError('群组名称不能超过100个字符');
      isValid = false;
    } else {
      setNameError('');
    }
    return isValid;
  };

  const handleCreateGroup = () => {
    if (isSubmitting || isLoading) {
      return;
    }

    Keyboard.dismiss();

    if (!validateForm()) {
      return;
    }

    const groupData = {
      name: name.trim(),
      description: description.trim(),
    };

    setIsSubmitting(true);
    dispatch(createGroup(groupData))
      .unwrap()
      .then((createdGroup) => {
        navigation.replace('GroupDetail', { groupId: createdGroup.id });
      })
      .catch((createError) => {
        console.error('Create group failed:', createError);
        if (isLikelyNetworkFailure(createError)) {
          const localGroup = buildLocalGroupFallback(groupData);
          dispatch(upsertLocalGroup(localGroup));
          navigation.replace('GroupDetail', { groupId: localGroup.id });
          networkErrorService.handleApiError(createError, {
            context: '创建群组',
            customMessage: '网络不稳定，已创建本地群组草稿，可先继续验证功能',
            suppressGlobalUI: true,
          });
          return;
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      testID={`state.group.create.state.${pageState}`}
    >
      <View testID="state.group.create.visibility.visible" />
      <View testID={`state.group.create.busy.visibility.${submitBusy ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.create.nameError.visibility.${nameError ? 'visible' : 'hidden'}`} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          styles.scrollContentSpacing,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
        keyboardShouldPersistTaps="handled"
        testID="list.group.create.sections"
      >
        <View style={styles.formContainer}>
          <View
            style={[styles.submitStateBanner, submitBusy ? styles.submitStateBannerBusy : styles.submitStateBannerIdle]}
            testID={`state.group.create.submit.visibility.${submitBusy ? 'visible' : 'hidden'}`}
          >
            <Icon name={submitBusy ? 'progress-clock' : 'check-circle-outline'} size={16} color={submitBusy ? '#1D4ED8' : '#2563EB'} />
            <Text
              style={[styles.submitStateText, submitBusy ? styles.submitStateTextBusy : styles.submitStateTextIdle]}
              testID="state.group.create.submitText"
            >
              {submitStateText}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              label="群组名称"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              error={!!nameError}
              disabled={submitBusy}
              maxLength={100}
              testID="input.group.name"
            />
            {nameError ? <HelperText type="error" visible>{nameError}</HelperText> : null}
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              label="群组描述（可选）"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={4}
              disabled={submitBusy}
              maxLength={500}
              testID="input.group.description"
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>

          {error ? (
            <View style={styles.errorContainer} testID="state.group.createError">
              <Icon name="alert-circle" size={20} color={COLORS.ERROR} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <View testID={`state.group.create.error.visibility.${error ? 'visible' : 'hidden'}`} />

          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleCreateGroup}
              style={styles.button}
              loading={submitBusy}
              disabled={submitBusy}
              testID="action.group.submitCreate"
            >
              创建群组
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FAFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.MEDIUM,
  },
  scrollContentSpacing: {
    paddingTop: 16,
  },
  formContainer: {
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderRadius: 20,
    padding: SPACING.MEDIUM,
    elevation: 4,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE1FF',
  },
  submitStateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: SPACING.MEDIUM,
  },
  submitStateBannerBusy: {
    backgroundColor: '#EAF2FF',
    borderColor: '#CFE1FF',
  },
  submitStateBannerIdle: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  submitStateText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  submitStateTextBusy: {
    color: '#1D4ED8',
  },
  submitStateTextIdle: {
    color: '#2563EB',
  },
  inputContainer: {
    marginBottom: SPACING.MEDIUM,
  },
  input: {
    backgroundColor: '#FFFFFF',
  },
  charCount: {
    fontSize: 12,
    color: COLORS.TEXT_TERTIARY,
    textAlign: 'right',
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: SPACING.MEDIUM,
    borderRadius: 8,
    marginBottom: SPACING.MEDIUM,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: COLORS.ERROR,
    marginLeft: SPACING.SMALL,
    flex: 1,
  },
  buttonContainer: {
    marginTop: SPACING.MEDIUM,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 6,
    backgroundColor: '#1D4ED8',
  },
});

export default CreateGroup;
