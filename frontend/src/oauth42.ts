import { api } from './api-client';

interface OAuth42Config {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

interface OAuth42User {
  id: number;
  email: string;
  login: string;
  displayname: string;
  image_url: string;
  campus: Array<{
    id: number;
    name: string;
  }>;
  cursus: Array<{
    cursus: {
      id: number;
      name: string;
    };
    level: number;
    grade: string;
  }>;
}

class OAuth42Manager {
  private config: OAuth42Config;

  constructor() {
    this.config = {
      clientId: (import.meta as any).env?.VITE_OAUTH42_CLIENT_ID || '',
      redirectUri: (import.meta as any).env?.VITE_OAUTH42_REDIRECT_URI || `https://app.localhost/auth/oauth42/callback`,
      scopes: ['public']
    };
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.clientId &&
      this.config.clientId !== 'demo_client_id' &&
      this.config.clientId.trim() !== '' &&
      !this.config.clientId.startsWith('your_') &&
      this.config.clientId.length > 10
    );
  }

  generateAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      ...(state && { state })
    });

    return `https://api.intra.42.fr/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, state?: string): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const data = await api('/auth/oauth42/callback', {
        method: 'POST',
        body: JSON.stringify({
          code,
          state,
          redirect_uri: this.config.redirectUri
        })
      });

      if (data.token) {
        return { success: true, token: data.token };
      } else {
        return { success: false, error: data.error || 'Token exchange failed' };
      }
    } catch (error: any) {
      return { success: false, error: `Network error: ${error.message}` };
    }
  }

  async getUserFromToken(token: string): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const response = await fetch('https://api.intra.42.fr/v2/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData: OAuth42User = await response.json();

        const user = {
          id: userData.id,
          email: userData.email,
          displayName: userData.displayname || userData.login,
          login: userData.login,
          imageUrl: userData.image_url,
          campus: userData.campus?.[0]?.name || 'Unknown',
          level: userData.cursus?.[0]?.level || 0,
          grade: userData.cursus?.[0]?.grade || 'novice',
          isOAuth42: true
        };

        return { success: true, user };
      } else {
        const errorText = await response.text();
        return { success: false, error: `API 42 Error [${response.status}]: ${errorText || response.statusText}` };
      }
    } catch (error: any) {
      return { success: false, error: `Network error: ${error.message}` };
    }
  }

  generateState(): string {
    return crypto.randomUUID();
  }

  isCallbackUrl(): boolean {
    return window.location.pathname === '/auth/42/callback';
  }

  getCallbackParams(): { code?: string; state?: string; error?: string } {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      code: urlParams.get('code') || undefined,
      state: urlParams.get('state') || undefined,
      error: urlParams.get('error') || undefined
    };
  }
}

export const oauth42Manager = new OAuth42Manager();
export type { OAuth42User };
