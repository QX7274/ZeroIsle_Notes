/**
 * 同步错误恢复策略
 * 提供同步错误的统一分类、指数退避重试（可取消）以及 Client Reset 前的本地数据备份能力
 *
 * 设计原则：
 * 1. 所有外部依赖（时间、休眠、文件系统、随机数）都可注入，保证纯单元测试不依赖原生模块
 * 2. 分类结果只暴露 { category, retryable, userMessage } 三个字段，调用方无需感知内部判定细节
 * 3. 不可重试的错误（认证 / 权限 / 会话过期 / Client Reset）立即短路，不做无意义的循环重试
 * 4. 备份失败必须抛出明确错误，绝不静默丢弃本地数据
 */

/**
 * 同步错误分类枚举
 * @enum {string}
 */
export const SYNC_ERROR_CATEGORIES = {
  /** 网络不可达 / 超时 / 离线 */
  NETWORK: 'network',
  /** 未认证（401 等），需要登录 */
  AUTH: 'auth',
  /** 无权限（403 等），登录也解决不了 */
  PERMISSION: 'permission',
  /** 会话/令牌过期，需要重新登录 */
  SESSION_EXPIRED: 'sessionExpired',
  /** Realm Client Reset，需要先备份再重置 */
  CLIENT_RESET: 'clientReset',
  /** 版本冲突 / 唯一键冲突，刷新后可重试 */
  CONFLICT: 'conflict',
  /** 服务端错误（429/5xx 等），可退避重试 */
  SERVER: 'server',
  /** 无法识别的错误，保守处理为不可重试 */
  UNKNOWN: 'unknown',
};

/**
 * 各分类的默认重试策略与用户提示文案
 * retryable 为 false 的分类表示：重试无法解决问题，应立即短路并把错误交回上层
 */
const CATEGORY_PRESETS = {
  [SYNC_ERROR_CATEGORIES.NETWORK]: {
    retryable: true,
    userMessage: '网络连接异常，请检查网络后重试',
  },
  [SYNC_ERROR_CATEGORIES.AUTH]: {
    retryable: false,
    userMessage: '登录状态无效，请重新登录后再同步',
  },
  [SYNC_ERROR_CATEGORIES.PERMISSION]: {
    retryable: false,
    userMessage: '当前账号没有同步权限，请联系管理员',
  },
  [SYNC_ERROR_CATEGORIES.SESSION_EXPIRED]: {
    retryable: false,
    userMessage: '登录已过期，请重新登录后再同步',
  },
  [SYNC_ERROR_CATEGORIES.CLIENT_RESET]: {
    retryable: false,
    userMessage: '检测到服务端要求重置客户端数据，本地备份已保留待恢复',
  },
  [SYNC_ERROR_CATEGORIES.CONFLICT]: {
    retryable: true,
    userMessage: '数据版本冲突，正在重试合并',
  },
  [SYNC_ERROR_CATEGORIES.SERVER]: {
    retryable: true,
    userMessage: '服务器暂时不可用，请稍后重试',
  },
  [SYNC_ERROR_CATEGORIES.UNKNOWN]: {
    retryable: false,
    userMessage: '同步失败，请稍后重试',
  },
};

/** 默认退避参数：基础 500ms、上限 30s、不抖动 */
export const DEFAULT_BACKOFF_OPTIONS = {
  baseMs: 500,
  maxMs: 30000,
  jitter: 0,
};

/** 结构化错误码：网络类 */
const NETWORK_CODES = [
  'NETWORK_ERROR',
  'ERR_NETWORK',
  'ERR_INTERNET_DISCONNECTED',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_RESET',
  'ERR_NAME_NOT_RESOLVED',
  'ERR_SOCKET_TIMEOUT',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
];

/** 结构化错误码：会话过期（优先于普通认证错误） */
const SESSION_EXPIRED_CODES = [
  'SESSION_EXPIRED',
  'SESSIONEXPIRED',
  'TOKEN_EXPIRED',
  'TOKENEXPIRED',
  'REFRESH_TOKEN_EXPIRED',
  'INVALID_GRANT',
  'JWT_EXPIRED',
];

