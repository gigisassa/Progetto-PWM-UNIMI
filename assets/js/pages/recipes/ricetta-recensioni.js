/*
 * Sezione recensioni della scheda ricetta.
 * Elenco pubblico per tutti; form visibile solo all'utente collegato,
 * precompilato se ha già recensito la ricetta (una recensione per utente).
 * Richiede assets/js/core/storage.js, assets/js/services/auth.js e assets/js/services/reviews.js.
 */
const reviewRecipeId = new URLSearchParams(window.location.search).get('id');

const reviewsList = document.getElementById('reviews-list');
const reviewForm = document.getElementById('review-form');
const reviewFormTitle = document.getElementById('review-form-title');
const reviewSubmit = document.getElementById('review-submit');
const reviewLoginHint = document.getElementById('review-login-hint');
const reviewMessage = document.getElementById('review-message');

function showReviewMessage(text, type = 'error') {
    reviewMessage.textContent = text;
    reviewMessage.className = `form-message ${type}`;
}

function renderReviewsList() {
    reviewsList.innerHTML =
        ReviewView.summaryHtml(reviewRecipeId) +
        ReviewView.listHtml(reviewRecipeId, { allowDelete: true });
}

// Ospite: invito al login. Utente: form, precompilato con la sua recensione se esiste
function renderReviewForm() {
    const loggedIn = AuthManager.isLoggedIn();

    reviewForm.hidden = !loggedIn;
    reviewLoginHint.hidden = loggedIn;
    if (!loggedIn) return;

    reviewForm['review-date'].max = todayISO();

    const myReview = ReviewManager.getUserReview(reviewRecipeId);

    if (myReview) {
        reviewForm['review-date'].value = myReview.dataPreparazione;
        reviewForm['difficulty-rating'].value = String(myReview.votoDifficolta);
        reviewForm['taste-rating'].value = String(myReview.votoGusto);
        reviewFormTitle.textContent = 'Modifica la tua recensione';
        reviewSubmit.textContent = 'Aggiorna recensione';
    } else {
        reviewForm.reset();
        reviewFormTitle.textContent = 'Inserisci una recensione';
        reviewSubmit.textContent = 'Pubblica recensione';
    }
}

function refreshReviews() {
    renderReviewsList();
    renderReviewForm();
}

reviewForm.addEventListener('submit', (event) => {
    event.preventDefault();

    try {
        const { updated } = ReviewManager.saveReview(reviewRecipeId, {
            dataPreparazione: reviewForm['review-date'].value,
            votoDifficolta: reviewForm['difficulty-rating'].value,
            votoGusto: reviewForm['taste-rating'].value
        });

        refreshReviews();
        showReviewMessage(updated ? 'Recensione aggiornata.' : 'Recensione pubblicata.', 'success');
    } catch (error) {
        showReviewMessage(error.message);
    }
});

reviewsList.addEventListener('click', (event) => {
    const button = event.target.closest('.btn-delete-review');
    if (!button) return;

    if (!window.confirm('Vuoi rimuovere la tua recensione?')) return;

    try {
        ReviewManager.removeReview(reviewRecipeId, button.dataset.reviewId);
        refreshReviews();
        showReviewMessage('Recensione rimossa.', 'success');
    } catch (error) {
        showReviewMessage(error.message);
    }
});

if (reviewRecipeId) {
    refreshReviews();
} else {
    reviewsList.innerHTML = '';
    reviewForm.hidden = true;
}
