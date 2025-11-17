import { authManager } from "../auth";
import { router } from "../router";
import { api } from "../api-client";
import { i18n } from "../i18n";

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
    console.error('Error loading user profile:', error);
    router.navigate("/login");
    return document.createElement("div");
  }

  const container = document.createElement("div");
  container.className = "max-w-2xl mx-auto mt-8 p-8";

  const isOAuth42 = user.accountType === 'oauth42';

  const header = document.createElement("div");
  header.className = "bg-prem rounded-lg shadow-xl p-8 mb-6";

  const avatarContent = user.avatarUrl
    ? `<img src="${user.avatarUrl}" alt="Avatar" class="w-16 h-16 rounded-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
       <div class="w-16 h-16 bg-sec rounded-full flex items-center justify-center" style="display:none;">
         <span class="text-2xl font-bold text-text">${user.displayName.charAt(0).toUpperCase()}</span>
       </div>`
    : `<div class="w-16 h-16 bg-sec rounded-full flex items-center justify-center">
         <span class="text-2xl font-bold text-text">${user.displayName.charAt(0).toUpperCase()}</span>
       </div>`;

  header.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="font-display font-black text-4xl text-text">Mon Profil</h1>
      <div class="flex items-center space-x-4">
        ${isOAuth42 ? '<span class="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-sans">Compte 42</span>' : ''}
        <button id="logoutBtn" class="bg-red-600 hover:bg-red-700 text-white font-sans font-bold py-2 px-4 rounded-lg transition">
          Déconnexion
        </button>
      </div>
    </div>
    <div class="flex items-center space-x-4">
      <div class="relative">
        ${avatarContent}
      </div>
      <div>
        <h2 class="font-sans text-2xl font-bold text-text">${user.displayName}</h2>
        <p class="font-sans text-gray-400">${user.email}</p>
        ${user.oauth42Login ? `<p class="font-sans text-sm text-blue-400">Login 42: ${user.oauth42Login}</p>` : ''}
        <p class="font-sans text-sm text-gray-500">Membre depuis ${formatDate(user.createdAt)}</p>
        ${user.last42Sync ? `<p class="font-sans text-xs text-gray-600">Dernière sync 42: ${formatDate(user.last42Sync)}</p>` : ''}
      </div>
    </div>
  `;

  const profileForm = document.createElement("form");
  profileForm.className = "bg-prem rounded-lg shadow-xl p-8 mb-6";
  profileForm.innerHTML = `
    <h3 class="font-display text-2xl font-bold text-text mb-6">Modifier le profil</h3>

    ${user.avatarUrl ? `
      <div class="mb-6">
        <label class="block font-sans text-text mb-2">Photo de profil</label>
        <div class="flex items-center space-x-4">
          <img src="${user.avatarUrl}" alt="Avatar" class="w-20 h-20 rounded-full object-cover" onerror="this.style.display='none';">
          <div class="text-sm text-gray-400">
            ${isOAuth42 ? 'Avatar synchronisé depuis votre profil 42' : 'Avatar personnalisé'}
          </div>
        </div>
      </div>
    ` : ''}

    <div class="mb-4">
      <label class="block font-sans text-text mb-2">Nom d'affichage</label>
      <input name="displayName" type="text" value="${user.displayName}" required
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>

    <div class="mb-4">
      <label class="block font-sans text-text mb-2">Email</label>
      <input name="email" type="email" value="${user.email}" required
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans"
        ${isOAuth42 ? 'disabled title="Les utilisateurs OAuth2 ne peuvent pas changer leur email"' : ''} />
      ${isOAuth42 ? '<small class="text-yellow-400 text-xs">Les utilisateurs 42 doivent modifier leur email depuis leur profil 42</small>' : ''}
    </div>

    <div class="flex space-x-4">
      <button type="submit" id="updateProfileBtn" class="bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
        Mettre à jour
      </button>
      <button type="button" id="cancelProfileBtn" class="bg-gray-600 hover:bg-gray-700 text-text font-sans font-bold py-2 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed" disabled>
        Annuler
      </button>
    </div>
    <div id="profileError" class="mt-4 p-3 bg-red-900 text-red-200 rounded-lg text-sm font-sans hidden"></div>
    <div id="profileSuccess" class="mt-4 p-3 bg-green-900 text-green-200 rounded-lg text-sm font-sans hidden"></div>
  `;

  const passwordForm = document.createElement("form");
  passwordForm.className = "bg-prem rounded-lg shadow-xl p-8";

  if (isOAuth42) {
    passwordForm.innerHTML = `
      <h3 class="font-display text-2xl font-bold text-text mb-6">Sécurité du compte</h3>
      <div class="bg-blue-900 border border-blue-600 rounded-lg p-4">
        <p class="font-sans text-blue-200 mb-2">🔒 Compte 42 OAuth</p>
        <p class="font-sans text-blue-300 text-sm">
          Votre compte est sécurisé par l'authentification 42.
          La gestion des mots de passe se fait directement via votre compte 42.
        </p>
      </div>
    `;
  } else {
    passwordForm.innerHTML = `
    <h3 class="font-display text-2xl font-bold text-text mb-6">Changer le mot de passe</h3>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">Mot de passe actuel</label>
      <input name="currentPassword" type="password" required
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">Nouveau mot de passe</label>
      <input name="newPassword" type="password" required minlength="6"
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">Confirmer le nouveau mot de passe</label>
      <input name="confirmPassword" type="password" required minlength="6"
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <div class="flex space-x-4">
      <button type="submit" id="changePasswordBtn" class="bg-orange-600 hover:bg-orange-700 text-white font-sans font-bold py-2 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
        Changer le mot de passe
      </button>
      <button type="button" id="cancelPasswordBtn" class="bg-gray-600 hover:bg-gray-700 text-text font-sans font-bold py-2 px-6 rounded-lg transition">
        Annuler
      </button>
    </div>
    <div id="passwordError" class="mt-4 p-3 bg-red-900 text-red-200 rounded-lg text-sm font-sans hidden"></div>
    <div id="passwordSuccess" class="mt-4 p-3 bg-green-900 text-green-200 rounded-lg text-sm font-sans hidden"></div>
  `;
  }

  const stats = document.createElement("div");
  stats.className = "bg-prem rounded-lg shadow-xl p-8 mt-6";
  stats.innerHTML = `
    <h3 class="font-display text-2xl font-bold text-text mb-6">Statistiques</h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-gray-700 p-4 rounded-lg text-center">
        <div class="font-display text-3xl font-bold text-sec">0</div>
        <div class="font-sans text-gray-400">Parties jouées</div>
      </div>
      <div class="bg-gray-700 p-4 rounded-lg text-center">
        <div class="font-display text-3xl font-bold text-green-400">0</div>
        <div class="font-sans text-gray-400">Victoires</div>
      </div>
      <div class="bg-gray-700 p-4 rounded-lg text-center">
        <div class="font-display text-3xl font-bold text-red-400">0</div>
        <div class="font-sans text-gray-400">Défaites</div>
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
    <h3 class="font-display text-2xl font-bold text-red-200 mb-6">Zone dangereuse</h3>
    <div class="bg-red-800 border border-red-600 rounded-lg p-4 mb-4">
      <p class="font-sans text-red-200 mb-2">⚠️ Attention : Cette action est irréversible</p>
      <p class="font-sans text-red-300 text-sm">La suppression de votre compte effacera définitivement :</p>
      <ul class="font-sans text-red-300 text-sm mt-2 ml-4 list-disc">
        <li>Votre profil et vos informations personnelles</li>
        <li>Tout votre historique de parties</li>
        <li>Vos statistiques et classements</li>
        <li>Vos messages de chat</li>
        <li>Tous vos tokens de connexion</li>
      </ul>
      ${isOAuth42 ? '<p class="font-sans text-red-300 text-sm mt-2">Note: Cela ne supprimera que votre compte sur notre plateforme, pas votre compte 42.</p>' : ''}
    </div>
    ${!isOAuth42 ? `
      <div class="mb-4">
        <label class="block font-sans text-red-200 mb-2">Mot de passe (pour confirmer la suppression)</label>
        <input id="deletePasswordInput" type="password" required
          class="w-full px-4 py-2 bg-red-800 text-red-100 border border-red-600 rounded-lg focus:outline-none focus:border-red-400 font-sans placeholder-red-400"
          placeholder="Entrez votre mot de passe pour confirmer" />
      </div>
    ` : ''}
    <div class="mb-4">
      <label class="block font-sans text-red-200 mb-2">
        <input type="checkbox" id="confirmDeleteCheckbox" class="mr-2">
        Je comprends que cette action est irréversible et que toutes mes données seront définitivement supprimées
      </label>
    </div>
    <button type="button" id="deleteAccountBtn" class="bg-red-600 hover:bg-red-700 text-white font-sans font-bold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed" disabled>
      🗑️ Supprimer définitivement mon compte
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
    if (confirm(i18n.translate('messages.confirmLogout'))) {
      await authManager.logout();
      router.navigate("/login");
    }
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
      showProfileError("Le nom d'affichage ne peut pas être vide");
      return;
    }

    if (!email) {
      showProfileError("L'email ne peut pas être vide");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showProfileError("Format d'email invalide");
      return;
    }

    if (displayName === originalDisplayName && email === originalEmail) {
      showProfileError("Aucune modification détectée");
      return;
    }

    updateProfileBtn.disabled = true;
    updateProfileBtn.textContent = "Mise à jour...";

    try {
      const updates: any = {};
      if (displayName !== originalDisplayName) updates.displayName = displayName;
      if (email !== originalEmail && !isOAuth42) updates.email = email;

      await api('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      showProfileSuccess("Profil mis à jour avec succès !");

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
      showProfileError("Erreur lors de la mise à jour: " + error.message);
    } finally {
      updateProfileBtn.disabled = false;
      updateProfileBtn.textContent = "Mettre à jour";
    }
  };

  deleteAccountBtn.onclick = async () => {
    if (!confirmDeleteCheckbox.checked) {
      showDeleteError("Veuillez confirmer que vous comprenez les conséquences");
      return;
    }

    if (!isOAuth42) {
      const password = deletePasswordInput.value;
      if (!password) {
        showDeleteError("Veuillez entrer votre mot de passe");
        return;
      }
    }

    const confirmed = confirm(
      "ATTENTION !\n\n" +
      "Êtes-vous absolument certain de vouloir supprimer votre compte ?\n\n" +
      "Cette action est IRRÉVERSIBLE et supprimera :\n" +
      "• Votre profil et vos données personnelles\n" +
      "• Tout votre historique de parties\n" +
      "• Vos statistiques et classements\n" +
      "• Vos messages de chat\n\n" +
      "Tapez 'SUPPRIMER' dans la prochaine boîte de dialogue pour confirmer."
    );

    if (!confirmed) return;

    const finalConfirmation = prompt(
      "Pour confirmer définitivement la suppression de votre compte, tapez exactement :\n\nSUPPRIMER"
    );

    if (finalConfirmation !== "SUPPRIMER") {
      showDeleteError("Confirmation incorrecte. Suppression annulée.");
      return;
    }

    deleteAccountBtn.disabled = true;
    deleteAccountBtn.textContent = "Suppression en cours...";

    try {
      const requestBody = isOAuth42 ? {} : { password: deletePasswordInput.value };
      await api('/auth/delete-account', {
        method: 'DELETE',
        body: JSON.stringify(requestBody)
      });

      alert(i18n.translate('messages.accountDeletedSuccess'));
      await authManager.logout();
      router.navigate("/");
    } catch (error: any) {
      showDeleteError(i18n.translate('errors.deleteError') + ": " + error.message);
      deleteAccountBtn.disabled = false;
      deleteAccountBtn.textContent = "🗑️ " + i18n.translate('profile.deleteAccountFinal');
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
      showPasswordError("Veuillez remplir tous les champs");
      return;
    }

    if (newPassword.length < 6) {
      showPasswordError("Le nouveau mot de passe doit contenir au moins 6 caractères");
      return;
    }

    if (newPassword !== confirmPassword) {
      showPasswordError("Les mots de passe ne correspondent pas");
      return;
    }

    if (currentPassword === newPassword) {
      showPasswordError("Le nouveau mot de passe doit être différent de l'actuel");
      return;
    }

    changePasswordBtn.disabled = true;
    changePasswordBtn.textContent = "Changement en cours...";

    try {
      const result = await authManager.changePassword(currentPassword, newPassword);

      if (result.success) {
        showPasswordSuccess("Mot de passe changé avec succès !");

        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';

      } else {
        showPasswordError(result.error || "Erreur lors du changement de mot de passe");
      }
    } catch (error: any) {
      showPasswordError("Erreur de réseau: " + error.message);
    } finally {
        changePasswordBtn.disabled = false;
        changePasswordBtn.textContent = "Changer le mot de passe";
      }
    };
  }

  updateCancelButtonState();

  container.appendChild(header);
  container.appendChild(profileForm);
  container.appendChild(passwordForm);
  container.appendChild(deleteAccountSection);
  container.appendChild(stats);

  return container;
}

function formatDate(dateString?: string): string {
  if (!dateString) return "Inconnue";

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return "Inconnue";
  }
}
