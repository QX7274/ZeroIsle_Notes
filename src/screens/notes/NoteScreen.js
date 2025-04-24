/**
 * 现代化笔记编辑屏幕
 * 支持渐变背景和动画效果
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  StatusBar
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { notesApi } from '../../services/api';
import { addNote, updateNote } from '../../store/actions/notesActions';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { dateUtils } from '../../utils';
import LinearGradient from 'react-native-linear-gradient';
import { SPACING, BORDER_RADIUS, SHADOW } from '../../utils/constants/dimensions';
import { Button, Card } from '../../components/common';

const NoteScreen = ({ route, navigation }) => {
  const { colors, isDarkMode } = useTheme();
  const dispatch = useDispatch();
  const { note } = route.params;

  // 状态管理
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [isEditing, setIsEditing] = useState(!note);
  const [isSaving, setIsSaving] = useState(false);

  // 动画值
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // 渐变色
  const backgroundGradient = isDarkMode
    ? colors.gradients.primary
    : ['#F8F9FA', '#E9ECEF'];

  // 处理动画效果
  useEffect(() => {
    // 设置状态栏
    StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setTranslucent(true);
    }

    // 启动动画
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleEdit}
          style={styles.headerButton}
        >
          <Icon
            name={isEditing ? 'checkmark' : 'pencil'}
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      )
    });
  }, [isEditing]);

  const handleEdit = async () => {
    if (isEditing) {
      // 保存笔记
      setIsSaving(true);

      try {
        const noteData = {
          title: title.trim() || '无标题笔记',
          content,
          updatedAt: dateUtils.format(new Date())
        };

        // 保存前的动画效果
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 300,
          useNativeDriver: true,
        }).start();

        if (note) {
          const updatedNote = await notesApi.update(note.id, noteData);
          dispatch(updateNote(updatedNote));
        } else {
          const newNote = await notesApi.create(noteData);
          dispatch(addNote(newNote));
        }

        // 保存成功的动画效果
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(300)
        ]).start(() => {
          setIsSaving(false);
          setIsEditing(false);
        });
      } catch (error) {
        console.error('保存笔记失败:', error);
        setIsSaving(false);

        // 保存失败的动画效果
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    } else {
      // 进入编辑模式
      setIsEditing(true);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 渐变背景 */}
      <LinearGradient
        colors={backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* 笔记内容 */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {isEditing ? (
          // 编辑模式
          <Card
            elevation="medium"
            style={styles.noteCard}
          >
            <TextInput
              style={[styles.titleInput, { color: colors.text }]}
              placeholder="标题"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            <View style={styles.divider} />

            <ScrollView style={styles.scrollContainer}>
              <TextInput
                style={[styles.contentInput, { color: colors.text }]}
                placeholder="开始记录您的想法..."
                placeholderTextColor={colors.textSecondary}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            {isSaving && (
              <View style={styles.savingIndicator}>
                <MaterialIcon name="save" size={20} color={colors.primary} />
                <Text style={[styles.savingText, { color: colors.primary }]}>
                  正在保存...
                </Text>
              </View>
            )}
          </Card>
        ) : (
          // 查看模式
          <Card
            elevation="medium"
            style={styles.noteCard}
          >
            <ScrollView style={styles.scrollContainer}>
              <Text style={[styles.noteTitle, { color: colors.text }]}>
                {title || '无标题笔记'}
              </Text>

              <View style={styles.divider} />

              <Text style={[styles.noteContent, { color: colors.text }]}>
                {content || '无内容'}
              </Text>

              {note && note.updatedAt && (
                <Text style={[styles.noteDate, { color: colors.textSecondary }]}>
                  最后更新: {dateUtils.formatRelative(note.updatedAt)}
                </Text>
              )}
            </ScrollView>

            <View style={styles.actionButtons}>
              <Button
                title="编辑"
                type="gradient"
                gradientType="primary"
                rounded
                onPress={handleEdit}
                style={styles.editButton}
              />
            </View>
          </Card>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // 基础容器样式
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    padding: SPACING.LARGE,
  },
  noteCard: {
    flex: 1,
    padding: SPACING.LARGE,
    borderRadius: BORDER_RADIUS.LARGE,
  },
  scrollContainer: {
    flex: 1,
  },

  // 分隔线
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: SPACING.MEDIUM,
  },

  // 标题样式
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingVertical: SPACING.SMALL,
  },

  // 内容样式
  contentInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    paddingTop: SPACING.SMALL,
    minHeight: 200,
  },

  // 查看模式样式
  noteTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: SPACING.SMALL,
  },
  noteContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: SPACING.LARGE,
  },
  noteDate: {
    fontSize: 12,
    marginTop: SPACING.LARGE,
    textAlign: 'right',
    fontStyle: 'italic',
  },

  // 保存指示器
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.SMALL,
    position: 'absolute',
    bottom: SPACING.MEDIUM,
    right: SPACING.MEDIUM,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.MEDIUM,
    ...SHADOW.SMALL,
  },
  savingText: {
    marginLeft: SPACING.SMALL,
    fontSize: 14,
  },

  // 操作按钮
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.MEDIUM,
  },
  editButton: {
    minWidth: 100,
  },

  // 头部按钮
  headerButton: {
    marginRight: SPACING.MEDIUM,
    padding: SPACING.SMALL,
  }
});

export default NoteScreen;