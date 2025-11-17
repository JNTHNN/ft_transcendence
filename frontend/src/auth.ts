interface User {
  id: number;
  email: string;
  displayName: string;
  createdAt?: string;
  isDemo?: boolean;
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
          console.log('🔑 Restored authentication from storage');
          return;
        } else {
          console.log('🔑 Stored token expired, clearing...');
          this.clearStoredAuth();
        }
      }
    } catch (error) {
      console.error('Failed to load stored auth:', error);
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

      console.log('🔑 Authentication stored successfully');
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
      const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || "https://api.localhost"}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          this.updateState({ token: data.token });
          if (this.state.user) {
            this.storeAuth(this.state.user, data.token);
          }
          console.log('🔑 Token refreshed successfully');
          return true;
        }
      }

      console.warn('🔑 Token refresh failed, logging out...');
      this.logout();
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.updateState({ isLoading: true });

      const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || "https://api.localhost"}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.user && data.token) {
        this.updateState({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          isLoading: false
        });

        this.storeAuth(data.user, data.token);
        console.log('🔑 Login successful');
        return { success: true };
      } else {
        this.updateState({ isLoading: false });
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      this.updateState({ isLoading: false });
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async signup(email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.updateState({ isLoading: true });

      const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || "https://api.localhost"}/auth/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, displayName })
      });

      const data = await response.json();

      if (response.ok && data.user && data.token) {
        this.updateState({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          isLoading: false
        });

        this.storeAuth(data.user, data.token);
        console.log('🔑 Signup successful');
        return { success: true };
      } else {
        this.updateState({ isLoading: false });
        return { success: false, error: data.error || 'Signup failed' };
      }
    } catch (error) {
      this.updateState({ isLoading: false });
      console.error('Signup error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async logout() {
    try {
      await fetch(`${(import.meta as any).env?.VITE_API_URL || "https://api.localhost"}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
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

    console.log('🔑 Logged out successfully');
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

      const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || "https://api.localhost"}/users/profile`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedUser = { ...this.state.user, ...updates };
        this.updateState({ user: updatedUser });
        this.storeAuth(updatedUser, this.state.token);
        return { success: true };
      } else {
        const data = await response.json();
        return { success: false, error: data.error || 'Échec de la mise à jour' };
      }
    } catch (error: any) {
      return { success: false, error: 'Erreur de réseau: ' + error.message };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.state.user || !this.state.token) {
        return { success: false, error: 'Non authentifié' };
      }

      const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || "https://api.localhost"}/auth/change-password`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.token) {
          this.updateState({ token: data.token });
          if (this.state.user) {
            this.storeAuth(this.state.user, data.token);
          }
        }
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Échec du changement de mot de passe' };
      }
    } catch (error: any) {
      return { success: false, error: 'Erreur de réseau: ' + error.message };
    }
  }

  async changeEmail(newEmail: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.state.user || !this.state.token) {
        return { success: false, error: 'Non authentifié' };
      }

      const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || "https://api.localhost"}/auth/change-email`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          newEmail,
          password
        })
      });

      const data = await response.json();

      if (response.ok) {
        const updatedUser = { ...this.state.user, email: newEmail };
        this.updateState({ user: updatedUser });

        if (this.state.token) {
          this.storeAuth(updatedUser, this.state.token);
        }

        return { success: true };
      } else {
        return { success: false, error: data.error || 'Échec du changement d\'email' };
      }
    } catch (error: any) {
      return { success: false, error: 'Erreur de réseau: ' + error.message };
    }
  }

  clearAuth(): void {
    localStorage.removeItem('ft_transcendence_auth');
    this.updateState({ user: null, token: null });
  }

  async deleteAccount(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.state.user || !this.state.token) {
        return { success: false, error: 'Non authentifié' };
      }

      const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || "https://api.localhost"}/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        credentials: 'include',
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok) {
        this.clearAuth();
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Échec de la suppression du compte' };
      }
    } catch (error: any) {
      return { success: false, error: 'Erreur de réseau: ' + error.message };
    }
  }

  async loginWithOAuth42(code: string, state?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${(import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost"}/auth/oauth42/callback`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          code,
          state,
          redirect_uri: (import.meta as any).env?.VITE_OAUTH42_REDIRECT_URI || `${window.location.origin}/auth/oauth42/callback`
        })
      });

      const data = await response.json();

      if (response.ok) {
        this.updateState({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          isLoading: false
        });

        this.storeAuth(data.user, data.token);
        this.startTokenRefresh();
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Échec de la connexion OAuth' };
      }
    } catch (error: any) {
      return { success: false, error: 'Erreur de réseau: ' + error.message };
    }
  }
}

export const authManager = new AuthManager();
export type { User, AuthState };
