import { getRealmConfig } from '../realmConfig';
import { UploadSessionSchema } from '../realmModels';

describe('UploadSession schema migration contract', () => {
  test('persists note and final attachment ownership fields at schema version 20', () => {
    const schema = UploadSessionSchema.properties;
    const config = getRealmConfig();

    expect(schema.noteId).toBe('string?');
    expect(schema.attachmentId).toBe('string?');
    // 19 -> 20（WS-T：新增 Note.last_opened_at）；这里仍然断言「当前确切版本」，
    // 每次提版本都需要同步更新本契约。
    expect(config.schemaVersion).toBe(20);
  });
});
