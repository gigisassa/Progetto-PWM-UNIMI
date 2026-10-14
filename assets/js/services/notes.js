/*
 * NoteManager: note private sulle ricette del ricettario.
 *
 * La nota è un campo della ricetta salvata nel ricettario dell'utente
 * (localStorage "ricettari" -> ricette[i].nota / notaUpdatedAt), quindi:
 *  - è visibile solo al proprietario del ricettario;
 *  - si può scrivere solo per ricette presenti nel proprio ricettario;
 *  - viene eliminata insieme alla ricetta o al profilo.
 *
 * Richiede assets/js/core/storage.js caricato prima.
 */
class NoteManager {
    static MAX_LENGTH = 1000;

    static findRecipe(ricette, recipeId) {
        return ricette.find(r => String(r.id) === String(recipeId)) || null;
    }

    static isInRicettario(recipeId) {
        return this.findRecipe(StorageManager.getRicettario(), recipeId) !== null;
    }

    // { testo, updatedAt } oppure null se la nota non c'è
    static getNote(recipeId) {
        const ricetta = this.findRecipe(StorageManager.getRicettario(), recipeId);
        if (!ricetta || !ricetta.nota) return null;
        return { testo: ricetta.nota, updatedAt: ricetta.notaUpdatedAt || ricetta.addedAt };
    }

    static saveNote(recipeId, testo) {
        if (!StorageManager.getUser()) throw new Error('Devi accedere per scrivere una nota');

        const nota = (testo || '').trim();
        if (!nota) throw new Error('La nota è vuota: per cancellarla usa "Elimina nota"');
        if (nota.length > this.MAX_LENGTH) {
            throw new Error(`La nota può contenere al massimo ${this.MAX_LENGTH} caratteri`);
        }

        const ricette = StorageManager.getRicettario();
        const ricetta = this.findRecipe(ricette, recipeId);
        if (!ricetta) throw new Error('Aggiungi prima la ricetta al tuo ricettario');

        ricetta.nota = nota;
        ricetta.notaUpdatedAt = new Date().toISOString();
        StorageManager.saveRicettario(ricette);
        return this.getNote(recipeId);
    }

    static deleteNote(recipeId) {
        if (!StorageManager.getUser()) throw new Error('Devi accedere per gestire le note');

        const ricette = StorageManager.getRicettario();
        const ricetta = this.findRecipe(ricette, recipeId);
        if (!ricetta || !ricetta.nota) throw new Error('Non c\'è nessuna nota da eliminare');

        ricetta.nota = '';
        delete ricetta.notaUpdatedAt;
        StorageManager.saveRicettario(ricette);
    }
}
