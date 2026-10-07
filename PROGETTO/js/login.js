const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('form-message');

function showLoginMessage(text, type = 'error') {
    loginMessage.textContent = text;
    loginMessage.className = `form-message ${type}`;
}

if (AuthManager.isLoggedIn()) {
    window.location.href = 'profilo.html';
}

// Arrivo dalla registrazione o dalla cancellazione del profilo
const loginParams = new URLSearchParams(window.location.search);
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
        window.location.href = 'profilo.html';
    } catch (error) {
        showLoginMessage(error.message);
        loginForm.password.value = '';
    }
});
