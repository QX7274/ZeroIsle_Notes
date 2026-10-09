/**
 * 撤销/重做「动作栈」回归测试（P1）。
 *
 * 背景：这是**运行期探针**才暴露的缺陷 ——
 *   原生两侧都只有「strokes 列表 <-> redoStack 末尾进出」的伪历史。
 *   用户「删除选中笔迹」时笔迹只是被压进 redoStack，而 undo() 是无条件弹出
 *   strokes 列表**末尾**那条 => 撤销撤掉的是列表末尾的无辜笔迹，
 *   真正被删的反而永远回不来；按钮还一直亮着（canUndo 只看列表非空）。
 *   探针实测（Android 无限画布）：delete 后 undo，strokeCount 仍是 2、期望 3。
 *
 * 本测试把「三类动作都必须可撤销」这一约束钉死在四个原生实现上，
 * 防止退回「删得掉、撤不回」。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const ANDROID_PAGED =
  'android/app/src/main/java/com/zeroisle_notes/nativepaged/NativePagedNoteView.java';
const ANDROID_INFINITE =
  'android/app/src/main/java/com/zeroisle_notes/nativeinfinite/NativeInfiniteCanvasView.java';
const IOS_INFINITE = 'ios/NativeInfiniteCanvasView/NativeInfiniteCanvasView.m';
const IOS_PAGED = 'ios/NativePagedNoteView/NativePagedNoteView.m';

/** 取某方法之后的源码片段，用于只在局部断言。 */
const sliceFrom = (src, marker, length = 6000) => {
  const at = src.indexOf(marker);
  return at < 0 ? '' : src.slice(at, at + length);
};

describe('Android 分页：撤销必须处理删除/清空动作', () => {
  const src = readSrc(ANDROID_PAGED);

  it('PageData 持有动作栈，且动作类型覆盖 add/remove/clear', () => {
    expect(src).toContain('List<HistoryAction> undoStack');
    expect(src).toContain('ADD_STROKE');
    expect(src).toContain('REMOVE_STROKE');
    expect(src).toContain('CLEAR');
  });

  it('undo 不再是「无条件弹出列表末尾」', () => {
    expect(src).not.toContain('pageData.strokes.remove(pageData.strokes.size() - 1)');
  });

  it('applyUndo / applyRedo 覆盖 REMOVE_STROKE 与 CLEAR 分支', () => {
    const undo = sliceFrom(src, 'private void applyUndo(');
    const redo = sliceFrom(src, 'private void applyRedo(');
    for (const body of [undo, redo]) {
      expect(body).toContain('case REMOVE_STROKE:');
      expect(body).toContain('case CLEAR:');
      expect(body).toContain('case ADD_STROKE:');
    }
  });

  it('deleteSelectedStrokes 记录带原下标的 REMOVE_BATCH 复合动作', () => {
    const body = sliceFrom(src, 'public void deleteSelectedStrokes(');
    expect(body).toContain('HistoryAction.Type.REMOVE_BATCH');
    expect(body).toContain('indexOf(s)');
    expect(body).not.toContain('HistoryAction.Type.REMOVE_STROKE');
  });

  it('clear() 在清空前记录 CLEAR 动作', () => {
    const body = sliceFrom(src, 'public void clear(String scope)');
    expect(body).toContain('new HistoryAction(');
    expect(body).toContain('new ArrayList<>(pageData.strokes)');
  });

  it('canUndo 看动作栈，而不是「列表非空」', () => {
    const body = sliceFrom(src, 'private void sendHistoryStateChangeEvent()');
    expect(body).toContain('canUndo = pageData.undoStack != null && !pageData.undoStack.isEmpty()');
  });

  it('批量删除/复制各记成一条复合动作，一次 undo 整批进出', () => {
    const del = sliceFrom(src, 'public void deleteSelectedStrokes(');
    const dup = sliceFrom(src, 'public void duplicateSelectedStrokes(');
    expect(del).toContain('HistoryAction.Type.REMOVE_BATCH, new ArrayList<>(removed), removedAt');
    expect(dup).toContain('HistoryAction.Type.ADD_BATCH, new ArrayList<>(copies), copyIndices');
    // 关键：删除时不得在循环里逐条入栈（那会让一次 undo 只还原一条）——
    // 在「删除方法」与「复制方法」之间只允许出现一次入栈调用。
    const delOnly = src.slice(src.indexOf('public void deleteSelectedStrokes('),
                             src.indexOf('public void duplicateSelectedStrokes('));
    const pushes = delOnly.split('pushHistoryAction(pageData, new HistoryAction(').length - 1;
    expect(pushes).toBe(1);
    // 循环体内不得入栈：取 for 头到其后第一个 '}' 之间。
    const loopAt = delOnly.indexOf('for (StrokeData s : removed)');
    expect(loopAt).toBeGreaterThan(-1);
    const loopEnd = delOnly.indexOf('}', loopAt);
    expect(delOnly.slice(loopAt, loopEnd)).not.toContain('pushHistoryAction');
    const undo = sliceFrom(src, 'private void applyUndo(');
    const redo = sliceFrom(src, 'private void applyRedo(');
    expect(undo).toContain('case REMOVE_BATCH:');
    expect(undo).toContain('case ADD_BATCH:');
    expect(redo).toContain('case REMOVE_BATCH:');
    expect(redo).toContain('case ADD_BATCH:');
    expect(src).toContain('private void restoreBatch(PageData pageData, HistoryAction action)');
    expect(src).toContain('private void removeBatch(PageData pageData, HistoryAction action)');
  });

  it('新动作入栈会清空 redoStack（重做失效语义）', () => {
    const body = sliceFrom(src, 'private void pushHistoryAction(');
    expect(body).toContain('pageData.redoStack.clear()');
  });
});

