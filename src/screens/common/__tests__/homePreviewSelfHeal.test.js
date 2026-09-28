/**
 * 列表「未打标自愈」调度器单测（里程碑 5.1 收尾 / WS-N）
 *
 * 控制器实现放在 services/notes/backfillNotePreviewMetadata.js（write scope 内唯一可新增逻辑的源文件），
 * 但它是列表侧的调度逻辑，因此按任务要求把用例放在 src/screens/common/__tests__ 下。
 *
 * 覆盖：
 * 1. 首次检测 -> 触发一次；in-flight 期间再次检测 -> 不触发；会话内已尝试过 -> 不触发（防循环）；
 * 2. updated > 0 -> 重载一次；updated == 0 -> 不重载；
 * 3. 回填抛错被吞掉、不重载、不影响调用方（返回值里带 reason）；
 * 4. 10 万次反复检测 + 重载后再检测的循环场景 -> 回填/重载次数恒为 1；
 * 5. 卸载取消（isCancelled）-> 不触发/不重载；maxAttempts 可配置。
 */

const {
  DEFAULT_SELF_HEAL_MAX_ATTEMPTS,
  withPreviewSelfHealFlag,
  createPreviewSelfHealController,
} = require('../../../services/notes/backfillNotePreviewMetadata');

/** 静默 logger，避免测试输出噪音（同时用于断言告警） */
const createLogger = () => ({ log: jest.fn(), warn: jest.fn() });

describe('withPreviewSelfHealFlag 自愈标记契约', () => {
  test('在回退结果上附加 needsPreviewSelfHeal / untaggedCount，且不改变原数据', async () => {
    const payload = { success: true, data: [{ _id: 'n1' }], isOffline: true };

    await expect(withPreviewSelfHealFlag(Promise.resolve(payload), 3)).resolves.toEqual({
      ...payload,
      needsPreviewSelfHeal: true,
      untaggedCount: 3,
    });
    // 不修改入参对象
    expect(payload).toEqual({ success: true, data: [{ _id: 'n1' }], isOffline: true });
  });

  test('原 Promise reject 时原样透传（loadNotes 既有错误处理不受影响）', async () => {
    await expect(
      withPreviewSelfHealFlag(Promise.reject(new Error('getAllNotes 失败')), 1),
    ).rejects.toThrow('getAllNotes 失败');
  });

  test('非对象结果原样返回，不强行包装', async () => {
    await expect(withPreviewSelfHealFlag(Promise.resolve(null), 1)).resolves.toBeNull();
    await expect(withPreviewSelfHealFlag(Promise.resolve(undefined), 1)).resolves.toBeUndefined();
  });
});

