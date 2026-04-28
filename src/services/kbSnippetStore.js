import realmService from './database/realmService';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { v4 as uuidv4 } from 'uuid';

const KEY_PREFIX = 'kb_snippets_';
const MIGRATION_KEY = 'kb_snippets_migrated_to_realm_v1';

/**
 * Migrates snippets from AsyncStorage to Realm.
 * This should be called once during app initialization.
 */
export const migrateSnippets = async () => {
  try {
    const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
    if (migrated) {return;} // Already migrated

    console.log('[kbSnippetStore] Starting migration from AsyncStorage to Realm...');
    const keys = await AsyncStorage.getAllKeys();
    const snippetKeys = keys.filter(k => k.startsWith(KEY_PREFIX));

    if (snippetKeys.length === 0) {
      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
      return;
    }

    const realm = await realmService.getRealm();
    let totalMigrated = 0;

    for (const key of snippetKeys) {
      const kbId = key.replace(KEY_PREFIX, '');
      const rawSnippets = await AsyncStorage.getItem(key);
      if (rawSnippets) {
        const snippets = JSON.parse(rawSnippets);
        realm.write(() => {
          for (const s of snippets) {
            realm.create('KBSnippet', {
              _id: s.id || uuidv4(),
              kbId,
              text: s.text || '',
              source: JSON.stringify(s.source || {}),
            });
            totalMigrated++;
          }
        });
        // await AsyncStorage.removeItem(key); // Optionally remove old data after migration
      }
    }

    if (totalMigrated > 0) {
      console.log(`[kbSnippetStore] Migration complete. Migrated ${totalMigrated} snippets.`);
    }
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
  } catch (e) {
    console.error('[kbSnippetStore] Snippet migration failed:', e);
  }
};


export async function getSnippets(kbId) {
  try {
    const realm = await realmService.getRealm();
    const snippets = realm.objects('KBSnippet').filtered('kbId == $0', kbId).sorted('createdAt', true);
    return Array.from(snippets);
  } catch (e) {
    console.error('[kbSnippetStore] Failed to get snippets from Realm:', e);
    return [];
  }
}

export async function addSnippet(kbId, snippet) {
  try {
    const realm = await realmService.getRealm();
    let newSnippet;
    realm.write(() => {
      newSnippet = realm.create('KBSnippet', {
        _id: uuidv4(),
        kbId: kbId,
        text: snippet.text || '',
        source: JSON.stringify(snippet.source || {}),
      });
    });
    return newSnippet;
  } catch (e) {
    console.error('[kbSnippetStore] Failed to add snippet to Realm:', e);
    throw e;
  }
}

// helper: build doc shape for local index
export function toDoc(snippet) {
  const source = typeof snippet.source === 'string' ? JSON.parse(snippet.source) : (snippet.source || {});
  const text = (snippet.text || '').slice(0, 2000);
  const title = source?.title || '片段';
  const anchor = source?.anchor || '';
  return {
    id: snippet._id,
    title,
    text,
    source: {
      type: source?.type || 'snippet',
      title,
      anchor,
      uri: source?.uri,
    },
  };
}

export default { getSnippets, addSnippet, toDoc, migrateSnippets };
