import { api } from "../apiClient";
import { router } from "../router";

export default async function View() {
  const form = document.createElement("form");
  form.className = "max-w-md mx-auto mt-8 p-8 bg-prem rounded-lg shadow-xl";
  
  form.innerHTML = `
    <h1 class="text-3xl font-bold text-text mb-6">Connexion</h1>
    <div class="mb-4">
      <label class="block text-text mb-2">Email</label>
      <input name="email" type="email" placeholder="email@example.com" required 
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text" />
    </div>
    <div class="mb-4">
      <label class="block text-text mb-2">Mot de passe</label>
      <input name="password" type="password" placeholder="••••••••" required 
        class="w-full px-4 py-2 bg-gray-700 text-text border border-sec rounded-lg focus:outline-none focus:border-text" />
    </div>
    <button class="w-full bg-sec hover:bg-opacity-80 text-text font-bold py-2 px-4 rounded-lg transition">
      Se connecter
    </button>
    <pre id="out" class="mt-4 p-4 bg-gray-700 text-text rounded-lg text-sm overflow-auto max-h-40"></pre>
    <p class="mt-4 text-center text-text">
      Pas de compte ? <a href="/signup" class="text-sec hover:underline">S'inscrire</a>
    </p>
  `;
  
  const out = form.querySelector("#out") as HTMLPreElement;
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const res = await api("/auth/login", { 
        method: "POST", 
        body: JSON.stringify({ 
          email: fd.get("email"), 
          password: fd.get("password") 
        })
      });
      out.textContent = JSON.stringify(res, null, 2);
      // Rediriger vers la page d'accueil après connexion réussie
      setTimeout(() => router.navigate("/"), 1000);
    } catch (err: any) { 
      out.textContent = "Échec de la connexion: " + err.message; 
    }
  };
  
  return form;
}