describe('createPreviewSelfHealController 未打标自愈', () => {
  test('默认会话尝试上限为 1', () => {
    expect(DEFAULT_SELF_HEAL_MAX_ATTEMPTS).toBe(1);
  });

  test('首次检测触发一次回填；updated>0 时只重载一次', async () => {
    const backfill = jest.fn(async () => ({ scanned: 10, updated: 3, failed: 0, batches: 1 }));
    const reload = jest.fn();
    const logger = createLogger();
    const controller = createPreviewSelfHealController({ backfill, reload, logger });

    const result = await controller.handleUntagged('home-list');

    expect(backfill).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ triggered: true, updated: 3, reloaded: true, reason: 'reloaded' });
    expect(logger.log).toHaveBeenCalled();
    expect(controller.getAttempts()).toBe(1);
    expect(controller.isInFlight()).toBe(false);
  });

  test('in-flight 去重：并发触发只跑一次回填', async () => {
    let resolveBackfill;
    const backfill = jest.fn(() => new Promise((resolve) => {
      resolveBackfill = resolve;
    }));
    const reload = jest.fn();
    const controller = createPreviewSelfHealController({ backfill, reload, logger: createLogger() });

    const first = controller.handleUntagged('first');
    const second = controller.handleUntagged('second');

    expect(controller.isInFlight()).toBe(true);
    await expect(second).resolves.toEqual({
      triggered: false,
      updated: 0,
      reloaded: false,
      reason: 'in-flight',
    });
    expect(backfill).toHaveBeenCalledTimes(1);

    resolveBackfill({ updated: 0 });
    await expect(first).resolves.toMatchObject({ triggered: true, updated: 0, reloaded: false });
    expect(controller.isInFlight()).toBe(false);
  });

  test('会话内已尝试过（updated == 0）-> 不再触发、不重载', async () => {
    const backfill = jest.fn(async () => ({ scanned: 5, updated: 0, failed: 0, batches: 1 }));
    const reload = jest.fn();
    const controller = createPreviewSelfHealController({ backfill, reload, logger: createLogger() });

    await expect(controller.handleUntagged('a')).resolves.toEqual({
      triggered: true,
      updated: 0,
      reloaded: false,
      reason: 'nothing-updated',
    });
    await expect(controller.handleUntagged('b')).resolves.toEqual({
      triggered: false,
      updated: 0,
      reloaded: false,
      reason: 'attempts-exhausted',
    });

    expect(backfill).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  test('回填抛错被吞掉：不重载、不抛出、只记日志', async () => {
    const backfill = jest.fn(async () => {
      throw new Error('realm 打开失败');
    });
    const reload = jest.fn();
    const logger = createLogger();
    const controller = createPreviewSelfHealController({ backfill, reload, logger });

    await expect(controller.handleUntagged('boom')).resolves.toEqual({
      triggered: true,
      updated: 0,
      reloaded: false,
      reason: 'failed',
    });
    expect(reload).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('reload 抛错/返回 rejected Promise 都被吞掉，不影响调用方', async () => {
    const syncThrow = createPreviewSelfHealController({
      backfill: async () => ({ updated: 1 }),
      reload: () => {
        throw new Error('sync reload failure');
      },
      logger: createLogger(),
    });
    await expect(syncThrow.handleUntagged('sync')).resolves.toEqual({
      triggered: true,
      updated: 1,
      reloaded: false,
      reason: 'reload-failed',
    });

    const asyncThrow = createPreviewSelfHealController({
      backfill: async () => ({ updated: 1 }),
      reload: async () => {
        throw new Error('async reload failure');
      },
      logger: createLogger(),
    });
    await expect(asyncThrow.handleUntagged('async')).resolves.toMatchObject({
      triggered: true,
      updated: 1,
      reloaded: true,
    });
  });

  test('防循环：10 万次反复检测 + 重载后再次检测，回填/重载次数恒为 1', async () => {
    let controller;
    const backfill = jest.fn(async () => ({ scanned: 100000, updated: 7, failed: 0, batches: 500 }));
    const reload = jest.fn(() => {
      // 模拟「重载后仍然检测到未打标」——不得再次触发回填/重载
      controller.handleUntagged('reload-detected');
    });
    controller = createPreviewSelfHealController({ backfill, reload, logger: createLogger() });

    for (let i = 0; i < 100000; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await controller.handleUntagged('home-list');
    }
    // 让 reload 里的异步触发有机会执行
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(backfill).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(controller.getAttempts()).toBe(1);
  });

  test('重载后的下一次检测即使不在 in-flight 中，也被会话上限挡住', async () => {
    let controller;
    const backfill = jest.fn(async () => ({ updated: 2 }));
    const reload = jest.fn(() => {
      setTimeout(() => {
        controller.handleUntagged('after-reload');
      }, 0);
    });
    controller = createPreviewSelfHealController({ backfill, reload, logger: createLogger() });

    await controller.handleUntagged('home-list');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(backfill).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('组件卸载（isCancelled）后不再触发，也不重载', async () => {
    let cancelled = false;
    const backfill = jest.fn(async () => ({ updated: 0 }));
    const reload = jest.fn();
    const controller = createPreviewSelfHealController({
      backfill,
      reload,
      logger: createLogger(),
      isCancelled: () => cancelled,
    });

    cancelled = true;
    await expect(controller.handleUntagged('unmounted')).resolves.toEqual({
      triggered: false,
      updated: 0,
      reloaded: false,
      reason: 'cancelled',
    });
    expect(backfill).not.toHaveBeenCalled();

    // 回填期间卸载：完成时不得再重载
    cancelled = false;
    const pending = controller.handleUntagged('mounted');
    cancelled = true;
    await expect(pending).resolves.toMatchObject({ triggered: true, reloaded: false, reason: 'cancelled' });
    expect(reload).not.toHaveBeenCalled();
  });

  test('maxAttempts 可配置：用完上限后才拒绝', async () => {
    const backfill = jest.fn(async () => ({ updated: 0 }));
    const controller = createPreviewSelfHealController({
      backfill,
      reload: jest.fn(),
      maxAttempts: 3,
      logger: createLogger(),
    });

    await controller.handleUntagged('1');
    await controller.handleUntagged('2');
    await controller.handleUntagged('3');
    await expect(controller.handleUntagged('4')).resolves.toMatchObject({
      triggered: false,
      reason: 'attempts-exhausted',
    });
    expect(backfill).toHaveBeenCalledTimes(3);
    expect(controller.getAttempts()).toBe(3);
  });
});
