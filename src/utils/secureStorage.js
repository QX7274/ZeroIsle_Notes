/**
 * Secure Storage Adapter for Redux Persist
 * Uses react-native-keychain to store sensitive data (Auth Tokens) securely.
 */

import * as Keychain from 'react-native-keychain';
import { logService } from './logService';

const secureStorage = {
    /**
     * Get item from secure storage
     * @param {string} key
     * @returns {Promise<string|null>}
     */
    async getItem(key) {
        try {
            const credentials = await Keychain.getGenericPassword({ service: key });
            if (credentials) {
                return credentials.password;
            }
            return null;
        } catch (error) {
            logService.error(`[secureStorage] Failed to get item: ${key}`, error);
            return null;
        }
    },

    /**
     * Set item in secure storage
     * @param {string} key
     * @param {string} value
     * @returns {Promise<void>}
     */
    async setItem(key, value) {
        try {
            // Keychain stores username/password pairs. We use the key as the "service" identifier
            // and a dummy username, storing the actual data value as the password.
            await Keychain.setGenericPassword('redux_persist_user', value, { service: key });
        } catch (error) {
            logService.error(`[secureStorage] Failed to set item: ${key}`, error);
            throw error;
        }
    },

    /**
     * Remove item from secure storage
     * @param {string} key
     * @returns {Promise<void>}
     */
    async removeItem(key) {
        try {
            await Keychain.resetGenericPassword({ service: key });
        } catch (error) {
            logService.error(`[secureStorage] Failed to remove item: ${key}`, error);
            throw error;
        }
    },
};

export default secureStorage;