/** 结构化错误码：认证 */
const AUTH_CODES = [
  'UNAUTHORIZED',
  'UNAUTHENTICATED',
  'AUTH_REQUIRED',
  'AUTHENTICATION_FAILED',
  'INVALID_CREDENTIALS',
  'NOT_AUTHENTICATED',
  'NO_TOKEN',
];

/** 结构化错误码：权限 */
const PERMISSION_CODES = [
  'FORBIDDEN',
  'PERMISSION_DENIED',
  'ACCESS_DENIED',
  'NOT_ALLOWED',
];

/** 结构化错误码：冲突（含 MongoDB 唯一键冲突 11000） */
const CONFLICT_CODES = [
  'CONFLICT',
  'VERSION_CONFLICT',
  'STALE_VERSION',
  'DUPLICATE_KEY',
  'E11000',
  '11000',
];

/** 结构化错误码：Realm Client Reset（含 Realm 历史上的 211） */
const CLIENT_RESET_CODES = [
  'CLIENT_RESET',
  'CLIENTRESET',
  'REALM_SYNC_CLIENT_RESET',
  '211',
];

/** 结构化错误码：服务端 */
const SERVER_CODES = [
  'INTERNAL_SERVER_ERROR',
  'SERVER_ERROR',
  'SERVICE_UNAVAILABLE',
  'BAD_GATEWAY',
  'GATEWAY_TIMEOUT',
  'RATE_LIMITED',
  'TOO_MANY_REQUESTS',
];

/** 错误名：Realm Client Reset */
const CLIENT_RESET_NAMES = ['CLIENTRESETERROR', 'CLIENTRESET'];

/** 错误名：会话过期 */
const SESSION_EXPIRED_NAMES = ['SESSIONEXPIREDERROR', 'SESSIONEXPIRED', 'TOKENEXPIREDERROR'];

/** 错误名：认证 */
const AUTH_NAMES = ['UNAUTHORIZEDERROR', 'AUTHENTICATIONERROR', 'NOTAUTHENTICATEDERROR'];

/** 错误名：权限 */
const PERMISSION_NAMES = ['FORBIDDENERROR', 'PERMISSIONDENIEDERROR', 'PERMISSIONERROR'];

/** 错误名：冲突 */
const CONFLICT_NAMES = ['CONFLICTERROR', 'VERSIONCONFLICTERROR'];

/** 错误名：服务端 */
const SERVER_NAMES = ['SERVERERROR', 'SERVICEUNAVAILABLEERROR', 'BADGATEWAYERROR'];

/** 消息关键字：Client Reset */
const CLIENT_RESET_KEYWORDS = [
  'client reset',
  'clientreset',
  'client_reset',
  '客户端重置',
  '客户端数据重置',
];

/** 消息关键字：会话过期 */
const SESSION_EXPIRED_KEYWORDS = [
  'session expired',
  'sessionexpired',
  'token expired',
  'tokenexpired',
  'refresh token',
  'invalid_grant',
  'jwt expired',
  '会话已过期',
  '登录已过期',
  '登录状态失效',
];

/** 消息关键字：认证 */
const AUTH_KEYWORDS = [
  'unauthorized',
  'unauthenticated',
  'authentication failed',
  'invalid credentials',
  'not logged in',
  'missing token',
  'no token',
  '未登录',
  '认证失败',
  '鉴权失败',
];

/** 消息关键字：权限 */
const PERMISSION_KEYWORDS = [
  'forbidden',
  'permission denied',
  'access denied',
  'not permitted',
  '无权限',
  '权限不足',
  '禁止访问',
];

/** 消息关键字：冲突 */
const CONFLICT_KEYWORDS = [
  'conflict',
  'version mismatch',
  'stale version',
  'already exists',
  'duplicate key',
  '冲突',
  '版本不一致',
  '已被修改',
];

