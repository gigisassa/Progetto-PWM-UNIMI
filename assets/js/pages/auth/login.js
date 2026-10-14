const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('form-message');

function showLoginMessage(text, type = 'error') {
    loginMessage.textContent = text;
    loginMessage.className = `form-message ${type}`;
}

if (AuthManager.isLoggedIn()) {
    window.location.href = '../../account/profilo/';
}

// Arrivo dalla registrazione, dalla cancellazione del profilo o da una pagina riservata
const loginParams = new URLSearchParams(window.location.search);
if (loginParams.get('reason') === 'ricettario') {
    showLoginMessage('Devi effettuare il login per accedere al ricettario.');
}
if (loginParams.get('registered')) {
    showLoginMessage('Account creato con il tuo ricettario personale. Accedi per iniziare.', 'success');
}
if (loginParams.get('email')) {
    loginForm.email.value = loginParams.get('email');
    loginForm.password.focus();
}

loginForm.addEventListener('submit', (event) => {
    event.preventDefault();

    try {
        AuthManager.login(
            loginForm.email.value,
            loginForm.password.value,
            loginForm['remember-me'].checked
        );
        window.location.href = '../../account/profilo/';
    } catch (error) {
        showLoginMessage(error.message);
        loginForm.password.value = '';
    }
});
