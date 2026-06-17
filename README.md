# 🍽️ La Mesa — Smart Restaurant Ordering System
## Complete Setup Guide for XAMPP

---

## 📁 FOLDER STRUCTURE
```
htdocs/
└── restaurant/
    ├── index.html          ← Main frontend app
    ├── database.sql        ← Database schema + seed data
    ├── css/
    │   └── style.css
    ├── js/
    │   └── app.js
    ├── php/
    │   └── api.php         ← REST API backend
    └── includes/
        └── config.php      ← DB config & helpers
```

---

## ⚙️ INSTALLATION STEPS

### Step 1 — Install XAMPP
Download and install XAMPP from: https://www.apachefriends.org
Start **Apache** and **MySQL** from the XAMPP Control Panel.

### Step 2 — Copy Project Files
Copy the entire `restaurant/` folder into:
```
C:\xampp\htdocs\restaurant\     (Windows)
/Applications/XAMPP/htdocs/restaurant/  (Mac)
/opt/lampp/htdocs/restaurant/   (Linux)
```

### Step 3 — Create the Database
1. Open your browser and go to: **http://localhost/phpmyadmin**
2. Click **"New"** to create a new database (or use the Import tab)
3. Click the **Import** tab
4. Click **"Choose File"** and select `database.sql`
5. Click **"Go"** — the database and all tables will be created automatically

### Step 4 — Configure Database (if needed)
Open `includes/config.php` and verify:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');          // Your MySQL password if set
define('DB_NAME', 'smart_restaurant');
```

### Step 5 — Access the System
Open your browser and go to:
**http://localhost/restaurant/**

---

## 🗂️ DATABASE TABLES

| Table | Purpose |
|-------|---------|
| `menu_categories` | Organizes menu into categories |
| `menu_items` | All food/beverage items with prices & availability |
| `restaurant_tables` | Physical table tracking with status |
| `customers` | Customer profiles, loyalty points, history |
| `orders` | Order records with totals, taxes, discounts |
| `order_items` | Individual items per order |
| `payments` | Payment records per order |
| `receipts` | Generated receipt data |
| `feedback` | Customer ratings and comments |
| `staff` | Staff accounts with roles |

---

## 🔑 DEFAULT CREDENTIALS
*(for staff table — password: "password")*

| Username | Role |
|----------|------|
| admin | Administrator |
| waiter1 | Waiter |
| kitchen1 | Kitchen |
| cashier1 | Cashier |

---

## 🧩 SYSTEM MODULES

### 1. Dashboard
- Today's revenue, order count, active orders
- Available tables, average customer rating
- Recent orders table
- Top-selling items chart

### 2. New Order (POS)
- Browse menu by category or search
- Select table (dine-in) or walk-in info
- Attach existing customer for loyalty tracking
- Cart with quantity controls
- Apply discounts + service charge
- Auto-calculates 12% VAT
- Place order → updates table status

### 3. Order Management
- Filter by status: confirmed / preparing / ready / served / cancelled
- View full order details
- Progress orders through workflow
- Process payment (cash, card, GCash, Maya)
- Auto-generate and print receipt

### 4. Kitchen Display System
- Shows confirmed + preparing orders in real-time
- Color-coded urgency (10min = orange, 20min = red)
- One-click: Start Cooking → Mark Ready
- Auto-refreshes every 15 seconds

### 5. Table Management
- Visual floor layout with color-coded status
- Click to free or reserve tables
- Live order number overlay

### 6. Menu Management
- Add / edit / delete menu items
- Enable or disable availability
- Filter by category, search by name
- Manage preparation times and stock

### 7. Customer Information System
- Add and edit customer profiles
- Track loyalty points, total visits, total spent
- Store dietary preferences / notes
- Search by name, email, or phone

### 8. Feedback System
- Multi-category star ratings (Overall, Food, Service, Ambiance)
- Comment recording
- Link feedback to orders or customers
- View all historical reviews

---

## 💡 BUSINESS RULES
- **VAT**: 12% applied on (subtotal - discount)
- **Service Charge**: Optional 10% 
- **Loyalty Points**: 1 point per ₱100 spent
- **Receipt**: Auto-generated with BIR-style formatting

---

## 🚀 API ENDPOINTS
All endpoints are in `php/api.php?action=<action_name>`

**Menu:** `get_menu`, `add_menu_item`, `update_menu_item`, `delete_menu_item`, `update_item_availability`  
**Orders:** `create_order`, `get_orders`, `get_order_detail`, `update_order_status`, `cancel_order`  
**Payment:** `process_payment`, `get_receipt`  
**Tables:** `get_tables`, `update_table_status`  
**Customers:** `get_customers`, `add_customer`, `update_customer`  
**Feedback:** `submit_feedback`, `get_feedback`  
**Reports:** `get_dashboard`  
