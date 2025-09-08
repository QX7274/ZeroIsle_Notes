/**
 * 创建群组组件
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  createGroup,
  selectGroupsLoading,
  selectGroupsError,
} from '../../redux/slices/groupsSlice';
import { SPACING } from '../../utils/constants/dimensions';
import { COLORS } from '../../utils/constants/colors';
import networkErrorService from '../../services/networkErrorService';

const CreateGroup = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const isLoading = useSelector(selectGroupsLoading);
  const error = useSelector(selectGroupsError);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');

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
    if (!validateForm()) {
      return;
    }

    const groupData = {
      name: name.trim(),
      description: description.trim(),
    };

    dispatch(createGroup(groupData))
      .unwrap()
      .then((createdGroup) => {
        navigation.replace('GroupDetail', { groupId: createdGroup.id });
      })
      .catch((error) => {
        console.error('创建群组失败:', error);
        
        // 使用网络错误服务处理错误
        if (networkErrorService.isNetworkError(error)) {
          networkErrorService.handleApiError(error, {
            context: '创建群组',
            customMessage: '网络连接失败，无法创建群组'
          });
        }
      });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <TextInput
              label="群组名称"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              error={!!nameError}
              disabled={isLoading}
              maxLength={100}
            />
            {nameError ? (
              <HelperText type="error" visible={!!nameError}>
                {nameError}
              </HelperText>
            ) : null}
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
              disabled={isLoading}
              maxLength={500}
            />
            <Text style={styles.charCount}>
              {description.length}/500
            </Text>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={20} color={COLORS.ERROR} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleCreateGroup}
              style={styles.button}
              loading={isLoading}
              disabled={isLoading}
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
    backgroundColor: COLORS.BACKGROUND,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.MEDIUM,
  },
  formContainer: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 20,
    padding: SPACING.MEDIUM,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  inputContainer: {
    marginBottom: SPACING.MEDIUM,
  },
  input: {
    backgroundColor: COLORS.SURFACE,
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
    backgroundColor: 'rgba(255,59,48,0.1)',
    padding: SPACING.MEDIUM,
    borderRadius: 8,
    marginBottom: SPACING.MEDIUM,
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
  },
});

export default CreateGroup;
