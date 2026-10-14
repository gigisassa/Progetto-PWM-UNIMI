/*
 * StorageManager: unico punto di accesso al web storage.
 *
 * Struttura dei dati (tutti in formato JSON):
 *  - localStorage "users"      -> [ { id, username, email, password, piattiPreferiti: [], registeredAt, updatedAt } ]
 *  - localStorage "ricettari"  -> { [userId]: { userId, createdAt, ricette: [ { id, nome, categoria, area, immagine, preferita, nota, addedAt } ] } }
 *  - localStorage "reviews"    -> { [recipeId]: [ { id, userId, ... } ] }
 *  - sessione "sessionUserId"  -> id dell'utente collegato
 *      in localStorage se l'utente ha scelto "Ricordami", altrimenti in sessionStorage
 *      (la sessione termina alla chiusura del browser).
 */
class StorageManager {
    static KEYS = {
        users: 'users',
        ricettari: 'ricettari',
        reviews: 'reviews',
        session: 'sessionUserId'
    };

    // ---------- Utility generiche ----------

    static read(key, fallback, storage = localStorage) {
        try {
            const value = storage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            console.error(`Errore lettura "${key}" dal web storage:`, error);
            return fallback;
        }
    }

    static write(key, value, storage = localStorage) {
        storage.setItem(key, JSON.stringify(value));
    }

    // ---------- Utenti ----------

    static getUsers() {
        return this.read(this.KEYS.users, []);
    }

    static saveUsers(users) {
        this.write(this.KEYS.users, users);
    }

    static getUserById(userId) {
        return this.getUsers().find(u => String(u.id) === String(userId)) || null;
    }

    // ---------- Sessione ----------

    static setSession(userId, remember = false) {
        this.clearSession();
        const storage = remember ? localStorage : sessionStorage;
        this.write(this.KEYS.session, String(userId), storage);
    }

    static getSessionUserId() {
        return this.read(this.KEYS.session, null, sessionStorage)
            || this.read(this.KEYS.session, null, localStorage);
    }

    static clearSession() {
        sessionStorage.removeItem(this.KEYS.session);
        localStorage.removeItem(this.KEYS.session);
    }

    // Restituisce l'utente collegato leggendolo sempre da "users",
    // così i dati sono aggiornati anche dopo una modifica del profilo.
    static getUser() {
        const userId = this.getSessionUserId();
        if (!userId) return null;

        const user = this.getUserById(userId);
        if (!user) this.clearSession(); // sessione orfana (utente cancellato)
        return user;
    }

    // ---------- Ricettari ----------

    static getRicettari() {
        return this.read(this.KEYS.ricettari, {});
    }

    static saveRicettari(ricettari) {
        this.write(this.KEYS.ricettari, ricettari);
    }

    static createRicettario(userId) {
        const ricettari = this.getRicettari();
        ricettari[userId] = {
            userId: String(userId),
            createdAt: new Date().toISOString(),
            ricette: []
        };
        this.saveRicettari(ricettari);
        return ricettari[userId];
    }

    // Ricette del ricettario dell'utente indicato (di default quello collegato)
    static getRicettario(userId = this.getSessionUserId()) {
        if (!userId) return [];
        const ricettario = this.getRicettari()[userId];
        return ricettario ? ricettario.ricette : [];
    }

    static saveRicettario(ricette, userId = this.getSessionUserId()) {
        if (!userId) throw new Error('Utente non autenticato');

        const ricettari = this.getRicettari();
        if (!ricettari[userId]) {
            ricettari[userId] = { userId: String(userId), createdAt: new Date().toISOString(), ricette: [] };
        }
        ricettari[userId].ricette = ricette;
        this.saveRicettari(ricettari);
    }

    static deleteRicettario(userId) {
        const ricettari = this.getRicettari();
        delete ricettari[userId];
        this.saveRicettari(ricettari);
    }

    // ---------- Recensioni ----------

    static getReviews() {
        return this.read(this.KEYS.reviews, {});
    }

    static saveReviews(reviews) {
        this.write(this.KEYS.reviews, reviews);
    }

    static countUserReviews(userId) {
        return Object.values(this.getReviews())
            .flat()
            .filter(r => String(r.userId) === String(userId))
            .length;
    }

    static deleteUserReviews(userId) {
        const reviews = this.getReviews();
        Object.keys(reviews).forEach(recipeId => {
            reviews[recipeId] = reviews[recipeId].filter(r => String(r.userId) !== String(userId));
            if (reviews[recipeId].length === 0) delete reviews[recipeId];
        });
        this.saveReviews(reviews);
    }
}
