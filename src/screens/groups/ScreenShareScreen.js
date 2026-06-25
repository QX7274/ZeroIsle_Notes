import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import MIIcon from 'react-native-vector-icons/MaterialIcons';
import ScreenShare from '../../components/groups/ScreenShare';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import { COLORS } from '../../utils/constants/colors';

const ScreenShareScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const groupId = route?.params?.groupId || null;
  const isValidGroupId = Boolean(groupId);

  if (!isValidGroupId) {
    return (
      <View style={styles.container} testID="state.group.screenShareScreen.state.invalid">
        <View testID="state.group.screenShareScreen.visibility.visible" />
        <View testID="state.group.screenShareScreen.groupId.visibility.hidden" />

        <View style={styles.headerBar}>
          <ScreenHeaderBackButton
            onPress={() => navigation.goBack()}
            testID="action.group.screenShareScreen.backFromInvalid"
            style={styles.backButton}
          />
          <Text style={styles.headerTitle}>屏幕共享</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.invalidCard} testID="state.group.screenShareScreen.invalid">
          <MIIcon name="warning-amber" size={20} color="#B45309" />
          <Text style={styles.invalidTitle}>无法打开屏幕共享</Text>
          <Text style={styles.invalidText}>缺少群组ID，请返回上一级后重试。</Text>
          <TouchableOpacity
            style={styles.invalidButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            testID="action.group.screenShareScreen.invalidBack"
          >
            <Text style={styles.invalidButtonText}>返回群组</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="state.group.screenShareScreen.state.ready">
      <View testID="state.group.screenShareScreen.visibility.visible" />
      <View testID="state.group.screenShareScreen.groupId.visibility.visible" />

      <View style={styles.headerBar} testID="panel.group.screenShareScreen.header">
        <ScreenHeaderBackButton
          onPress={() => navigation.goBack()}
          testID="action.group.screenShareScreen.back"
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>屏幕共享</Text>
        <View style={styles.headerRight} />
      </View>

      <ScreenShare groupId={groupId} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FAFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(33,150,243,0.10)',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33,150,243,0.18)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  backButton: {
    marginLeft: -4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 18,
    color: COLORS.TEXT,
  },
  headerRight: {
    width: 40,
  },
  invalidCard: {
    margin: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: 'rgba(255,251,235,0.92)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  invalidTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  invalidText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#A16207',
  },
  invalidButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  invalidButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default ScreenShareScreen;
