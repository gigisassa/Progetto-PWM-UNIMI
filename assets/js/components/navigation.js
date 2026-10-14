/*
 * Adatta il menu dell'header allo stato di autenticazione. E viene anche utilizzata nella scheda delle ricette
 * Le voci con data-auth="user" sono visibili solo all'utente collegato,
 * quelle con data-auth="guest" solo a chi non ha effettuato l'accesso.
 * Richiede assets/js/core/storage.js caricato prima.
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

// Il menu resta visibile se JavaScript non è disponibile.
document.querySelectorAll('.navigation').forEach(navigation => {
    const toggle = navigation.querySelector('.nav-toggle');
    const menu = navigation.querySelector('.nav-menu');
    if (!toggle || !menu) return;

    const mobile = window.matchMedia('(max-width: 768px)');

    function setMenuOpen(open, restoreFocus = false) {
        navigation.toggleAttribute('data-menu-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        if (restoreFocus) toggle.focus();
    }

    navigation.setAttribute('data-menu-ready', '');
    setMenuOpen(false);

    toggle.addEventListener('click', () => {
        setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && mobile.matches && navigation.hasAttribute('data-menu-open')) {
            event.preventDefault();
            setMenuOpen(false, true);
        }
    });

    menu.addEventListener('click', event => {
        if (mobile.matches && event.target.closest('a')) setMenuOpen(false);
    });

    document.addEventListener('click', event => {
        if (mobile.matches && !navigation.contains(event.target)) {
            setMenuOpen(false, menu.contains(document.activeElement));
        }
    });

    mobile.addEventListener('change', () => {
        const focusInMenu = menu.contains(document.activeElement);
        const focusOnToggle = document.activeElement === toggle;
        setMenuOpen(false, mobile.matches && focusInMenu);
        if (!mobile.matches && focusOnToggle) navigation.querySelector('.logo a')?.focus();
    });
});
