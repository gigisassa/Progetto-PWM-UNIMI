/*
 * Adatta il menu dell'header allo stato di autenticazione. E viene anche utilizzata nella scheda delle ricette
 * Le voci con data-auth="user" sono visibili solo all'utente collegato,
 * quelle con data-auth="guest" solo a chi non ha effettuato l'accesso.
 * Richiede js/storage.js caricato prima.
 */
function updateNavigation() {
    const user = StorageManager.getUser();

    document.querySelectorAll('[data-auth]').forEach(item => {
        item.hidden = (item.dataset.auth === 'user') !== Boolean(user);
    });

    if (!user) return;

    document.querySelectorAll('.user-chip').forEach(chip => {
        chip.querySelector('.user-avatar').textContent = user.username.charAt(0).toUpperCase();
        chip.querySelector('.user-name').textContent = user.username;
        chip.setAttribute('aria-label', `Profilo di ${user.username}`);
    });
}

updateNavigation();
