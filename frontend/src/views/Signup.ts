import { api } from "../apiClient";
import { router } from "../router";

export default async function View() {
  const form = document.createElement("form");
  form.className = "max-w-md mx-auto mt-8 p-8 bg-prem rounded-lg shadow-xl";
  
  form.innerHTML = `
    <h1 class="font-display font-black text-4xl font-bold text-text mb-6">Inscription</h1>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">Nom d'utilisateur</label>
      <input name="username" type="text" placeholder="pseudo" required 
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">Email</label>
      <input name="email" type="email" placeholder="email@example.com" required 
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <div class="mb-4">
      <label class="block font-sans text-text mb-2">Mot de passe</label>
      <input name="password" type="password" placeholder="••••••••" required 
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text font-sans" />
    </div>
    <button class="w-full bg-sec hover:bg-opacity-80 text-text font-sans font-bold py-2 px-4 rounded-lg transition">
      S'inscrire
    </button>
    <pre id="out" class="mt-4 p-4 bg-gray-700 text-text rounded-lg text-sm overflow-auto max-h-40 font-sans"></pre>
    <p class="mt-4 text-center font-sans text-text">
      Déjà un compte ? <a href="/login" class="text-sec hover:underline">Se connecter</a>
    </p>
  `;
  
  const out = form.querySelector("#out") as HTMLPreElement;
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const res = await api("/auth/signup", { 
        method: "POST", 
        body: JSON.stringify({ 
          username: fd.get("username"),
          email: fd.get("email"), 
          password: fd.get("password") 
        })
      });
      out.textContent = JSON.stringify(res, null, 2);
      // Rediriger vers login après inscription réussie
      setTimeout(() => router.navigate("/login"), 1000);
    } catch (err: any) { 
      out.textContent = "Échec de l'inscription: " + err.message; 
    }
  };
  
  return form;
}

