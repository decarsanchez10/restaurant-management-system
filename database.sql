-- Smart Restaurant Ordering System Database
-- Run this in phpMyAdmin or MySQL CLI

CREATE DATABASE IF NOT EXISTS smart_restaurant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_restaurant;

-- =============================================
-- MENU MANAGEMENT
-- =============================================
CREATE TABLE IF NOT EXISTS menu_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT '🍽️',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(255),
    is_available TINYINT(1) DEFAULT 1,
    stock_quantity INT DEFAULT 100,
    preparation_time INT DEFAULT 15 COMMENT 'in minutes',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
);

-- =============================================
-- TABLE MANAGEMENT
-- =============================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_number VARCHAR(10) NOT NULL UNIQUE,
    capacity INT DEFAULT 4,
    status ENUM('available','occupied','reserved','cleaning') DEFAULT 'available',
    current_order_id INT DEFAULT NULL
);

-- =============================================
-- CUSTOMER MANAGEMENT
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(20),
    loyalty_points INT DEFAULT 0,
    total_visits INT DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0.00,
    preferences TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- ORDER MANAGEMENT
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(20) NOT NULL UNIQUE,
    table_id INT,
    customer_id INT,
    customer_name VARCHAR(150),
    status ENUM('pending','confirmed','preparing','ready','served','cancelled') DEFAULT 'pending',
    order_type ENUM('dine-in','takeout','delivery') DEFAULT 'dine-in',
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    service_charge DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    special_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    menu_item_id INT NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    item_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(10,2) NOT NULL,
    special_instructions TEXT,
    status ENUM('pending','preparing','ready','served') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- =============================================
-- BILLING & PAYMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    payment_method ENUM('cash','card','gcash','maya','online') DEFAULT 'cash',
    amount_paid DECIMAL(10,2) NOT NULL,
    change_given DECIMAL(10,2) DEFAULT 0.00,
    payment_status ENUM('pending','completed','refunded','failed') DEFAULT 'pending',
    transaction_ref VARCHAR(100),
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- =============================================
-- RECEIPTS
-- =============================================
CREATE TABLE IF NOT EXISTS receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    payment_id INT NOT NULL,
    receipt_number VARCHAR(30) NOT NULL UNIQUE,
    receipt_data JSON,
    printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

-- =============================================
-- FEEDBACK SYSTEM
-- =============================================
CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    customer_id INT,
    customer_name VARCHAR(150),
    rating INT CHECK (rating BETWEEN 1 AND 5),
    food_rating INT CHECK (food_rating BETWEEN 1 AND 5),
    service_rating INT CHECK (service_rating BETWEEN 1 AND 5),
    ambiance_rating INT CHECK (ambiance_rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- =============================================
-- STAFF MANAGEMENT
-- =============================================
CREATE TABLE IF NOT EXISTS staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','manager','waiter','kitchen','cashier') DEFAULT 'waiter',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- SEED DATA
-- =============================================

-- Categories
INSERT INTO menu_categories (name, icon, sort_order) VALUES
('Appetizers', '🥗', 1),
('Main Course', '🍖', 2),
('Pasta & Rice', '🍝', 3),
('Seafood', '🦐', 4),
('Desserts', '🍰', 5),
('Beverages', '🥤', 6);

-- Menu Items
INSERT INTO menu_items (category_id, name, description, price, is_available, preparation_time) VALUES
(1, 'Caesar Salad', 'Romaine lettuce, croutons, parmesan, caesar dressing', 185.00, 1, 10),
(1, 'Calamari Rings', 'Crispy fried squid rings with marinara sauce', 220.00, 1, 12),
(1, 'Spring Rolls', 'Crispy vegetable spring rolls with sweet chili dip', 160.00, 1, 10),
(1, 'Chicken Wings', 'Buffalo-glazed wings with blue cheese dip', 280.00, 1, 20),
(2, 'Grilled Chicken', 'Herb-marinated grilled chicken with seasonal veg', 350.00, 1, 25),
(2, 'Beef Steak', '200g sirloin steak cooked to your preference', 580.00, 1, 30),
(2, 'Pork Ribs', 'Slow-braised ribs with BBQ glaze and coleslaw', 520.00, 1, 35),
(2, 'Chicken Inasal', 'Classic Filipino grilled chicken with garlic rice', 320.00, 1, 25),
(3, 'Spaghetti Carbonara', 'Creamy bacon and egg pasta with pecorino', 295.00, 1, 20),
(3, 'Seafood Paella', 'Saffron rice with mixed seafood', 480.00, 1, 35),
(3, 'Pasta Bolognese', 'Slow-cooked beef ragu with pappardelle', 310.00, 1, 20),
(3, 'Garlic Fried Rice', 'Fragrant garlic rice with egg', 95.00, 1, 10),
(4, 'Grilled Salmon', 'Atlantic salmon with lemon butter and asparagus', 620.00, 1, 25),
(4, 'Shrimp Scampi', 'Garlic butter shrimp over linguine', 450.00, 1, 20),
(4, 'Fish and Chips', 'Beer-battered fish with crispy fries and tartar', 380.00, 1, 20),
(5, 'Chocolate Lava Cake', 'Warm molten chocolate cake with vanilla ice cream', 180.00, 1, 15),
(5, 'Mango Panna Cotta', 'Silky panna cotta with fresh mango coulis', 155.00, 1, 5),
(5, 'Leche Flan', 'Classic Filipino caramel custard', 120.00, 1, 5),
(5, 'Halo-Halo', 'Filipino shaved ice dessert with ube ice cream', 145.00, 1, 5),
(6, 'Brewed Coffee', 'Freshly brewed arabica coffee', 95.00, 1, 5),
(6, 'Iced Latte', 'Espresso with cold milk over ice', 125.00, 1, 5),
(6, 'Fresh Lemonade', 'Freshly squeezed lemonade with mint', 95.00, 1, 5),
(6, 'Mango Shake', 'Fresh mango blended with milk', 120.00, 1, 5),
(6, 'Iced Tea', 'House-brewed iced tea, bottomless', 75.00, 1, 3),
(6, 'Mineral Water', 'Still or sparkling', 55.00, 1, 1);

-- Tables
INSERT INTO restaurant_tables (table_number, capacity, status) VALUES
('T01', 2, 'available'),
('T02', 2, 'available'),
('T03', 4, 'available'),
('T04', 4, 'available'),
('T05', 4, 'available'),
('T06', 6, 'available'),
('T07', 6, 'available'),
('T08', 8, 'available'),
('BAR1', 1, 'available'),
('BAR2', 1, 'available');

-- Default admin staff
INSERT INTO staff (name, username, password, role) VALUES
('Administrator', 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('Head Waiter', 'waiter1', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'waiter'),
('Kitchen Staff', 'kitchen1', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'kitchen'),
('Cashier', 'cashier1', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cashier');
-- Default password for all: "password"

-- Sample customers
INSERT INTO customers (name, email, phone, loyalty_points, total_visits) VALUES
('Juan dela Cruz', 'juan@email.com', '09171234567', 150, 5),
('Maria Santos', 'maria@email.com', '09281234567', 320, 12),
('Walk-in Guest', NULL, NULL, 0, 0);
