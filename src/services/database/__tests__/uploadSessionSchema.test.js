import { getRealmConfig } from '../realmConfig';
import { UploadSessionSchema } from '../realmModels';

describe('UploadSession schema migration contract', () => {
  test('persists note and final attachment ownership fields at schema version 19', () => {
    const schema = UploadSessionSchema.properties;
    const config = getRealmConfig();

    expect(schema.noteId).toBe('string?');
    expect(schema.attachmentId).toBe('string?');
    expect(config.schemaVersion).toBe(19);
  });
});
