/**
 * 服务检查器
 * 用于检查所有服务是否正确初始化，并在必要时强制初始化
 */

import { fixServiceInitialization } from './initFix';

// 直接导入所有需要检查的服务
import realmStorageService from './storage/realmStorageService';
import apiCache from './api/apiCache';
import authStorage from './auth/authStorage';
import reminderMongoDBService from './reminder/reminderMongoDBService';
import logService from './utils/logService';
import { advancedGestureService } from './gesture/AdvancedGestureService';

// 服务映射表
const SERVICE_MAP = {
  realmStorageService,
  apiCache,
  authStorage,
  reminderMongoDBService,
  logService,
  advancedGestureService
};

// 需要检查的服务列表
const REQUIRED_SERVICES = [
  {
    name: 'realmStorageService',
    required: true // 必须成功初始化
  },
  {
    name: 'apiCache',
    required: true // 必须成功初始化
  },
  {
    name: 'authStorage',
    required: true // 必须成功初始化
  },
  {
    name: 'reminderMongoDBService',
    required: true // 必须成功初始化
  },
  {
    name: 'logService',
    required: true // 必须成功初始化
  },
  {
    name: 'advancedGestureService',
    required: false // 手势服务为可选，失败时使用基础手势
  }
];

/**
 * 检查服务是否已初始化
 * @param {Object} service 服务对象
 * @returns {boolean} 是否已初始化
 */
const isServiceInitialized = (service) => {
  return service && (
    service.initialized === true ||
    (typeof service.isInitialized === 'function' && service.isInitialized()) ||
    (typeof service.getInitialized === 'function' && service.getInitialized())
  );
};

/**
 * 检查所有服务是否已初始化
 * @returns {Promise<{success: boolean, results: Array<{name: string, initialized: boolean, required: boolean}>}>} 检查结果
 */
export const checkAllServices = async () => {
  console.log('开始检查所有服务...');

  const results = [];
  let allRequiredServicesInitialized = true;

  // 检查每个服务
  for (const serviceInfo of REQUIRED_SERVICES) {
    try {
      console.log(`检查服务: ${serviceInfo.name}`);

      // 从服务映射表中获取服务
      const service = SERVICE_MAP[serviceInfo.name];

      if (!service) {
        console.error(`服务未定义: ${serviceInfo.name}`);
        results.push({
          name: serviceInfo.name,
          initialized: false,
          required: serviceInfo.required,
          error: '服务未定义'
        });

        if (serviceInfo.required) {
          allRequiredServicesInitialized = false;
        }
        continue;
      }

      // 检查服务是否已初始化
      const initialized = isServiceInitialized(service);

      // 如果服务未初始化，尝试初始化
      if (!initialized) {
        try {
          console.log(`尝试初始化服务: ${serviceInfo.name}`);
          
          // 特殊处理手势服务
          if (serviceInfo.name === 'advancedGestureService') {
            if (typeof service.reinitialize === 'function') {
              await service.reinitialize();
            }
            // 检查初始化状态
            const isNowInitialized = service.isInitialized && service.isInitialized();
            if (isNowInitialized) {
              console.log(`手势服务初始化成功: ${serviceInfo.name}`);
              results.push({
                name: serviceInfo.name,
                initialized: true,
                required: serviceInfo.required
              });
            } else {
              throw new Error('手势服务初始化失败');
            }
          } else if (typeof service.initialize === 'function') {
            await service.initialize();
            console.log(`服务初始化成功: ${serviceInfo.name}`);

            results.push({
              name: serviceInfo.name,
              initialized: true,
              required: serviceInfo.required
            });
          } else {
            // 服务没有初始化方法，标记为未初始化
            throw new Error('服务没有初始化方法');
          }
        } catch (initError) {
          console.error(`服务初始化失败: ${serviceInfo.name}`, initError);

          results.push({
            name: serviceInfo.name,
            initialized: false,
            required: serviceInfo.required,
            error: initError.message
          });

          if (serviceInfo.required) {
            allRequiredServicesInitialized = false;
          }
        }
      } else {
        console.log(`服务状态: ${serviceInfo.name} - ${initialized ? '已初始化' : '未初始化'}`);

        results.push({
          name: serviceInfo.name,
          initialized: initialized,
          required: serviceInfo.required
        });

        if (serviceInfo.required && !initialized) {
          allRequiredServicesInitialized = false;
        }
      }
    } catch (error) {
      console.error(`检查服务失败: ${serviceInfo.name}`, error);

      results.push({
        name: serviceInfo.name,
        initialized: false,
        required: serviceInfo.required,
        error: error.message
      });

      if (serviceInfo.required) {
        allRequiredServicesInitialized = false;
      }
    }
  }

  console.log('服务检查完成');
  console.log('所有必需服务初始化状态:', allRequiredServicesInitialized ? '成功' : '失败');

  return {
    success: allRequiredServicesInitialized,
    results: results
  };
};

/**
 * 确保所有必需服务已初始化
 * @param {boolean} throwError 如果为true，则在服务初始化失败时抛出错误
 * @returns {Promise<boolean>} 是否所有必需服务都已初始化
 */
export const ensureAllServicesInitialized = async (throwError = false) => {
  console.log('确保所有必需服务已初始化...');

  // 首先检查所有服务
  const checkResult = await checkAllServices();

  // 如果所有必需服务都已初始化，直接返回成功
  if (checkResult.success) {
    console.log('所有必需服务已初始化');
    return true;
  }

  // 尝试修复服务初始化问题
  console.log('尝试修复服务初始化问题...');
  await fixServiceInitialization();

  // 再次检查所有服务
  const recheckResult = await checkAllServices();

  // 如果仍有必需服务未初始化，根据参数决定是否抛出错误
  if (!recheckResult.success && throwError) {
    const failedServices = recheckResult.results
      .filter(r => r.required && !r.initialized)
      .map(r => r.name)
      .join(', ');

    throw new Error(`必需服务初始化失败: ${failedServices}`);
  }

  return recheckResult.success;
};

export default {
  checkAllServices,
  ensureAllServicesInitialized
};
