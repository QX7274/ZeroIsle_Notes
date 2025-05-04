/**
 * 权限钩子
 * 用于请求和检查应用权限
 */
import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

/**
 * 权限钩子
 * @param {string} permissionType - 权限类型，如'camera', 'microphone', 'storage'
 * @returns {Object} - { status, requestPermission }
 */
function usePermissions(permissionType) {
  const [status, setStatus] = useState(null);

  // 获取对应平台的权限
  const getPermission = useCallback(() => {
    switch (permissionType) {
      case 'camera':
        return Platform.select({
          ios: PERMISSIONS.IOS.CAMERA,
          android: PERMISSIONS.ANDROID.CAMERA,
        });
      case 'microphone':
        return Platform.select({
          ios: PERMISSIONS.IOS.MICROPHONE,
          android: PERMISSIONS.ANDROID.RECORD_AUDIO,
        });
      case 'storage':
        return Platform.select({
          ios: PERMISSIONS.IOS.PHOTO_LIBRARY,
          android: PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
        });
      case 'location':
        return Platform.select({
          ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
          android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        });
      default:
        return null;
    }
  }, [permissionType]);

  // 检查权限状态
  const checkPermission = useCallback(async () => {
    const permission = getPermission();
    if (!permission) return;

    try {
      const result = await check(permission);
      setStatus(result);
    } catch (error) {
      console.error('Error checking permission:', error);
      setStatus(RESULTS.DENIED);
    }
  }, [getPermission]);

  // 请求权限
  const requestPermission = useCallback(async () => {
    const permission = getPermission();
    if (!permission) return;

    try {
      const result = await request(permission);
      setStatus(result);
      return result;
    } catch (error) {
      console.error('Error requesting permission:', error);
      setStatus(RESULTS.DENIED);
      return RESULTS.DENIED;
    }
  }, [getPermission]);

  // 初始检查权限
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return { status, requestPermission };
}

export default usePermissions;
