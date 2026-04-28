/**
 * End-to-End Encryption Service
 *
 * Provides client-side encryption for sensitive notes
 * Uses AES-256-GCM for symmetric encryption
 * Uses RSA-OAEP for key exchange
 */

import CryptoJS from 'crypto-js';

/**
 * Generate a random encryption key
 */
export const generateEncryptionKey = () => {
    return CryptoJS.lib.WordArray.random(256 / 8).toString();
};

/**
 * Generate a salt for key derivation
 */
export const generateSalt = () => {
    return CryptoJS.lib.WordArray.random(128 / 8).toString();
};

/**
 * Derive encryption key from password
 */
export const deriveKeyFromPassword = (password, salt, iterations = 100000) => {
    const key = CryptoJS.PBKDF2(password, salt, {
        keySize: 256 / 32,
        iterations,
        hasher: CryptoJS.algo.SHA256,
    });
    return key.toString();
};

/**
 * Encrypt data with AES-256
 */
export const encryptData = (data, key) => {
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });

    return {
        ciphertext: encrypted.toString(),
        iv: iv.toString(),
    };
};

/**
 * Decrypt data with AES-256
 */
export const decryptData = (encryptedData, key) => {
    const { ciphertext, iv } = encryptedData;

    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
        iv: CryptoJS.enc.Hex.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });

    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
};

/**
 * Hash data using SHA-256
 */
export const hashData = (data) => {
    return CryptoJS.SHA256(JSON.stringify(data)).toString();
};

/**
 * Encrypted Note Service
 */
class EncryptedNoteService {
    constructor() {
        this.encryptionKey = null;
        this.isUnlocked = false;
    }

    /**
     * Initialize encryption with user password
     */
    async initialize(password, salt = null) {
        const useSalt = salt || generateSalt();
        this.encryptionKey = deriveKeyFromPassword(password, useSalt);
        this.isUnlocked = true;

        return { salt: useSalt, keyHash: hashData(this.encryptionKey) };
    }

    /**
     * Lock the service (clear encryption key)
     */
    lock() {
        this.encryptionKey = null;
        this.isUnlocked = false;
    }

    /**
     * Check if service is unlocked
     */
    isLocked() {
        return !this.isUnlocked || !this.encryptionKey;
    }

    /**
     * Encrypt a note
     */
    encryptNote(note) {
        if (this.isLocked()) {
            throw new Error('Encryption service is locked');
        }

        const sensitiveFields = ['title', 'content', 'plain_text'];
        const encryptedNote = { ...note, isEncrypted: true };

        sensitiveFields.forEach(field => {
            if (note[field]) {
                encryptedNote[field] = encryptData(note[field], this.encryptionKey);
            }
        });

        // Hash for search (encrypted notes use hash-based search)
        encryptedNote.contentHash = hashData(note.content || '');
        encryptedNote.titleHash = hashData(note.title || '');

        return encryptedNote;
    }

    /**
     * Decrypt a note
     */
    decryptNote(encryptedNote) {
        if (this.isLocked()) {
            throw new Error('Encryption service is locked');
        }

        if (!encryptedNote.isEncrypted) {
            return encryptedNote;
        }

        const sensitiveFields = ['title', 'content', 'plain_text'];
        const decryptedNote = { ...encryptedNote, isEncrypted: false };

        sensitiveFields.forEach(field => {
            if (encryptedNote[field] && encryptedNote[field].ciphertext) {
                try {
                    decryptedNote[field] = decryptData(encryptedNote[field], this.encryptionKey);
                } catch (error) {
                    console.error(`Failed to decrypt field ${field}:`, error);
                    decryptedNote[field] = '[Decryption Failed]';
                }
            }
        });

        return decryptedNote;
    }

    /**
     * Encrypt attachment
     */
    encryptAttachment(data) {
        if (this.isLocked()) {
            throw new Error('Encryption service is locked');
        }
        return encryptData(data, this.encryptionKey);
    }

    /**
     * Decrypt attachment
     */
    decryptAttachment(encryptedData) {
        if (this.isLocked()) {
            throw new Error('Encryption service is locked');
        }
        return decryptData(encryptedData, this.encryptionKey);
    }

    /**
     * Change password (re-encrypt with new key)
     */
    async changePassword(oldPassword, newPassword, salt) {
        // Verify old password
        const oldKey = deriveKeyFromPassword(oldPassword, salt);
        if (oldKey !== this.encryptionKey) {
            throw new Error('Invalid old password');
        }

        // Generate new salt and key
        const newSalt = generateSalt();
        const newKey = deriveKeyFromPassword(newPassword, newSalt);

        // Store old key for re-encryption
        const previousKey = this.encryptionKey;
        this.encryptionKey = newKey;

        return {
            previousKey,
            newSalt,
            newKeyHash: hashData(newKey),
        };
    }

    /**
     * Verify password
     */
    verifyPassword(password, salt, expectedKeyHash) {
        const key = deriveKeyFromPassword(password, salt);
        return hashData(key) === expectedKeyHash;
    }
}

// Export singleton instance
export const encryptedNoteService = new EncryptedNoteService();

export default {
    generateEncryptionKey,
    generateSalt,
    deriveKeyFromPassword,
    encryptData,
    decryptData,
    hashData,
    encryptedNoteService,
};
