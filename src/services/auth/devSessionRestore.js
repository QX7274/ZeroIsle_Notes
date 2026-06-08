import authApi from '../api/authApi';
import authStorage from './authStorage';
import tokenService from './tokenService';
import { saveAuthInfo } from './authUtils';
import { API_URL, API_VERSION, DEV_MODE_CONFIG } from '../../config';

const DEV_DIRECT_LOGIN_PHONE = '13800138000';
const DEV_DIRECT_LOGIN_CODE = '1234';

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

    // 优先走当前已验证可用的直登口径，避免验证码发送链在真机联调时
    // 因网络/限流/权限细节导致静默恢复失败，进而让社区详情误退回匿名态。
    const directLoginHttpResponse = await fetch(`${API_URL}/api/${API_VERSION}/auth/login/`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: DEV_DIRECT_LOGIN_PHONE,
        identifier: DEV_DIRECT_LOGIN_PHONE,
        verification_code: DEV_DIRECT_LOGIN_CODE,
      }),
    });

    const directPayload = await directLoginHttpResponse.json();
    const directAccessToken = directPayload?.access || directPayload?.token || null;
    const directRefreshToken = directPayload?.refresh || null;
    const directUser = directPayload?.user || null;

    if (directLoginHttpResponse.ok && directAccessToken && directUser) {
      await saveAuthInfo(directAccessToken, directRefreshToken, directUser);

      return {
        token: directAccessToken,
        refreshToken: directRefreshToken,
        user: directUser,
      };
    }

    console.log('DevSessionRestore: 直登口径未命中，回退验证码链');

    const verificationResponse = await authApi.sendVerificationCode({
      phone: DEV_DIRECT_LOGIN_PHONE,
      purpose: 'login',
    });

    const verificationCode =
      verificationResponse?.data?.code
      || verificationResponse?.code
      || '';

    if (!verificationCode) {
      console.log('DevSessionRestore: 未获取到验证码');
      return null;
    }

    const loginResponse = await authApi.loginWithCode({
      phone: DEV_DIRECT_LOGIN_PHONE,
      code: verificationCode,
    });

    const payload = loginResponse?.data || loginResponse;
    const accessToken = payload?.access || payload?.token || null;
    const refreshToken = payload?.refresh || null;
    const user = payload?.user || null;

    if (!accessToken || !user) {
      console.log('DevSessionRestore: 登录返回缺少 token 或 user');
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
