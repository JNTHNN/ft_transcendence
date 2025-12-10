import { t } from "../i18n";
import { api } from "../api-client";
import { authManager } from "../auth";
import { router } from "../router";



class TwoFactorLoginView {
  private container: HTMLElement;
  private tempToken: string;
  private isBackupMode: boolean = false;

  constructor(tempToken: string) {
    this.tempToken = tempToken;
    this.container = document.createElement('div');
    this.container.className = 'min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8';
    this.render();
  }

  private render() {
    this.container.innerHTML = `
      <div class="max-w-md w-full space-y-8">
        <div>
          <div class="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            ${t('twoFactorVerification')}
          </h2>
          <p class="mt-2 text-center text-sm text-gray-600">
            ${t('enterTwoFactorCode')}
          </p>
        </div>

        <form id="twoFactorForm" class="mt-8 space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              ${t('verificationCode')}
            </label>
            <input 
              id="codeInput"
              type="text" 
              maxlength="6" 
              pattern="[0-9]{6}" 
              class="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-center text-lg tracking-widest font-mono"
              placeholder="123456"
              autocomplete="one-time-code"
              required>
          </div>

          <div class="text-sm text-gray-600">
            <p>${t('twoFactorInstructions')}</p>
          </div>

          <div class="space-y-3">
            <button 
              type="submit" 
              class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              id="submitButton">
              ${t('verify')}
            </button>
            
            <button 
              type="button" 
              class="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              id="useBackupCodeButton">
              ${t('useBackupCode')}
            </button>
          </div>

          <div class="text-center">
            <button 
              type="button" 
              class="text-sm text-blue-600 hover:text-blue-500"
              id="backToLoginButton">
              ${t('backToLogin')}
            </button>
          </div>
        </form>

        <!-- Error Message -->
        <div id="errorMessage" class="hidden mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div class="ml-3">
              <p id="errorText" class="text-sm text-red-700"></p>
            </div>
          </div>
        </div>

        <!-- Success Message -->
        <div id="successMessage" class="hidden mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div class="ml-3">
              <p id="successText" class="text-sm text-green-700">${t('verificationSuccessful')}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners() {
    const form = this.container.querySelector('#twoFactorForm') as HTMLFormElement;
    const codeInput = this.container.querySelector('#codeInput') as HTMLInputElement;
    const useBackupCodeButton = this.container.querySelector('#useBackupCodeButton') as HTMLButtonElement;
    const backToLoginButton = this.container.querySelector('#backToLoginButton') as HTMLButtonElement;

    setTimeout(() => codeInput.focus(), 100);

    codeInput.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (!this.isBackupMode && value.length === 6 && /^\d{6}$/.test(value)) {
        this.verify(value);
      } else if (this.isBackupMode && value.length >= 8 && /^[A-Z0-9-]{8,10}$/.test(value)) {
        this.verify(value);
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = codeInput.value.trim();
      if (!this.isBackupMode && code.length === 6) {
        this.verify(code);
      } else if (this.isBackupMode && code.length >= 8) {
        this.verify(code);
      } else {
        const errorMessage = this.isBackupMode ? t('enterBackupCodeInstructions') : t('pleaseEnterSixDigitCode');
        this.showError(errorMessage);
      }
    });

    useBackupCodeButton.addEventListener('click', () => {
      this.switchToBackupCode();
    });

    backToLoginButton.addEventListener('click', () => {
      router.navigate('/login');
    });
  }

  private async verify(code: string): Promise<void> {
    const codeInput = this.container.querySelector('#codeInput') as HTMLInputElement;
    const submitButton = this.container.querySelector('#submitButton') as HTMLButtonElement;

    try {
      submitButton.disabled = true;
      submitButton.textContent = t('verifying');

      const response = await api('/auth/2fa/login-verify', {
        method: 'POST',
        body: JSON.stringify({
          tempToken: this.tempToken,
          code: code
        })
      });

      this.showSuccess();

      if (response.token) {
        authManager.setAuth(response.user, response.token);
        
        sessionStorage.removeItem('2fa_temp_token');
        
        setTimeout(() => {
          router.navigate('/');
        }, 1000);
      }

    } catch (error: any) {

      let errorMessage = t('invalidVerificationCode');
      
      if (error.message?.includes('expired')) {
        errorMessage = t('verificationCodeExpired');
      } else if (error.message?.includes('invalid_temp_token')) {
        errorMessage = t('invalidTempToken');
      }
      
      this.showError(errorMessage);
      codeInput.value = '';
      codeInput.focus();
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = t('verify');
    }
  }

  private switchToBackupCode(): void {
    const codeInput = this.container.querySelector('#codeInput') as HTMLInputElement;
    const label = this.container.querySelector('label') as HTMLLabelElement;
    const instruction = this.container.querySelector('.text-sm.text-gray-600 p') as HTMLParagraphElement;
    const useBackupCodeButton = this.container.querySelector('#useBackupCodeButton') as HTMLButtonElement;

    this.isBackupMode = true;

    label.textContent = t('backupCode');
    codeInput.placeholder = t('enterBackupCode');
    codeInput.maxLength = 10;
    codeInput.pattern = '[A-Z0-9-]{8,10}';
    codeInput.className = codeInput.className.replace('tracking-widest', '');
    instruction.textContent = t('enterBackupCodeInstructions');
    
    useBackupCodeButton.style.display = 'none';
    
    const switchBackButton = document.createElement('button');
    switchBackButton.type = 'button';
    switchBackButton.className = 'group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500';
    switchBackButton.textContent = t('useAuthenticatorCode');
    switchBackButton.addEventListener('click', () => {
      this.switchToRegularCode();
    });

    useBackupCodeButton.parentNode?.insertBefore(switchBackButton, useBackupCodeButton.nextSibling);
    
    codeInput.value = '';
    codeInput.focus();
  }

  private switchToRegularCode(): void {
    const codeInput = this.container.querySelector('#codeInput') as HTMLInputElement;
    const label = this.container.querySelector('label') as HTMLLabelElement;
    const instruction = this.container.querySelector('.text-sm.text-gray-600 p') as HTMLParagraphElement;
    const useBackupCodeButton = this.container.querySelector('#useBackupCodeButton') as HTMLButtonElement;

    this.isBackupMode = false;

    label.textContent = t('verificationCode');
    codeInput.placeholder = '123456';
    codeInput.maxLength = 6;
    codeInput.pattern = '[0-9]{6}';
    codeInput.className = codeInput.className.includes('tracking-widest') ? codeInput.className : codeInput.className + ' tracking-widest';
    instruction.textContent = t('twoFactorInstructions');
    
    useBackupCodeButton.style.display = '';
    
    const switchBackButton = useBackupCodeButton.parentNode?.querySelector('button:last-child');
    if (switchBackButton && switchBackButton.textContent === t('useAuthenticatorCode')) {
      switchBackButton.remove();
    }
    
    codeInput.value = '';
    codeInput.focus();
  }

  private showError(message: string): void {
    const errorMessage = this.container.querySelector('#errorMessage') as HTMLElement;
    const errorText = this.container.querySelector('#errorText') as HTMLElement;
    const successMessage = this.container.querySelector('#successMessage') as HTMLElement;

    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    successMessage.classList.add('hidden');

    setTimeout(() => {
      errorMessage.classList.add('hidden');
    }, 5000);
  }

  private showSuccess(): void {
    const errorMessage = this.container.querySelector('#errorMessage') as HTMLElement;
    const successMessage = this.container.querySelector('#successMessage') as HTMLElement;

    successMessage.classList.remove('hidden');
    errorMessage.classList.add('hidden');
  }

  getElement(): HTMLElement {
    return this.container;
  }

  destroy(): void {
    // Cleanup if needed
  }
}

export default function View(): HTMLElement {
  const tempToken = sessionStorage.getItem('2fa_temp_token');
  
  if (!tempToken) {
    router.navigate('/login');
    return document.createElement('div');
  }
  
  const view = new TwoFactorLoginView(tempToken);
  return view.getElement();
}