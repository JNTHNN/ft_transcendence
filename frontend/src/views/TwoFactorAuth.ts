import { t } from "../i18n";
import { api } from "../api-client";
import { authManager } from "../auth";
import { router } from "../router";

interface TwoFAStatus {
  enabled: boolean;
  setupAt?: string;
  accountType: string;
}

interface SetupResponse {
  qrCode: string;
  secret: string;
}

interface BackupCodesResponse {
  backupCodes: string[];
}

export class TwoFactorAuthView {
  private container: HTMLElement;
  private status: TwoFAStatus | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'min-h-screen bg-gray-50 py-8';
    this.init();
  }

  private async init() {
    if (!authManager.isAuthenticated()) {
      router.navigate('/login');
      return;
    }
    
    await this.loadStatus();
    this.render();
  }

  private async loadStatus() {
    try {
      const response = await api('/auth/2fa/status');
      this.status = response;
    } catch (error) {
      this.status = null;
    }
  }

  private render() {
    if (!this.status) {
      this.renderError();
      return;
    }

    this.container.innerHTML = `
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="bg-white shadow rounded-lg">
          <div class="px-6 py-8">
            <div class="mb-8">
              <h1 class="text-2xl font-bold text-gray-900 mb-2">${t('twoFactorAuth')}</h1>
              <p class="text-gray-600">${t('twoFactorAuthDescription')}</p>
            </div>

            <!-- Status Card -->
            <div class="mb-8 p-6 border rounded-lg ${this.status.enabled ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  ${this.status.enabled 
                    ? '<svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                    : '<svg class="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>'
                  }
                </div>
                <div class="ml-3">
                  <h3 class="text-lg font-medium ${this.status.enabled ? 'text-green-900' : 'text-yellow-900'}">
                    ${this.status.enabled ? t('twoFactorEnabled') : t('twoFactorDisabled')}
                  </h3>
                  <p class="text-sm ${this.status.enabled ? 'text-green-700' : 'text-yellow-700'}">
                    ${this.status.enabled 
                      ? (this.status.setupAt ? t('enabledSince') + ' ' + new Date(this.status.setupAt).toLocaleString() : t('twoFactorActive'))
                      : t('twoFactorNotEnabled')
                    }
                  </p>
                </div>
              </div>
            </div>

            <!-- Action Cards -->
            <div class="space-y-6">
              ${!this.status.enabled ? this.renderSetupCard() : this.renderManagementCard()}
            </div>
          </div>
        </div>
      </div>

      <!-- Modals -->
      <div id="setupModal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div class="mt-3">
            <h3 class="text-lg font-medium text-gray-900 mb-4">${t('setupTwoFactor')}</h3>
            <div id="setupContent"></div>
          </div>
        </div>
      </div>

      <div id="backupCodesModal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div class="mt-3">
            <h3 class="text-lg font-medium text-gray-900 mb-4">${t('backupCodes')}</h3>
            <div id="backupCodesContent"></div>
          </div>
        </div>
      </div>

      <div id="passwordModal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div class="mt-3">
            <h3 class="text-lg font-medium text-gray-900 mb-4">${t('confirmPassword')}</h3>
            <div id="passwordContent">
              <div class="space-y-4">
                <div class="text-sm text-gray-600">
                  <p>${t('enterPasswordToDisable2FA')}</p>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">${t('currentPassword')}</label>
                  <input type="password" id="passwordInput" 
                         class="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                         placeholder="${t('enterCurrentPassword')}" autocomplete="current-password">
                </div>
                
                <div class="flex justify-end space-x-3">
                  <button id="cancelPassword" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">
                    ${t('cancel')}
                  </button>
                  <button id="confirmPassword" class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">
                    ${t('disable')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderSetupCard(): string {
    return `
      <div class="border border-gray-200 rounded-lg p-6">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <div class="ml-3 flex-1">
            <h3 class="text-lg font-medium text-gray-900">${t('enableTwoFactor')}</h3>
            <p class="mt-2 text-sm text-gray-600">${t('enableTwoFactorDescription')}</p>
            <div class="mt-4">
              <button id="setupButton" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                ${t('setup')}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderManagementCard(): string {
    return `
      <div class="space-y-4">
        <div class="border border-gray-200 rounded-lg p-6">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <div class="ml-3 flex-1">
              <h3 class="text-lg font-medium text-gray-900">${t('backupCodes')}</h3>
              <p class="mt-2 text-sm text-gray-600">${t('backupCodesDescription')}</p>
              <div class="mt-4">
                <button id="showBackupCodesButton" class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  ${t('showBackupCodes')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="border border-red-200 rounded-lg p-6">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <div class="ml-3 flex-1">
              <h3 class="text-lg font-medium text-red-900">${t('disableTwoFactor')}</h3>
              <p class="mt-2 text-sm text-red-700">${t('disableTwoFactorWarning')}</p>
              <div class="mt-4">
                <button id="disableButton" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                  ${t('disable')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderError(): void {
    this.container.innerHTML = `
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="bg-white shadow rounded-lg">
          <div class="px-6 py-8">
            <div class="text-center">
              <svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              <h2 class="mt-4 text-lg font-medium text-gray-900">${t('failedToLoadTwoFactorStatus')}</h2>
              <p class="mt-2 text-sm text-gray-600">${t('pleaseRefreshPage')}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const setupButton = this.container.querySelector('#setupButton');
    const disableButton = this.container.querySelector('#disableButton');
    const showBackupCodesButton = this.container.querySelector('#showBackupCodesButton');

    if (setupButton) {
      setupButton.addEventListener('click', () => this.startSetup());
    }

    if (disableButton) {
      disableButton.addEventListener('click', () => this.showDisableConfirm());
    }

    if (showBackupCodesButton) {
      showBackupCodesButton.addEventListener('click', () => this.showBackupCodes());
    }

    window.addEventListener('click', (event) => {
      const setupModal = this.container.querySelector('#setupModal') as HTMLElement;
      const backupCodesModal = this.container.querySelector('#backupCodesModal') as HTMLElement;
      
      if (event.target === setupModal) {
        setupModal.classList.add('hidden');
      }
      if (event.target === backupCodesModal) {
        backupCodesModal.classList.add('hidden');
      }
    });
  }

  private async startSetup(): Promise<void> {
    try {
      const response = await api('/auth/2fa/setup', { method: 'POST', body: JSON.stringify({}) }) as SetupResponse;
      this.showSetupModal(response);
    } catch (error) {
      alert(t('failedToStartSetup'));
    }
  }

  private showSetupModal(setupData: SetupResponse): void {
    const modal = this.container.querySelector('#setupModal') as HTMLElement;
    const content = modal.querySelector('#setupContent') as HTMLElement;

    content.innerHTML = `
      <div class="space-y-4">
        <div class="text-sm text-gray-600">
          <p>${t('scanQRCode')}</p>
        </div>
        
        <div class="flex justify-center">
          <img src="${setupData.qrCode}" alt="QR Code" class="w-48 h-48 border">
        </div>
        
        <div class="text-xs text-gray-500">
          <p class="font-medium">${t('manualEntry')}:</p>
          <code class="break-all bg-gray-100 p-2 rounded text-xs block mt-1">${setupData.secret}</code>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">${t('enterVerificationCode')}</label>
          <input type="text" id="verificationCode" maxlength="6" pattern="[0-9]{6}" 
                 class="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono tracking-widest text-black"
                 placeholder="123456" autocomplete="one-time-code">
        </div>
        
        <div class="flex justify-end space-x-3">
          <button id="cancelSetup" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">
            ${t('cancel')}
          </button>
          <button id="verifySetup" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
            ${t('verify')}
          </button>
        </div>
      </div>
    `;

    const verificationInput = content.querySelector('#verificationCode') as HTMLInputElement;
    const verifyButton = content.querySelector('#verifySetup') as HTMLButtonElement;
    
    content.querySelector('#cancelSetup')!.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    verifyButton.addEventListener('click', () => {
      this.verifySetup();
    });

    setTimeout(() => verificationInput.focus(), 100);

    verificationInput.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (value.length === 6 && /^\d{6}$/.test(value)) {
        this.verifySetup();
      }
    });

    verificationInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.verifySetup();
      }
    });

    modal.classList.remove('hidden');
  }

  private async verifySetup(): Promise<void> {
    const codeInput = this.container.querySelector('#verificationCode') as HTMLInputElement;
    const code = codeInput.value.trim();

    if (code.length !== 6) {
      alert(t('pleaseEnterSixDigitCode'));
      return;
    }

    try {
      await api('/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code }) });
      
      const modal = this.container.querySelector('#setupModal') as HTMLElement;
      modal.classList.add('hidden');
      
      await this.loadStatus();
      this.render();
      
      alert(t('twoFactorSuccessfullyEnabled'));
    } catch (error) {
      alert(t('invalidVerificationCode'));
    }
  }

  private showDisableConfirm(): void {
    const isOAuth = this.status?.accountType === 'oauth42';
    
    if (isOAuth) {
      const message = t('confirmDisableTwoFactorOAuth');
      if (confirm(message)) {
        this.disable2FA('');
      }
    } else {
      this.showPasswordModal();
    }
  }

  private showPasswordModal(): void {
    const modal = this.container.querySelector('#passwordModal') as HTMLElement;
    const passwordInput = modal.querySelector('#passwordInput') as HTMLInputElement;
    const cancelBtn = modal.querySelector('#cancelPassword') as HTMLButtonElement;
    const confirmBtn = modal.querySelector('#confirmPassword') as HTMLButtonElement;

    passwordInput.value = '';
    
    const closeModal = () => {
      modal.classList.add('hidden');
      passwordInput.value = '';
    };

    cancelBtn.onclick = closeModal;
    
    confirmBtn.onclick = () => {
      const password = passwordInput.value.trim();
      if (password) {
        closeModal();
        this.disable2FA(password);
      } else {
        passwordInput.focus();
      }
    };

    passwordInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmBtn.click();
      }
    };

    modal.classList.remove('hidden');
    setTimeout(() => passwordInput.focus(), 100);
  }

  private async disable2FA(password: string): Promise<void> {
    try {
      await api('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) });
      
      await this.loadStatus();
      this.render();
      
      alert(t('twoFactorSuccessfullyDisabled'));
    } catch (error) {
      alert(t('failedToDisableTwoFactor'));
    }
  }

  private async showBackupCodes(): Promise<void> {
    try {
      const response = await api('/auth/2fa/backup-codes', { method: 'POST', body: JSON.stringify({}) }) as BackupCodesResponse;
      
      const modal = this.container.querySelector('#backupCodesModal') as HTMLElement;
      const content = modal.querySelector('#backupCodesContent') as HTMLElement;

      content.innerHTML = `
        <div class="space-y-4">
          <div class="text-sm text-gray-600">
            <p>${t('backupCodesWarning')}</p>
          </div>
          
          <div class="bg-gray-50 p-4 rounded-md">
            <div class="grid grid-cols-2 gap-2 font-mono text-sm">
              ${response.backupCodes.map(code => `<div class="text-gray-800">${code}</div>`).join('')}
            </div>
          </div>
          
          <div class="flex justify-end space-x-3">
            <button id="closeBackupCodes" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">
              ${t('close')}
            </button>
            <button id="printBackupCodes" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
              ${t('print')}
            </button>
          </div>
        </div>
      `;

      content.querySelector('#closeBackupCodes')!.addEventListener('click', () => {
        modal.classList.add('hidden');
      });

      content.querySelector('#printBackupCodes')!.addEventListener('click', () => {
        window.print();
      });

      modal.classList.remove('hidden');
    } catch (error) {
      alert(t('failedToGenerateBackupCodes'));
    }
  }

  getElement(): HTMLElement {
    return this.container;
  }

  destroy(): void {
 
  }
}

export default async function View(): Promise<HTMLElement> {
  if (!authManager.isAuthenticated()) {
    router.navigate('/login');
    return document.createElement('div');
  }
  
  const view = new TwoFactorAuthView();
  return view.getElement();
}