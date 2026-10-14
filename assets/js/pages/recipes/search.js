const searchForm = document.getElementById("recipe-search-form");
const searchTypeSelect = document.getElementById("search-type");
const searchQueryInput = document.getElementById("search-query");
const resultsMessage = document.getElementById("results-message");
const searchResultsContainer = document.getElementById("search-results");

const BASE_URL = "https://www.themealdb.com/api/json/v1/1";



function saveToLocalStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getSearchEndpoint(type, query) {
    const trimmedQuery = query.trim();

    if (type === "name") {
        return `${BASE_URL}/search.php?s=${encodeURIComponent(trimmedQuery)}`;
    }

    if (type === "ingredient") {
        return `${BASE_URL}/filter.php?i=${encodeURIComponent(trimmedQuery)}`;
    }

    if (type === "letter") {
        return `${BASE_URL}/search.php?f=${encodeURIComponent(trimmedQuery.charAt(0))}`;
    }

    return null;
}

// ---------- Ricerca per testo descrittivo (sul catalogo nel web storage) ----------

// Minuscolo, senza accenti e con apostrofi uniformi: "Crème" -> "creme", "shepherd’s" -> "shepherd's"
function normalizeText(text) {
    return (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[‘’`]/g, "'");
}

// Parole da cercare: quelle di una sola lettera ("a", "e") vengono ignorate
function getSearchTerms(query) {
    return normalizeText(query).split(/\s+/).filter(term => term.length > 1);
}

/*
 * Parola esatta: prima e dopo non ci devono essere altre lettere o cifre.
 * Così "pan" non trova "Japanese", "egg" non trova "veggie", "baked" non trova "unbaked".
 * \p{L} = qualsiasi lettera Unicode, \p{N} = qualsiasi cifra (flag "u").
 * L'apostrofo del genitivo è facoltativo: "shepherd's" e "shepherds" si trovano a vicenda.
 */
function wordRegex(term) {
    const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const plain = term.replace(/'/g, "");
    const pattern = plain.length > 2 && plain.endsWith("s")
        ? `${escape(plain.slice(0, -1))}'?s`
        : escape(term);
    return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "u");
}

// Pezzo di procedimento attorno alla prima parola trovata, con la parola evidenziata
function buildSnippet(instructions, regex) {
    const text = (instructions || "").replace(/\s+/g, " ");
    const match = regex.exec(normalizeText(text));
    if (!match) return "";

    const index = match.index;
    const length = match[0].length;
    const start = Math.max(0, index - 60);
    const end = Math.min(text.length, index + length + 60);

    return (start > 0 ? "…" : "") +
        escapeHtml(text.slice(start, index)) +
        `<mark>${escapeHtml(text.slice(index, index + length))}</mark>` +
        escapeHtml(text.slice(index + length, end)) +
        (end < text.length ? "…" : "");
}

/*
 * Tutte le parole cercate devono comparire, come parole intere, nella ricetta
 * (nome, procedimento, tag, categoria, area o ingredienti). Le ricette sono ordinate
 * per rilevanza: una parola nel nome pesa più di una nel procedimento.
 */
function searchByText(meals, query) {
    const regexes = getSearchTerms(query).map(wordRegex);
    const WEIGHTS = { name: 10, tags: 4, info: 3, ingredients: 3, instructions: 1 };

    if (regexes.length === 0) return [];

    return meals
        .map(meal => {
            const fields = {
                name: normalizeText(meal.strMeal),
                tags: normalizeText(meal.strTags),
                info: normalizeText(`${meal.strCategory} ${meal.strArea}`),
                ingredients: normalizeText((meal.ingredients || []).join(" ")),
                instructions: normalizeText(meal.strInstructions)
            };

            let score = 0;
            for (const regex of regexes) {
                const found = Object.keys(fields).filter(f => regex.test(fields[f]));
                if (found.length === 0) return null; // manca una parola: esclusa
                score += found.reduce((sum, f) => sum + WEIGHTS[f], 0);
            }

            const snippetRegex = regexes.find(r => r.test(fields.instructions));

            // Nei risultati salvati solo i campi della card, non tutto il procedimento
            return {
                score,
                meal: {
                    idMeal: meal.idMeal,
                    strMeal: meal.strMeal,
                    strCategory: meal.strCategory,
                    strArea: meal.strArea,
                    strMealThumb: meal.strMealThumb,
                    matchSnippet: snippetRegex ? buildSnippet(meal.strInstructions, snippetRegex) : ""
                }
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || a.meal.strMeal.localeCompare(b.meal.strMeal))
        .map(result => result.meal);
}

function createRecipeCard(meal) {
    const recipeId = meal.idMeal;
    const recipeName = meal.strMeal || "Nome non disponibile";
    const recipeImage = meal.strMealThumb || "../../../assets/images/placeholders/not-found.jpg";
    const recipeCategory = meal.strCategory || "Non specificata";
    const recipeArea = meal.strArea || meal.strCountry || "Non specificata";

    return `
        <article class="recipe-card">
            <a href="../ricetta/?id=${recipeId}" class="recipe-card-image" title="Apri la scheda di ${recipeName}"><img src="${recipeImage}" alt="Immagine di ${recipeName}"></a>
            <div class="recipe-card-content">
                <h4><a href="../ricetta/?id=${recipeId}" class="recipe-card-title">${recipeName}</a></h4>
                <p>Categoria: ${recipeCategory}</p>
                <p>Area: ${recipeArea}</p>
                ${meal.matchSnippet ? `<p class="match-snippet">${meal.matchSnippet}</p>` : ""}
                <a href="../ricetta/?id=${recipeId}" class="details-link">Vedi dettagli</a>

                <section class="card-reviews" aria-label="Recensioni di ${recipeName}">
                    <h5>Recensioni</h5>
                    ${ReviewView.summaryHtml(recipeId)}
                    ${ReviewView.listHtml(recipeId)}
                    <a href="../ricetta/?id=${recipeId}#recensioni" class="review-link">
                        ${ReviewManager.getUserReview(recipeId) ? 'Modifica la tua recensione' : 'Scrivi una recensione'}
                    </a>
                </section>
            </div>
        </article>
    `;
}

async function enrichMealsIfNeeded(meals, type) {
    if (type !== "ingredient") {
        return meals;
    }

    const detailedMeals = await Promise.all(
        meals.slice(0, 12).map(async (meal) => {
            try {
                const response = await fetch(`${BASE_URL}/lookup.php?i=${meal.idMeal}`);
                const data = await response.json();
                return data.meals ? data.meals[0] : meal;
            } catch (error) {
                console.error("Errore nel recupero dettagli ricetta:", error);
                return meal;
            }
        })
    );

    return detailedMeals;
}

// Risultati attualmente mostrati (servono per ridisegnare le card al ritorno sulla pagina)
let currentMeals = [];

function renderRecipes(meals) {
    currentMeals = meals;
    searchResultsContainer.innerHTML = meals.map(createRecipeCard).join("");
}

// Salva la ricerca nell'URL della voce corrente della cronologia (senza crearne una nuova):
// tornando indietro con le frecce del browser la pagina si riapre con questi parametri,
// mentre il link "Ricerca" del menu apre ricerca/ senza parametri, quindi vuota.
function rememberSearchInHistory(searchType, searchQuery) {
    const params = new URLSearchParams({ "search-type": searchType, "search-query": searchQuery });
    history.replaceState(null, "", `?${params}`);
}

function showNoResultsMessage() {
    resultsMessage.textContent = "Nessuna ricetta trovata per la ricerca effettuata.";
    searchResultsContainer.innerHTML = "";
}

function handleSearch(event) {
    event.preventDefault();
    runSearch(searchTypeSelect.value, searchQueryInput.value.trim());
}

// Lettere (anche accentate), spazi, apostrofi e trattini, con almeno una lettera:
// es. "pollo al curry", "shepherd's pie"; rifiuta "   ", "123", "pasta!"
const VALID_QUERY = /^[A-Za-zÀ-ÿ' \-]*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' \-]*$/;

async function runSearch(searchType, searchQuery) {

    if (!searchQuery) {
        resultsMessage.textContent = "Inserisci un valore di ricerca.";
        searchResultsContainer.innerHTML = "";
        return;
    }

    if (!VALID_QUERY.test(searchQuery)) {
        resultsMessage.textContent = "La ricerca può contenere solo lettere, spazi, apostrofi o trattini.";
        searchResultsContainer.innerHTML = "";
        alert("Caratteri non consentiti: niente numeri o simboli nella ricerca.");
        return;
    }

    if (searchType === "letter" && searchQuery.length !== 1) {
        resultsMessage.textContent = "Per la ricerca per lettera iniziale devi inserire una sola lettera.";
        searchResultsContainer.innerHTML = "";
        return;
    }

    if (searchType === "text") {
        runTextSearch(searchQuery);
        return;
    }

    const endpoint = getSearchEndpoint(searchType, searchQuery);

    if (!endpoint) {
        resultsMessage.textContent = "Tipo di ricerca non valido.";
        searchResultsContainer.innerHTML = "";
        return;
    }

    resultsMessage.textContent = "Ricerca in corso...";
    searchResultsContainer.innerHTML = "";
    currentMeals = [];
    rememberSearchInHistory(searchType, searchQuery);

    try {
        const response = await fetch(endpoint);
        const data = await response.json();

        if (!data.meals) {
            showNoResultsMessage();
            return;
        }

        const meals = await enrichMealsIfNeeded(data.meals, searchType);

        resultsMessage.textContent = `Trovate ${meals.length} ricette.`;
        renderRecipes(meals);

        saveToLocalStorage("lastSearchResults", meals);
        saveToLocalStorage("lastSearchType", searchType);
        saveToLocalStorage("lastSearchQuery", searchQuery);
    } catch (error) {
        console.error("Errore durante la ricerca:", error);
        resultsMessage.textContent = "Si è verificato un errore durante la ricerca delle ricette.";
        searchResultsContainer.innerHTML = "";
    }
}

async function runTextSearch(searchQuery) {
    searchResultsContainer.innerHTML = "";
    currentMeals = [];

    if (getSearchTerms(searchQuery).length === 0) {
        resultsMessage.textContent = "Per la ricerca per testo inserisci almeno una parola di due o più lettere.";
        return;
    }

    rememberSearchInHistory("text", searchQuery);

    // Al primo avvio il catalogo potrebbe essere ancora in download
    resultsMessage.textContent = CatalogManager.isFresh(CatalogManager.getCached())
        ? "Ricerca in corso..."
        : "Download del catalogo delle ricette in corso...";

    try {
        const meals = searchByText(await CatalogManager.load(), searchQuery);

        if (meals.length === 0) {
            showNoResultsMessage();
            return;
        }

        resultsMessage.textContent = `Trovate ${meals.length} ricette.`;
        renderRecipes(meals);

        saveToLocalStorage("lastSearchResults", meals);
        saveToLocalStorage("lastSearchType", "text");
        saveToLocalStorage("lastSearchQuery", searchQuery);
    } catch (error) {
        console.error("Errore durante la ricerca per testo:", error);
        resultsMessage.textContent = "Impossibile caricare il catalogo delle ricette. Riprova più tardi.";
    }
}

// Ricerca indicata nell'URL (ricerca/?search-type=...&search-query=...):
// arriva dalla Home oppure dal ritorno indietro da una scheda ricetta
function loadSearchFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const query = (params.get("search-query") || "").trim();

    if (!query) {
        return false;
    }

    const type = params.get("search-type") || "name";
    if (searchTypeSelect.querySelector(`option[value="${type}"]`)) {
        searchTypeSelect.value = type;
    }
    searchQueryInput.value = query;

    // Se è la stessa ricerca già salvata nel web storage, i risultati si mostrano subito
    // senza richiamare l'API (e il browser può ripristinare la posizione di scorrimento)
    const savedType = JSON.parse(localStorage.getItem("lastSearchType") || "null");
    const savedQuery = JSON.parse(localStorage.getItem("lastSearchQuery") || "null");
    const savedResults = JSON.parse(localStorage.getItem("lastSearchResults") || "[]");

    if (savedType === searchTypeSelect.value && savedQuery === query && savedResults.length > 0) {
        resultsMessage.textContent = `Trovate ${savedResults.length} ricette.`;
        renderRecipes(savedResults);
    } else {
        runSearch(searchTypeSelect.value, query);
    }
    return true;
}

searchForm.addEventListener("submit", handleSearch);
document.addEventListener("DOMContentLoaded", loadSearchFromUrl);

// Pagina ripristinata dalla cache del browser (back/forward cache): il contenuto è già quello
// lasciato, ma le recensioni potrebbero essere cambiate nella scheda ricetta, quindi ridisegno le card
window.addEventListener("pageshow", (event) => {
    if (event.persisted && currentMeals.length > 0) {
        renderRecipes(currentMeals);
    }
});