/** 消息关键字：网络 */
const NETWORK_KEYWORDS = [
  'network',
  'connection',
  'timeout',
  'timed out',
  'unreachable',
  'refused',
  'aborted',
  'disconnected',
  'offline',
  'no internet',
  'failed to fetch',
  'socket hang up',
  '网络',
  '连接',
  '超时',
  '离线',
];

/** 消息关键字：服务端 */
const SERVER_KEYWORDS = [
  'internal server error',
  'service unavailable',
  'bad gateway',
  'gateway timeout',
  'too many requests',
  'rate limit',
  'server error',
  '服务端',
  '服务器错误',
  '服务不可用',
  '请求过于频繁',
];

/**
 * 判断是否为非空字符串
 * @param {*} value 待判断的值
 * @returns {boolean} 是否为非空字符串
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 归一化为正数，非法入参回退到 fallback（保证退避计算不会出现 NaN/负数）
 * @param {*} value 原始值
 * @param {number} fallback 回退值
 * @returns {number} 正数
 */
function normalizePositiveNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return num;
}

/**
 * 归一化为非负整数，非法入参回退到 fallback
 * @param {*} value 原始值
 * @param {number} fallback 回退值
 * @returns {number} 非负整数
 */
function normalizeNonNegativeInteger(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return fallback;
  }
  return Math.floor(num);
}

/**
 * 将数值收敛到 [0, 1]
 * @param {*} value 原始值
 * @returns {number} 收敛后的比例值
 */
function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.min(1, Math.max(0, num));
}

/**
 * 收集错误文本（消息、错误名、响应体文案），统一小写，用于关键字匹配
 * @param {*} error 错误对象或字符串
 * @returns {string} 小写错误文本
 */
function buildErrorText(error) {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return error.toLowerCase();
  }

  if (typeof error !== 'object') {
    return String(error).toLowerCase();
  }

  const parts = [
    error.message,
    error.reason && typeof error.reason === 'object' ? error.reason.message : error.reason,
    error.name,
    error.response && typeof error.response === 'object' ? error.response.data : undefined,
    error.response && error.response.data ? error.response.data.message : undefined,
    error.response && error.response.data ? error.response.data.error : undefined,
    error.response && error.response.data ? error.response.data.error_description : undefined,
    error.cause && error.cause.message,
  ];

  return parts.filter(isNonEmptyString).join(' | ').toLowerCase();
}

/**
 * 提取 HTTP 状态码（top-level status / axios response.status / 嵌套 cause）
 * @param {*} error 错误对象
 * @returns {number|null} 合法状态码或 null
 */
function extractStatus(error) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidates = [
    error.status,
    error.statusCode,
    error.response && error.response.status,
    error.response && error.response.statusCode,
    error.cause && error.cause.response && error.cause.response.status,
  ];

  for (const candidate of candidates) {
    const num = Number(candidate);
    if (Number.isFinite(num) && num >= 100 && num <= 599) {
      return num;
    }
  }

  return null;
}

/**
 * 提取错误码列表（统一转字符串，兼容 Realm/Mongo 的数字码）
 * @param {*} error 错误对象
 * @returns {Array<string>} 错误码列表
 */
function extractCodes(error) {
  if (!error || typeof error !== 'object') {
    return [];
  }

  const raw = [
    error.code,
    error.errorCode,
    error.reason && error.reason.code,
    error.response && error.response.data ? error.response.data.code : undefined,
    error.cause && error.cause.code,
  ];

  return raw
    .filter(value => value !== undefined && value !== null)
    .map(value => String(value));
}

/**
 * 提取错误名列表（统一大写，用于按 name 精确匹配）
 * @param {*} error 错误对象
 * @returns {Array<string>} 错误名列表
 */
function extractNames(error) {
  if (!error || typeof error !== 'object') {
    return [];
  }

  const raw = [
    error.name,
    error.errorName,
    error.reason && error.reason.name,
    error.constructor && error.constructor.name,
    error.cause && error.cause.name,
  ];

  return raw
    .filter(isNonEmptyString)
    .map(value => String(value).toUpperCase());
}

