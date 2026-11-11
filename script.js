const API_URL = "https://mhw-db.com/monsters";
const WIKI_API = "https://monsterhunter.fandom.com/api.php";

// HTML elements
const monsterContainer = document.getElementById("monster-container");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const loadingMessage = document.getElementById("loading");
const errorMessage = document.getElementById("error");
const noResultsMessage = document.getElementById("no-results");
const monsterCount = document.getElementById("monster-count");
const monsterModal = document.getElementById("monster-modal");
const modalBody = document.getElementById("modal-body");
const closeModalButton = document.getElementById("close-modal");

let allMonsters = [];

// Format text
function formatText(text) {
    if (!text) return "Unknown";

    return text
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// Load monster images from the Monster Hunter wiki (Fandom)
// The mhw-db API does not provide images, so we get them from here.
async function loadMonsterImages() {
    const names = allMonsters.map(monster => monster.name);

    // The wiki API allows up to 50 titles per request
    for (let i = 0; i < names.length; i += 50) {
        const batch = names.slice(i, i + 50);

        const params = new URLSearchParams({
            action: "query",
            titles: batch.join("|"),
            prop: "pageimages",
            piprop: "thumbnail",
            pithumbsize: "400",
            redirects: "1",
            format: "json",
            origin: "*"
        });

        try {
            const response = await fetch(`${WIKI_API}?${params}`);

            if (!response.ok) {
                throw new Error("Unable to load images.");
            }

            const data = await response.json();
            const query = data.query || {};

            // Map: final page title -> image URL
            const imageByTitle = {};

            Object.values(query.pages || {}).forEach(page => {
                if (page.thumbnail) {
                    imageByTitle[page.title] = page.thumbnail.source;
                }
            });

            // Follow title normalizations and redirects
            const titleMap = {};

            [...(query.normalized || []), ...(query.redirects || [])]
                .forEach(item => {
                    titleMap[item.from] = item.to;
                });

            batch.forEach(name => {
                let title = name;

                while (titleMap[title]) {
                    title = titleMap[title];
                }

                if (imageByTitle[title]) {
                    allMonsters
                        .filter(monster => monster.name === name)
                        .forEach(monster => {
                            monster.image = imageByTitle[title];
                        });
                }
            });

        } catch (error) {
            console.error("Error loading images:", error);
        }
    }
}

// Load monsters
async function getMonsters() {
    try {
        loadingMessage.style.display = "block";
        errorMessage.style.display = "none";
        noResultsMessage.style.display = "none";

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Unable to connect to the API.");
        }

        // The API returns an array directly
        allMonsters = await response.json();

        createCategoryOptions();
        displayMonsters(allMonsters);

        // Load images in the background, then refresh the list
        // keeping the current search and category filter
        loadMonsterImages().then(searchMonsters);

    } catch (error) {
        console.error("Error loading monsters:", error);

        errorMessage.textContent =
            "Something went wrong. Please try again later.";

        errorMessage.style.display = "block";

    } finally {
        loadingMessage.style.display = "none";
    }
}

// Create category options
function createCategoryOptions() {
    const categories = [
        ...new Set(allMonsters.map(monster => monster.species))
    ].filter(Boolean);

    categoryFilter.innerHTML =
        '<option value="all">All categories</option>';

    categories.sort().forEach(category => {
        const option = document.createElement("option");

        option.value = category;
        option.textContent = formatText(category);

        categoryFilter.appendChild(option);
    });
}

