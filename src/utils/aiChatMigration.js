/**
 * AI聊天数据迁移工具
 * 用于将旧的数据格式迁移到新的格式
 */

import realmService from '../services/database/realmService';
import { logService } from './logService';

/**
 * 迁移AI聊天数据
 * 将messages从对象数组转换为JSON字符串
 */
export async function migrateAIChatData() {
  try {
    const realm = await realmService.getRealm();
    const chats = realm.objects('AIChat');

    let migratedCount = 0;

    realm.write(() => {
      for (const chat of chats) {
        try {
          // 检查messages是否需要迁移
          if (chat.messages && typeof chat.messages !== 'string') {
            // 如果messages是数组，转换为JSON字符串
            if (Array.isArray(chat.messages)) {
              chat.messages = JSON.stringify(chat.messages);
              migratedCount++;
            }
            // 如果messages是对象，也转换为JSON字符串
            else if (typeof chat.messages === 'object') {
              chat.messages = JSON.stringify([]);
              migratedCount++;
            }
          }
          // 如果messages为空或undefined，设置为空数组的JSON字符串
          else if (!chat.messages) {
            chat.messages = '[]';
            migratedCount++;
          }

          // 确保_id和user_id是字符串类型
          if (chat._id && typeof chat._id !== 'string') {
            chat._id = chat._id.toString();
          }
          if (chat.user_id && typeof chat.user_id !== 'string') {
            chat.user_id = chat.user_id.toString();
          }
        } catch (chatError) {
          logService.error(`迁移聊天记录失败: ${chat._id}`, chatError);
        }
      }
    });

    if (migratedCount > 0) {
      logService.info(`成功迁移 ${migratedCount} 条AI聊天记录`);
    }

    return { success: true, migratedCount };
  } catch (error) {
    logService.error('AI聊天数据迁移失败', error);
    return { success: false, error: error.message };
  }
}

/**
 * 验证AI聊天数据格式
 * 检查所有聊天记录是否符合新的数据格式
 */
export async function validateAIChatData() {
  try {
    const realm = await realmService.getRealm();
    const chats = realm.objects('AIChat');

    const issues = [];

    for (const chat of chats) {
      // 检查messages是否为字符串
      if (typeof chat.messages !== 'string') {
        issues.push({
          chatId: chat._id,
          issue: 'messages不是字符串类型',
          currentType: typeof chat.messages,
        });
      } else {
        // 尝试解析messages
        try {
          JSON.parse(chat.messages);
        } catch (e) {
          issues.push({
            chatId: chat._id,
            issue: 'messages不是有效的JSON字符串',
            error: e.message,
          });
        }
      }

      // 检查_id是否为字符串
      if (chat._id && typeof chat._id !== 'string') {
        issues.push({
          chatId: chat._id,
          issue: '_id不是字符串类型',
          currentType: typeof chat._id,
        });
      }

      // 检查user_id是否为字符串（如果存在）
      if (chat.user_id && typeof chat.user_id !== 'string') {
        issues.push({
          chatId: chat._id,
          issue: 'user_id不是字符串类型',
          currentType: typeof chat.user_id,
        });
      }
    }

    if (issues.length > 0) {
      logService.warn(`发现 ${issues.length} 个数据格式问题`, issues);
    }

    return {
      success: true,
      totalChats: chats.length,
      issues: issues,
      isValid: issues.length === 0,
    };
  } catch (error) {
    logService.error('验证AI聊天数据失败', error);
    return { success: false, error: error.message };
  }
}

export default {
  migrateAIChatData,
  validateAIChatData,
};