/**
 * 判断错误码是否命中给定集合
 * @param {Array<string>} codes 错误码列表
 * @param {Array<string>} candidates 候选错误码集合
 * @returns {boolean} 是否命中
 */
function matchCode(codes, candidates) {
  return codes.some(code => candidates.includes(code) || candidates.includes(code.toUpperCase()));
}

/**
 * 判断错误名是否命中给定集合
 * @param {Array<string>} names 错误名列表
 * @param {Array<string>} candidates 候选错误名集合
 * @returns {boolean} 是否命中
 */
function matchName(names, candidates) {
  return names.some(name => candidates.includes(name));
}

/**
 * 判断错误文本是否包含任一关键字
 * @param {string} text 小写错误文本
 * @param {Array<string>} keywords 关键字集合
 * @returns {boolean} 是否包含
 */
function matchKeyword(text, keywords) {
  if (!text) {
    return false;
  }
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * 判断是否为网络类标记（isNetworkError / 离线标记 / 请求未到达服务端 / 网络错误码）
 * @param {*} error 错误对象
 * @param {Array<string>} codes 错误码列表
 * @returns {boolean} 是否为网络错误
 */
function isNetworkMarked(error, codes) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if (error.isNetworkError === true || error.isOfflineError === true || error.offline === true) {
    return true;
  }

  // axios 约定：有 request 但无 response，说明请求根本没有到达服务端
  if (error.request && !error.response) {
    return true;
  }

  // 已拿到明确 HTTP 响应时不再按网络错误处理，避免 4xx/5xx 被误判为断网
  if (error.response) {
    return false;
  }

  return matchCode(codes, NETWORK_CODES);
}

/**
 * 判断是否为 Realm Client Reset 错误
 * @param {*} error 错误对象
 * @param {Object} signals 已提取的信号
 * @param {string} signals.text 小写错误文本
 * @param {Array<string>} signals.codes 错误码列表
 * @param {Array<string>} signals.names 错误名列表
 * @returns {boolean} 是否为 Client Reset
 */
function detectClientReset(error, signals) {
  if (error && typeof error === 'object' && error.isClientReset === true) {
    return true;
  }
  if (matchCode(signals.codes, CLIENT_RESET_CODES)) {
    return true;
  }
  if (matchName(signals.names, CLIENT_RESET_NAMES)) {
    return true;
  }
  return matchKeyword(signals.text, CLIENT_RESET_KEYWORDS);
}

/**
 * 根据分类构造标准返回值
 * @param {string} category 错误分类
 * @returns {{category: string, retryable: boolean, userMessage: string}} 分类结果
 */
function buildCategoryResult(category) {
  const preset = CATEGORY_PRESETS[category] || CATEGORY_PRESETS[SYNC_ERROR_CATEGORIES.UNKNOWN];
  return {
    category,
    retryable: preset.retryable,
    userMessage: preset.userMessage,
  };
}

/**
 * 对同步错误进行分类
 *
 * 判定优先级（自上而下，命中即返回）：
 * 1. 空错误 -> unknown
 * 2. Client Reset：Realm 客户端重置必须最先识别，否则可能被当成普通网络/服务端错误重试而覆盖本地数据
 * 3. HTTP 状态码（可信度最高的信号）：
 *    401 -> 若带会话过期语义则 sessionExpired，否则 auth；403 -> permission；409 -> conflict；
 *    408 -> network；429 与 5xx -> server
 * 4. 无状态码时的结构化标记：错误码 / 错误名 / 网络标记
 * 5. 最后按消息关键字兜底：sessionExpired > auth > permission > conflict > network > server
 * 6. 仍未命中 -> unknown（保守判定为不可重试，避免盲目重试放大问题）
 *
 * @param {*} error 原始错误（Error / AxiosError / Realm 错误 / 字符串均可）
 * @returns {{category: string, retryable: boolean, userMessage: string}} 分类结果
 */
