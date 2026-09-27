import authStorage from './authStorage';
import tokenService from './tokenService';
import { saveAuthInfo } from './authUtils';
import authApi from '../api/authApi';
import { DEV_MODE_CONFIG } from '../../config';

const DEV_DIRECT_LOGIN_USERNAME = DEV_MODE_CONFIG?.DEV_ACCOUNT?.username || 'developer';
const getDevDirectLoginPassword = () => process.env.ZEROISLE_DEV_PASSWORD || '';

export const shouldAttemptDevSessionRestore = () => (
  __DEV__
  && Boolean(DEV_MODE_CONFIG?.ENABLED)
  && !Boolean(DEV_MODE_CONFIG?.FEATURES?.SKIP_LOGIN_SCREEN)
);

export const tryRestoreDevSession = async (options = {}) => {
  const {
    forceRefresh = false,
  } = options;

  if (!shouldAttemptDevSessionRestore()) {
    return null;
  }

  if (!forceRefresh) {
    const existingTokenData = await tokenService.getAccessToken();
    const existingAccessToken = typeof existingTokenData === 'string'
      ? existingTokenData
      : existingTokenData?.token;

    if (existingAccessToken) {
      const refreshTokenData = await tokenService.getRefreshToken();
      const existingRefreshToken = typeof refreshTokenData === 'string'
        ? refreshTokenData
        : refreshTokenData?.token || null;
      const existingUser = await authStorage.getUser();
      return {
        token: existingAccessToken,
        refreshToken: existingRefreshToken,
        user: existingUser || null,
      };
    }
  } else {
    console.log('DevSessionRestore: 收到强制刷新请求，跳过本地旧 token 复用');
  }

  try {
    console.log('DevSessionRestore: 尝试恢复开发态真实认证');

    const devDirectLoginPassword = getDevDirectLoginPassword();
    if (!devDirectLoginPassword) {
      console.warn('DevSessionRestore: 未配置 ZEROISLE_DEV_PASSWORD，跳过开发者直登');
      return null;
    }

    const loginResponse = await authApi.login({
      username: DEV_DIRECT_LOGIN_USERNAME,
      password: devDirectLoginPassword,
    });

    const payload = loginResponse?.data || loginResponse;
    const accessToken = payload?.access || payload?.token || null;
    const refreshToken = payload?.refresh || null;
    const user = payload?.user || null;

    if (!accessToken || !user) {
      console.log('DevSessionRestore: 开发者账号登录返回缺少 token 或 user');
      return null;
    }

    await saveAuthInfo(accessToken, refreshToken, user);

    return {
      token: accessToken,
      refreshToken,
      user,
    };
  } catch (error) {
    console.warn('DevSessionRestore: 恢复失败:', error?.message || error);
    return null;
  }
};

export default tryRestoreDevSession;
