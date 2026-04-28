import { STORAGE_KEYS } from '../../../config';

jest.mock('axios');
jest.mock('react-native-keychain', () => ({
    setGenericPassword: jest.fn(async () => true),
    getGenericPassword: jest.fn(async () => null),
    resetGenericPassword: jest.fn(async () => true),
}));

describe('TokenService', () => {
    let tokenService;
    let axios;
    let keychain;
    let mockPost;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        axios = require('axios');
        keychain = require('react-native-keychain');

        mockPost = jest.fn();
        axios.create.mockReturnValue({ post: mockPost });

        tokenService = require('../tokenService').default;
    });

    it('saveAccessToken should persist token to keychain', async () => {
        await tokenService.saveAccessToken('new_token');

        expect(keychain.setGenericPassword).toHaveBeenCalledWith(
            'access_token',
            expect.stringContaining('new_token'),
            { service: STORAGE_KEYS.AUTH_TOKEN }
        );
    });

    it('getAccessToken should return token data if valid', async () => {
        const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        keychain.getGenericPassword.mockResolvedValue({
            password: JSON.stringify({ token: 'valid_token', expires_at: futureDate }),
        });

        const result = await tokenService.getAccessToken();

        expect(result).toEqual(expect.objectContaining({ token: 'valid_token' }));
    });

    it('getAccessToken should return null if expired', async () => {
        const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        keychain.getGenericPassword.mockResolvedValue({
            password: JSON.stringify({ token: 'expired_token', expires_at: pastDate }),
        });

        const result = await tokenService.getAccessToken();
        expect(result).toBeNull();
    });

    it('refreshAccessToken should call refresh endpoint and save new token', async () => {
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        keychain.getGenericPassword.mockResolvedValue({
            password: JSON.stringify({ token: 'refresh_token_1', expires_at: futureDate }),
        });

        mockPost.mockResolvedValue({
            data: { access: 'new_access_token', refresh: 'new_refresh_token' },
        });

        await tokenService.refreshAccessToken();

        expect(mockPost).toHaveBeenCalledWith(expect.any(String), { refresh: 'refresh_token_1' });
        expect(keychain.setGenericPassword).toHaveBeenCalledWith(
            'access_token',
            expect.stringContaining('new_access_token'),
            { service: STORAGE_KEYS.AUTH_TOKEN }
        );
    });
});
