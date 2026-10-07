// La pagina è riservata: senza sessione si torna al login
const utente = AuthManager.requireAuth('login.html');

const profileForm = document.getElementById('profile-form');
const passwordForm = document.getElementById('password-form');
const deleteForm = document.getElementById('delete-form');
const favoritesContainer = document.getElementById('favorites-container');
const dishTags = document.getElementById('dish-tags');

function showMessage(elementId, text, type = 'error') {
    const element = document.getElementById(elementId);
    element.textContent = text;
    element.className = `form-message ${type}`;
}

function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// ---------- Riepilogo ----------

function renderSummary(user) {
    const ricette = StorageManager.getRicettario(user.id);

    document.getElementById('profile-avatar').textContent = user.username.charAt(0).toUpperCase();
    document.getElementById('profile-username').textContent = user.username;
    document.getElementById('profile-email').textContent = user.email;

    const since = document.getElementById('profile-since');
    since.dateTime = user.registeredAt;
    since.textContent = formatDate(user.registeredAt);

    document.getElementById('stat-ricette').textContent = ricette.length;
    document.getElementById('stat-preferite').textContent = ricette.filter(r => r.preferita).length;
    document.getElementById('stat-recensioni').textContent = StorageManager.countUserReviews(user.id);
}

// ---------- Dati personali ----------

function renderDishTags(piatti) {
    dishTags.innerHTML = '';
    piatti.forEach(piatto => {
        const li = document.createElement('li');
        li.textContent = piatto;
        dishTags.appendChild(li);
    });
}

function fillProfileForm(user) {
    profileForm.username.value = user.username;
    profileForm.email.value = user.email;
    profileForm['favorite-dishes'].value = (user.piattiPreferiti || []).join(', ');
    renderDishTags(user.piattiPreferiti || []);
}

// Anteprima dei tag mentre si scrive
profileForm['favorite-dishes'].addEventListener('input', (event) => {
    renderDishTags(AuthManager.parsePiattiPreferiti(event.target.value));
});

// "Annulla" ripristina i dati salvati (il reset nativo svuoterebbe i campi)
profileForm.addEventListener('reset', (event) => {
    event.preventDefault();
    fillProfileForm(StorageManager.getUser());
    showMessage('profile-message', '');
});

profileForm.addEventListener('submit', (event) => {
    event.preventDefault();

    try {
        const updated = AuthManager.updateProfile({
            username: profileForm.username.value,
            email: profileForm.email.value,
            piattiPreferiti: profileForm['favorite-dishes'].value
        });

        fillProfileForm(updated);
        renderSummary(updated);
        showMessage('profile-message', 'Dati aggiornati correttamente.', 'success');
    } catch (error) {
        showMessage('profile-message', error.message);
    }
});

// ---------- Password ----------

passwordForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const newPassword = passwordForm['new-password'].value;

    if (newPassword !== passwordForm['confirm-new-password'].value) {
        showMessage('password-message', 'Le nuove password non coincidono.');
        return;
    }

    try {
        AuthManager.changePassword(passwordForm['current-password'].value, newPassword);
        passwordForm.reset();
        showMessage('password-message', 'Password aggiornata.', 'success');
    } catch (error) {
        showMessage('password-message', error.message);
    }
});

// ---------- Ricette preferite ----------

function createFavoriteCard(ricetta) {
    const card = document.createElement('article');
    card.className = 'favorite-card';

    const link = `ricetta.html?id=${encodeURIComponent(ricetta.id)}`;

    card.innerHTML = `
        <a href="${link}" class="favorite-image">
            <img src="${ricetta.immagine || '../images/not-found.jpg'}" alt="">
        </a>
        <div class="favorite-body">
            <h4><a href="${link}"></a></h4>
            <p class="favorite-meta"></p>
            <button type="button" class="btn-unfavorite" data-id="${ricetta.id}">
                Rimuovi dai preferiti
            </button>
        </div>
    `;

    // textContent per i dati provenienti dall'esterno
    card.querySelector('h4 a').textContent = ricetta.nome || 'Ricetta';
    card.querySelector('.favorite-meta').textContent =
        [ricetta.categoria, ricetta.area].filter(Boolean).join(' · ');

    return card;
}

function renderFavorites(user) {
    const preferite = StorageManager.getRicettario(user.id).filter(r => r.preferita);
    favoritesContainer.innerHTML = '';

    if (preferite.length === 0) {
        favoritesContainer.innerHTML = `
            <p class="empty-favorites">
                Non hai ancora ricette preferite.
                Aggiungi ricette al <a href="ricettario.html">ricettario</a> e premi il cuore
                per vederle qui, oppure <a href="ricerca.html">cercane di nuove</a>.
            </p>`;
        return;
    }

    preferite.forEach(r => favoritesContainer.appendChild(createFavoriteCard(r)));
}

favoritesContainer.addEventListener('click', (event) => {
    const button = event.target.closest('.btn-unfavorite');
    if (!button) return;

    const ricette = StorageManager.getRicettario();
    const ricetta = ricette.find(r => String(r.id) === String(button.dataset.id));
    if (!ricetta) return;

    ricetta.preferita = false;
    StorageManager.saveRicettario(ricette);

    const user = StorageManager.getUser();
    renderFavorites(user);
    renderSummary(user);
});

// ---------- Logout ----------

document.getElementById('logout-btn').addEventListener('click', () => {
    AuthManager.logout();
    window.location.href = 'login.html';
});

// ---------- Cancellazione profilo ----------

deleteForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const conferma = window.confirm(
        'Sei sicuro di voler eliminare il profilo? Questa operazione non può essere annullata.'
    );
    if (!conferma) return;

    try {
        AuthManager.deleteProfile(deleteForm['delete-password'].value);
        alert('Il tuo profilo è stato eliminato.');
        window.location.href = '../index.html';
    } catch (error) {
        showMessage('delete-message', error.message);
        deleteForm['delete-password'].value = '';
    }
});

// ---------- Avvio ----------

if (utente) {
    renderSummary(utente);
    fillProfileForm(utente);
    renderFavorites(utente);
}
