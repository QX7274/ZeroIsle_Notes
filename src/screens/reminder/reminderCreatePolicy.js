const NETWORK_ERROR_MESSAGES = ['网络', 'offline', 'Network'];

const getHttpStatus = (error) => Number(
  error?.response?.status
  ?? error?.status
  ?? error?.statusCode
);

export const shouldFallbackToLocalReminder = (error, isDeveloperDirectEntry = false) => {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403) {
    return Boolean(isDeveloperDirectEntry);
  }

  return Boolean(
    error?.isOfflineError
    || error?.isNetworkError
    || NETWORK_ERROR_MESSAGES.some(message => error?.message?.includes(message))
  );
};

export default shouldFallbackToLocalReminder;
