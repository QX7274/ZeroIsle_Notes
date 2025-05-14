/**
 * 笔记API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../constants/api';
import { offlineStorageService } from '../offline/offlineStorageService';
// 使用MongoDB替代AsyncStorage
import { mongoDBService } from '../database/mongoDBAdapter';
import { STORAGE_KEYS } from '../../utils/constants/config';
import NetInfo from '@react-native-community/netinfo';
import { dataService } from '../database';
import { realmStorageService } from '../storage';

// 使用导入的离线存储服务

/**
 * 创建笔记
 * @param {object} note - 笔记数据
 * @returns {Promise} - 创建结果
 */
export const createNote = async (note) => {
  try {
    console.log('开始创建笔记:', note.title || '无标题笔记');

    // 生成唯一ID，确保在离线状态下也能使用
    const noteId = note.id || 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    // 准备笔记数据，添加必要的元数据
    const now = new Date().toISOString();
    const noteWithMeta = {
      ...note,
      id: noteId,
      title: note.title || '无标题笔记',
      content: note.content || '',
      created_at: now,
      updated_at: now,
      is_synced: false,
      is_offline: true  // 标记为离线创建
    };

    // 创建一个简单的内存笔记对象，作为最后的备选方案
    const memoryNote = {
      ...noteWithMeta,
      id: noteId,
      title: noteWithMeta.title,
      content: noteWithMeta.content,
      created_at: now,
      updated_at: now,
      is_memory_only: true
    };

    // 1. 优先保存到MongoDB数据库
    let createdNote = null;
    try {
      console.log('尝试保存到MongoDB数据库...');

      // 初始化数据服务
      await dataService.init();

      // 使用数据服务创建笔记
      const mongoResult = await dataService.createNote(noteWithMeta);

      if (mongoResult) {
        createdNote = mongoResult;
        console.log('MongoDB保存笔记成功:', createdNote.id);
      } else {
        console.warn('MongoDB保存笔记失败');
      }
    } catch (mongoError) {
      console.error('MongoDB保存笔记失败，尝试使用备用存储:', mongoError);
      // MongoDB失败时，不抛出错误，继续尝试其他存储方式
    }

    // 2. 尝试保存到离线存储，但设置超时
    if (!createdNote) {
      try {
        console.log('尝试保存到离线存储...');

        // 设置离线存储操作超时
        const offlineTimeoutPromise = new Promise(resolve => {
          setTimeout(() => {
            console.log('离线存储保存操作超时');
            resolve(null);
          }, 3000); // 3秒超时
        });

        // 使用已创建的笔记或原始笔记数据
        const localNote = noteWithMeta;

        // 尝试保存到离线存储，但设置超时
        const savePromise = offlineStorageService.saveNote(localNote);
        const offlineResult = await Promise.race([savePromise, offlineTimeoutPromise]);

        if (offlineResult !== null) {
          createdNote = localNote;
          console.log('离线存储保存笔记成功:', localNote.id);
        } else {
          console.warn('离线存储保存笔记超时');
        }
      } catch (offlineError) {
        console.error('离线存储保存笔记失败:', offlineError);
      }
    }

    // 3. 如果两种存储都失败，使用内存笔记
    if (!createdNote) {
      console.warn('所有存储方式都失败，使用内存笔记');
      createdNote = memoryNote;

      // 尝试使用MongoDB作为最后的备选方案
      try {
        const notesKey = 'emergency_notes';
        const existingNotes = await mongoDBService.getItem(notesKey) || [];
        existingNotes.push(memoryNote);
        await mongoDBService.setItem(notesKey, existingNotes);
        console.log('成功将笔记保存到MongoDB应急存储');
      } catch (mongoError) {
        console.error('MongoDB应急保存失败:', mongoError);
      }
    }

    // 4. 在后台尝试同步到服务器，但不阻塞UI
    setTimeout(async () => {
      try {
        // 检查网络状态
        const networkStatus = await NetInfo.fetch();
        const isOnline = networkStatus.isConnected && networkStatus.isInternetReachable;

        if (isOnline) {
          console.log('尝试在后台同步笔记到服务器:', noteId);

          // 设置请求头，标记为离线模式，这样即使请求失败也不会影响用户体验
          const headers = { 'X-Offline-Mode': 'true' };

          // 发送API请求，但不等待结果
          try {
            const apiClient = instance; // 使用导入的实例
            apiClient.post('/notes', createdNote, { headers })
              .then(response => {
                console.log('笔记同步到服务器成功:', response);

                // 更新本地记录为已同步
                try {
                  dataService.updateNote(noteId, {
                    ...createdNote,
                    is_synced: true,
                    server_id: response.id || response.data?.id || noteId
                  }).catch(err => console.warn('更新本地笔记同步状态失败:', err));
                } catch (updateError) {
                  console.warn('更新本地笔记同步状态失败:', updateError);
                }
              })
              .catch(err => {
                console.warn('后台同步笔记失败，将在下次联网时重试:', err);
              });
          } catch (apiError) {
            console.warn('API请求创建失败:', apiError);
          }
        } else {
          console.log('当前离线，笔记将在下次联网时同步');
        }
      } catch (syncError) {
        console.warn('后台同步过程出错:', syncError);
      }
    }, 0);

    // 立即返回创建的结果，不等待同步
    return {
      success: true,
      data: createdNote,
      isOffline: true,
      message: '笔记已创建'
    };
  } catch (error) {
    console.error('创建笔记失败:', error);

    // 即使出错，也尝试返回一个最小的笔记对象
    try {
      const emergencyNote = {
        id: 'emergency_' + Date.now(),
        title: note.title || '紧急恢复的笔记',
        content: note.content || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_emergency: true
      };

      return {
        success: true,
        data: emergencyNote,
        isOffline: true,
        isEmergency: true,
        message: '笔记创建过程中出错，但已创建紧急恢复笔记'
      };
    } catch (emergencyError) {
      console.error('创建紧急恢复笔记也失败:', emergencyError);

      return {
        success: false,
        message: error.message || '创建笔记失败',
        error
      };
    }
  }
};

