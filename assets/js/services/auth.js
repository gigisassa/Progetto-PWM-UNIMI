/*
 * AuthManager: registrazione, login/logout e gestione del profilo utente.
 * Richiede assets/js/core/storage.js caricato prima.
 */
class AuthManager {
    static MIN_PASSWORD_LENGTH = 6;

    static normalizeEmail(email) {
        return (email || '').trim().toLowerCase();
    }

    // "Carbonara, pizza ,  sushi" -> ["Carbonara", "pizza", "sushi"] (senza duplicati)
    static parsePiattiPreferiti(text) {
        const piatti = (text || '')
            .split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0);

        return piatti.filter((p, i) =>
            piatti.findIndex(x => x.toLowerCase() === p.toLowerCase()) === i
        );
    }

    // Separatori diversi dalla virgola (; / | \ + & o a capo): l'utente non ha seguito le istruzioni
    static validatePiattiPreferiti(text) {
        if (/[;\/|\\+&\n\r]/.test(text || '')) {
            throw new Error('I piatti preferiti devono essere separati da una virgola (es. "Carbonara, Pizza, Sushi")');
        }
    }

    static validatePassword(password) {
        if (!password || password.length < this.MIN_PASSWORD_LENGTH) {
            throw new Error(`La password deve contenere almeno ${this.MIN_PASSWORD_LENGTH} caratteri`);
        }
    }

    static validateUserData(users, { username, email }, excludeUserId = null) {
        if (!username) throw new Error('Il nome utente è obbligatorio');
        if (!email) throw new Error("L'indirizzo email è obbligatorio");

        const others = users.filter(u => String(u.id) !== String(excludeUserId));

        if (others.some(u => u.email === email)) {
            throw new Error('Email già registrata');
        }
        if (others.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            throw new Error('Nome utente già in uso');
        }
    }

    static register({ username, email, password, piattiPreferiti }) {
        const users = StorageManager.getUsers();
        const data = {
            username: (username || '').trim(),
            email: this.normalizeEmail(email)
        };

        this.validateUserData(users, data);
        this.validatePassword(password);
        if (!Array.isArray(piattiPreferiti)) this.validatePiattiPreferiti(piattiPreferiti);

        const newUser = {
            id: String(Date.now()),
            username: data.username,
            email: data.email,
            password: password,
            piattiPreferiti: Array.isArray(piattiPreferiti)
                ? piattiPreferiti
                : this.parsePiattiPreferiti(piattiPreferiti),
            registeredAt: new Date().toISOString()
        };

        users.push(newUser);
        StorageManager.saveUsers(users);

        // Ogni nuovo utente parte con un ricettario personale vuoto
        StorageManager.createRicettario(newUser.id);

        return newUser;
    }

    static login(email, password, remember = false) {
        const user = StorageManager.getUsers().find(
            u => u.email === this.normalizeEmail(email) && u.password === password
        );

        if (!user) {
            throw new Error('Credenziali non valide');
        }

        // Utenti creati prima dell'introduzione dei ricettari separati
        if (!StorageManager.getRicettari()[user.id]) {
            StorageManager.createRicettario(user.id);
        }

        StorageManager.setSession(user.id, remember);
        return user;
    }

    static logout() {
        StorageManager.clearSession();
    }

    static isLoggedIn() {
        return StorageManager.getUser() !== null;
    }

    // Da usare nelle pagine riservate: se l'utente non è collegato lo manda al login
    static requireAuth(loginPage = '../../auth/login/') {
        const user = StorageManager.getUser();
        if (!user) {
            window.location.href = loginPage;
            return null;
        }
        return user;
    }

    static updateProfile({ username, email, piattiPreferiti }) {
        const currentUser = StorageManager.getUser();
        if (!currentUser) throw new Error('Utente non autenticato');

        const users = StorageManager.getUsers();
        const index = users.findIndex(u => u.id === currentUser.id);
        const data = {
            username: (username || '').trim(),
            email: this.normalizeEmail(email)
        };

        this.validateUserData(users, data, currentUser.id);
        this.validatePiattiPreferiti(piattiPreferiti);

        users[index] = {
            ...users[index],
            username: data.username,
            email: data.email,
            piattiPreferiti: this.parsePiattiPreferiti(piattiPreferiti),
            updatedAt: new Date().toISOString()
        };

        StorageManager.saveUsers(users);
        return users[index];
    }

    static changePassword(currentPassword, newPassword) {
        const currentUser = StorageManager.getUser();
        if (!currentUser) throw new Error('Utente non autenticato');

        if (currentUser.password !== currentPassword) {
            throw new Error('La password attuale non è corretta');
        }
        if (currentPassword === newPassword) {
            throw new Error('La nuova password deve essere diversa da quella attuale');
        }
        this.validatePassword(newPassword);

        const users = StorageManager.getUsers();
        const index = users.findIndex(u => u.id === currentUser.id);
        users[index].password = newPassword;
        users[index].updatedAt = new Date().toISOString();
        StorageManager.saveUsers(users);
    }

    // Cancella l'utente e tutti i dati collegati: ricettario (con note) e recensioni
    static deleteProfile(password) {
        const currentUser = StorageManager.getUser();
        if (!currentUser) throw new Error('Utente non autenticato');

        if (currentUser.password !== password) {
            throw new Error('Password non corretta');
        }

        const users = StorageManager.getUsers().filter(u => u.id !== currentUser.id);
        StorageManager.saveUsers(users);
        StorageManager.deleteRicettario(currentUser.id);
        StorageManager.deleteUserReviews(currentUser.id);
        StorageManager.clearSession();
    }
}
