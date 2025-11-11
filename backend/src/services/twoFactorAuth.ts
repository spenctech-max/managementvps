import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from '../utils/crypto';

export interface TwoFactorSecret {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export class TwoFactorAuthService {
  /**
   * Generate a new TOTP secret and QR code for user setup
   */
  static async generateSecret(username: string, issuer: string = 'Medicine Man'): Promise<TwoFactorSecret> {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${issuer} (${username})`,
      issuer,
      length: 32,
    });

    if (!secret.base32) {
      throw new Error('Failed to generate 2FA secret');
    }

    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    // Generate backup codes (8 codes, 8 characters each)
    const backupCodes = this.generateBackupCodes(8);

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Verify a TOTP token against a secret
   */
  static verifyToken(token: string, secret: string, window: number = 1): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window, // Allow 1 step before/after for clock skew
    });
  }

  /**
   * Generate backup codes for 2FA recovery
   */
  private static generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto
        .randomBytes(4)
        .toString('hex')
        .toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash backup codes for secure storage
   */
  static async hashBackupCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map(code => hashPassword(code)));
  }

  /**
   * Verify a backup code against hashed codes
   */
  static async verifyBackupCode(code: string, hashedCodes: string[]): Promise<{ valid: boolean; remainingCodes: string[] }> {
    for (let i = 0; i < hashedCodes.length; i++) {
      const isValid = await verifyPassword(code, hashedCodes[i]);
      if (isValid) {
        // Remove the used backup code
        const remainingCodes = [...hashedCodes];
        remainingCodes.splice(i, 1);
        return { valid: true, remainingCodes };
      }
    }
    return { valid: false, remainingCodes: hashedCodes };
  }

  /**
   * Regenerate backup codes
   */
  static async regenerateBackupCodes(): Promise<{ codes: string[]; hashedCodes: string[] }> {
    const codes = this.generateBackupCodes(8);
    const hashedCodes = await this.hashBackupCodes(codes);
    return { codes, hashedCodes };
  }
}
