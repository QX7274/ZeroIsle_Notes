/**
 * 同步事件常量
 * 定义同步服务使用的事件类型
 */

/**
 * 同步事件类型
 * @enum {string}
 */
export const SYNC_EVENTS = {
  /**
   * 同步开始
   */
  SYNC_STARTED: 'sync:started',

  /**
   * 同步完成
   */
  SYNC_COMPLETED: 'sync:completed',

  /**
   * 同步失败
   */
  SYNC_FAILED: 'sync:failed',

  /**
   * 同步进度更新
   */
  SYNC_PROGRESS: 'sync:progress',

  /**
   * 离线队列处理开始
   */
  QUEUE_PROCESSING_STARTED: 'queue:processing_started',

  /**
   * 离线队列处理完成
   */
  QUEUE_PROCESSING_COMPLETED: 'queue:processing_completed',

  /**
   * 离线队列处理失败
   */
  QUEUE_PROCESSING_FAILED: 'queue:processing_failed',

  /**
   * 从服务器拉取更新开始
   */
  PULL_STARTED: 'pull:started',

  /**
   * 从服务器拉取更新完成
   */
  PULL_COMPLETED: 'pull:completed',

  /**
   * 从服务器拉取更新失败
   */
  PULL_FAILED: 'pull:failed',

  /**
   * 添加离线操作
   */
  OFFLINE_OPERATION_ADDED: 'offline:operation_added',

  /**
   * 网络状态变化
   */
  NETWORK_STATUS_CHANGED: 'network:status_changed',
};

export default SYNC_EVENTS;