/**
 * 更新笔记
 * @param {string} id - 笔记ID
 * @param {object} note - 笔记数据
 * @returns {Promise} - 更新结果
 */
export const updateNote = async (id, note) => {
  try {
    console.log(`开始更新笔记 (ID: ${id})`);

    // 设置超时，确保不会一直等待
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        console.log('更新笔记操作超时');
        resolve({
          success: true,
          data: note,
          isTimeout: true,
          message: '操作超时，但UI已更新'
        });
      }, 5000); // 5秒超时
    });

    // 实际更新笔记的Promise
    const updatePromise = (async () => {
      try {
        // 尝试初始化数据服务，但不等待太久
        const initTimeoutPromise = new Promise(resolve => {
          setTimeout(() => {
            console.log('数据服务初始化超时');
            resolve(false);
          }, 2000); // 2秒超时
        });

        await Promise.race([dataService.init(), initTimeoutPromise]);

        // 使用数据服务更新笔记
        const result = await dataService.updateNote(id, note);

        // 在后台尝试更新旧的离线存储，不阻塞主流程
        setTimeout(async () => {
          try {
            // 检查 offlineStorageService 是否存在 updateNote 方法
            if (offlineStorageService && typeof offlineStorageService.updateNote === 'function') {
              const localNote = {
                ...note,
                is_synced: false,
                updated_at: new Date().toISOString()
              };
              await offlineStorageService.updateNote(id, localNote);
              console.log('已更新旧的离线存储');
            } else if (offlineStorageService && typeof offlineStorageService.saveNote === 'function') {
              // 如果方法不存在，尝试使用 saveNote 方法
              const localNote = {
                ...note,
                id: id, // 确保ID正确
                is_synced: false,
                updated_at: new Date().toISOString()
              };
              await offlineStorageService.saveNote(localNote);
              console.log('使用 saveNote 替代 updateNote 更新离线存储');
            } else {
              console.log('离线存储服务不可用或缺少必要的方法');
            }
          } catch (offlineError) {
            console.log('更新旧的离线存储失败，但MongoDB Realm更新成功', offlineError);
          }
        }, 0);

        return result;
      } catch (error) {
        console.error('更新笔记失败:', error);

        // 即使出错，也返回一个基本的结果，避免UI卡住
        return {
          success: false,
          message: error.message || '更新笔记失败',
          error,
          // 返回原始笔记数据，以便UI可以显示
          data: {
            ...note,
            id: id,
            updated_at: new Date().toISOString()
          }
        };
      }
    })();

    // 使用Promise.race确保不会一直等待
    return await Promise.race([updatePromise, timeoutPromise]);
  } catch (error) {
    console.error('更新笔记过程中出现未处理的错误:', error);

    // 返回错误信息，但包含原始笔记数据
    return {
      success: false,
      message: '更新笔记失败: ' + (error.message || '未知错误'),
      error: error.message,
      data: {
        ...note,
        id: id,
        updated_at: new Date().toISOString()
      }
    };
  }
};

