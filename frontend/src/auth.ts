import { api } from './api-client';
import { t } from './i18n/index.js';

interface User {
  id: number;
  email: string;
  displayName: string;
  createdAt?: string;
  accountType?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type AuthListener = (state: AuthState) => void;

class AuthManager {
  private state: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true
  };

  private listeners: AuthListener[] = [];
  private refreshTimer: number | null = null;

  constructor() {
    this.loadStoredAuth();
    this.startTokenRefresh();
  }

  onAuthChange(listener: AuthListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  private updateState(updates: Partial<AuthState>) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private loadStoredAuth(): void {
    try {
      const storedAuth = localStorage.getItem('ft_transcendence_auth');
      if (storedAuth) {
        const { user, token, expiresAt } = JSON.parse(storedAuth);

        if (expiresAt && Date.now() < expiresAt) {
          this.updateState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false
          });

          return;
        } else {

          this.clearStoredAuth();
        }
      }
    } catch (error) {
      this.clearStoredAuth();
    }

    this.updateState({ isLoading: false });
  }

  private storeAuth(user: User, token: string) {
    try {
      const expiresAt = Date.now() + (14 * 60 * 1000);

      localStorage.setItem('ft_transcendence_auth', JSON.stringify({
        user,
        token,
        expiresAt
      }));
    } catch (error) {
      console.error('Failed to store auth:', error);
    }
  }

  private clearStoredAuth() {
    localStorage.removeItem('ft_transcendence_auth');
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private startTokenRefresh() {
    this.refreshTimer = window.setInterval(async () => {
      if (this.state.isAuthenticated && this.state.token) {
        await this.refreshToken();
      }
    }, 12 * 60 * 1000);
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const data = await api('/auth/refresh', {
        method: 'POST'
      });

      if (data.token) {
        this.updateState({ token: data.token });
        if (this.state.user) {
          this.storeAuth(this.state.user, data.token);
        }

        return true;
      }

      this.logout();
      return false;
    } catch (error) {
      return false;
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.updateState({ isLoading: true });

      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (data.user && data.token) {
        this.updateState({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          isLoading: false
        });

        this.storeAuth(data.user, data.token);

        return { success: true };
      } else {
        this.updateState({ isLoading: false });
        return { success: false, error: data.error || t('errors.loginFailedGeneric') };
      }
    } catch (error) {
      this.updateState({ isLoading: false });
      return { success: false, error: error instanceof Error ? error.message : t('errors.networkError') };
    }
  }

  async signup(email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.updateState({ isLoading: true });

      const data = await api('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName })
      });

      if (data.user && data.token) {
        this.updateState({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          isLoading: false
        });

        this.storeAuth(data.user, data.token);

        return { success: true };
      } else {
        this.updateState({ isLoading: false });
        return { success: false, error: data.error || t('errors.signupFailedGeneric') };
      }
    } catch (error) {
      this.updateState({ isLoading: false });
      return { success: false, error: error instanceof Error ? error.message : t('errors.networkError') };
    }
  }

  async logout() {
    try {
      await api('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({})
      });
    } catch (error) {
      console.warn('Server logout failed:', error);
    }

    this.clearStoredAuth();
    this.updateState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false
    });
  }

  getState(): AuthState {
    return { ...this.state };
  }

  getCurrentUser(): User | null {
    return this.state.user;
  }

  getToken(): string | null {
    return this.state.token;
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  isLoading(): boolean {
    return this.state.isLoading;
  }

  async updateProfile(updates: Partial<User>): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.state.user || !this.state.token) {
        return { success: false, error: 'Non authentifié' };
      }

      await api('/users/profile', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify(updates)
      });

      const updatedUser = { ...this.state.user, ...updates };
      this.updateState({ user: updatedUser });
      this.storeAuth(updatedUser, this.state.token);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || t('errors.networkError') };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.state.user || !this.state.token) {
        return { success: false, error: 'Non authentifié' };
      }

      const data = await api('/auth/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (data.token) {
        this.updateState({ token: data.token });
        if (this.state.user) {
          this.storeAuth(this.state.user, data.token);
        }
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || t('errors.networkError') };
    }
  }

  async changeEmail(newEmail: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.state.user || !this.state.token) {
        return { success: false, error: 'Non authentifié' };
      }

      await api('/auth/change-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify({
          newEmail,
          password
        })
      });

      const updatedUser = { ...this.state.user, email: newEmail };
      this.updateState({ user: updatedUser });

      if (this.state.token) {
        this.storeAuth(updatedUser, this.state.token);
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || t('errors.networkError') };
    }
  }

  clearAuth(): void {
    localStorage.removeItem('ft_transcendence_auth');
    this.updateState({ 
      user: null, 
      token: null, 
      isAuthenticated: false,
      isLoading: false 
    });
  }

  async deleteAccount(password?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.state.user || !this.state.token) {
        return { success: false, error: 'Non authentifié' };
      }

      const requestBody = this.state.user.accountType === 'oauth42' ? {} : { password };

      await api('/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify(requestBody)
      });

      this.clearAuth();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || t('errors.networkError') };
    }
  }

  async loginWithOAuth42(code: string, state?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const data = await api('/auth/oauth42/callback', {
        method: 'POST',
        body: JSON.stringify({
          code,
          state,
          redirect_uri: (import.meta as any).env?.VITE_OAUTH42_REDIRECT_URI || `${window.location.origin}/auth/oauth42/callback`
        })
      });

      this.updateState({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false
      });

      this.storeAuth(data.user, data.token);
      this.startTokenRefresh();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || t('errors.networkError') };
    }
  }
}

export const authManager = new AuthManager();
export type { User, AuthState };
