/**
 * 加入群组组件
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Text, Button } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  joinGroupByCode,
  selectGroupsLoading,
  selectGroupsError,
  clearGroupError,
} from '../../redux/slices/groupsSlice';
import { SPACING } from '../../utils/constants/dimensions';
import { COLORS } from '../../utils/constants/colors';
import networkErrorService from '../../services/networkErrorService';

const JoinGroup = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const isLoading = useSelector(selectGroupsLoading);
  const error = useSelector(selectGroupsError);

  const [code, setCode] = useState(['', '', '', '']);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    // 清除之前的错误
    dispatch(clearGroupError());
  }, []);

  const handleCodeChange = (text, index) => {
    // 只允许输入数字
    if (!/^\d*$/.test(text)) {return;}

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // 自动跳转到下一个输入框
    if (text && index < 3) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // 处理删除键
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handleJoinGroup = () => {
    const joinCode = code.join('');
    if (joinCode.length !== 4) {
      return;
    }

    dispatch(joinGroupByCode(joinCode))
      .unwrap()
      .then((result) => {
        navigation.replace('GroupDetail', { groupId: result.group.id });
      })
      .catch((error) => {
        console.error('加入群组失败:', error);

        // 使用网络错误服务处理错误
        if (networkErrorService.isNetworkError(error)) {
          networkErrorService.handleApiError(error, {
            context: '加入群组',
            customMessage: '网络连接失败，无法加入群组',
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
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Icon name="account-group" size={48} color={COLORS.PRIMARY} />
          <Text style={styles.title}>加入群组</Text>
          <Text style={styles.subtitle}>
            输入4位数字加入码加入群组
          </Text>
        </View>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <View key={index} style={styles.digitContainer}>
              <RNTextInput
                ref={inputRefs[index]}
                style={styles.digitInput}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!isLoading}
              />
            </View>
          ))}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={20} color={COLORS.ERROR} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Button
          mode="contained"
          onPress={handleJoinGroup}
          style={styles.button}
          loading={isLoading}
          disabled={isLoading || code.some(digit => !digit)}
        >
          加入群组
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    flex: 1,
    padding: SPACING.LARGE,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.XLARGE,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.MEDIUM,
    marginBottom: SPACING.SMALL,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.LARGE,
  },
  digitContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  digitInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.1)',
    padding: SPACING.MEDIUM,
    borderRadius: 8,
    marginBottom: SPACING.LARGE,
  },
  errorText: {
    color: COLORS.ERROR,
    marginLeft: SPACING.SMALL,
    flex: 1,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 6,
  },
});

export default JoinGroup;
