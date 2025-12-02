import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { createI18nForRequest } from '../i18n/translations.js';
import { generateTOTPSecret, generateQRCode, verifyTOTPCode, generateBackupCodes, verifyBackupCode, removeUsedBackupCode } from './totp.js';
import crypto from 'crypto';
import argon2 from 'argon2';



const verifySchema = z.object({
  code: z.string().min(6).max(6)
});

const disableSchema = z.object({
  password: z.string().optional()
});

export async function register2FARoutes(app: FastifyInstance, db: Database.Database) {
  
  app.get('/auth/2fa/status', { preHandler: app.auth }, async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const user = db.prepare('SELECT totp_enabled, totp_setup_at, account_type FROM users WHERE id = ?').get(uid) as any;
      if (!user) return res.status(404).send({ error: reqI18n.t('userNotFound') });

      return res.send({
        enabled: !!user.totp_enabled,
        setupAt: user.totp_setup_at,
        accountType: user.account_type
      });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('internalError') });
    }
  });

  app.post('/auth/2fa/setup', { preHandler: app.auth }, async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const user = db.prepare('SELECT email, totp_enabled FROM users WHERE id = ?').get(uid) as any;
      if (!user) return res.status(404).send({ error: reqI18n.t('userNotFound') });

      if (user.totp_enabled) {
        return res.status(400).send({ error: reqI18n.t('twoFactorAlreadyEnabled') });
      }

      const totpData = generateTOTPSecret(user.email);
      const qrCodeDataUrl = await generateQRCode(totpData.qrCodeUrl);

      db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(totpData.secret, uid);

      return res.send({
        secret: totpData.manualEntryKey,
        qrCode: qrCodeDataUrl
      });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('twoFactorSetupFailed') });
    }
  });

  app.post('/auth/2fa/verify', { preHandler: app.auth }, async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const body = verifySchema.parse(req.body);
      
      const user = db.prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?').get(uid) as any;
      if (!user || !user.totp_secret) {
        return res.status(400).send({ error: reqI18n.t('twoFactorNoSetup') });
      }

      if (user.totp_enabled) {
        return res.status(400).send({ error: reqI18n.t('twoFactorAlreadyEnabled') });
      }

      const isValid = verifyTOTPCode(user.totp_secret, body.code);
      if (!isValid) {
        return res.status(400).send({ error: reqI18n.t('twoFactorInvalidCode') });
      }

      const backupCodesData = generateBackupCodes();

      db.prepare(`
        UPDATE users SET 
          totp_enabled = TRUE, 
          backup_codes = ?,
          totp_setup_at = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(backupCodesData.hashedCodes), uid);

      return res.send({
        success: true,
        backupCodes: backupCodesData.codes,
        message: reqI18n.t('twoFactorEnabledSuccess')
      });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('twoFactorVerifyFailed') });
    }
  });

  app.post('/auth/2fa/disable', { preHandler: app.auth }, async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const body = disableSchema.parse(req.body);
      
      const user = db.prepare('SELECT account_type, password_hash, totp_enabled FROM users WHERE id = ?').get(uid) as any;
      if (!user) return res.status(404).send({ error: reqI18n.t('userNotFound') });

      if (!user.totp_enabled) {
        return res.status(400).send({ error: reqI18n.t('twoFactorNotEnabled') });
      }

      if (user.account_type === 'local') {
        if (!body.password) {
          return res.status(400).send({ error: reqI18n.t('twoFactorPasswordRequired') });
        }
        
        const validPassword = await argon2.verify(user.password_hash, body.password);
        if (!validPassword) {
          return res.status(400).send({ error: reqI18n.t('currentPasswordIncorrect') });
        }
      }

      db.prepare(`
        UPDATE users SET 
          totp_enabled = FALSE,
          totp_secret = NULL,
          backup_codes = NULL,
          totp_setup_at = NULL
        WHERE id = ?
      `).run(uid);

      return res.send({
        success: true,
        message: reqI18n.t('twoFactorDisabledSuccess')
      });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('twoFactorDisableFailed') });
    }
  });

  app.post('/auth/2fa/backup-codes', { preHandler: app.auth }, async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).send({ error: reqI18n.t('unauthorized') });

      const user = db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(uid) as any;
      if (!user || !user.totp_enabled) {
        return res.status(400).send({ error: reqI18n.t('twoFactorNotEnabled') });
      }

      const backupCodesData = generateBackupCodes();

      db.prepare('UPDATE users SET backup_codes = ? WHERE id = ?').run(
        JSON.stringify(backupCodesData.hashedCodes), uid
      );

      return res.send({
        backupCodes: backupCodesData.codes,
        message: reqI18n.t('twoFactorBackupCodesGenerated')
      });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('twoFactorBackupCodesFailed') });
    }
  });

  app.post('/auth/2fa/login-verify', async (req: any, res: any) => {
    const reqI18n = createI18nForRequest(req.headers);
    try {
      const { tempToken, code } = req.body;
      
      if (!tempToken || !code) {
        return res.status(400).send({ error: reqI18n.t('twoFactorInvalidRequest') });
      }

      const tokenRecord = db.prepare(`
        SELECT user_id, expires_at FROM temp_login_tokens 
        WHERE token = ? AND expires_at > datetime('now')
      `).get(tempToken) as any;

      if (!tokenRecord) {
        return res.status(401).send({ error: reqI18n.t('twoFactorInvalidToken') });
      }

      const user = db.prepare(`
        SELECT id, email, display_name, totp_secret, backup_codes, account_type, oauth42_data, last_42_sync 
        FROM users WHERE id = ?
      `).get(tokenRecord.user_id) as any;

      if (!user || !user.totp_secret) {
        return res.status(400).send({ error: reqI18n.t('twoFactorNotEnabled') });
      }

      let isValidCode = false;
      let isBackupCode = false;

      if (code.length === 6 && /^\d+$/.test(code)) {
        isValidCode = verifyTOTPCode(user.totp_secret, code);
      }

      if (!isValidCode && code.length === 8) {
        const backupCodes = user.backup_codes ? JSON.parse(user.backup_codes) : [];
        const backupResult = verifyBackupCode(code, backupCodes);
        
        if (backupResult.valid) {
          isValidCode = true;
          isBackupCode = true;
          
          const newBackupCodes = removeUsedBackupCode(backupCodes, backupResult.index);
          db.prepare('UPDATE users SET backup_codes = ? WHERE id = ?').run(
            JSON.stringify(newBackupCodes), user.id
          );
        }
      }

      if (!isValidCode) {
        return res.status(400).send({ error: reqI18n.t('twoFactorInvalidCode') });
      }

      const finalToken = app.jwt.sign({
        uid: user.id,
        email: user.email,
        twoFAVerified: true
      }, { expiresIn: '15m' });

      const refreshToken = crypto.randomBytes(32).toString('base64url');
      const refreshExp = new Date();
      refreshExp.setDate(refreshExp.getDate() + 7);
      
      db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
        user.id, refreshToken, refreshExp.toISOString().replace('T', ' ').slice(0, 19)
      );

      res.setCookie('rt', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/auth',
        maxAge: 7 * 24 * 60 * 60,
        partitioned: true
      });

      db.prepare('DELETE FROM temp_login_tokens WHERE token = ?').run(tempToken);

      return res.send({
        token: finalToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          accountType: user.account_type,
          avatarUrl: user.avatar_url
        },
        usedBackupCode: isBackupCode
      });
    } catch (e) {
      app.log.error(e);
      return res.status(500).send({ error: reqI18n.t('twoFactorLoginFailed') });
    }
  });
}