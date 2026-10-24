
const express = require("express");
const Database = require("better-sqlite3");
const foods = require("./foods");

const app = express();
const db = new Database("calories.db");

app.use(express.json());
app.use(express.static("public"));

// Create database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    calories REAL NOT NULL,
    unit TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    calories REAL NOT NULL,
    meal TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    FOREIGN KEY(food_id) REFERENCES foods(id)
  );
`);

// Add foods to the database
const insertFood = db.prepare(`
  INSERT OR IGNORE INTO foods
  (name, category, calories, unit)
  VALUES (?, ?, ?, ?)
`);

const seedFoods = db.transaction(() => {
  for (const food of foods) {
    insertFood.run(
      food.name,
      food.category,
      food.calories,
      food.unit
    );
  }
});

seedFoods();

// Get all foods
app.get("/api/foods", (req, res) => {
  const result = db.prepare(
    "SELECT * FROM foods ORDER BY name"
  ).all();

  res.json(result);
});

// Get entries for a date
app.get("/api/entries", (req, res) => {
  const date = req.query.date;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    return res.status(400).json({
      error: "Invalid date"
    });
  }

  const result = db.prepare(`
    SELECT entries.*, foods.name, foods.unit
    FROM entries
    JOIN foods ON entries.food_id = foods.id
    WHERE entry_date = ?
    ORDER BY entries.id DESC
  `).all(date);

  res.json(result);
});

// Add a food entry
app.post("/api/entries", (req, res) => {
  const { foodId, quantity, meal, date } = req.body;

  const allowedMeals = [
    "Breakfast", "Lunch", "Dinner", "Snacks"
  ];

  if (
    !Number.isInteger(foodId) ||
    typeof quantity !== "number" ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 100000 ||
    !allowedMeals.includes(meal) ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return res.status(400).json({
      error: "Invalid food entry"
    });
  }

  const food = db.prepare(
    "SELECT * FROM foods WHERE id = ?"
  ).get(foodId);

  if (!food) {
    return res.status(404).json({
      error: "Food not found"
    });
  }

  const totalCalories =
    Math.round((food.calories * quantity / 100) * 10) / 10;

  const result = db.prepare(`
    INSERT INTO entries
    (food_id, quantity, calories, meal, entry_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    foodId,
    quantity,
    totalCalories,
    meal,
    date
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    calories: totalCalories
  });
});

// Delete one entry
app.delete("/api/entries/:id", (req, res) => {
  const result = db.prepare(
    "DELETE FROM entries WHERE id = ?"
  ).run(req.params.id);

  res.json({ deleted: result.changes });
});

// Clear all entries for one date
app.delete("/api/entries", (req, res) => {
  const date = req.query.date;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    return res.status(400).json({
      error: "Invalid date"
    });
  }

  db.prepare(
    "DELETE FROM entries WHERE entry_date = ?"
  ).run(date);

  res.json({ message: "Entries cleared" });
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
