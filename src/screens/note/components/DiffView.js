import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';

// Simple unified diff renderer
// Props:
// - titleDiff: string[]
// - contentDiff: string[]
// - initialTab: 'title' | 'content'
export default function DiffView({ titleDiff = [], contentDiff = [], initialTab = 'content', theme }) {
  const [tab, setTab] = useState(initialTab);

  const renderLine = (line, idx) => {
    const isAdd = line.startsWith('+') && !line.startsWith('+++');
    const isDel = line.startsWith('-') && !line.startsWith('---');
    const isMeta = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');

    let style = styles.line;
    if (isMeta) {style = [style, styles.meta];}
    else if (isAdd) {style = [style, styles.add];}
    else if (isDel) {style = [style, styles.del];}
    else {style = [style, styles.ctx];}

    return (
      <Text key={idx} style={style} selectable>
        {line}
      </Text>
    );
  };

  const palette = useMemo(() => ({
    add: '#0B7F3B11',
    del: '#AD1D1D11',
    meta: '#6A5ACD22',
    ctx: '#00000000',
  }), []);

  const themed = (base) => {
    if (!theme) {return base;}
    return {
      ...base,
      backgroundColor: base.backgroundColor || theme.colors?.card,
      color: base.color || theme.colors?.text,
      borderColor: theme.colors?.border,
    };
  };

  const current = tab === 'title' ? titleDiff : contentDiff;

  return (
    <View style={themed(styles.container)}>
      <View style={themed(styles.tabBar)}>
        <TouchableOpacity onPress={() => setTab('title')} style={[styles.tab, tab === 'title' && styles.tabActive]}>
          <Text style={themed(styles.tabText)}>Title</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('content')} style={[styles.tab, tab === 'content' && styles.tabActive]}>
          <Text style={themed(styles.tabText)}>Content</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={themed(styles.diffArea)}>
        {current && current.length > 0 ? (
          current.map(renderLine)
        ) : (
          <Text style={themed(styles.empty)}>No differences</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontWeight: '600',
  },
  diffArea: {
    padding: 10,
    maxHeight: 320,
  },
  line: {
    fontFamily: Platform?.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginBottom: 2,
  },
  add: { backgroundColor: '#E6FFED' },
  del: { backgroundColor: '#FFECEC' },
  meta: { backgroundColor: '#F1F0FF', fontWeight: '700' },
  ctx: { backgroundColor: '#FFFFFF' },
  empty: { opacity: 0.6, fontStyle: 'italic' },
});
