
const searchFood = document.getElementById("searchFood");
const foodCategory = document.getElementById("foodCategory");
const foodList = document.getElementById("foodList");
const quantity = document.getElementById("quantity");
const mealType = document.getElementById("mealType");
const caloriesText = document.getElementById("calories");
const addFoodButton = document.getElementById("addFood");
const historyBox = document.getElementById("foodHistory");

const DAILY_GOAL = 2000;

let allFoods = [];
let today = getLocalDate();

// Get local date in YYYY-MM-DD format
function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Request helper
async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

// Load foods from backend
async function loadFoods() {
  allFoods = await apiRequest("/api/foods");
  displayFoods();
}

// Search and filter foods
function displayFoods() {
  const search = searchFood.value.toLowerCase().trim();
  const category = foodCategory.value;
  const previousId = foodList.value;

  const filteredFoods = allFoods.filter(food => {
    const matchesName = food.name.toLowerCase().includes(search);
    const matchesCategory =
      category === "All" || food.category === category;

    return matchesName && matchesCategory;
  });

  foodList.replaceChildren();

  for (const food of filteredFoods) {
    const option = document.createElement("option");
    option.value = food.id;
    option.textContent = food.name;
    foodList.appendChild(option);
  }

  if (filteredFoods.some(food => String(food.id) === previousId)) {
    foodList.value = previousId;
  }

  addFoodButton.disabled = filteredFoods.length === 0;
  calculateCalories();
}

// Calculate calories
function calculateCalories() {
  const selectedFood = allFoods.find(
    food => String(food.id) === foodList.value
  );

  const amount = Number(quantity.value);

  if (!selectedFood || !Number.isFinite(amount) || amount <= 0) {
    caloriesText.textContent = "0";
    return;
  }

  const total = selectedFood.calories * amount / 100;
  caloriesText.textContent = total.toFixed(1);
}

// Add food to the database
async function addFood() {
  const foodId = Number(foodList.value);
  const amount = Number(quantity.value);

  if (!foodId || !Number.isFinite(amount) ||
      amount <= 0 || amount > 100000) {
    alert("Please select food and enter a valid quantity.");
    return;
  }

  try {
    await apiRequest("/api/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        foodId: foodId,
        quantity: amount,
        meal: mealType.value,
        date: getLocalDate()
      })
    });

    await loadToday();
  } catch (error) {
    alert(error.message);
  }
}

// Load today's entries
async function loadToday() {
  today = getLocalDate();

  const entries = await apiRequest(
    `/api/entries?date=${today}`
  );

  historyBox.replaceChildren();

  let totalCalories = 0;

  if (entries.length === 0) {
    const message = document.createElement("p");
    message.textContent = "No food added today.";
    historyBox.appendChild(message);
  }

  for (const entry of entries) {
    totalCalories += entry.calories;

    const row = document.createElement("div");
    row.className = "food-entry";

    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = entry.name;

    const details = document.createElement("p");
    details.textContent =
      `${entry.quantity} ${entry.unit} • ${entry.meal} • ` +
      `${entry.calories.toFixed(1)} kcal`;

    info.append(name, details);

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", async () => {
      try {
        await apiRequest(`/api/entries/${entry.id}`, {
          method: "DELETE"
        });
        await loadToday();
      } catch (error) {
        alert(error.message);
      }
    });

    row.append(info, deleteButton);
    historyBox.appendChild(row);
  }

  document.getElementById("goal").textContent = DAILY_GOAL;
  document.getElementById("consumed").textContent =
    totalCalories.toFixed(1);

  document.getElementById("remaining").textContent =
    (DAILY_GOAL - totalCalories).toFixed(1);
}

// Clear today's food
async function clearToday() {
  if (!confirm("Delete all today's food entries?")) {
    return;
  }

  try {
    await apiRequest(
      `/api/entries?date=${getLocalDate()}`,
      { method: "DELETE" }
    );
    await loadToday();
  } catch (error) {
    alert(error.message);
  }
}

// Event listeners
searchFood.addEventListener("input", displayFoods);
foodCategory.addEventListener("change", displayFoods);
foodList.addEventListener("change", calculateCalories);
quantity.addEventListener("input", calculateCalories);

addFoodButton.addEventListener("click", addFood);

document.getElementById("clearDay")
  .addEventListener("click", clearToday);

// Check for a new day while the page stays open
setInterval(() => {
  if (getLocalDate() !== today) {
    loadToday().catch(console.error);
  }
}, 60000);

// Start application
async function startApp() {
  try {
    await loadFoods();
    await loadToday();
  } catch (error) {
    alert("Unable to connect to server: " + error.message);
  }
}

startApp();
