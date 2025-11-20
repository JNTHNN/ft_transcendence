import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

export interface TOTPSecret {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

export interface BackupCodes {
  codes: string[];
  hashedCodes: string[];
}

export function generateTOTPSecret(userEmail: string, issuer: string = 'ft_transcendence'): TOTPSecret {
  const secret = speakeasy.generateSecret({
    name: userEmail,
    issuer: issuer,
    length: 32
  });

  return {
    secret: secret.base32!,
    qrCodeUrl: secret.otpauth_url!,
    manualEntryKey: secret.base32!
  };
}

export async function generateQRCode(otpauthUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
}

export function verifyTOTPCode(secret: string, code: string, window: number = 1): boolean {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: code,
    window: window
  });
}

export function generateBackupCodes(): BackupCodes {
  const codes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    
    codes.push(code);
    hashedCodes.push(hashedCode);
  }

  return { codes, hashedCodes };
}

export function verifyBackupCode(inputCode: string, hashedCodes: string[]): { valid: boolean; index: number } {
  const hashedInput = crypto.createHash('sha256').update(inputCode.toUpperCase()).digest('hex');
  const index = hashedCodes.indexOf(hashedInput);
  
  return {
    valid: index !== -1,
    index: index
  };
}

export function removeUsedBackupCode(hashedCodes: string[], index: number): string[] {
  const newCodes = [...hashedCodes];
  newCodes.splice(index, 1);
  return newCodes;
}