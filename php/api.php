<?php
// php/api.php - Main REST API Handler
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once '../includes/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];

$db = getDB();

switch ($action) {

    // =========== MENU ===========
    case 'get_menu':
        $stmt = $db->query("SELECT mi.*, mc.name as category_name, mc.icon as category_icon 
                            FROM menu_items mi 
                            JOIN menu_categories mc ON mi.category_id = mc.id 
                            ORDER BY mc.sort_order, mi.name");
        $items = $stmt->fetchAll();
        $cats = $db->query("SELECT * FROM menu_categories ORDER BY sort_order")->fetchAll();
        jsonResponse(['success' => true, 'items' => $items, 'categories' => $cats]);

    case 'update_item_availability':
        $stmt = $db->prepare("UPDATE menu_items SET is_available = ? WHERE id = ?");
        $stmt->execute([$input['is_available'], $input['id']]);
        jsonResponse(['success' => true]);

    case 'add_menu_item':
        $stmt = $db->prepare("INSERT INTO menu_items (category_id, name, description, price, is_available, stock_quantity, preparation_time) VALUES (?,?,?,?,?,?,?)");
        $stmt->execute([$input['category_id'], $input['name'], $input['description'], $input['price'], 1, $input['stock_quantity'] ?? 100, $input['preparation_time'] ?? 15]);
        jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);

    case 'update_menu_item':
        $stmt = $db->prepare("UPDATE menu_items SET name=?, description=?, price=?, is_available=?, stock_quantity=?, preparation_time=? WHERE id=?");
        $stmt->execute([$input['name'], $input['description'], $input['price'], $input['is_available'], $input['stock_quantity'], $input['preparation_time'], $input['id']]);
        jsonResponse(['success' => true]);

    case 'delete_menu_item':
        $stmt = $db->prepare("DELETE FROM menu_items WHERE id=?");
        $stmt->execute([$input['id']]);
        jsonResponse(['success' => true]);

    // =========== TABLES ===========
    case 'get_tables':
        $stmt = $db->query("SELECT rt.*, o.order_number, o.status as order_status 
                            FROM restaurant_tables rt 
                            LEFT JOIN orders o ON rt.current_order_id = o.id
                            ORDER BY rt.table_number");
        jsonResponse(['success' => true, 'tables' => $stmt->fetchAll()]);

    case 'update_table_status':
        $stmt = $db->prepare("UPDATE restaurant_tables SET status=? WHERE id=?");
        $stmt->execute([$input['status'], $input['id']]);
        jsonResponse(['success' => true]);

    // =========== ORDERS ===========
    case 'create_order':
        $db->beginTransaction();
        try {
            $orderNum = generateOrderNumber();
            $items = $input['items'];
            $subtotal = 0;
            foreach ($items as $item) {
                $subtotal += $item['price'] * $item['quantity'];
            }
            $discount = floatval($input['discount'] ?? 0);
            $useServiceCharge = $input['service_charge'] ?? false;
            $taxableAmt = $subtotal - $discount;
            $tax = round($taxableAmt * TAX_RATE, 2);
            $sc = $useServiceCharge ? round($taxableAmt * SERVICE_CHARGE, 2) : 0;
            $total = $taxableAmt + $tax + $sc;

            $stmt = $db->prepare("INSERT INTO orders (order_number, table_id, customer_id, customer_name, status, order_type, subtotal, tax_amount, discount_amount, service_charge, total_amount, special_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
            $stmt->execute([
                $orderNum, $input['table_id'] ?? null, $input['customer_id'] ?? null,
                $input['customer_name'] ?? 'Walk-in', 'confirmed',
                $input['order_type'] ?? 'dine-in',
                $subtotal, $tax, $discount, $sc, $total, $input['notes'] ?? ''
            ]);
            $orderId = $db->lastInsertId();

            foreach ($items as $item) {
                $itemSub = $item['price'] * $item['quantity'];
                $stmt2 = $db->prepare("INSERT INTO order_items (order_id, menu_item_id, item_name, item_price, quantity, subtotal, special_instructions) VALUES (?,?,?,?,?,?,?)");
                $stmt2->execute([$orderId, $item['menu_item_id'], $item['name'], $item['price'], $item['quantity'], $itemSub, $item['instructions'] ?? '']);
                // Reduce stock
                $db->prepare("UPDATE menu_items SET stock_quantity = stock_quantity - ? WHERE id = ?")->execute([$item['quantity'], $item['menu_item_id']]);
            }

            // Link table
            if (!empty($input['table_id'])) {
                $db->prepare("UPDATE restaurant_tables SET status='occupied', current_order_id=? WHERE id=?")->execute([$orderId, $input['table_id']]);
            }

            $db->commit();
            jsonResponse(['success' => true, 'order_id' => $orderId, 'order_number' => $orderNum, 'total' => $total]);
        } catch (Exception $e) {
            $db->rollBack();
            jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }

    case 'get_orders':
        $where = "WHERE 1=1";
        $params = [];
        if (!empty($_GET['status'])) { $where .= " AND o.status=?"; $params[] = $_GET['status']; }
        if (!empty($_GET['date'])) { $where .= " AND DATE(o.created_at)=?"; $params[] = $_GET['date']; }
        $stmt = $db->prepare("SELECT o.*, rt.table_number FROM orders o LEFT JOIN restaurant_tables rt ON o.table_id = rt.id $where ORDER BY o.created_at DESC LIMIT 100");
        $stmt->execute($params);
        jsonResponse(['success' => true, 'orders' => $stmt->fetchAll()]);

    case 'get_order_detail':
        $stmt = $db->prepare("SELECT o.*, rt.table_number FROM orders o LEFT JOIN restaurant_tables rt ON o.table_id=rt.id WHERE o.id=?");
        $stmt->execute([$_GET['id']]);
        $order = $stmt->fetch();
        $stmt2 = $db->prepare("SELECT * FROM order_items WHERE order_id=?");
        $stmt2->execute([$_GET['id']]);
        $items = $stmt2->fetchAll();
        jsonResponse(['success' => true, 'order' => $order, 'items' => $items]);

    case 'update_order_status':
        $stmt = $db->prepare("UPDATE orders SET status=? WHERE id=?");
        $stmt->execute([$input['status'], $input['id']]);
        // Free table if served or cancelled
        if (in_array($input['status'], ['served', 'cancelled'])) {
            $db->prepare("UPDATE restaurant_tables SET status='available', current_order_id=NULL WHERE current_order_id=?")->execute([$input['id']]);
        }
        jsonResponse(['success' => true]);

    case 'update_item_status':
        $stmt = $db->prepare("UPDATE order_items SET status=? WHERE id=?");
        $stmt->execute([$input['status'], $input['id']]);
        jsonResponse(['success' => true]);

    case 'cancel_order':
        $db->beginTransaction();
        $stmt = $db->prepare("UPDATE orders SET status='cancelled' WHERE id=?");
        $stmt->execute([$input['id']]);
        $db->prepare("UPDATE restaurant_tables SET status='available', current_order_id=NULL WHERE current_order_id=?")->execute([$input['id']]);
        $db->commit();
        jsonResponse(['success' => true]);

    // =========== PAYMENT ===========
    case 'process_payment':
        $db->beginTransaction();
        try {
            $stmt = $db->prepare("SELECT * FROM orders WHERE id=?");
            $stmt->execute([$input['order_id']]);
            $order = $stmt->fetch();
            if (!$order) throw new Exception('Order not found');

            $change = floatval($input['amount_paid']) - floatval($order['total_amount']);
            $stmt2 = $db->prepare("INSERT INTO payments (order_id, payment_method, amount_paid, change_given, payment_status, transaction_ref) VALUES (?,?,?,?,?,?)");
            $stmt2->execute([$input['order_id'], $input['payment_method'], $input['amount_paid'], max(0, $change), 'completed', $input['transaction_ref'] ?? null]);
            $paymentId = $db->lastInsertId();

            $db->prepare("UPDATE orders SET status='served' WHERE id=?")->execute([$input['order_id']]);
            $db->prepare("UPDATE restaurant_tables SET status='available', current_order_id=NULL WHERE current_order_id=?")->execute([$input['order_id']]);

            // Update customer loyalty
            if (!empty($order['customer_id'])) {
                $pts = floor($order['total_amount'] / 100) * LOYALTY_RATE;
                $db->prepare("UPDATE customers SET loyalty_points=loyalty_points+?, total_visits=total_visits+1, total_spent=total_spent+? WHERE id=?")->execute([$pts, $order['total_amount'], $order['customer_id']]);
            }

            // Generate receipt
            $receiptNum = generateReceiptNumber();
            $receiptData = json_encode(['order' => $order, 'payment_method' => $input['payment_method'], 'amount_paid' => $input['amount_paid'], 'change' => max(0, $change)]);
            $db->prepare("INSERT INTO receipts (order_id, payment_id, receipt_number, receipt_data) VALUES (?,?,?,?)")->execute([$input['order_id'], $paymentId, $receiptNum, $receiptData]);

            $db->commit();
            jsonResponse(['success' => true, 'payment_id' => $paymentId, 'receipt_number' => $receiptNum, 'change' => max(0, $change)]);
        } catch (Exception $e) {
            $db->rollBack();
            jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }

    // =========== CUSTOMERS ===========
    case 'get_customers':
        $search = '%' . ($_GET['search'] ?? '') . '%';
        $stmt = $db->prepare("SELECT * FROM customers WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? ORDER BY name LIMIT 50");
        $stmt->execute([$search, $search, $search]);
        jsonResponse(['success' => true, 'customers' => $stmt->fetchAll()]);

    case 'add_customer':
        try {
            $stmt = $db->prepare("INSERT INTO customers (name, email, phone, preferences) VALUES (?,?,?,?)");
            $stmt->execute([$input['name'], $input['email'] ?? null, $input['phone'] ?? null, $input['preferences'] ?? null]);
            jsonResponse(['success' => true, 'id' => $db->lastInsertId()]);
        } catch (PDOException $e) {
            jsonResponse(['success' => false, 'error' => 'Email already exists']);
        }

    case 'update_customer':
        $stmt = $db->prepare("UPDATE customers SET name=?, email=?, phone=?, preferences=? WHERE id=?");
        $stmt->execute([$input['name'], $input['email'], $input['phone'], $input['preferences'], $input['id']]);
        jsonResponse(['success' => true]);

    // =========== FEEDBACK ===========
    case 'submit_feedback':
        $stmt = $db->prepare("INSERT INTO feedback (order_id, customer_id, customer_name, rating, food_rating, service_rating, ambiance_rating, comment) VALUES (?,?,?,?,?,?,?,?)");
        $stmt->execute([$input['order_id'] ?? null, $input['customer_id'] ?? null, $input['customer_name'] ?? 'Anonymous', $input['rating'], $input['food_rating'], $input['service_rating'], $input['ambiance_rating'], $input['comment'] ?? '']);
        jsonResponse(['success' => true]);

    case 'get_feedback':
        $stmt = $db->query("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 50");
        jsonResponse(['success' => true, 'feedback' => $stmt->fetchAll()]);

    // =========== DASHBOARD / REPORTS ===========
    case 'get_dashboard':
        $today = date('Y-m-d');
        $todaySales = $db->prepare("SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count FROM orders WHERE DATE(created_at)=? AND status NOT IN ('cancelled')");
        $todaySales->execute([$today]);
        $sales = $todaySales->fetch();

        $activeOrders = $db->query("SELECT COUNT(*) as count FROM orders WHERE status IN ('confirmed','preparing','ready')")->fetch();
        $availTables = $db->query("SELECT COUNT(*) as count FROM restaurant_tables WHERE status='available'")->fetch();
        $avgRating = $db->query("SELECT ROUND(AVG(rating),1) as avg FROM feedback")->fetch();

        $recentOrders = $db->prepare("SELECT o.*, rt.table_number FROM orders o LEFT JOIN restaurant_tables rt ON o.table_id=rt.id ORDER BY o.created_at DESC LIMIT 8");
        $recentOrders->execute();

        $topItems = $db->query("SELECT oi.item_name, SUM(oi.quantity) as qty, SUM(oi.subtotal) as revenue FROM order_items oi JOIN orders o ON oi.order_id=o.id WHERE o.status NOT IN ('cancelled') GROUP BY oi.item_name ORDER BY qty DESC LIMIT 5")->fetchAll();

        $weeklySales = $db->query("SELECT DATE(created_at) as date, SUM(total_amount) as total FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND status NOT IN ('cancelled') GROUP BY DATE(created_at) ORDER BY date")->fetchAll();

        jsonResponse([
            'success' => true,
            'today_sales' => $sales['total'],
            'today_orders' => $sales['count'],
            'active_orders' => $activeOrders['count'],
            'available_tables' => $availTables['count'],
            'avg_rating' => $avgRating['avg'] ?? 0,
            'recent_orders' => $recentOrders->fetchAll(),
            'top_items' => $topItems,
            'weekly_sales' => $weeklySales
        ]);

    case 'get_receipt':
        $stmt = $db->prepare("SELECT r.*, o.*, rt.table_number, p.payment_method, p.amount_paid, p.change_given FROM receipts r JOIN orders o ON r.order_id=o.id LEFT JOIN restaurant_tables rt ON o.table_id=rt.id JOIN payments p ON r.payment_id=p.id WHERE r.receipt_number=?");
        $stmt->execute([$_GET['number']]);
        $receipt = $stmt->fetch();
        if ($receipt) {
            $items = $db->prepare("SELECT * FROM order_items WHERE order_id=?");
            $items->execute([$receipt['order_id']]);
            $receipt['items'] = $items->fetchAll();
        }
        jsonResponse(['success' => true, 'receipt' => $receipt]);

    default:
        jsonResponse(['success' => false, 'error' => 'Unknown action'], 404);
}
?>