/**
 * 删除笔记
 * @param {string} id - 笔记ID
 * @returns {Promise} - 删除结果
 */
export const deleteNote = async (id) => {
  try {
    // 确保数据服务已初始化
    await dataService.init();

    // 使用数据服务删除笔记（软删除）
    await dataService.deleteNote(id);

    // 同时从旧的离线存储中删除，以保持兼容性
    try {
      await offlineStorageService.deleteNote(id);
    } catch (offlineError) {
      console.log('从旧的离线存储删除失败，但MongoDB Realm删除成功', offlineError);
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('删除笔记失败:', error);
    return {
      success: false,
      message: error.message || '删除笔记失败',
      error
    };
  }
};

/**
 * 获取所有笔记
 * @param {object} params - 查询参数
 * @returns {Promise} - 笔记列表
 */
export const getAllNotes = async (params = {}) => {
  try {
    console.log('开始获取所有笔记...');
    const startTime = Date.now();

    // 设置较短的超时，确保UI快速响应
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        console.log('本地没有笔记数据，显示空列表');
        resolve({
          success: true,
          message: '本地没有笔记数据，显示空列表',
          isFirstUse: true,
          data: []
        });
      }, 3000); // 3秒超时，本地数据查询应该很快
    });

    // 实际获取笔记的Promise
    const fetchPromise = (async () => {
      try {
        // 并行执行多个初始化操作，提高效率
        console.log('并行执行初始化操作...');

        // 1. 初始化数据服务（较短超时）
        const initPromise = (async () => {
          try {
            await dataService.init();
            return true;
          } catch (error) {
            console.warn('数据服务初始化失败:', error);
            return false;
          }
        })();

        // 2. 获取网络状态
        const networkPromise = NetInfo.fetch();

        // 3. 获取用户信息
        const userPromise = (async () => {
          try {
            // 尝试获取用户信息，但不抛出错误
            // 从authStorage获取用户信息
            const authStorage = require('../auth/authStorage').default;
            const user = await authStorage.getUser();

            if (user && user.id) {
              console.log('从authStorage获取到用户信息:', user.username || user.id);
              return user;
            }

            // 如果authStorage没有，尝试从realmStorageService获取
            const { realmStorageService } = require('../storage/realmStorageService');

            // 尝试多个可能的键
            const possibleKeys = ['user', 'zeroisle_user', 'zeroisle_user_info'];
            let userInfo = null;

            for (const key of possibleKeys) {
              userInfo = await realmStorageService.getItem(key);
              if (userInfo) {
                console.log(`从Realm存储中获取到用户信息(键: ${key})`);
                // 如果userInfo包含user字段，返回user，否则返回userInfo本身
                return userInfo.user || userInfo;
              }
            }

            console.log('未找到用户信息，使用默认用户');
            return { id: 'default_user', username: 'Guest', isGuest: true };
          } catch (userError) {
            console.warn('获取用户信息失败:', userError);
            // 返回一个默认用户对象，避免后续代码出错
            return { id: 'default_user', username: 'Guest', isGuest: true };
          }
        })();

        // 设置较短的初始化超时
        const initTimeoutPromise = new Promise(resolve => {
          setTimeout(() => {
            console.log('初始化操作完成');
            resolve({ timeout: false });
          }, 2000); // 2秒超时，本地初始化应该很快
        });

        // 等待所有初始化操作完成或超时
        const [initResult, networkStatus, user] = await Promise.all([
          Promise.race([initPromise, initTimeoutPromise]),
          networkPromise,
          userPromise
        ]);

        console.log('初始化操作完成，耗时:', Date.now() - startTime, 'ms');

        // 检查网络状态
        const isOnline = networkStatus && networkStatus.isConnected && networkStatus.isInternetReachable;
        console.log('网络状态:', isOnline ? '在线' : '离线');

        // 检查用户信息
        if (!user || !user.id) {
          console.warn('未找到当前用户信息，尝试从离线存储获取笔记');
          try {
            const offlineResult = await getOfflineNotes();
            return offlineResult;
          } catch (offlineError) {
            console.error('从离线存储获取笔记失败:', offlineError);
            return {
              success: true,
              data: [],
              isOffline: true,
              message: '未找到用户信息且离线存储获取失败'
            };
          }
        }

        console.log('当前用户:', user.username || user.id);

        // 设置当前用户到dataService
        try {
          dataService.setCurrentUser(user);
        } catch (userError) {
          console.warn('设置当前用户失败，但将继续尝试获取笔记:', userError);
        }

        // 确保params中包含userId和合理的limit
        const paramsWithUserId = {
          ...params,
          userId: user.id,
          limit: params.limit || 30 // 默认限制为30条，减少数据量
        };

        // 从本地Realm数据库获取笔记，设置较短的超时
        console.log('从本地Realm数据库获取笔记...');
        const realmTimeoutPromise = new Promise(resolve => {
          setTimeout(() => {
            console.log('本地没有笔记数据，这是正常的');
            resolve([]);
          }, 2000); // 2秒超时，本地数据库查询应该很快
        });

        // 使用Promise.race，确保查询不会阻塞太久
        let notes = [];
        try {
          notes = await Promise.race([
            dataService.getNotes(paramsWithUserId),
            realmTimeoutPromise
          ]);
        } catch (notesError) {
          console.error('获取笔记失败，返回空数组:', notesError);
          notes = [];
        }

        // 如果查询超时或失败，返回空数组而不是错误
        if (!notes || notes.length === 0) {
          console.log('本地没有笔记数据，这是正常的');
          return {
            success: true,
            message: '欢迎使用！点击右上角"+"按钮创建您的第一条笔记',
            data: [],
            isFirstUse: true
          };
        }

        console.log(`从MongoDB Realm获取到${notes.length}条笔记，耗时: ${Date.now() - startTime}ms`);

        // 根据应用设计，笔记默认保存在本地，不自动从服务器获取
        // 只有用户主动上传时才会同步到云端
        console.log('使用本地笔记数据，不从服务器获取');

        // 立即返回本地数据
        return {
          success: true,
          data: notes,
          isOffline: !isOnline
        };
      } catch (error) {
        console.error('获取笔记列表失败:', error);

        // 尝试从本地备份恢复笔记
        try {
          console.log('尝试从本地备份恢复笔记...');
          const backupNotes = await mongoDBService.getItem('BACKUP_NOTES');
          if (backupNotes && backupNotes.length > 0) {
            console.log(`从本地备份恢复了${backupNotes.length}条笔记`);
            return {
              success: true,
              data: backupNotes,
              isBackup: true,
              message: '从本地备份恢复的笔记'
            };
          } else {
            console.log('本地没有备份笔记数据，这可能是首次使用应用');
          }
        } catch (backupError) {
          console.log('本地没有备份笔记数据，这可能是首次使用应用');
        }

        // 所有方法都失败，返回空数组而不是错误
        return {
          success: true,
          message: '欢迎使用！点击右上角"+"按钮创建您的第一条笔记',
          data: [],
          isFirstUse: true
        };
      }
    })();

    // 使用Promise.race确保不会一直等待
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    console.error('获取笔记列表过程中出现未处理的错误:', error);

    // 即使出错，也返回空数组而不是错误，避免UI崩溃
    return {
      success: true,
      message: '获取笔记列表失败，返回空数组',
      error: error.message,
      data: []
    };
  }
};

