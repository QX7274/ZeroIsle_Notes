import realmService from '../database/realmService';
import { SearchIndex } from '../../models';

export const rebuildSearchIndex = async (options = {}) => {
  const {
    includeNotes = true,
    includeKnowledge = true,
    batchSize = 200,
    onProgress,
  } = options;

  const realm = await realmService.getRealm();

  const progress = {
    phase: 'init',
    scanned: 0,
    indexed: 0,
  };

  const report = () => {
    if (typeof onProgress === 'function') {
      onProgress({ ...progress });
    }
  };

  const upsert = (data) => {
    try {
      SearchIndex.createOrUpdate(realm, data);
      progress.indexed += 1;
    } catch (_) {
      // ignore single item
    }
  };

  const clip = (s, n) => {
    const str = String(s || '');
    return str.length > n ? str.slice(0, n) : str;
  };

  progress.phase = 'knowledge_graph';
  report();
  if (includeKnowledge) {
    const graphs = realm.objects('KnowledgeGraph').filtered('is_deleted == false');
    for (let i = 0; i < graphs.length; i++) {
      const g = graphs[i];
      progress.scanned += 1;
      upsert({
        entity_id: String(g._id),
        entity_type: 'knowledge_graph',
        user_id: String(g.user_id || ''),
        title: String(g.title || ''),
        content: clip(g.description, 2000),
        keywords: String(g.title || '').split(/\s+/).filter(w => w.length >= 2).slice(0, 20),
        tags: Array.isArray(g.tags) ? g.tags.map(String) : [],
        category: g.category_id ? String(g.category_id) : null,
        metadata: { type: g.type },
        relevance_score: 1.0,
        language: 'zh-CN',
      });
      if (i % batchSize === 0) {report();}
    }
  }

  progress.phase = 'knowledge_node';
  report();
  if (includeKnowledge) {
    const nodes = realm.objects('KnowledgeNode').filtered('is_deleted == false');
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      progress.scanned += 1;
      upsert({
        entity_id: String(n._id),
        entity_type: 'knowledge_node',
        user_id: String(n.user_id || ''),
        title: String(n.title || ''),
        content: clip(n.content, 2000),
        keywords: String(n.title || '').split(/\s+/).filter(w => w.length >= 2).slice(0, 20),
        tags: Array.isArray(n.tags) ? n.tags.map(String) : [],
        category: null,
        metadata: { graph_id: String(n.graph_id || ''), type: n.type },
        relevance_score: 1.0,
        language: 'zh-CN',
      });
      if (i % batchSize === 0) {report();}
    }
  }

  progress.phase = 'note';
  report();
  if (includeNotes) {
    const notes = realm.objects('Note').filtered('is_deleted == false');
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      progress.scanned += 1;
      upsert({
        entity_id: String(note._id),
        entity_type: 'note',
        user_id: String(note.user_id || ''),
        title: String(note.title || ''),
        content: clip(note.content, 2000),
        keywords: String(note.title || '').split(/\s+/).filter(w => w.length >= 2).slice(0, 20),
        tags: Array.isArray(note.tags) ? note.tags.map(String) : [],
        category: note.category_id ? String(note.category_id) : null,
        metadata: {},
        relevance_score: 1.0,
        language: 'zh-CN',
      });
      if (i % batchSize === 0) {report();}
    }
  }

  progress.phase = 'done';
  report();

  return { ...progress };
};

