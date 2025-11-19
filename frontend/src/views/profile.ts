import { authManager } from "../auth";
import { router } from "../router";
import { api } from "../api-client";
import { t } from "../i18n/index.js";
import { menuManager } from "./Menu.js";

interface User {
  id: number;
  email: string;
  displayName: string;
  createdAt: string;
  avatarUrl?: string;
  accountType: 'local' | 'oauth42';
  oauth42Login?: string;
  oauth42Data?: any;
  last42Sync?: string;
}

export default async function View() {
  if (!authManager.isAuthenticated()) {
    router.navigate("/login");
    return document.createElement("div");
  }

  let user: User;
  try {
    const response = await api('/auth/me');
    user = response;
  } catch (error) {
    router.navigate("/login");
    return document.createElement("div");
  }

  const container = document.createElement("div");
  container.className = "max-w-2xl mx-auto mt-8 p-8";

  const isOAuth42 = user.accountType === 'oauth42';

  const header = document.createElement("div");
  header.className = "bg-prem rounded-lg shadow-xl p-8 mb-6";

  const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || "https://api.localhost:8443";
  const transformAvatarUrl = (avatarUrl: string | undefined) => 
    avatarUrl && avatarUrl.startsWith('/uploads/') ? `${apiBaseUrl}${avatarUrl}` : avatarUrl;

  const headerAvatarUrl = transformAvatarUrl(user.avatarUrl);
    
  const avatarContent = headerAvatarUrl
    ? `<img src="${headerAvatarUrl}" alt="Avatar" class="w-16 h-16 rounded-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
       <div class="w-16 h-16 bg-sec rounded-full flex items-center justify-center" style="display:none;">
         <span class="text-2xl font-bold text-text">${user.displayName.charAt(0).toUpperCase()}</span>
       </div>`
    : `<div class="w-16 h-16 bg-sec rounded-full flex items-center justify-center">
         <span class="text-2xl font-bold text-text">${user.displayName.charAt(0).toUpperCase()}</span>
       </div>`;

  header.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="font-display font-black text-4xl text-text">${t('profile.title')}</h1>
      <div class="flex items-center space-x-4">
        ${isOAuth42 ? `<span class="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-sans">${t('profile.oauth42Account')}</span>` : ''}
        <button id="logoutBtn" class="bg-red-600 hover:bg-red-700 text-white font-sans font-bold py-2 px-4 rounded-lg transition">
          ${t('auth.logout')}
        </button>
      </div>
    </div>
    <div class="flex items-center space-x-4">
      <div class="relative" id="profile-header-avatar">
        ${avatarContent}
      </div>
      <div>
        <h2 class="font-sans text-2xl font-bold text-text">${user.displayName}</h2>
        <p class="font-sans text-gray-400">${user.email}</p>
        ${user.oauth42Login ? `<p class="font-sans text-sm text-blue-400">Login 42: ${user.oauth42Login}</p>` : ''}
        <p class="font-sans text-sm text-gray-500">${t('profile.memberSince')} ${formatDate(user.createdAt)}</p>
        ${user.last42Sync ? `<p class="font-sans text-xs text-gray-600">${t('profile.lastSync')} ${formatDate(user.last42Sync)}</p>` : ''}
      </div>
    </div>
  `;

  const avatarSection = document.createElement("div");
  avatarSection.className = "bg-prem rounded-lg shadow-xl p-8 mb-6";
  
  const avatarUrl = user.avatarUrl;
  const displayImageUrl = transformAvatarUrl(avatarUrl);

  avatarSection.innerHTML = `
    <h3 class="font-display text-2xl font-bold text-text mb-6">${t('profile.avatar')}</h3>
    
    <div class="flex items-center space-x-6 mb-6">
      <div class="relative">
        ${avatarUrl ? 
          `<img src="${displayImageUrl}" alt="Avatar" class="w-20 h-20 rounded-full object-cover border-2 border-sec">` :
          `<div class="w-20 h-20 bg-sec rounded-full flex items-center justify-center border-2 border-sec">
             <span class="text-2xl font-bold text-text">${user.displayName.charAt(0).toUpperCase()}</span>
           </div>`
        }
      </div>
      
      <div class="flex-1">
        <p class="font-sans text-sm text-gray-400 mb-2">
          ${avatarUrl ? t('profile.currentAvatar') : t('profile.noAvatar')}
        </p>
        
        <div class="flex flex-wrap gap-2">
          <div class="relative">
            <input type="file" id="avatarInput" class="hidden" accept="image/jpeg,image/png,image/gif,image/webp">
            <label for="avatarInput" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-sans font-bold py-2 px-4 rounded-lg cursor-pointer transition">
              ${avatarUrl ? t('profile.changeAvatar') : t('profile.uploadAvatar')}
            </label>
          </div>
          ${avatarUrl ? 
            `<button type="button" id="deleteAvatarBtn" class="bg-red-600 hover:bg-red-700 text-white font-sans font-bold py-2 px-4 rounded-lg transition">
               ${t('profile.deleteAvatar')}
             </button>` : ''
          }
          ${isOAuth42 ? 
            `<button type="button" id="sync42AvatarBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold py-2 px-4 rounded-lg transition">
               ${t('profile.sync42Avatar')}
             </button>` : ''
          }
        </div>
      </div>
    </div>
    
    <div id="dropZone" class="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-sec transition-colors cursor-pointer">
      <div class="text-gray-400 mb-2">📷</div>
      <p class="font-sans text-gray-400">${t('profile.dragDropAvatar')}</p>
      <p class="font-sans text-xs text-gray-500 mt-2">JPEG, PNG, GIF, WebP - Max 5MB</p>
    </div>
    
    <div id="avatarError" class="mt-4 p-3 bg-red-900 text-red-200 rounded-lg text-sm font-sans hidden"></div>
    <div id="avatarSuccess" class="mt-4 p-3 bg-green-900 text-green-200 rounded-lg text-sm font-sans hidden"></div>
  `;

  const profileForm = document.createElement("form");
  profileForm.className = "bg-prem rounded-lg shadow-xl p-8 mb-6";
  profileForm.innerHTML = `
    <h3 class="font-display text-2xl font-bold text-text mb-6">${t('profile.editProfile')}</h3>

    <div class="mb-4">
      <label class="block font-sans text-text mb-2">${t('auth.displayName')}</label>
      <input name="displayName" type="text" value="${user.displayName}" required
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>

    <div class="mb-4">
      <label class="block font-sans text-text mb-2">${t('auth.email')}</label>
      <input name="email" type="email" value="${user.email}" required
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans"
        ${isOAuth42 ? `disabled title="${t('profile.oauth42EmailRestriction')}"` : ''} />
      ${isOAuth42 ? `<small class="text-yellow-400 text-xs">${t('profile.oauth42EmailRestriction')}</small>` : ''}
    </div>

    <div class="flex space-x-4">
      <button type="submit" id="updateProfileBtn" class="bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
        ${t('profile.updateProfile')}
      </button>
      <button type="button" id="cancelProfileBtn" class="bg-gray-600 hover:bg-gray-700 text-text font-sans font-bold py-2 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed" disabled>
        ${t('profile.cancel')}
      </button>
    </div>
    <div id="profileError" class="mt-4 p-3 bg-red-900 text-red-200 rounded-lg text-sm font-sans hidden"></div>
    <div id="profileSuccess" class="mt-4 p-3 bg-green-900 text-green-200 rounded-lg text-sm font-sans hidden"></div>
  `;

  const passwordForm = document.createElement("form");
  passwordForm.className = "bg-prem rounded-lg shadow-xl p-8";

  if (isOAuth42) {
    passwordForm.innerHTML = `
      <h3 class="font-display text-2xl font-bold text-text mb-6">${t('profile.accountSecurity')}</h3>
      <div class="bg-blue-900 border border-blue-600 rounded-lg p-4">
        <p class="font-sans text-blue-200 mb-2">🔒 ${t('profile.oauth42Account')}</p>
        <p class="font-sans text-blue-300 text-sm">
          ${t('profile.oauth42SecurityMessage')}
        </p>
      </div>
    `;
  } else {
    passwordForm.innerHTML = `
    <h3 class="font-display text-2xl font-bold text-text mb-6">${t('profile.changePassword')}</h3>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">${t('profile.currentPassword')}</label>
      <input name="currentPassword" type="password" required
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">${t('profile.newPassword')}</label>
      <input name="newPassword" type="password" required minlength="6"
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">${t('profile.confirmNewPassword')}</label>
      <input name="confirmPassword" type="password" required minlength="6"
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <div class="flex space-x-4">
      <button type="submit" id="changePasswordBtn" class="bg-orange-600 hover:bg-orange-700 text-white font-sans font-bold py-2 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
        ${t('profile.changePassword')}
      </button>
      <button type="button" id="cancelPasswordBtn" class="bg-gray-600 hover:bg-gray-700 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
        ${t('profile.cancel')}
      </button>
    </div>
    <div id="passwordError" class="mt-4 p-3 bg-red-900 text-red-200 rounded-lg text-sm font-sans hidden"></div>
    <div id="passwordSuccess" class="mt-4 p-3 bg-green-900 text-green-200 rounded-lg text-sm font-sans hidden"></div>
  `;
  }

  const stats = document.createElement("div");
  stats.className = "bg-prem rounded-lg shadow-xl p-8 mt-6";
  stats.innerHTML = `
    <h3 class="font-display text-2xl font-bold text-text mb-6">${t('stats.title')}</h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-gray-700 p-4 rounded-lg text-center">
        <div class="font-display text-3xl font-bold text-sec">0</div>
        <div class="font-sans text-gray-400">${t('stats.gamesPlayed')}</div>
      </div>
      <div class="bg-gray-700 p-4 rounded-lg text-center">
        <div class="font-display text-3xl font-bold text-green-400">0</div>
        <div class="font-sans text-gray-400">${t('stats.victories')}</div>
      </div>
      <div class="bg-gray-700 p-4 rounded-lg text-center">
        <div class="font-display text-3xl font-bold text-red-400">0</div>
        <div class="font-sans text-gray-400">${t('stats.defeats')}</div>
      </div>
    </div>
  `;

  const logoutBtn = header.querySelector("#logoutBtn") as HTMLButtonElement;

  const updateProfileBtn = profileForm.querySelector("#updateProfileBtn") as HTMLButtonElement;
  const cancelProfileBtn = profileForm.querySelector("#cancelProfileBtn") as HTMLButtonElement;
  const profileErrorDiv = profileForm.querySelector("#profileError") as HTMLDivElement;
  const profileSuccessDiv = profileForm.querySelector("#profileSuccess") as HTMLDivElement;
  const displayNameInput = profileForm.querySelector('input[name="displayName"]') as HTMLInputElement;
  const emailInput = profileForm.querySelector('input[name="email"]') as HTMLInputElement;

  const changePasswordBtn = !isOAuth42 ? passwordForm.querySelector("#changePasswordBtn") as HTMLButtonElement : null;
  const cancelPasswordBtn = !isOAuth42 ? passwordForm.querySelector("#cancelPasswordBtn") as HTMLButtonElement : null;
  const passwordErrorDiv = !isOAuth42 ? passwordForm.querySelector("#passwordError") as HTMLDivElement : null;
  const passwordSuccessDiv = !isOAuth42 ? passwordForm.querySelector("#passwordSuccess") as HTMLDivElement : null;
  const currentPasswordInput = !isOAuth42 ? passwordForm.querySelector('input[name="currentPassword"]') as HTMLInputElement : null;
  const newPasswordInput = !isOAuth42 ? passwordForm.querySelector('input[name="newPassword"]') as HTMLInputElement : null;
  const confirmPasswordInput = !isOAuth42 ? passwordForm.querySelector('input[name="confirmPassword"]') as HTMLInputElement : null;

  const deleteAccountSection = document.createElement("div");
  deleteAccountSection.className = "bg-red-900 rounded-lg shadow-xl p-8 mt-6 border border-red-600";
  deleteAccountSection.innerHTML = `
    <h3 class="font-display text-2xl font-bold text-red-200 mb-6">${t('profile.dangerZone')}</h3>
    <div class="bg-red-800 border border-red-600 rounded-lg p-4 mb-4">
      <p class="font-sans text-red-200 mb-2">${t('profile.deleteAccountWarning')}</p>
      <p class="font-sans text-red-300 text-sm">${t('profile.deleteAccountNote')}</p>
      <ul class="font-sans text-red-300 text-sm mt-2 ml-4 list-disc">
        <li>${t('profile.deleteAccountItems.profile')}</li>
        <li>${t('profile.deleteAccountItems.history')}</li>
        <li>${t('profile.deleteAccountItems.stats')}</li>
        <li>${t('profile.deleteAccountItems.messages')}</li>
        <li>${t('profile.deleteAccountItems.tokens')}</li>
      </ul>
      ${isOAuth42 ? `<p class="font-sans text-red-300 text-sm mt-2">${t('profile.oauth42DeleteNote')}</p>` : ''}
    </div>
    ${!isOAuth42 ? `
      <div class="mb-4">
        <label class="block font-sans text-red-200 mb-2">${t('profile.deletePasswordConfirm')}</label>
        <input id="deletePasswordInput" type="password" required
          class="w-full px-4 py-2 bg-red-800 text-red-100 border border-red-600 rounded-lg focus:outline-none focus:border-red-400 font-sans placeholder-red-400"
          placeholder="${t('profile.deletePasswordConfirm')}" />
      </div>
    ` : ''}
    <div class="mb-4">
      <label class="block font-sans text-red-200 mb-2">
        <input type="checkbox" id="confirmDeleteCheckbox" class="mr-2">
        ${t('profile.deleteConfirmation')}
      </label>
    </div>
    <button type="button" id="deleteAccountBtn" class="bg-red-600 hover:bg-red-700 text-white font-sans font-bold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed" disabled>
      ${t('profile.deleteAccount')}
    </button>
    <div id="deleteError" class="mt-4 p-3 bg-red-900 text-red-200 rounded-lg text-sm font-sans hidden border border-red-600"></div>
  `;

  const deleteAccountBtn = deleteAccountSection.querySelector("#deleteAccountBtn") as HTMLButtonElement;
  const deletePasswordInput = deleteAccountSection.querySelector("#deletePasswordInput") as HTMLInputElement;
  const confirmDeleteCheckbox = deleteAccountSection.querySelector("#confirmDeleteCheckbox") as HTMLInputElement;
  const deleteErrorDiv = deleteAccountSection.querySelector("#deleteError") as HTMLDivElement;

  let originalDisplayName = user.displayName;
  let originalEmail = user.email;
  let hasUnsavedChanges = false;

  const showProfileError = (message: string) => {
    profileErrorDiv.textContent = message;
    profileErrorDiv.classList.remove("hidden");
    profileSuccessDiv.classList.add("hidden");
  };

  const showProfileSuccess = (message: string) => {
    profileSuccessDiv.textContent = message;
    profileSuccessDiv.classList.remove("hidden");
    profileErrorDiv.classList.add("hidden");
  };

  const showPasswordError = (message: string) => {
    if (passwordErrorDiv && passwordSuccessDiv) {
      passwordErrorDiv.textContent = message;
      passwordErrorDiv.classList.remove("hidden");
      passwordSuccessDiv.classList.add("hidden");
    }
  };

  const showPasswordSuccess = (message: string) => {
    if (passwordSuccessDiv && passwordErrorDiv) {
      passwordSuccessDiv.textContent = message;
      passwordSuccessDiv.classList.remove("hidden");
      passwordErrorDiv.classList.add("hidden");
    }
  };

  const showDeleteError = (message: string) => {
    deleteErrorDiv.textContent = message;
    deleteErrorDiv.classList.remove("hidden");
  };

  const updateCancelButtonState = () => {
    const currentDisplayName = displayNameInput.value.trim();
    const currentEmail = emailInput.value.trim();
    hasUnsavedChanges = currentDisplayName !== originalDisplayName || currentEmail !== originalEmail;

    cancelProfileBtn.disabled = !hasUnsavedChanges;
    cancelProfileBtn.classList.toggle('opacity-50', !hasUnsavedChanges);
    cancelProfileBtn.classList.toggle('cursor-not-allowed', !hasUnsavedChanges);
  };

  displayNameInput.addEventListener('input', updateCancelButtonState);
  if (!isOAuth42) {
    emailInput.addEventListener('input', updateCancelButtonState);
  }

  const updateDeleteButtonState = () => {
    const isConfirmed = confirmDeleteCheckbox.checked;
    if (isOAuth42) {
      deleteAccountBtn.disabled = !isConfirmed;
    } else {
      const hasPassword = deletePasswordInput?.value.length > 0;
      deleteAccountBtn.disabled = !hasPassword || !isConfirmed;
    }
  };

  if (deletePasswordInput) {
    deletePasswordInput.addEventListener('input', updateDeleteButtonState);
  }
  confirmDeleteCheckbox.addEventListener('change', updateDeleteButtonState);

  logoutBtn.onclick = async () => {
    await authManager.logout();
    router.navigate("/login");
  };

  cancelProfileBtn.onclick = () => {
    if (hasUnsavedChanges) {
      displayNameInput.value = originalDisplayName;
      emailInput.value = originalEmail;
      updateCancelButtonState();
      profileErrorDiv.classList.add("hidden");
      profileSuccessDiv.classList.add("hidden");
    }
  };

  profileForm.onsubmit = async (e) => {
    e.preventDefault();

    const displayName = displayNameInput.value.trim();
    const email = emailInput.value.trim();

    if (!displayName) {
      showProfileError(t('messages.displayNameRequired'));
      return;
    }

    if (!email) {
      showProfileError(t('messages.emailRequired'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showProfileError(t('messages.invalidEmailFormat'));
      return;
    }

    if (displayName === originalDisplayName && email === originalEmail) {
      showProfileError(t('messages.noChangesDetected'));
      return;
    }

    updateProfileBtn.disabled = true;
    updateProfileBtn.textContent = t('common.loading');

    try {
      const updates: any = {};
      if (displayName !== originalDisplayName) updates.displayName = displayName;
      if (email !== originalEmail && !isOAuth42) updates.email = email;

      await api('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      showProfileSuccess(t('messages.profileUpdated'));

      const nameElement = header.querySelector('h2');
      const emailElement = header.querySelector('p');
      const avatarElements = header.querySelectorAll('.w-16.h-16 span, .rounded-full + div span');
      if (nameElement) nameElement.textContent = displayName;
      if (emailElement && !isOAuth42) emailElement.textContent = email;
      avatarElements.forEach(el => {
        if (el.textContent) el.textContent = displayName.charAt(0).toUpperCase();
      });

      originalDisplayName = displayName;
      if (!isOAuth42) originalEmail = email;
      updateCancelButtonState();

    } catch (error: any) {
      showProfileError(t('errors.networkError') + ": " + error.message);
    } finally {
      updateProfileBtn.disabled = false;
      updateProfileBtn.textContent = t('profile.updateProfile');
    }
  };

  deleteAccountBtn.onclick = async () => {
    if (!confirmDeleteCheckbox.checked) {
      showDeleteError(t('profile.deleteConfirmation'));
      return;
    }

    if (!isOAuth42) {
      const password = deletePasswordInput.value;
      if (!password) {
        showDeleteError(t('messages.fillAllFields'));
        return;
      }
    }

    deleteAccountBtn.disabled = true;
    deleteAccountBtn.textContent = t('messages.deletingAccount');

    try {
      let result;
      if (isOAuth42) {
        result = await authManager.deleteAccount('');
      } else {
        result = await authManager.deleteAccount(deletePasswordInput.value);
      }

      if (result.success) {
        router.navigate('/');
      } else {
        showDeleteError(result.error || t('errors.deleteError'));
        deleteAccountBtn.disabled = false;
        deleteAccountBtn.textContent = t('profile.deleteAccount');
      }
    } catch (error: any) {
      showDeleteError(t('errors.deleteError') + ": " + error.message);
      deleteAccountBtn.disabled = false;
      deleteAccountBtn.textContent = t('profile.deleteAccount');
    }
  };

  if (!isOAuth42 && cancelPasswordBtn && currentPasswordInput && newPasswordInput && confirmPasswordInput) {
    cancelPasswordBtn.onclick = () => {
      if (currentPasswordInput && newPasswordInput && confirmPasswordInput && passwordErrorDiv && passwordSuccessDiv) {
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        passwordErrorDiv.classList.add("hidden");
        passwordSuccessDiv.classList.add("hidden");
      }
    };

    passwordForm.onsubmit = async (e) => {
      e.preventDefault();

      if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput || !changePasswordBtn) return;

      const currentPassword = currentPasswordInput.value;
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showPasswordError(t('messages.fillAllFields'));
      return;
    }

    if (newPassword.length < 6) {
      showPasswordError(t('messages.passwordTooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      showPasswordError(t('messages.passwordsMismatch'));
      return;
    }

    if (currentPassword === newPassword) {
      showPasswordError(t('messages.passwordMustDiffer'));
      return;
    }

    changePasswordBtn.disabled = true;
    changePasswordBtn.textContent = t('common.loading');

    try {
      const result = await authManager.changePassword(currentPassword, newPassword);

      if (result.success) {
        showPasswordSuccess(t('messages.passwordChanged'));

        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';

      } else {
        showPasswordError(result.error || t('errors.passwordChangeFailed'));
      }
    } catch (error: any) {
      showPasswordError(t('errors.networkError') + ": " + error.message);
    } finally {
        changePasswordBtn.disabled = false;
        changePasswordBtn.textContent = t('profile.changePassword');
      }
    };
  }

  updateCancelButtonState();

  const avatarInput = avatarSection.querySelector("#avatarInput") as HTMLInputElement;
  const deleteAvatarBtn = avatarSection.querySelector("#deleteAvatarBtn") as HTMLButtonElement;
  const dropZone = avatarSection.querySelector("#dropZone") as HTMLDivElement;
  const avatarErrorDiv = avatarSection.querySelector("#avatarError") as HTMLDivElement;
  const avatarSuccessDiv = avatarSection.querySelector("#avatarSuccess") as HTMLDivElement;

  const showAvatarError = (message: string) => {
    avatarErrorDiv.textContent = message;
    avatarErrorDiv.classList.remove("hidden");
    avatarSuccessDiv.classList.add("hidden");
  };

  const showAvatarSuccess = (message: string) => {
    avatarSuccessDiv.textContent = message;
    avatarSuccessDiv.classList.remove("hidden");
    avatarErrorDiv.classList.add("hidden");
  };

  const updateAvatarsInInterface = (newAvatarUrl: string | null) => {
    const displayImageUrl = transformAvatarUrl(newAvatarUrl || undefined);

    const headerAvatarContainer = document.querySelector('#profile-header-avatar') as HTMLElement;
    if (headerAvatarContainer) {
      if (newAvatarUrl) {
        headerAvatarContainer.innerHTML = `
          <img src="${displayImageUrl}" alt="Avatar" class="w-16 h-16 rounded-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="w-16 h-16 bg-sec rounded-full flex items-center justify-center" style="display:none;">
            <span class="text-2xl font-bold text-text">${user.displayName.charAt(0).toUpperCase()}</span>
          </div>`;
      } else {
        headerAvatarContainer.innerHTML = `
          <div class="w-16 h-16 bg-sec rounded-full flex items-center justify-center">
            <span class="text-2xl font-bold text-text">${user.displayName.charAt(0).toUpperCase()}</span>
          </div>`;
      }
    }

    const avatarSectionImg = avatarSection.querySelector('.w-20.h-20') as HTMLElement;
    if (avatarSectionImg) {
      if (newAvatarUrl) {
        avatarSectionImg.outerHTML = `<img src="${displayImageUrl}" alt="Avatar" class="w-20 h-20 rounded-full object-cover border-2 border-sec">`;
      } else {
        avatarSectionImg.outerHTML = `<div class="w-20 h-20 bg-sec rounded-full flex items-center justify-center border-2 border-sec">
           <span class="text-2xl font-bold text-text">${user.displayName.charAt(0).toUpperCase()}</span>
         </div>`;
      }
    }

    const avatarDescription = avatarSection.querySelector('p.font-sans.text-sm.text-gray-400');
    if (avatarDescription) {
      avatarDescription.textContent = newAvatarUrl ? t('profile.currentAvatar') : t('profile.noAvatar');
    }

    const buttonContainer = avatarSection.querySelector('.flex.flex-wrap.gap-2');
    if (buttonContainer) {
      buttonContainer.innerHTML = `
        <div class="relative">
          <input type="file" id="avatarInput" class="hidden" accept="image/jpeg,image/png,image/gif,image/webp">
          <label for="avatarInput" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-sans font-bold py-2 px-4 rounded-lg cursor-pointer transition">
            ${newAvatarUrl ? t('profile.changeAvatar') : t('profile.uploadAvatar')}
          </label>
        </div>
        ${newAvatarUrl ? 
          `<button type="button" id="deleteAvatarBtn" class="bg-red-600 hover:bg-red-700 text-white font-sans font-bold py-2 px-4 rounded-lg transition">
             ${t('profile.deleteAvatar')}
           </button>` : ''
        }
        ${isOAuth42 ? 
          `<button type="button" id="sync42AvatarBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-bold py-2 px-4 rounded-lg transition">
             ${t('profile.sync42Avatar')}
           </button>` : ''
        }
      `;
      
      const avatarInput = buttonContainer.querySelector('#avatarInput') as HTMLInputElement;
      if (avatarInput) {
        avatarInput.addEventListener('change', (e: any) => {
          const file = e.target.files[0];
          if (file) handleFileUpload(file);
        });
      }
      
      const deleteBtn = buttonContainer.querySelector('#deleteAvatarBtn') as HTMLElement;
      if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteAvatar);
      }
      
      const sync42Btn = buttonContainer.querySelector('#sync42AvatarBtn') as HTMLElement;
      if (sync42Btn) {
        sync42Btn.addEventListener('click', handleSync42Avatar);
      }
    }

    (async () => {
      try {
        await menuManager.forceUpdateAsync();
      } catch (error) {
        console.warn('Menu update error:', error);

        menuManager.forceUpdate();
      }
    })();

    user.avatarUrl = newAvatarUrl || undefined;
  };

  const handleDeleteAvatar = async () => {
    if (confirm(t('profile.confirmDeleteAvatar'))) {
      try {
        const { deleteAvatar } = await import('../api-client.js');
        const result = await deleteAvatar();
        
        if (result.success) {
          showAvatarSuccess(t('profile.avatarDeleteSuccess'));
          updateAvatarsInInterface(null);
        } else {
          showAvatarError(result.error || t('profile.avatarDeleteFailed'));
        }
      } catch (error: any) {
        showAvatarError(error.message || t('profile.avatarDeleteFailed'));
      }
    }
  };

  const handleSync42Avatar = async () => {
    if (confirm(t('profile.confirm42Sync'))) {
      try {
        const { sync42Avatar } = await import('../api-client.js');
        const result = await sync42Avatar();
        
        if (result.success) {
          showAvatarSuccess(t('profile.avatar42SyncSuccess'));
          updateAvatarsInInterface(result.avatarUrl);
        } else {
          showAvatarError(result.error || t('profile.avatar42SyncFailed'));
        }
      } catch (error: any) {
        showAvatarError(error.message || t('profile.avatar42SyncFailed'));
      }
    }
  };

  const handleFileUpload = async (file: File) => {

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showAvatarError(t('profile.invalidFileType'));
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      showAvatarError(t('profile.fileTooLarge'));
      return;
    }

    try {
      const { uploadAvatar } = await import('../api-client.js');
      const result = await uploadAvatar(file);
      
      if (result.success) {
        showAvatarSuccess(t('profile.avatarUploadSuccess'));

        updateAvatarsInInterface(result.avatarUrl);
      } else {
        showAvatarError(result.error || t('profile.avatarUploadFailed'));
      }
    } catch (error: any) {
      showAvatarError(error.message || t('profile.avatarUploadFailed'));
    }
  };

  avatarInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      handleFileUpload(target.files[0]);
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-sec');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-sec');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-sec');
    
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  dropZone.addEventListener('click', () => {
    avatarInput.click();
  });

  if (deleteAvatarBtn) {
    deleteAvatarBtn.addEventListener('click', handleDeleteAvatar);
  }

  const sync42AvatarBtn = avatarSection.querySelector("#sync42AvatarBtn") as HTMLButtonElement;
  if (sync42AvatarBtn) {
    sync42AvatarBtn.addEventListener('click', handleSync42Avatar);
  }

  container.appendChild(header);
  container.appendChild(avatarSection);
  container.appendChild(profileForm);
  container.appendChild(passwordForm);
  container.appendChild(deleteAccountSection);
  container.appendChild(stats);

  return container;
}

function formatDate(dateString?: string): string {
  if (!dateString) return t('common.unknown');

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return t('common.unknown');
  }
}
