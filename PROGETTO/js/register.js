const registerForm = document.getElementById('register-form');
const registerMessage = document.getElementById('form-message');

function showRegisterMessage(text, type = 'error') {
    registerMessage.textContent = text;
    registerMessage.className = `form-message ${type}`;
}

// Utente già collegato: niente registrazione, vai al profilo
if (AuthManager.isLoggedIn()) {
    window.location.href = 'profilo.html';
}

registerForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const password = formData.get('password');

    if (password !== formData.get('confirm-password')) {
        showRegisterMessage('Le password non coincidono.');
        return;
    }

    try {
        const user = AuthManager.register({
            username: formData.get('username'),
            email: formData.get('email'),
            password: password,
            piattiPreferiti: formData.get('favorite-dishes')
        });

        showRegisterMessage('Registrazione completata! Ora puoi accedere.', 'success');
        registerForm.reset();

        setTimeout(() => {
            window.location.href = `login.html?registered=1&email=${encodeURIComponent(user.email)}`;
        }, 1200);
    } catch (error) {
        showRegisterMessage(error.message);
    }
});