export function classifySyncError(error) {
  if (!error) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.UNKNOWN);
  }

  const text = buildErrorText(error);
  const codes = extractCodes(error);
  const names = extractNames(error);
  const status = extractStatus(error);

  // 1) Client Reset 优先级最高
  if (detectClientReset(error, { text, codes, names })) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.CLIENT_RESET);
  }

  // 2) HTTP 状态码判定
  if (status === 401) {
    const sessionExpired = matchKeyword(text, SESSION_EXPIRED_KEYWORDS)
      || matchCode(codes, SESSION_EXPIRED_CODES);
    return buildCategoryResult(
      sessionExpired ? SYNC_ERROR_CATEGORIES.SESSION_EXPIRED : SYNC_ERROR_CATEGORIES.AUTH,
    );
  }
  if (status === 403) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.PERMISSION);
  }
  if (status === 409) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.CONFLICT);
  }
  if (status === 408) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.NETWORK);
  }
  if (status === 429 || (status >= 500 && status <= 599)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.SERVER);
  }

  // 3) 无（或非关键）状态码时按结构化标记判定
  if (matchCode(codes, SESSION_EXPIRED_CODES) || matchName(names, SESSION_EXPIRED_NAMES)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.SESSION_EXPIRED);
  }
  if (matchCode(codes, AUTH_CODES) || matchName(names, AUTH_NAMES)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.AUTH);
  }
  if (matchCode(codes, PERMISSION_CODES) || matchName(names, PERMISSION_NAMES)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.PERMISSION);
  }
  if (matchCode(codes, CONFLICT_CODES) || matchName(names, CONFLICT_NAMES)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.CONFLICT);
  }
  if (isNetworkMarked(error, codes)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.NETWORK);
  }
  if (matchCode(codes, SERVER_CODES) || matchName(names, SERVER_NAMES)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.SERVER);
  }

  // 4) 消息关键字兜底（顺序按“特异性从高到低”）
  if (matchKeyword(text, SESSION_EXPIRED_KEYWORDS)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.SESSION_EXPIRED);
  }
  if (matchKeyword(text, AUTH_KEYWORDS)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.AUTH);
  }
  if (matchKeyword(text, PERMISSION_KEYWORDS)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.PERMISSION);
  }
  if (matchKeyword(text, CONFLICT_KEYWORDS)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.CONFLICT);
  }
  if (matchKeyword(text, NETWORK_KEYWORDS)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.NETWORK);
  }
  if (matchKeyword(text, SERVER_KEYWORDS)) {
    return buildCategoryResult(SYNC_ERROR_CATEGORIES.SERVER);
  }

  return buildCategoryResult(SYNC_ERROR_CATEGORIES.UNKNOWN);
}

/**
 * 计算指数退避延迟
 *
 * 公式：delay = min(baseMs * 2^(attempt - 1), maxMs)，再按抖动比例随机下调：
 *   delay = delay * (1 - jitter + jitter * random)，random ∈ [0, 1)
 * 因此 jitter = 0 时无抖动，jitter = 1 时延迟在 [0, delay] 之间均匀取值。
 *
 * 边界处理：
 * - attempt 非数字 / 小于 1 时按第 1 次处理，保证调用方传参安全
 * - baseMs / maxMs 非正数或非法时回退到默认值；maxMs 小于 baseMs 时以 baseMs 为上限
 * - attempt 过大时指数截断，避免 Math.pow 溢出为 Infinity
 *
 * @param {number} attempt 第几次重试（从 1 开始）
 * @param {Object} [options] 退避选项
 * @param {number} [options.baseMs=500] 基础延迟（毫秒）
 * @param {number} [options.maxMs=30000] 延迟上限（毫秒）
 * @param {number} [options.jitter=0] 抖动比例 [0, 1]
 * @param {Function} [options.random=Math.random] 随机数源（便于测试注入）
 * @returns {number} 延迟毫秒数（非负整数）
 */
