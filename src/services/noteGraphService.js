import realmService from './database/realmService';

/**
 * Builds a graph structure from notes with wiki-links.
 * @returns {Promise<{nodes: Array, edges: Array}>}
 */
export const buildGraphFromNotes = async () => {
  try {
    const realm = await realmService.getRealm();
    const allNotes = realm.objects('Note');

    const nodes = allNotes.map(note => ({
      id: note._id,
      label: note.title,
      type: 'note',
      linkCount: 0, // Initialize link count
      updated_at: note.updated_at,
    }));

    const edges = [];
    const noteMap = new Map(nodes.map(node => [node.id, node]));
    const noteTitleMap = new Map(allNotes.map(note => [note.title, note._id]));

    for (const note of allNotes) {
      if (note.content) {
        const linkRegex = /\[\[([^\]]+)\]\]/g;
        let match;
        while ((match = linkRegex.exec(note.content)) !== null) {
          const linkedTitle = match[1];
          const targetId = noteTitleMap.get(linkedTitle);
          if (targetId && targetId !== note._id) {
            edges.push({
              id: `${note._id}->${targetId}`,
              source: note._id,
              target: targetId,
              label: 'links to',
            });
            // Increment link count for both source and target nodes
            const sourceNode = noteMap.get(note._id);
            const targetNode = noteMap.get(targetId);
            if (sourceNode) {sourceNode.linkCount++;}
            if (targetNode) {targetNode.linkCount++;}
          }
        }
      }
    }

    return { nodes, edges };
  } catch (error) {
    console.error('Failed to build graph from notes:', error);
    return { nodes: [], edges: [] };
  }
};

export default {
  buildGraphFromNotes,
};

