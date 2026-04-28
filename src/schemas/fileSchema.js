/**
 * 文件模式定义
 */


/**
 * 文件模式
 */
const FileSchema = {
  name: 'File',
  primaryKey: '_id',
  properties: {
    _id: { type: 'string' },
    name: { type: 'string', default: '' },
    original_name: { type: 'string', default: '' },
    path: { type: 'string', default: '' },
    size: { type: 'int', default: 0 },
    mime_type: { type: 'string', default: '' },
    extension: { type: 'string', default: '' },
    type: { type: 'string', default: 'other' }, // image, document, audio, video, other
    hash: { type: 'string', optional: true },
    thumbnail_path: { type: 'string', optional: true },
    metadata: { type: 'dictionary', default: {} },
    storage_location: { type: 'string', default: 'local' }, // local, cloud, both
    cloud_path: { type: 'string', optional: true },
    cloud_provider: { type: 'string', optional: true },
    user_id: { type: 'string', optional: true },
    note_id: { type: 'string', optional: true },
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    deleted_at: { type: 'date', optional: true },
    last_accessed_at: { type: 'date', optional: true },
    is_public: { type: 'bool', default: false },
    public_url: { type: 'string', optional: true },
    expiry_date: { type: 'date', optional: true },
    tags: { type: 'list', objectType: 'string', default: [] },
    _partition: { type: 'string', default: 'files' },
  },
};

export default FileSchema;
