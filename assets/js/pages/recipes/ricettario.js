// Il ricettario è personale: senza login si torna alla pagina di accesso,
// che mostra il motivo del reindirizzamento
AuthManager.requireAuth('../../auth/login/?reason=ricettario');

const container = document.getElementById("recipes-container");
let ricettario = StorageManager.getRicettario();

if (!container) {
    console.warn("#recipes-container non trovato");
}

const searchInput = document.getElementById('search-input');

function getRicettarioFromStorage() {
    return StorageManager.getRicettario();
}

function createCard(ricetta) {
    const card = document.createElement('article');
    card.classList.add('recipe-card');

    const isFavorite = Boolean(ricetta.preferita || ricetta.favorite);
    const favoriteClass = isFavorite ? 'favorite-btn active' : 'favorite-btn';

    card.innerHTML = `
    <img src="${ricetta.immagine || '../../../assets/images/placeholders/not-found.jpg'}" alt="${ricetta.nome || ''}" />

    <div class="recipe-content">

        <h3>${ricetta.nome || ''}</h3>

        <div class="recipe-info">
            <p><strong>Area:</strong> ${ricetta.area || ''}</p>
            <p><strong>Categoria:</strong> ${ricetta.categoria || ''}</p>
        </div>

        <div class="recipe-actions">

            <a class="open-btn" href="../ricetta/?id=${encodeURIComponent(ricetta.id)}">Apri</a>

            <button
                class="recipe-remove remove-btn"
                data-id="${ricetta.id}"
            >
                Rimuovi
            </button>

            <button
                class="recipe-favorite ${favoriteClass}"
                data-id="${ricetta.id}"
                aria-pressed="${isFavorite}"
                aria-label="${isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}"
            >
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4 8.04 4 9.54 4.99 10.44 6.36L12 8l1.56-1.64C14.46 4.99 15.96 4 17.5 4 20 4 22 6 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
            </button>

        </div>

    </div>
`;

    // Nota privata (testo dell'utente: inserito con textContent, mai come HTML)
    if (ricetta.nota) {
        const note = document.createElement('p');
        note.className = 'recipe-note';
        note.title = 'Nota privata';
        note.textContent = ricetta.nota;
        card.querySelector('.recipe-info').after(note);
    }

    return card;
}

function renderRecipes(list) {
    if (!container) return;
    container.innerHTML = '';
    if (!list || list.length === 0) {
        container.innerHTML = "<p id='empty-message'>Nessuna ricetta salvata.</p>";
        return;
    }

    list.forEach(r => {
        container.appendChild(createCard(r));
    });
}

function scoreRecipe(ricetta, q) {
    if (!q) return 1; // neutral score for empty query
    const s = q.trim().toLowerCase();
    let score = 0;
    const name = (ricetta.nome || '').toLowerCase();
    const area = (ricetta.area || '').toLowerCase();
    const categoria = (ricetta.categoria || '').toLowerCase();

    if (name === s) score += 100;
    else if (name.startsWith(s)) score += 50;
    else if (name.includes(s)) score += 30;

    if (area === s) score += 40;
    else if (area.includes(s)) score += 10;

    if (categoria === s) score += 40;
    else if (categoria.includes(s)) score += 10;

    return score;
}

function searchAndRender(query) {
    ricettario = getRicettarioFromStorage();
    const q = (query || '').trim();
    if (!q) {
        renderRecipes(ricettario);
        return;
    }

    const scored = ricettario.map(r => ({ r, score: scoreRecipe(r, q) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.r);

    renderRecipes(scored);
}

// initial render
renderRecipes(ricettario);

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        searchAndRender(e.target.value);
    });
}

// delegated click handling for remove and favorite
document.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('.remove-btn');
    if (removeBtn) {
        const idRicetta = removeBtn.dataset.id;
        const daRimuovere = getRicettarioFromStorage().find(r => String(r.id) === String(idRicetta));

        const confirmRemove = window.confirm(daRimuovere && daRimuovere.nota
            ? 'Confermi la rimozione di questa ricetta? Verrà eliminata anche la tua nota privata.'
            : 'Confermi la rimozione di questa ricetta?');
        if (!confirmRemove) return;

        let ricettarioLocal = getRicettarioFromStorage();

        ricettarioLocal = ricettarioLocal.filter(
            ricetta => String(ricetta.id) !== String(idRicetta)
        );

        StorageManager.saveRicettario(ricettarioLocal);
        ricettario = ricettarioLocal;

        const currentQuery = searchInput ? searchInput.value : '';
        searchAndRender(currentQuery);
        return;
    }

    const favBtn = event.target.closest('.favorite-btn');
    if (favBtn) {
        const idRicetta = favBtn.dataset.id;

        let ricettarioLocal = getRicettarioFromStorage();

        const index = ricettarioLocal.findIndex(r => String(r.id) === String(idRicetta));
        if (index === -1) return;

        // Toggle preferita flag
        const currently = Boolean(ricettarioLocal[index].preferita || ricettarioLocal[index].favorite);
        ricettarioLocal[index].preferita = !currently;

        StorageManager.saveRicettario(ricettarioLocal);
        ricettario = ricettarioLocal;

        const currentQuery = searchInput ? searchInput.value : '';
        searchAndRender(currentQuery);
    }
});