import React from 'react';
import { StyleSheet } from 'react-native';
import { CategoryManager } from '../../components/notes';
import { SafeAreaView } from 'react-native-safe-area-context';

const CategoryScreen = ({ navigation }) => {
  const handleSelectCategory = (category) => {
    navigation.navigate('NoteList', { categoryId: category.id });
  };

  return (
    <SafeAreaView style={styles.container}>
      <CategoryManager onSelectCategory={handleSelectCategory} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default CategoryScreen;