export function computeBackoffDelay(attempt, options = {}) {
  const opts = options || {};
  const baseMs = normalizePositiveNumber(opts.baseMs, DEFAULT_BACKOFF_OPTIONS.baseMs);
  let maxMs = normalizePositiveNumber(opts.maxMs, DEFAULT_BACKOFF_OPTIONS.maxMs);
  if (maxMs < baseMs) {
    // 上限小于基数时以基数为上限，保证“延迟不超过上限”的语义仍然成立
    maxMs = baseMs;
  }

  const jitter = clamp01(opts.jitter);
  const random = typeof opts.random === 'function' ? opts.random : Math.random;

  const rawAttempt = normalizeNonNegativeInteger(attempt, 1);
  const safeAttempt = rawAttempt < 1 ? 1 : rawAttempt;
  // 指数截断在 30，避免超大 attempt 让 Math.pow 溢出（结果本来也会被 maxMs 截断）
  const exponent = Math.min(safeAttempt - 1, 30);
  const exponential = baseMs * Math.pow(2, exponent);
  const capped = Math.min(exponential, maxMs);
  const jitterFactor = 1 - jitter + jitter * clamp01(random());
  const delay = capped * clamp01(jitterFactor);

  return Math.max(0, Math.min(Math.round(delay), Math.floor(maxMs)));
}

/**
 * 默认休眠实现
 * @param {number} ms 毫秒
 * @returns {Promise<void>} 休眠 Promise
 */
function defaultSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建可取消的重试控制器
 *
 * 语义：
 * - run(fn) 首次立即执行，失败后按分类决定是否重试；可重试错误最多重试 maxRetries 次
 * - 不可重试错误（auth / permission / sessionExpired / clientReset / unknown）立即短路，不吞错
 * - cancel() 后不再发起新的尝试，并唤醒正在退避等待的 run()，最终仍抛出最后一次错误
 * - shouldAbort() 返回真或抛错时同样停止重试（不吞掉最后一次错误）
 *
 * @param {Object} [options] 控制器选项
 * @param {number} [options.maxRetries=3] 最大重试次数（不含首次执行）
 * @param {number} [options.baseMs=500] 退避基础延迟
 * @param {number} [options.maxMs=30000] 退避延迟上限
 * @param {number} [options.jitter=0] 退避抖动比例
 * @param {Function} [options.sleep] 休眠实现（ms => Promise），默认 setTimeout
 * @param {Function} [options.shouldAbort] 外部中止判定（返回 true 时停止重试）
 * @param {Function} [options.random] 随机数源（透传给退避抖动，便于测试）
 * @returns {{run: Function, cancel: Function, cancelled: boolean, isCancelled: Function}} 重试控制器
 */
