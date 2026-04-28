
import authService from '../authService';
import realmService from '../../database/realmService';
import authStorage from '../authStorage';
import { logService } from '../../../utils/logService';
import { DeviceEventEmitter } from 'react-native';
import realmJwtAuthService from '../realmJwtAuthService';

// Mock dependencies
jest.mock('../../database/realmService', () => ({
    initialize: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
    isUserLoggedIn: jest.fn(),
}));

jest.mock('../authStorage', () => ({
    getUser: jest.fn(),
    saveUser: jest.fn(),
    saveToken: jest.fn(),
    clearAuth: jest.fn(),
    getToken: jest.fn(),
    getRealmJwt: jest.fn(),
}));

jest.mock('../../../utils/logService', () => ({
    logService: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
}));

jest.mock('../realmJwtAuthService', () => ({
    loginWithJwt: jest.fn(),
    logout: jest.fn(),
    app: { currentUser: null },
}));

// Mock DeviceEventEmitter
jest.mock('react-native', () => ({
    DeviceEventEmitter: {
        emit: jest.fn(),
    },
}));

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset internal state if possible
        authService.initialized = false;
        authService.currentUser = null;
        authService.initializationPromise = null;
    });

    describe('initialize', () => {
        it('should initialize successfully', async () => {
            realmService.initialize.mockResolvedValue();
            authStorage.getUser.mockResolvedValue(null);

            await authService.initialize();

            expect(realmService.initialize).toHaveBeenCalled();
            expect(authStorage.getUser).toHaveBeenCalled();
            expect(authService.initialized).toBe(true);
        });

        it('should restore user from storage if available', async () => {
            const mockUser = { id: 'user_1', email: 'test@example.com' };
            realmService.initialize.mockResolvedValue();
            authStorage.getUser.mockResolvedValue(mockUser);

            await authService.initialize();

            expect(authService.currentUser).toEqual(mockUser);
        });
    });

    describe('loginWithEmail', () => {
        it('should throw deprecation error', async () => {
            await expect(authService.loginWithEmail('a', 'b')).rejects.toThrow('邮箱登录功能已停用');
        });
    });

    describe('logout', () => {
        it('should logout and clear storage', async () => {
            realmJwtAuthService.logout.mockResolvedValue();
            authStorage.clearAuth.mockResolvedValue();
            authService.currentUser = { id: 'u1' };

            await authService.logout();

            expect(realmJwtAuthService.logout).toHaveBeenCalled();
            expect(authStorage.clearAuth).toHaveBeenCalled();
            expect(authService.currentUser).toBeNull();
        });
    });

    describe('forceLogout', () => {
        it('should emit FORCE_LOGOUT event', async () => {
            realmJwtAuthService.logout.mockResolvedValue();
            authStorage.clearAuth.mockResolvedValue();

            await authService.forceLogout();

            expect(DeviceEventEmitter.emit).toHaveBeenCalledWith('FORCE_LOGOUT');
        });
    });
});
