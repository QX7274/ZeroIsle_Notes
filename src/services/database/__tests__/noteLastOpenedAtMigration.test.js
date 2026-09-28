import { getRealmConfig } from '../realmConfig';
import { NoteSchema } from '../realmModels';

/**
 * WS-T：Note.last_opened_at 落库（「最近访问」排序可下推 Realm）的 schema 与迁移契约。
 *
 * 迁移安全性是本用例的重点：v19 -> v20 只是「新增可选属性」，
 * 必须只记录日志、**不遍历全表写值**（否则 10 万条库会被迁移阻塞）。
 */
describe('Note.last_opened_at schema 与 v20 迁移契约（WS-T）', () => {
  test('运行时 schema 声明可选字段 last_opened_at', () => {
    expect(NoteSchema.properties.last_opened_at).toBe('date?');
  });

  test('schemaVersion 提升到 20', () => {
    expect(getRealmConfig().schemaVersion).toBe(20);
  });

  test('v19 → v20 迁移分支存在：只记录日志，不遍历全表写值', () => {
    const config = getRealmConfig();
    const oldRealm = { schemaVersion: 19, objects: jest.fn(() => []) };
    const newRealm = { schemaVersion: 20, objects: jest.fn(() => []) };
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});

    expect(() => config.migration(oldRealm, newRealm)).not.toThrow();

    const logged = info.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('迁移到版本 20');
    expect(logged).toContain('last_opened_at');

    // 新增可选属性由 Realm 自动补 null：迁移分支不得读取/重写任何对象
    expect(oldRealm.objects).not.toHaveBeenCalled();
    expect(newRealm.objects).not.toHaveBeenCalled();

    info.mockRestore();
  });

  test('任意旧版本（含远古库）迁移都不抛错，最终仍落到版本 20', () => {
    const config = getRealmConfig();
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    [1, 5, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19].forEach((oldVersion) => {
      const oldRealm = { schemaVersion: oldVersion, objects: () => [] };
      const newRealm = { schemaVersion: 20, objects: () => [] };

      expect(() => config.migration(oldRealm, newRealm)).not.toThrow();
    });

    info.mockRestore();
    warn.mockRestore();
  });

  test('迁移分支不修改 newRealm.schemaVersion（由 Realm 自身管理）', () => {
    const config = getRealmConfig();
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const oldRealm = { schemaVersion: 19, objects: () => [] };
    const newRealm = { schemaVersion: 20, objects: () => [] };

    config.migration(oldRealm, newRealm);

    expect(oldRealm.schemaVersion).toBe(19);
    expect(newRealm.schemaVersion).toBe(20);
    info.mockRestore();
  });
});
