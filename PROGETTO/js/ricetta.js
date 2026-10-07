const recipeTitle = document.querySelector(".recipe-summary h2");
const recipeDescription = document.querySelector(".recipe-description");
const recipeImage = document.querySelector(".recipe-image-box img");
const recipeMeta = document.querySelector(".recipe-meta");
const ingredientsList = document.querySelector(".ingredients-list");
const stepsList = document.querySelector(".steps-list");

const BASE_URL = "https://www.themealdb.com/api/json/v1/1";
let ricettaCorrente = null;

function getRecipeIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

function renderRecipeMeta(meal) {
    recipeMeta.innerHTML = `
        <p><strong>Categoria:</strong> ${meal.strCategory || "Non specificata"}</p>
        <p><strong>Area:</strong> ${meal.strArea || meal.strCountry || "Non specificata"}</p>
        <p><strong>ID Ricetta:</strong> ${meal.idMeal}</p>
    `;
}

function renderIngredients(meal) {
    ingredientsList.innerHTML = "";

    for (let i = 1; i <= 20; i++) {
        const ingredient = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];

        if (ingredient && ingredient.trim() !== "") {
            const li = document.createElement("li");
            li.textContent = `${measure ? measure.trim() : ""} ${ingredient.trim()}`.trim();
            ingredientsList.appendChild(li);
        }
    }
}

function renderInstructions(meal) {
    stepsList.innerHTML = "";

    const instructions = meal.strInstructions
        ? meal.strInstructions
              .split(/\r\n|\n|\.\s+/)
              .map(step => step.trim())
              .filter(step => step.length > 0)
        : [];

    if (instructions.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Procedimento non disponibile.";
        stepsList.appendChild(li);
        return;
    }

    instructions.forEach(step => {
        const li = document.createElement("li");
        li.textContent = step.endsWith(".") ? step : `${step}.`;
        stepsList.appendChild(li);
    });
}

function renderRecipe(meal) {
    
    ricettaCorrente = {
        id: meal.idMeal,
        nome: meal.strMeal,
        categoria: meal.strCategory,
        area: meal.strArea || meal.strCountry,
        immagine: meal.strMealThumb
    };

    recipeTitle.textContent = meal.strMeal || "Ricetta non trovata";

    if (meal.strYoutube) {
        recipeDescription.href = meal.strYoutube;
        recipeDescription.textContent = "Guarda il video";
    } else {
        recipeDescription.removeAttribute("href");
        recipeDescription.textContent = "Video non disponibile";
    }

    recipeImage.src = meal.strMealThumb || "../images/not-found.jpg";
    recipeImage.alt = meal.strMeal || "Immagine ricetta";

    renderRecipeMeta(meal);
    renderIngredients(meal);
    renderInstructions(meal);
}

function showRecipeError(message) {
    recipeTitle.textContent = message;
    recipeDescription.textContent = "";
    recipeMeta.innerHTML = "";
    ingredientsList.innerHTML = "<li>Nessun ingrediente disponibile.</li>";
    stepsList.innerHTML = "<li>Nessun procedimento disponibile.</li>";
}

async function loadRecipe() {
    const recipeId = getRecipeIdFromUrl();

    if (!recipeId) {
        showRecipeError("ID ricetta non presente nella URL.");
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/lookup.php?i=${recipeId}`);
        const data = await response.json();

        if (!data.meals || data.meals.length === 0) {
            showRecipeError("Ricetta non trovata.");
            return;
        }

        const meal = data.meals[0];
        renderRecipe(meal);
    } catch (error) {
        console.error("Errore durante il caricamento della ricetta:", error);
        showRecipeError("Errore nel caricamento della ricetta.");
    }
}
const addButton = document.querySelector(".btn-primary");

addButton.addEventListener("click", () => {

    if (!ricettaCorrente) {
        alert("Ricetta non caricata.");
        return;
    }

    if (!AuthManager.isLoggedIn()) {
        alert("Accedi per aggiungere ricette al tuo ricettario.");
        window.location.href = "login.html";
        return;
    }

    let ricettario = StorageManager.getRicettario();

    const esiste = ricettario.some(
        ricetta => String(ricetta.id) === String(ricettaCorrente.id)
    );

    if (!esiste) {

        ricettario.push({
            ...ricettaCorrente,
            preferita: false,
            nota: "",
            addedAt: new Date().toISOString()
        });

        StorageManager.saveRicettario(ricettario);
        document.dispatchEvent(new CustomEvent("ricettario:changed"));

        alert("Ricetta aggiunta al ricettario");
    }
    else {
        alert("La ricetta è già presente");
    }
});

const removeButton = document.querySelector(".btn-secondary");

removeButton.addEventListener("click", () => {

    if (!ricettaCorrente) {
        alert("Ricetta non caricata.");
        return;
    }

    if (!AuthManager.isLoggedIn()) {
        alert("Accedi per gestire il tuo ricettario.");
        window.location.href = "login.html";
        return;
    }

    let ricettario = StorageManager.getRicettario();

    const presente = ricettario.some(
        ricetta => String(ricetta.id) === String(ricettaCorrente.id)
    );

    if (!presente) {
        alert("La ricetta non è presente nel tuo ricettario");
        return;
    }

    // La nota privata fa parte della ricetta salvata: rimuovendo la ricetta si perde anche lei
    if (NoteManager.getNote(ricettaCorrente.id) &&
        !confirm("Rimuovendo la ricetta verrà eliminata anche la tua nota privata. Continuare?")) {
        return;
    }

    ricettario = ricettario.filter(
        ricetta => String(ricetta.id) !== String(ricettaCorrente.id)
    );

    StorageManager.saveRicettario(ricettario);
    document.dispatchEvent(new CustomEvent("ricettario:changed"));

    alert("Ricetta rimossa dal ricettario");
});

document.addEventListener("DOMContentLoaded", loadRecipe);