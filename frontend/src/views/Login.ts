import { api } from "../apiClient";
export default async function View() {
  const form = document.createElement("form");
  form.innerHTML = `<h1>Login</h1>
  <input name="email" placeholder="email" required />
  <input name="password" type="password" placeholder="password" required />
  <button>Login</button><pre id="out"></pre>`;
  const out = form.querySelector("#out") as HTMLPreElement;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const res = await api("/auth/login", { method:"POST", body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") })});
      out.textContent = JSON.stringify(res,null,2);
    } catch (err:any) { out.textContent = "Login failed: " + err.message; }
  };
  return form;
}
