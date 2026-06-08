import authApi from '../api/authApi';
import authStorage from './authStorage';
import tokenService from './tokenService';
import { saveAuthInfo } from './authUtils';
import { DEV_MODE_CONFIG } from '../../config';

const DEV_DIRECT_LOGIN_PHONE = '13800138000';

export const shouldAttemptDevSessionRestore = () => (
  __DEV__
  && Boolean(DEV_MODE_CONFIG?.ENABLED)
  && !Boolean(DEV_MODE_CONFIG?.FEATURES?.SKIP_LOGIN_SCREEN)
);

export const tryRestoreDevSession = async () => {
  if (!shouldAttemptDevSessionRestore()) {
    return null;
  }

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

  try {
    console.log('DevSessionRestore: 尝试恢复开发态真实认证');

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
