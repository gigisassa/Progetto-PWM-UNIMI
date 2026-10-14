/*
 * Nota privata nella scheda ricetta.
 * Ospite: invito al login. Utente senza la ricetta nel ricettario: invito ad aggiungerla.
 * Utente con la ricetta nel ricettario: inserimento, modifica e rimozione della nota.
 * Richiede assets/js/core/storage.js, assets/js/services/auth.js, assets/js/services/notes.js (e formatDateIT da assets/js/services/reviews.js).
 */
const noteRecipeId = new URLSearchParams(window.location.search).get('id');

const noteForm = document.getElementById('note-form');
const noteTextarea = document.getElementById('private-note');
const noteCounter = document.getElementById('note-counter');
const noteUpdated = document.getElementById('note-updated');
const noteDeleteButton = document.getElementById('note-delete');
const noteHintGuest = document.getElementById('note-hint-guest');
const noteHintAdd = document.getElementById('note-hint-add');
const noteMessage = document.getElementById('note-message');

function showNoteMessage(text, type = 'error') {
    noteMessage.textContent = text;
    noteMessage.className = `form-message ${type}`;
}

function updateNoteCounter() {
    noteCounter.textContent = `${noteTextarea.value.length}/${NoteManager.MAX_LENGTH}`;
}

function renderNote() {
    const loggedIn = AuthManager.isLoggedIn();
    const inRicettario = loggedIn && noteRecipeId && NoteManager.isInRicettario(noteRecipeId);

    noteHintGuest.hidden = loggedIn;
    noteHintAdd.hidden = !loggedIn || inRicettario;
    noteForm.hidden = !inRicettario;
    if (!inRicettario) return;

    const note = NoteManager.getNote(noteRecipeId);

    noteTextarea.value = note ? note.testo : '';
    noteDeleteButton.disabled = !note;
    noteUpdated.textContent = note
        ? `Ultima modifica: ${formatDateIT(note.updatedAt.slice(0, 10))}`
        : 'Nessuna nota salvata';
    updateNoteCounter();
}

noteTextarea.addEventListener('input', updateNoteCounter);

noteForm.addEventListener('submit', (event) => {
    event.preventDefault();

    try {
        const hadNote = NoteManager.getNote(noteRecipeId) !== null;
        NoteManager.saveNote(noteRecipeId, noteTextarea.value);
        renderNote();
        showNoteMessage(hadNote ? 'Nota aggiornata.' : 'Nota salvata.', 'success');
    } catch (error) {
        showNoteMessage(error.message);
    }
});

noteDeleteButton.addEventListener('click', () => {
    if (!window.confirm('Vuoi eliminare la tua nota privata?')) return;

    try {
        NoteManager.deleteNote(noteRecipeId);
        renderNote();
        showNoteMessage('Nota eliminata.', 'success');
    } catch (error) {
        showNoteMessage(error.message);
    }
});

// Aggiunta o rimozione della ricetta dal ricettario (assets/js/pages/recipes/ricetta.js)
document.addEventListener('ricettario:changed', () => {
    showNoteMessage('');
    renderNote();
});

renderNote();
