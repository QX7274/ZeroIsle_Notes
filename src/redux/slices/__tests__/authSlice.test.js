
// Use doMock to handle complex mock resolutions if needed, but standard mock should work.
// Ensure we mock all top-level imports that might cause side effects.

jest.mock('../../../services/api/index', () => ({
    userApi: {
        loginWithPassword: jest.fn(),
        logout: jest.fn(),
    },
}));

jest.mock('../../../utils', () => ({
    storage: {
        set: jest.fn(),
        remove: jest.fn(),
    },
}));

jest.mock('../../../services/auth/tokenService', () => ({
    clearTokens: jest.fn(),
}));

jest.mock('../../../services/auth/authUtils', () => ({}));
jest.mock('../../../services/auth/authStorage', () => ({}));

// Mock navigation which is used at top level in authSlice
jest.mock('../../../navigation/navigationRef', () => ({
    navigate: jest.fn(),
    navigationRef: { current: null },
}));


// Import slice AFTER mocks
import authReducer, {
    setUserInfo,
    setAuthToken,
    setIsAuthenticated,
    logout,
} from '../authSlice';

describe('authSlice', () => {
    const initialState = {
        user: null,
        token: null,
        refreshToken: null,
        loading: false,
        error: null,
        isAuthenticated: false,
    };

    it('should return initial state', () => {
        expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    describe('Reducers', () => {
        it('setUserInfo should update user', () => {
            const user = { id: 1, name: 'Test' };
            const nextState = authReducer(initialState, setUserInfo(user));
            expect(nextState.user).toEqual(user);
        });

        it('setAuthToken should update token', () => {
            const token = 'xyz';
            const nextState = authReducer(initialState, setAuthToken(token));
            expect(nextState.token).toEqual(token);
        });

        it('setIsAuthenticated should update status', () => {
            const nextState = authReducer(initialState, setIsAuthenticated(true));
            expect(nextState.isAuthenticated).toBe(true);
        });
    });

    describe('Extra Reducers', () => {
        it('logout.fulfilled should reset state', () => {
            const loggedIn = { ...initialState, isAuthenticated: true, user: {} };
            const nextState = authReducer(loggedIn, { type: logout.fulfilled.type });
            expect(nextState.isAuthenticated).toBe(false);
            expect(nextState.user).toBeNull();
        });
    });
});