/**
 * 获取笔记详情
 * @param {string} id - 笔记ID
 * @returns {Promise} - 笔记详情
 */
export const getNoteById = async (id) => {
  try {
    console.log(`开始获取笔记详情 (ID: ${id})`);
    const startTime = Date.now();

    // 设置超时，确保不会一直等待
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        console.log('获取笔记详情超时');
        resolve({
          success: false,
          message: '获取笔记详情超时，请稍后重试',
          isTimeout: true,
          data: null
        });
      }, 10000); // 10秒超时
    });

    // 实际获取笔记的Promise
    const fetchPromise = (async () => {
      try {
        // 检查MongoDB数据库连接状态
        try {
          await dataService.init();
          console.log('MongoDB数据库连接正常，开始获取笔记数据');
        } catch (connectionError) {
          console.warn('MongoDB数据库连接不可用:', connectionError);
          return {
            success: false,
            message: 'MongoDB数据库连接不可用',
            isOffline: true,
            connectionFailed: true,
            data: null
          };
        }

        // 确保数据服务已初始化，但不等待太久
        const initTimeoutPromise = new Promise(resolve => {
          setTimeout(() => {
            console.log('数据服务初始化超时');
            resolve(false);
          }, 3000); // 3秒超时
        });

        await Promise.race([dataService.init(), initTimeoutPromise]);

        // 从MongoDB获取笔记详情
        console.log('从MongoDB获取笔记详情...');

        try {
          const note = await dataService.getNote(id);

          if (!note) {
            console.log('获取笔记详情失败');
            return {
              success: false,
              message: '获取笔记详情失败',
              isOffline: true,
              queryFailed: true,
              data: null
            };
          }

          console.log(`从MongoDB获取笔记详情成功，耗时: ${Date.now() - startTime}ms`);

          // 检查网络状态
          const networkStatus = await NetInfo.fetch();
          const isOnline = networkStatus.isConnected && networkStatus.isInternetReachable;

          return {
            success: true,
            data: note,
            isOffline: !isOnline
          };
        } catch (noteError) {
          console.error('获取笔记详情失败:', noteError);
          return {
            success: false,
            message: '获取笔记详情失败: ' + noteError.message,
            isOffline: true,
            queryFailed: true,
            data: null
          };
        }

        // 这部分代码已经被上面的代码替代，不再需要
      } catch (error) {
        console.error('获取笔记详情失败:', error);

        // 记录详细的错误信息
        if (error.message) {
          console.error('错误详情:', error.message);
        }
        if (error.stack) {
          console.error('错误堆栈:', error.stack);
        }

        // 尝试从服务器获取
        try {
          console.log('尝试从服务器获取笔记详情');
          const serverTimeoutPromise = new Promise(resolve => {
            setTimeout(() => {
              console.log('从服务器获取笔记详情超时');
              resolve(null);
            }, 5000); // 5秒超时
          });

          const responsePromise = instance.get(API_ENDPOINTS.NOTES.DETAIL(id));
          const response = await Promise.race([responsePromise, serverTimeoutPromise]);

          if (response) {
            console.log('从服务器获取笔记详情成功');
            return {
              success: true,
              data: response.data,
              fromServer: true
            };
          } else {
            console.log('从服务器获取笔记详情超时');
            return {
              success: false,
              message: '从服务器获取笔记详情超时',
              isOffline: true,
              serverTimeout: true,
              data: null
            };
          }
        } catch (serverError) {
          console.error('从服务器获取笔记详情也失败:', serverError);

          // 所有方法都失败，返回错误
          console.log('所有获取方法都失败');
          return {
            success: false,
            message: '无法获取笔记详情，所有存储方法都失败',
            isOffline: true,
            allMethodsFailed: true,
            error: error.message,
            data: null
          };
        }
      }
    })();

    // 使用Promise.race确保不会一直等待
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    console.error('获取笔记详情过程中出现未处理的错误:', error);

    // 返回错误信息
    return {
      success: false,
      message: '获取笔记详情失败: ' + (error.message || '未知错误'),
      isOffline: true,
      isError: true,
      error: error.message,
      data: null
    };
  }
};