// Display monsters
function displayMonsters(monsters) {
    monsterContainer.innerHTML = "";

    monsterCount.textContent =
        `${monsters.length} monsters found`;

    noResultsMessage.style.display =
        monsters.length === 0 ? "block" : "none";

    monsters.forEach(monster => {
        const monsterCard = document.createElement("article");
        monsterCard.className = "monster-card";

        // Image container
        const imageContainer = document.createElement("div");
        imageContainer.className = "monster-image";

        // Image loaded from the wiki (or any other source added later)
        const imageUrl =
            monster.image ||
            monster.assets?.image ||
            monster.image_url;

        if (imageUrl) {
            const image = document.createElement("img");

            image.src = imageUrl;
            image.alt = monster.name;
            image.loading = "lazy";

            image.onerror = () => {
                imageContainer.innerHTML =
                    `<span>${monster.name.charAt(0)}</span>`;
            };

            imageContainer.appendChild(image);
        } else {
            const placeholder = document.createElement("span");
            placeholder.textContent = monster.name.charAt(0);

            imageContainer.appendChild(placeholder);
        }

        // Monster information
        const monsterInfo = document.createElement("div");
        monsterInfo.className = "monster-info";

        const title = document.createElement("h3");
        title.textContent = monster.name;

        const category = document.createElement("p");
        category.className = "monster-category";
        category.textContent = formatText(monster.species);

        const type = document.createElement("p");
        type.className = "monster-type";
        type.textContent = `${formatText(monster.type)} Monster`;

        const detailsButton = document.createElement("button");
        detailsButton.className = "details-button";
        detailsButton.textContent = "View details";

        detailsButton.addEventListener("click", () => {
            openMonsterDetails(monster);
        });

        monsterInfo.append(
            title,
            category,
            type,
            detailsButton
        );

        monsterCard.append(imageContainer, monsterInfo);
        monsterContainer.appendChild(monsterCard);
    });
}

// Search and filter monsters
function searchMonsters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedCategory = categoryFilter.value;

    const filteredMonsters = allMonsters.filter(monster => {
        const matchesName = monster.name
            .toLowerCase()
            .includes(searchTerm);

        const matchesCategory =
            selectedCategory === "all" ||
            monster.species === selectedCategory;

        return matchesName && matchesCategory;
    });

    displayMonsters(filteredMonsters);
}

// Open monster details
function openMonsterDetails(monster) {
    modalBody.innerHTML = "";

    // Monster image in the modal
    const imageUrl =
        monster.image ||
        monster.assets?.image ||
        monster.image_url;

    if (imageUrl) {
        const modalImage = document.createElement("img");

        modalImage.src = imageUrl;
        modalImage.alt = monster.name;
        modalImage.className = "modal-monster-image";

        // If the image fails, simply remove it
        modalImage.onerror = () => modalImage.remove();

        modalBody.appendChild(modalImage);
    }

    const title = document.createElement("h2");
    title.textContent = monster.name;

    const description = document.createElement("p");
    description.textContent =
        monster.description || "No description available.";

    const type = document.createElement("p");
    type.textContent = `Type: ${formatText(monster.type)}`;

    const species = document.createElement("p");
    species.textContent =
        `Species: ${formatText(monster.species)}`;

    const elements = document.createElement("p");
    elements.textContent =
        `Elements: ${monster.elements?.length
            ? monster.elements.map(formatText).join(", ")
            : "None"}`;

    const weaknesses = document.createElement("p");
    weaknesses.textContent =
        `Weaknesses: ${monster.weaknesses?.length
            ? monster.weaknesses.map(weakness =>
                `${formatText(weakness.element)} (${weakness.stars} stars)`
            ).join(", ")
            : "Unknown"}`;

    const locations = document.createElement("p");
    locations.textContent =
        `Locations: ${monster.locations?.length
            ? monster.locations.map(location => location.name).join(", ")
            : "Unknown"}`;

    modalBody.append(
        title,
        description,
        type,
        species,
        elements,
        weaknesses,
        locations
    );

    monsterModal.style.display = "flex";
}

// Close monster details
function closeMonsterDetails() {
    monsterModal.style.display = "none";
}

// Event listeners
searchInput.addEventListener("input", searchMonsters);

categoryFilter.addEventListener("change", searchMonsters);

closeModalButton.addEventListener(
    "click",
    closeMonsterDetails
);

monsterModal.addEventListener("click", event => {
    if (event.target === monsterModal) {
        closeMonsterDetails();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeMonsterDetails();
    }
});

// Start application
getMonsters();