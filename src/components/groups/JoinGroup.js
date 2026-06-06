import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Button, Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  clearGroupError,
  joinGroupByCode,
  selectGroupsError,
  selectGroupsLoading,
} from '../../redux/slices/groupsSlice';
import { SPACING } from '../../utils/constants/dimensions';
import { COLORS } from '../../utils/constants/colors';
import networkErrorService from '../../services/networkErrorService';

const JoinGroup = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isLoading = useSelector(selectGroupsLoading);
  const error = useSelector(selectGroupsError);

  const [code, setCode] = useState(['', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  const joinBusy = isLoading || isSubmitting;
  const canSubmit = code.every((digit) => !!digit) && !joinBusy;
  const filledDigits = code.filter((digit) => !!digit).length;
  const pageState = joinBusy ? 'busy' : error ? 'error' : 'ready';
  const joinStateText = joinBusy ? '正在加入群组，请稍候...' : '请输入 4 位数字加入码';

  useEffect(() => {
    dispatch(clearGroupError());
  }, [dispatch]);

  const handleCodeChange = (text, index) => {
    if (!/^\d*$/.test(text)) {
      return;
    }
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    if (text && index < 3) {
      inputRefs[index + 1].current?.focus?.();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus?.();
    }
  };

  const handleJoinGroup = () => {
    if (isSubmitting || isLoading) {
      return;
    }
    const joinCode = code.join('');
    if (joinCode.length !== 4) {
      return;
    }

    setIsSubmitting(true);
    dispatch(joinGroupByCode(joinCode))
      .unwrap()
      .then((result) => {
        navigation.replace('GroupDetail', { groupId: result.group.id });
      })
      .catch((err) => {
        if (networkErrorService.isNetworkError(err)) {
          networkErrorService.handleApiError(err, {
            context: '加入群组',
            customMessage: '网络连接失败，无法加入群组',
          });
          dispatch(clearGroupError());
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <View style={styles.safeArea} testID={`state.group.join.state.${pageState}`}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View testID="state.group.join.visibility.visible" />
        <View testID={`state.group.join.busy.visibility.${joinBusy ? 'visible' : 'hidden'}`} />
        <View testID={`state.group.join.codeComplete.visibility.${filledDigits === 4 ? 'visible' : 'hidden'}`} />
        <View testID={`state.group.join.filledDigits.${filledDigits}`} />

        <View
          style={[
            styles.content,
            styles.contentSpacing,
            { paddingBottom: Math.max(insets.bottom, SPACING.LARGE) },
          ]}
          testID="list.group.join.sections"
        >
          <View style={styles.headerContainer}>
            <Icon name="account-group" size={48} color="#2563EB" />
            <Text style={styles.title}>加入群组</Text>
            <Text style={styles.subtitle}>输入 4 位数字加入码加入群组</Text>
          </View>

          <View
            style={[styles.joinStateBanner, joinBusy ? styles.joinStateBannerBusy : styles.joinStateBannerIdle]}
            testID={`state.group.join.submit.visibility.${joinBusy ? 'visible' : 'hidden'}`}
          >
            <Icon name={joinBusy ? 'progress-clock' : 'information-outline'} size={16} color={joinBusy ? '#1D4ED8' : '#2563EB'} />
            <Text
              style={[styles.joinStateText, joinBusy ? styles.joinStateTextBusy : styles.joinStateTextIdle]}
              testID="state.group.join.submitText"
            >
              {joinStateText}
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
                  editable={!joinBusy}
                  testID={`input.group.joinCode.${index + 1}`}
                />
              </View>
            ))}
          </View>

          {error ? (
            <View style={styles.errorContainer} testID="state.group.join.error">
              <Icon name="alert-circle" size={20} color={COLORS.ERROR} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <View testID={`state.group.join.error.visibility.${error ? 'visible' : 'hidden'}`} />

          <Button
            mode="contained"
            onPress={handleJoinGroup}
            style={styles.button}
            loading={joinBusy}
            disabled={!canSubmit}
            testID="action.group.submitJoin"
          >
            加入群组
          </Button>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FAFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F6FAFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.LARGE,
    justifyContent: 'center',
  },
  contentSpacing: {
    paddingTop: 16,
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
  joinStateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: SPACING.MEDIUM,
  },
  joinStateBannerBusy: {
    backgroundColor: '#EAF2FF',
    borderColor: '#CFE1FF',
  },
  joinStateBannerIdle: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  joinStateText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  joinStateTextBusy: {
    color: '#1D4ED8',
  },
  joinStateTextIdle: {
    color: '#2563EB',
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
    backgroundColor: 'rgba(255,255,255,0.90)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE1FF',
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
    backgroundColor: '#FEF2F2',
    padding: SPACING.MEDIUM,
    borderRadius: 8,
    marginBottom: SPACING.LARGE,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: COLORS.ERROR,
    marginLeft: SPACING.SMALL,
    flex: 1,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 6,
    backgroundColor: '#1D4ED8',
  },
});

export default JoinGroup;