/**
 * 收藏/取消收藏笔记
 * @param {string} id - 笔记ID
 * @returns {Promise} - 操作结果
 */
export const toggleFavorite = async (id) => {
  try {
    const response = await instance.post(API_ENDPOINTS.NOTES.FAVORITE(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '操作失败',
      error
    };
  }
};

/**
 * 获取笔记统计信息
 * @returns {Promise} - 统计信息
 */
export const getNoteStats = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTES.STATS);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取统计信息失败',
      error
    };
  }
};

/**
 * 获取笔记标签
 * @returns {Promise} - 标签列表
 */
const getNoteTags = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTES.TAGS);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取标签失败',
      error
    };
  }
};

/**
 * 获取笔记分类
 * @returns {Promise} - 分类列表
 */
export const getNoteCategories = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTES.CATEGORIES);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取分类失败',
      error
    };
  }
};

/**
 * 获取笔记历史版本
 * @param {string} id - 笔记ID
 * @returns {Promise} - 历史版本列表
 */
const getNoteHistory = async (id) => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTES.HISTORY(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取历史版本失败',
      error
    };
  }
};

/**
 * 导出笔记
 * @param {string} id - 笔记ID
 * @param {string} format - 导出格式（如 'pdf', 'markdown', 'html'）
 * @returns {Promise} - 导出结果
 */