export function createRetryController(options = {}) {
  const opts = options || {};
  const maxRetries = normalizeNonNegativeInteger(opts.maxRetries, 3);
  const baseMs = normalizePositiveNumber(opts.baseMs, DEFAULT_BACKOFF_OPTIONS.baseMs);
  let maxMs = normalizePositiveNumber(opts.maxMs, DEFAULT_BACKOFF_OPTIONS.maxMs);
  if (maxMs < baseMs) {
    maxMs = baseMs;
  }
  const jitter = clamp01(opts.jitter);
  const sleep = typeof opts.sleep === 'function' ? opts.sleep : defaultSleep;
  const shouldAbort = typeof opts.shouldAbort === 'function' ? opts.shouldAbort : null;
  const random = typeof opts.random === 'function' ? opts.random : Math.random;

  let cancelled = false;
  let running = false;
  let cancelWaiters = [];

  const isAborted = () => {
    if (cancelled) {
      return true;
    }
    if (!shouldAbort) {
      return false;
    }
    try {
      return Boolean(shouldAbort());
    } catch (error) {
      // shouldAbort 自身抛错时按“需要中止”处理，避免无休止重试
      return true;
    }
  };

  const waitForCancellation = () => {
    if (cancelled) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      cancelWaiters.push(resolve);
    });
  };

  const waitDelay = async ms => {
    if (isAborted()) {
      return;
    }
    const sleepPromise = Promise.resolve().then(() => sleep(ms));
    // sleep 被取消信号抢先结束时可能稍后 reject，这里吞掉以避免未处理的 rejection
    sleepPromise.catch(() => {});
    await Promise.race([sleepPromise, waitForCancellation()]);
  };

  const cancel = () => {
    cancelled = true;
    const waiters = cancelWaiters;
    cancelWaiters = [];
    waiters.forEach(resolve => resolve());
  };

  const run = async fn => {
    if (typeof fn !== 'function') {
      throw new TypeError('createRetryController: run 需要一个函数作为同步任务');
    }
    if (running) {
      throw new Error('createRetryController: 同一控制器不支持并发 run');
    }

    running = true;
    let lastError = null;

    try {
      let attempt = 0;
      while (attempt <= maxRetries) {
        if (isAborted()) {
          // 取消 / 外部中止：抛出最后一次错误，绝不吞错；首次即被取消时给出明确错误
          throw lastError || new Error('同步重试已取消，未执行任何尝试');
        }

        attempt += 1;
        try {
          return await fn(attempt);
        } catch (error) {
          lastError = error;
          const classification = classifySyncError(error);

          // 不可重试错误短路；重试次数耗尽同样直接抛出最后一次错误
          if (!classification.retryable || attempt > maxRetries) {
            throw error;
          }

          const delay = computeBackoffDelay(attempt, { baseMs, maxMs, jitter, random });
          await waitDelay(delay);

          if (isAborted()) {
            throw error;
          }
        }
      }

      throw lastError || new Error('同步重试失败');
    } finally {
      running = false;
    }
  };

  return {
    run,
    cancel,
    get cancelled() {
      return cancelled;
    },
    isCancelled: () => cancelled,
  };
}

/**
 * 时间戳格式化（用于备份文件名），非法时间回退到当前时间
 * @param {Function} now 时间源
 * @returns {string} 形如 2024-05-01T10-20-30-400Z 的时间戳
 */
function formatBackupTimestamp(now) {
  let value;
  try {
    value = now();
  } catch (error) {
    value = new Date();
  }

  const date = value instanceof Date ? value : new Date(value);
  const iso = Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  return iso.replace(/[:.]/g, '-');
}

/**
 * 解析文件系统依赖：仅在未注入时才加载 react-native-fs，
 * 保证单元测试可以零原生依赖运行
 * @param {Object} overrides 注入的实现
 * @returns {{copyFile: Function, exists: Function, mkdir: Function}} 文件系统依赖
 */
function resolveFileSystemDeps(overrides = {}) {
  const hasCopyFile = typeof overrides.copyFile === 'function';
  const hasExists = typeof overrides.exists === 'function';
  const hasMkdir = typeof overrides.mkdir === 'function';

  if (hasCopyFile && hasExists && hasMkdir) {
    return {
      copyFile: overrides.copyFile,
      exists: overrides.exists,
      mkdir: overrides.mkdir,
    };
  }

  const RNFS = require('react-native-fs');

  return {
    copyFile: hasCopyFile ? overrides.copyFile : (from, to) => RNFS.copyFile(from, to),
    exists: hasExists ? overrides.exists : path => RNFS.exists(path),
    mkdir: hasMkdir ? overrides.mkdir : path => RNFS.mkdir(path),
  };
}

/**
 * 默认备份目录（懒加载 RNFS，避免模块导入即依赖原生模块）
 * @returns {string} 备份目录
 */
function defaultBackupDir() {
  const RNFS = require('react-native-fs');
  return `${RNFS.DocumentDirectoryPath}/realm_backups`;
}

