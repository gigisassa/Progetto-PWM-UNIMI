/*
 * Recensioni delle ricette.
 *
 * TheMealDB non fornisce recensioni: sono dati propri di MyRicettario, salvati in
 * localStorage "reviews" e collegati alla ricetta tramite idMeal.
 *
 *   { [recipeId]: [ { id, recipeId, userId, dataPreparazione: "YYYY-MM-DD",
 *                     votoDifficolta: 1-5, votoGusto: 1-5, createdAt, updatedAt? } ] }
 *
 * - lettura pubblica (utenti e ospiti);
 * - scrittura solo per utenti collegati, una recensione per utente e ricetta (modificabile);
 * - il nome dell'autore non viene copiato ma letto da "users" in fase di visualizzazione,
 *   così resta corretto anche se l'utente cambia nome utente.
 *
 * Richiede assets/js/core/storage.js caricato prima.
 */
class ReviewManager {
    static VOTO_MIN = 1;
    static VOTO_MAX = 5;

    // Recensioni di una ricetta, dalla preparazione più recente
    static getRecipeReviews(recipeId) {
        const reviews = StorageManager.getReviews()[recipeId] || [];
        return [...reviews].sort((a, b) => b.dataPreparazione.localeCompare(a.dataPreparazione));
    }

    static getUserReview(recipeId, userId = StorageManager.getSessionUserId()) {
        if (!userId) return null;
        return this.getRecipeReviews(recipeId).find(r => String(r.userId) === String(userId)) || null;
    }

    static validate({ dataPreparazione, votoDifficolta, votoGusto }) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPreparazione || '')) {
            throw new Error('Inserisci la data di preparazione');
        }
        if (dataPreparazione > todayISO()) {
            throw new Error('La data di preparazione non può essere nel futuro');
        }

        [['difficoltà', votoDifficolta], ['gusto', votoGusto]].forEach(([nome, voto]) => {
            if (!Number.isInteger(voto) || voto < this.VOTO_MIN || voto > this.VOTO_MAX) {
                throw new Error(`Il voto ${nome} deve essere compreso tra ${this.VOTO_MIN} e ${this.VOTO_MAX}`);
            }
        });
    }

    // Inserisce la recensione dell'utente collegato o aggiorna quella esistente
    static saveReview(recipeId, data) {
        const user = StorageManager.getUser();
        if (!user) throw new Error('Devi accedere per pubblicare una recensione');

        const review = {
            dataPreparazione: data.dataPreparazione,
            votoDifficolta: parseInt(data.votoDifficolta, 10),
            votoGusto: parseInt(data.votoGusto, 10)
        };
        this.validate(review);

        const reviews = StorageManager.getReviews();
        const list = reviews[recipeId] || [];
        const index = list.findIndex(r => String(r.userId) === String(user.id));
        const updated = index !== -1;

        if (updated) {
            list[index] = { ...list[index], ...review, updatedAt: new Date().toISOString() };
        } else {
            list.push({
                id: String(Date.now()),
                recipeId: String(recipeId),
                userId: String(user.id),
                ...review,
                createdAt: new Date().toISOString()
            });
        }

        reviews[recipeId] = list;
        StorageManager.saveReviews(reviews);
        return { review: list[updated ? index : list.length - 1], updated };
    }

    // Un utente può rimuovere solo la propria recensione
    static removeReview(recipeId, reviewId) {
        const user = StorageManager.getUser();
        if (!user) throw new Error('Devi accedere per rimuovere una recensione');

        const reviews = StorageManager.getReviews();
        const list = reviews[recipeId] || [];
        const review = list.find(r => String(r.id) === String(reviewId));

        if (!review) throw new Error('Recensione non trovata');
        if (String(review.userId) !== String(user.id)) {
            throw new Error('Puoi rimuovere solo le tue recensioni');
        }

        reviews[recipeId] = list.filter(r => r !== review);
        if (reviews[recipeId].length === 0) delete reviews[recipeId];
        StorageManager.saveReviews(reviews);
    }

    static getAverageRatings(recipeId) {
        const reviews = this.getRecipeReviews(recipeId);
        if (reviews.length === 0) return { difficolta: 0, gusto: 0, count: 0 };

        const media = campo => Math.round(
            reviews.reduce((sum, r) => sum + r[campo], 0) / reviews.length * 10
        ) / 10;

        return {
            difficolta: media('votoDifficolta'),
            gusto: media('votoGusto'),
            count: reviews.length
        };
    }

    static getAuthorName(userId) {
        const user = StorageManager.getUserById(userId);
        return user ? user.username : 'Utente eliminato';
    }
}

/*
 * ReviewView: markup delle recensioni, condiviso tra card di ricerca e scheda ricetta.
 * I dati inseriti dagli utenti passano sempre da escapeHtml.
 */
class ReviewView {
    static rating(voto, simbolo, vuoto) {
        return simbolo.repeat(voto) + vuoto.repeat(ReviewManager.VOTO_MAX - voto);
    }

    static summaryHtml(recipeId) {
        const avg = ReviewManager.getAverageRatings(recipeId);

        if (avg.count === 0) {
            return '<p class="reviews-summary empty">Nessuna recensione ancora.</p>';
        }

        return `
            <p class="reviews-summary">
                <span>Gusto <strong>${avg.gusto}</strong>/5</span>
                <span>Difficoltà <strong>${avg.difficolta}</strong>/5</span>
                <span>${avg.count} ${avg.count === 1 ? 'recensione' : 'recensioni'}</span>
            </p>`;
    }

    // allowDelete: mostra "Rimuovi" sulla recensione dell'utente collegato
    static listHtml(recipeId, { allowDelete = false } = {}) {
        const reviews = ReviewManager.getRecipeReviews(recipeId);
        if (reviews.length === 0) return '';

        const currentUserId = StorageManager.getSessionUserId();

        const items = reviews.map(r => {
            const mine = currentUserId && String(r.userId) === String(currentUserId);

            return `
                <li class="review-item${mine ? ' mine' : ''}">
                    <p class="review-author">
                        ${escapeHtml(ReviewManager.getAuthorName(r.userId))}${mine ? ' <span class="review-badge">tu</span>' : ''}
                    </p>
                    <p class="review-date">Preparata il ${formatDateIT(r.dataPreparazione)}</p>
                    <p class="review-rating">
                        Gusto <span class="stars" aria-label="${r.votoGusto} su 5">${this.rating(r.votoGusto, '★', '☆')}</span>
                    </p>
                    <p class="review-rating">
                        Difficoltà <span class="dots" aria-label="${r.votoDifficolta} su 5">${this.rating(r.votoDifficolta, '●', '○')}</span>
                    </p>
                    ${mine && allowDelete
                        ? `<button type="button" class="btn-delete-review" data-review-id="${escapeHtml(r.id)}">Rimuovi recensione</button>`
                        : ''}
                </li>`;
        }).join('');

        return `<ul class="review-list">${items}</ul>`;
    }
}

// ---------- Utility ----------

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Data odierna locale in formato YYYY-MM-DD (toISOString userebbe l'ora UTC)
function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateIT(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}