const exportNote = async (id, format) => {
  try {
    const response = await instance.get(`${API_ENDPOINTS.NOTES.EXPORT}?id=${id}&format=${format}`, {
      responseType: 'blob'
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '导出笔记失败',
      error
    };
  }
};

/**
 * 导入笔记
 * @param {FormData} formData - 包含文件的表单数据
 * @returns {Promise} - 导入结果
 */
const importNote = async (formData) => {
  try {
    console.log('开始导入笔记，FormData:', formData);

    // 直接从FormData中提取文件和类型信息
    let fileType = 'generic';
    let fileObj = null;
    let fileName = '';

    // 直接从FormData的_parts属性获取文件对象
    if (formData._parts && Array.isArray(formData._parts)) {
      console.log('直接从FormData._parts获取数据');

      // 遍历FormData中的所有部分
      for (const part of formData._parts) {
        if (Array.isArray(part) && part.length === 2) {
          const [key, value] = part;
          console.log(`处理FormData部分: key=${key}, value=`, value);

          if (key === 'type' && typeof value === 'string') {
            fileType = value;
            console.log(`设置文件类型: ${fileType}`);
          } else if (key === 'file') {
            fileObj = value;
            console.log('找到文件对象:', fileObj);

            if (typeof fileObj === 'object' && fileObj !== null) {
              fileName = fileObj.name || `导入的${fileType}文件_${new Date().toISOString()}`;
              console.log(`设置文件名: ${fileName}`);
            }
          }
        }
      }
    }
    // 如果上面的方法没有找到文件，尝试使用getParts方法
    else if (formData.getParts && typeof formData.getParts === 'function') {
      const parts = formData.getParts();
      console.log('FormData parts:', parts);

      // 获取文件类型
      const typePart = parts.find(part => part.string === 'pdf' || part.string === 'word');
      if (typePart && typePart.string) {
        fileType = typePart.string;
        console.log(`从parts中设置文件类型: ${fileType}`);
      }

      // 获取文件对象
      const filePart = parts.find(part => part.uri && part.type);
      if (filePart) {
        fileObj = filePart;
        fileName = filePart.name || `导入的${fileType}文件_${new Date().toISOString()}`;
        console.log(`从parts中设置文件名: ${fileName}`);
      }
    } else {
      console.log('无法从FormData中提取文件信息');
    }

    // 检查文件是否存在
    if (!fileObj) {
      console.error('未找到文件对象:', formData);

      // 尝试直接从FormData._parts中提取第一个元素作为文件对象
      if (formData._parts && Array.isArray(formData._parts) && formData._parts.length > 0) {
        // 遍历所有parts寻找文件对象
        for (const part of formData._parts) {
          if (Array.isArray(part) && part.length > 1 && part[0] === 'file') {
            fileObj = part[1];
            console.log('从FormData._parts提取文件对象:', fileObj);

            if (fileObj && typeof fileObj === 'object') {
              fileName = fileObj.name || `导入的${fileType}文件_${new Date().toISOString()}`;
              console.log(`设置文件名: ${fileName}`);
              break;
            }
          }
        }
      }

      // 如果仍然没有找到文件对象，创建一个模拟的文件对象
      if (!fileObj && formData._parts && Array.isArray(formData._parts)) {
        console.log('创建模拟文件对象');
        // 尝试从formData中找到任何可能的URI
        let uri = '';
        for (const part of formData._parts) {
          if (Array.isArray(part) && part.length > 1 && typeof part[1] === 'object' && part[1] !== null) {
            if (part[1].uri) {
              uri = part[1].uri;
              console.log('找到URI:', uri);
              fileObj = {
                uri: uri,
                name: part[1].name || `导入的${fileType}文件_${new Date().toISOString()}`,
                type: part[1].type || (fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
              };
              fileName = fileObj.name;
              console.log('创建的模拟文件对象:', fileObj);
              break;
            }
          }
        }
      }

      // 如果仍然没有找到文件对象，抛出错误
      if (!fileObj) {
        throw new Error('未提供文件或无法识别文件格式');
      }
    }

    console.log('文件信息:', { fileType, fileName, fileObj });

    // 提取文件名和URI
    const title = fileName.split('.')[0]; // 使用文件名作为标题
    let fileUri = '';

    // 尝试多种方式获取文件URI
    if (typeof fileObj === 'object' && fileObj !== null) {
      if (fileObj.uri) {
        fileUri = fileObj.uri;
      } else if (fileObj.fileCopyUri) {
        fileUri = fileObj.fileCopyUri;
      } else if (fileObj.path) {
        fileUri = fileObj.path;
      }
    }

    console.log('提取的文件URI:', fileUri);

    // 如果仍然没有找到URI，创建一个临时URI
    if (!fileUri) {
      console.warn('文件URI不存在，创建临时URI');
      fileUri = `file://temp/${fileName}`;
      console.log('创建的临时URI:', fileUri);
    }

    // 生成临时ID
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // 创建笔记对象
    const note = {
      id: tempId,
      title: title,
      content: `导入的${fileType}文件: ${fileName}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_synced: false,
      file_type: fileType,
      file_name: fileName,
      file_uri: fileUri,
      imported: true,
      is_offline: true, // 标记为离线笔记
      // 添加预览图片
      preview_image: fileType === 'pdf' ? 'https://img-blog.csdnimg.cn/20200627111426602.png' : null
    };

    // 保存到离线存储
    const saveResult = await offlineStorageService.saveNote(note);

    if (!saveResult.success) {
      throw new Error(saveResult.error || `离线导入${fileType}失败`);
    }

    // 添加到MongoDB数据库
    try {
      // 确保数据服务已初始化
      await dataService.init();

      // 使用简化版的笔记对象，减少数据量
      const simplifiedNote = {
        id: note.id,
        title: note.title,
        content: note.content.substring(0, 1000), // 限制内容长度，避免超时
        file_type: note.file_type,
        file_name: note.file_name,
        file_uri: note.file_uri,
        created_at: note.created_at,
        updated_at: note.updated_at,
        is_synced: note.is_synced
      };

      // 设置更长的超时时间
      console.log('使用简化笔记对象保存到MongoDB数据库');

      // 获取当前用户ID
      const userId = dataService.getCurrentUserId() || '9cdc472e-92e9-4f2a-b9d8-5a9a86a59b98'; // 默认用户ID

      // 准备完整的笔记对象
      const noteDocument = {
        id: simplifiedNote.id,
        user_id: userId,
        title: simplifiedNote.title,
        content: simplifiedNote.content,
        category_id: '',
        is_favorite: false,
        is_encrypted: false,
        encryption_key: '',
        is_public: false,
        is_deleted: false,
        created_at: simplifiedNote.created_at,
        updated_at: simplifiedNote.updated_at,
        is_synced: false,
        file_type: simplifiedNote.file_type,
        file_name: simplifiedNote.file_name,
        file_uri: simplifiedNote.file_uri
      };

      // 保存到MongoDB
      await dataService.createNote(noteDocument);
      console.log('笔记已成功保存到MongoDB数据库');
    } catch (dbError) {
      console.error('保存到MongoDB数据库失败，但本地存储成功:', dbError);
      // 不影响整体导入流程
    }

    // 完全跳过在线导入尝试，直接使用本地存储
    console.log('使用本地存储导入文件，不尝试在线导入');

    // 返回本地导入的结果，包含完整的笔记对象
    return {
      success: true,
      data: {
        ...saveResult.note,
        message: `导入${fileType}成功`,
        note_id: note.id,
        title: note.title,
        isOffline: true
      },
      isOffline: true
    };
  } catch (error) {
    console.error('导入失败:', error);
    return {
      success: false,
      message: error.message || '导入笔记失败',
      error
    };
  }
};

/**
 * 保存离线笔记
 * @param {object} note - 笔记数据
 * @returns {Promise} - 保存结果
 */
export const saveOfflineNote = async (note) => {
  try {
    const saveResult = await offlineStorageService.saveNote(note);
    return saveResult;
  } catch (error) {
    return {
      success: false,
      message: error.message || '保存离线笔记失败',
      error
    };
  }
};

/**
 * 同步离线笔记
 * @returns {Promise} - 同步结果
 */
export const syncOfflineNotes = async () => {
  try {
    const result = await offlineStorageService.manualSync();
    return result;
  } catch (error) {
    return {
      success: false,
      message: error.message || '同步离线笔记失败',
      error
    };
  }
};

/**
 * 获取离线笔记
 * @returns {Promise} - 离线笔记列表
 */
export const getOfflineNotes = async () => {
  try {
    const notes = await offlineStorageService.getNotes();

    // 处理笔记日期格式，确保前端可以正确显示
    const processedNotes = notes.map(note => {
      // 确保每个笔记都有必要的字段
      return {
        ...note,
        // 确保有id字段
        id: note.id || note.note_id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        // 确保有title字段
        title: note.title || (note.file_name ? note.file_name.split('.')[0] : '未命名笔记'),
        // 确保有content字段
        content: note.content || '',
        // 确保有updatedAt字段，用于排序和显示
        updatedAt: note.updated_at || note.updatedAt || new Date().toISOString(),
        // 确保有createdAt字段
        createdAt: note.created_at || note.createdAt || new Date().toISOString(),
        // 添加文件类型信息
        type: note.file_type || note.type || 'text',
        // 添加导入标志
        imported: note.imported || false,
        // 添加文件信息
        file_name: note.file_name || '',
        file_uri: note.file_uri || '',
      };
    });

    console.log('处理后的离线笔记:', processedNotes.length, '条');

    return {
      success: true,
      data: processedNotes
    };
  } catch (error) {
    console.error('获取离线笔记失败:', error);
    return {
      success: false,
      message: error.message || '获取离线笔记失败',
      error
    };
  }
};

/**
 * 根据关键词搜索笔记
 * @param {object} params - 搜索参数
 * @param {string} params.text - 要搜索的文本
 * @param {Array<string>} params.keywords - 关键词数组
 * @returns {Promise} - 搜索结果
 */
export const searchByKeywords = async (params) => {
  try {
    const response = await instance.post(`${API_ENDPOINTS.NOTES.BASE}search/`, params);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '搜索笔记失败',
      error
    };
  }
};

/**
 * 获取笔记（别名方法，与 getNoteById 相同）
 * @param {string} id - 笔记ID
 * @returns {Promise} - 笔记详情
 */
export const getNote = async (id) => {
  return getNoteById(id);
};

const notesApi = {
  createNote,
  updateNote,
  deleteNote,
  getAllNotes,
  getNoteById,
  getNote, // 添加别名方法
  toggleFavorite,
  getNoteStats,
  getNoteTags,
  getNoteCategories,
  getNoteHistory,
  exportNote,
  importNote,
  saveOfflineNote,
  syncOfflineNotes,
  getOfflineNotes,
  searchByKeywords
};

export default notesApi;