/**
 * 创建 Client Reset 恢复器：在重置前备份 Realm 文件，并提供还原能力
 *
 * 备份失败（目录创建失败 / Realm 文件不存在 / 复制失败）会抛出带原因的错误，
 * 绝不静默继续执行 Client Reset，以保证本地数据不丢。
 *
 * @param {Object} options 选项
 * @param {string} options.realmPath Realm 文件路径（必填）
 * @param {string} [options.backupDir] 备份目录，默认 `<DocumentDirectoryPath>/realm_backups`
 * @param {Function} [options.copyFile] 复制实现 (from, to) => Promise
 * @param {Function} [options.exists] 存在性判断实现 path => Promise<boolean>
 * @param {Function} [options.mkdir] 目录创建实现 path => Promise
 * @param {Function} [options.now] 时间源，默认 () => new Date()
 * @returns {Promise<{backupPath: string, restore: Function, description: string}>} 恢复器
 */
export async function createClientResetRecovery(options = {}) {
  const opts = options || {};
  const realmPath = opts.realmPath;
  if (!isNonEmptyString(realmPath)) {
    throw new Error('创建 Client Reset 恢复器失败：缺少 realmPath');
  }

  const now = typeof opts.now === 'function' ? opts.now : () => new Date();
  const deps = resolveFileSystemDeps(opts);
  const backupDir = isNonEmptyString(opts.backupDir) ? opts.backupDir : defaultBackupDir();
  const backupPath = `${backupDir}/backup_${formatBackupTimestamp(now)}.realm`;

  // 前置校验：源文件不存在时直接失败，避免生成一个“看似成功”的空备份
  let realmExists = false;
  try {
    realmExists = await deps.exists(realmPath);
  } catch (error) {
    throw createBackupError(`无法确认 Realm 文件是否存在：${describeError(error)}`, realmPath, backupPath, error);
  }
  if (!realmExists) {
    throw createBackupError(`Realm 文件不存在：${realmPath}`, realmPath, backupPath, null);
  }

  try {
    const dirExists = await deps.exists(backupDir);
    if (!dirExists) {
      await deps.mkdir(backupDir);
    }
    await deps.copyFile(realmPath, backupPath);
  } catch (error) {
    throw createBackupError(
      `备份复制失败：${describeError(error)}`,
      realmPath,
      backupPath,
      error,
    );
  }

  const description = `Client Reset 前备份：${realmPath} -> ${backupPath}`;

  return {
    backupPath,
    description,
    /**
     * 将备份文件还原回 Realm 路径
     * @returns {Promise<boolean>} 还原是否成功
     */
    async restore() {
      const backupExists = await deps.exists(backupPath);
      if (!backupExists) {
        throw new Error(`Client Reset 恢复失败：备份文件不存在 (${backupPath})`);
      }
      await deps.copyFile(backupPath, realmPath);
      return true;
    },
  };
}

/**
 * 描述错误信息
 * @param {*} error 错误对象
 * @returns {string} 错误描述
 */
function describeError(error) {
  if (!error) {
    return '未知原因';
  }
  if (typeof error === 'string') {
    return error;
  }
  return error.message || String(error);
}

/**
 * 构造带上下文的备份错误（保留原始错误为 cause，便于上层排查）
 * @param {string} reason 失败原因
 * @param {string} realmPath Realm 路径
 * @param {string} backupPath 备份路径
 * @param {*} cause 原始错误
 * @returns {Error} 备份错误
 */
function createBackupError(reason, realmPath, backupPath, cause) {
  const error = new Error(`Client Reset 备份失败：${reason} (${realmPath} -> ${backupPath})`);
  error.realmPath = realmPath;
  error.backupPath = backupPath;
  if (cause) {
    error.cause = cause;
  }
  return error;
}

/**
 * 同步错误恢复工具集合（默认导出，便于整体引入）
 */
export default {
  SYNC_ERROR_CATEGORIES,
  DEFAULT_BACKOFF_OPTIONS,
  classifySyncError,
  computeBackoffDelay,
  createRetryController,
  createClientResetRecovery,
};
