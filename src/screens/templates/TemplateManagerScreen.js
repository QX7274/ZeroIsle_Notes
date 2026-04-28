import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text, Card, Button } from '../../components/common';
import realmService from '../../services/database/realmService';

const TemplateManagerScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    const loadTemplates = async () => {
      const realm = await realmService.getRealm();
      const templateObjects = realm.objects('Template');
      setTemplates(Array.from(templateObjects));
    };

    const unsubscribe = navigation.addListener('focus', loadTemplates);
    return unsubscribe;
  }, [navigation]);

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => navigation.navigate('TemplateEditor', { templateId: item._id })}>
      <Card style={styles.card}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.content} numberOfLines={2}>{item.content}</Text>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={templates}
        renderItem={renderItem}
        keyExtractor={item => item._id}
        ListEmptyComponent={<Text style={styles.emptyText}>No templates found.</Text>}
      />
      <Button
        title="Create New Template"
        onPress={() => navigation.navigate('TemplateEditor')}
        style={styles.createButton}
      />
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 10,
  },
  card: {
    padding: 15,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  content: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 5,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: theme.colors.textSecondary,
  },
  createButton: {
    margin: 10,
  },
});

export default TemplateManagerScreen;

