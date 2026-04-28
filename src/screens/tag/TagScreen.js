import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TagManager } from '../../components/notes';

const TagScreen = ({ navigation }) => {
  const handleSelectTag = (tag) => {
    // 处理标签选择
    navigation.navigate('NoteList', { tagId: tag.id });
  };

  return (
    <View style={styles.container}>
      <TagManager onSelectTag={handleSelectTag} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default TagScreen;
