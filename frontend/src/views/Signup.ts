import { api } from "../apiClient";
export default async function View() {
  const form = document.createElement("form");
  form.innerHTML = `<h1>Signup</h1>
  <input name="email" placeholder="email" required />
  <input name="displayName" placeholder="display name" required />
  <input name="password" type="password" placeholder="password" required />
  <button>Create account</button><pre id="out"></pre>`;
  const out = form.querySelector("#out") as HTMLPreElement;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const res = await api("/auth/signup", { method:"POST", body: JSON.stringify({
        email: fd.get("email"), password: fd.get("password"), displayName: fd.get("displayName") })});
      out.textContent = JSON.stringify(res,null,2);
    } catch (err:any) { out.textContent = "Signup failed: " + err.message; }
  };
  return form;
}