describe('Android 无限画布：撤销必须处理删除/清空动作', () => {
  const src = readSrc(ANDROID_INFINITE);

  it('HistoryAction 记录下标与笔迹数据', () => {
    expect(src).toContain('int index');
  });

  it('undo 覆盖 REMOVE_STROKE，redo 覆盖 ADD_STROKE', () => {
    const undo = sliceFrom(src, 'public void undo()');
    expect(undo).toContain('case REMOVE_STROKE:');
    expect(undo).toContain('case ADD_STROKE:');
  });

  it('canUndo 看 undoStack', () => {
    expect(src).toContain('canUndo", !undoStack.isEmpty()');
  });

  it('批量删除/复制各记成一条复合动作', () => {
    const del = sliceFrom(src, 'public void deleteSelectedStrokes(');
    const dup = sliceFrom(src, 'public void duplicateSelectedStrokes(');
    expect(del).toContain('HistoryAction.Type.REMOVE_BATCH, new ArrayList<>(removed), removedAt');
    expect(dup).toContain('HistoryAction.Type.ADD_BATCH, new ArrayList<>(copies), copyIndices');
    expect(src).toContain('case REMOVE_BATCH:');
    expect(src).toContain('case ADD_BATCH:');
    expect(src).toContain('private void restoreBatch(HistoryAction action)');
    expect(src).toContain('private void removeBatch(HistoryAction action)');
  });
});

describe('iOS 无限画布：撤销必须处理删除/清空动作', () => {
  const src = readSrc(IOS_INFINITE);

  it('新增 undoStack 动作栈', () => {
    expect(src).toContain('NSMutableArray *undoStack;');
    expect(src).toContain('_undoStack = [NSMutableArray array]');
  });

  it('pushHistoryAction 会清空 redoStack', () => {
    const body = sliceFrom(src, '- (void)pushHistoryAction:(NSDictionary *)action\n{');
    expect(body).toContain('redoStack');
    expect(body).toContain('removeAllObjects');
  });

  it('undo/redo 覆盖 add/remove/clear 三种动作', () => {
    const undo = sliceFrom(src, '- (void)undo {');
    const redo = sliceFrom(src, '- (void)redo {');
    expect(undo).toContain('@"remove"');
    expect(undo).toContain('@"clear"');
    expect(redo).toContain('@"add"');
    expect(redo).toContain('@"remove"');
    expect(redo).toContain('@"clear"');
  });

  it('deleteSelectedStrokes 不再直接清空 redoStack（退路由动作栈接管）', () => {
    const body = sliceFrom(src, '- (void)deleteSelectedStrokes:');
    expect(body.indexOf('redoStack')).toBe(-1);
  });

  it('emitHistoryStateChange 的 canUndo 看 undoStack', () => {
    const body = sliceFrom(src, '- (void)emitHistoryStateChange');
    expect(body).toContain('undoStack.count > 0');
  });

  it('批量删除/复制各记成一条复合动作，undo/redo 覆盖 remove_batch/add_batch', () => {
    const del = sliceFrom(src, '- (void)deleteSelectedStrokes:');
    expect(del).toContain('@"remove_batch"');
    expect(del).not.toContain('@"type": @"remove"');
    const dup = sliceFrom(src, '- (void)duplicateSelectedStrokes:');
    expect(dup).toContain('@"add_batch"');
    expect(dup).not.toContain('@"type": @"add"');
    const undo = sliceFrom(src, '- (void)undo {');
    const redo = sliceFrom(src, '- (void)redo {');
    for (const body of [undo, redo]) {
      expect(body).toContain('@"remove_batch"');
      expect(body).toContain('@"add_batch"');
    }
    expect(src).toContain('- (void)restoreBatchEntries:(NSDictionary *)action');
    expect(src).toContain('- (void)removeBatchEntries:(NSDictionary *)action');
  });
});

describe('iOS 分页：历史按页持有，删除可撤销', () => {
  const src = readSrc(IOS_PAGED);

  it('每页字典带 history/redo 两个动作栈', () => {
    expect(src).toContain('@"history"');
    expect(src).toContain('@"redo"');
  });

  it('提供懒创建的按页动作栈访问器（兼容无 history 键的老文档）', () => {
    expect(src).toContain('undoStackForPage');
  });

  it('全局 redoStack 不再是任何页的撤销退路', () => {
    expect(src.indexOf('self.redoStack')).toBe(-1);
  });

  it('undo 覆盖 remove 与 clear 动作', () => {
    const undo = sliceFrom(src, '- (void)undo {');
    expect(undo).toContain('@"remove"');
    expect(undo).toContain('@"clear"');
  });

  it('批量删除/复制各记成一条复合动作（本页历史）', () => {
    const del = sliceFrom(src, '- (void)deleteSelectedStrokes:');
    expect(del).toContain('@"remove_batch"');
    expect(del).not.toContain('@"type": @"remove"');
    const dup = sliceFrom(src, '- (void)duplicateSelectedStrokes:');
    expect(dup).toContain('@"add_batch"');
    expect(dup).not.toContain('@"type": @"add"');
    const undo = sliceFrom(src, '- (void)undo {');
    const redo = sliceFrom(src, '- (void)redo {');
    expect(undo).toContain('@"remove_batch"');
    expect(undo).toContain('@"add_batch"');
    expect(redo).toContain('@"remove_batch"');
    expect(redo).toContain('@"add_batch"');
    expect(src).toContain('- (void)restoreBatchEntries:(NSDictionary *)action strokes:(NSMutableArray *)strokes');
    expect(src).toContain('- (void)removeBatchEntries:(NSDictionary *)action strokes:(NSMutableArray *)strokes');
  });
});
