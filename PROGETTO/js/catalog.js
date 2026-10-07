/*
 * CatalogManager: catalogo completo delle ricette di TheMealDB nel web storage.
 *
 * TheMealDB non offre una ricerca nel testo delle ricette (search.php?s= cerca solo nel nome),
 * quindi all'avvio dell'applicazione il catalogo viene scaricato con le 26 chiamate
 * search.php?f=a ... search.php?f=z e salvato in localStorage "mealsCatalog":
 *
 *   { updatedAt: "ISO date", meals: [ { idMeal, strMeal, strCategory, strArea, strMealThumb,
 *                                      strTags, strInstructions, ingredients: ["2 cups Rice", ...] } ] }
 *
 * Le ricette sono salvate in forma compatta (solo i campi utili, ingredienti in un array)
 * per restare nel limite di spazio del localStorage. Il catalogo viene riscaricato dopo 24 ore.
 */
class CatalogManager {
    static KEY = 'mealsCatalog';
    static MAX_AGE_MS = 24 * 60 * 60 * 1000;
    static BASE_URL = 'https://www.themealdb.com/api/json/v1/1';
    static LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

    static loading = null; // download in corso, condiviso tra chi chiama load()
    static memoryCopy = null; // usato se il localStorage è pieno

    static compact(meal) {
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            const ingredient = (meal[`strIngredient${i}`] || '').trim();
            const measure = (meal[`strMeasure${i}`] || '').trim();
            if (ingredient) ingredients.push(`${measure} ${ingredient}`.trim());
        }

        return {
            idMeal: meal.idMeal,
            strMeal: meal.strMeal,
            strCategory: meal.strCategory,
            strArea: meal.strArea || meal.strCountry, // per alcune ricette l'API valorizza solo strCountry
            strMealThumb: meal.strMealThumb,
            strTags: meal.strTags,
            strInstructions: meal.strInstructions,
            ingredients
        };
    }

    static getCached() {
        if (this.memoryCopy) return this.memoryCopy;
        try {
            return JSON.parse(localStorage.getItem(this.KEY) || 'null');
        } catch (error) {
            return null;
        }
    }

    static isFresh(catalog) {
        return Boolean(catalog && catalog.meals && catalog.meals.length > 0 &&
            Date.now() - new Date(catalog.updatedAt).getTime() < this.MAX_AGE_MS);
    }

    static async download() {
        const results = await Promise.all(this.LETTERS.map(async letter => {
            try {
                const response = await fetch(`${this.BASE_URL}/search.php?f=${letter}`);
                const data = await response.json();
                return data.meals || [];
            } catch (error) {
                console.error(`Errore download ricette con iniziale "${letter}":`, error);
                return null;
            }
        }));

        if (results.every(r => r === null)) {
            throw new Error('Impossibile scaricare il catalogo delle ricette');
        }

        const catalog = {
            updatedAt: new Date().toISOString(),
            meals: results.flat().filter(Boolean).map(m => this.compact(m))
        };

        try {
            localStorage.setItem(this.KEY, JSON.stringify(catalog));
            this.memoryCopy = null;
        } catch (error) {
            // Spazio esaurito: il catalogo resta disponibile per questa pagina
            console.warn('Catalogo non salvato nel web storage (spazio insufficiente):', error);
            this.memoryCopy = catalog;
        }

        return catalog;
    }

    // Restituisce le ricette del catalogo, scaricandolo solo se manca o è vecchio
    static async load() {
        const cached = this.getCached();
        if (this.isFresh(cached)) return cached.meals;

        if (!this.loading) {
            this.loading = this.download()
                .catch(error => {
                    // Rete non disponibile: meglio un catalogo vecchio che nessuno
                    if (cached && cached.meals) return cached;
                    throw error;
                })
                .finally(() => { this.loading = null; });
        }

        return (await this.loading).meals;
    }
}

// Avvio dell'applicazione: il catalogo viene preparato subito in background
CatalogManager.load().catch(error => console.error(error));
