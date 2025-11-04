"use strict";
let action = document.getElementById("play");
if (!action)
    throw new Error("Element #play introuvable");
let base = document.getElementById("game");
if (!base)
    throw new Error("Element #game introuvable");
const initialContent = base.innerHTML;
action.addEventListener("click", () => {
    console.log("Acceder au jeu");
    showGame();
});
function showGame() {
    let div = `
        <div>
            <h1> GAME - PONG </h1>
            <p>"ici se trouvera la partie"</p>
            <button id="back" class="bouton">Retour</button>
        </div>
    `;
    base.innerHTML = div;
    const backBtn = document.getElementById("back");
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            base.innerHTML = initialContent;
            const playBtn = document.getElementById("play");
            if (playBtn)
                playBtn.addEventListener("click", () => { showGame(); });
        });
    }
}
let buttonSignUp = document.getElementById("signup");
if (!buttonSignUp)
    throw new Error("Element #game introuvable");
buttonSignUp.addEventListener("click", () => {
    console.log("Creation compte");
    showForm();
});
function showForm() {
    let div = `
        <div>
            <h2>Inscription</h2>
            <form id="signup-form">
                <label for="pseudo">Pseudo</label>
                <input type="text" id="pseudo" name="pseudo" required />

                <label for="email">Email</label>
                <input type="email" id="email" name="email" required />

                <label for="password">Mot de passe</label>
                <input type="password" id="password" name="password" required />

                <div style="margin-top:1em;">
                    <button type="submit" id="submit_signup" class="bouton">Créer</button>
                    <button type="button" id="back_form" class="bouton">Retour</button>
                </div>
            </form>
        </div>
    `;
    base.innerHTML = div;
    const backFormBtn = document.getElementById('back_form');
    if (backFormBtn) {
        backFormBtn.addEventListener('click', () => {
            base.innerHTML = initialContent;
            const playBtn = document.getElementById('play');
            if (playBtn)
                playBtn.addEventListener('click', () => { showGame(); });
            const signupDiv = document.getElementById('signup');
            if (signupDiv)
                signupDiv.addEventListener('click', () => { showForm(); });
        });
    }
    const form = document.getElementById('signup-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const pseudo = document.getElementById('pseudo').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        if (!pseudo || !email || !password) {
            alert('Veuillez remplir tous les champs.');
            return;
        }
        const emailRe = /^\S+@\S+\.\S+$/;
        if (!emailRe.test(email)) {
            alert('Veuillez entrer un email valide.');
            return;
        }
        console.log('Signup:', { pseudo, email, password });
        alert('Compte créé pour ' + pseudo + ' (simulation)');
        base.innerHTML = initialContent;
        const playBtn = document.getElementById('play');
        if (playBtn)
            playBtn.addEventListener('click', () => { showGame(); });
        const signupDiv = document.getElementById('signup');
        if (signupDiv)
            signupDiv.addEventListener('click', () => { showForm(); });
    });
}
