import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/common';
import realmService from '../../services/database/realmService';
import { Realm } from '@realm/react';

const TemplateEditorScreen = ({ route, navigation }) => {
  const { templateId } = route.params || {};
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (templateId) {
      const loadTemplate = async () => {
        const realm = await realmService.getRealm();
        const templateObject = realm.objectForPrimaryKey('Template', templateId);
        if (templateObject) {
          setTitle(templateObject.title);
          setContent(templateObject.content);
        }
      };
      loadTemplate();
    }
  }, [templateId]);

  const handleSave = async () => {
    const realm = await realmService.getRealm();
    realm.write(() => {
      if (templateId) {
        realm.create('Template', { _id: templateId, title, content }, 'modified');
      } else {
        realm.create('Template', {
          _id: new Realm.BSON.UUID().toHexString(),
          title,
          content,
        });
      }
    });
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <TextInput
        style={styles.titleInput}
        placeholder="Template Title"
        placeholderTextColor={theme.colors.textSecondary}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.contentInput}
        placeholder="Template Content (e.g., Meeting notes for {{date}})"
        placeholderTextColor={theme.colors.textSecondary}
        value={content}
        onChangeText={setContent}
        multiline
      />
      <Button title="Save Template" onPress={handleSave} style={styles.saveButton} />
    </ScrollView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 15,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 15,
    paddingBottom: 10,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    textAlignVertical: 'top',
    minHeight: 200,
  },
  saveButton: {
    marginTop: 20,
  },
});

export default TemplateEditorScreen;

