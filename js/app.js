// js/app.js - Smart Restaurant Ordering System

const API = 'php/api.php';
let state = {
  menu: [], categories: [], tables: [], orders: [], customers: [],
  cart: [], selectedTable: null, selectedCustomer: null,
  activePage: 'dashboard',
  activeOrderFilter: 'all',
  kitchenInterval: null,
  dashboardInterval: null
};

// ===================== UTILITIES =====================
const $ = id => document.getElementById(id);
const fmt = n => '₱' + parseFloat(n||0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2});
const fmtDate = d => new Date(d).toLocaleString('en-PH', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});

async function api(action, data = {}, method = 'GET') {
  try {
    let url = `${API}?action=${action}`;
    let opts = { headers: {'Content-Type': 'application/json'} };
    if (method === 'GET' && Object.keys(data).length) {
      url += '&' + new URLSearchParams(data);
    } else if (method === 'POST') {
      opts.method = 'POST';
      opts.body = JSON.stringify(data);
    }
    const res = await fetch(url, opts);
    return await res.json();
  } catch (e) {
    showToast('Connection error. Is XAMPP running?', 'error');
    return { success: false, error: e.message };
  }
}

function showToast(msg, type = 'info') {
  const c = $('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  t.innerHTML = `<span>${icons[type]||'ℹ'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

function openModal(id) { $(id).classList.add('show'); }
function closeModal(id) { $(id).classList.remove('show'); }

function setPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = $('page-' + page);
  if (pg) pg.classList.add('active');
  const nav = document.querySelector(`[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  state.activePage = page;

  clearInterval(state.kitchenInterval);
  clearInterval(state.dashboardInterval);

  if (page === 'dashboard') { loadDashboard(); state.dashboardInterval = setInterval(loadDashboard, 30000); }
  else if (page === 'order') { loadMenu(); loadTables(); }
  else if (page === 'orders') loadOrders();
  else if (page === 'kitchen') { loadKitchen(); state.kitchenInterval = setInterval(loadKitchen, 15000); }
  else if (page === 'tables') loadTablesPage();
  else if (page === 'menu') loadMenuAdmin();
  else if (page === 'customers') loadCustomers();
  else if (page === 'feedback') loadFeedback();

  // Update topbar
  const titles = {
    dashboard: ['Dashboard', 'Overview of today\'s operations'],
    order: ['New Order', 'Take customer orders'],
    orders: ['Order Management', 'Track and manage all orders'],
    kitchen: ['Kitchen Display', 'Real-time order queue for kitchen'],
    tables: ['Table Management', 'Monitor restaurant floor layout'],
    menu: ['Menu Management', 'Manage food and beverage items'],
    customers: ['Customers', 'Customer information and loyalty'],
    feedback: ['Feedback', 'Customer reviews and ratings'],
  };
  if (titles[page]) {
    $('topbarTitle').textContent = titles[page][0];
    $('topbarSub').textContent = titles[page][1];
  }
}

// ===================== DASHBOARD =====================
async function loadDashboard() {
  const r = await api('get_dashboard');
  if (!r.success) return;

  $('statSales').textContent = fmt(r.today_sales);
  $('statOrders').textContent = r.today_orders;
  $('statActive').textContent = r.active_orders;
  $('statTables').textContent = r.available_tables;
  $('statRating').textContent = r.avg_rating ? r.avg_rating + ' ★' : 'N/A';

  // Recent orders table
  const tbody = $('recentOrdersBody');
  if (r.recent_orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:24px">No orders today yet</td></tr>';
  } else {
    tbody.innerHTML = r.recent_orders.map(o => `
      <tr>
        <td><strong>${o.order_number}</strong></td>
        <td>${o.table_number || (o.order_type)}</td>
        <td>${o.customer_name || '-'}</td>
        <td><span class="badge badge-${o.status}">${o.status}</span></td>
        <td class="text-gold"><strong>${fmt(o.total_amount)}</strong></td>
        <td>${fmtDate(o.created_at)}</td>
      </tr>`).join('');
  }

  // Top items chart
  const chartDiv = $('topItemsChart');
  if (r.top_items.length === 0) {
    chartDiv.innerHTML = '<div class="text-muted text-sm">No sales data yet</div>';
  } else {
    const maxQty = Math.max(...r.top_items.map(i => i.qty));
    chartDiv.innerHTML = r.top_items.map(i => `
      <div class="chart-bar-row">
        <div class="chart-bar-label">${i.item_name}</div>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(i.qty/maxQty*100)}%"></div></div>
        <div class="chart-bar-val">${i.qty} sold</div>
      </div>`).join('');
  }
}

// ===================== MENU (ORDER PAGE) =====================
async function loadMenu() {
  const r = await api('get_menu');
  if (!r.success) return;
  state.menu = r.items;
  state.categories = r.categories;
  renderCategoryTabs();
  renderMenuGrid(r.items);
}

function renderCategoryTabs() {
  const el = $('categoryTabs');
  el.innerHTML = `<div class="cat-tab active" onclick="filterMenu('all', this)">All Items</div>` +
    state.categories.map(c => `<div class="cat-tab" onclick="filterMenu(${c.id}, this)">${c.icon} ${c.name}</div>`).join('');
}

function filterMenu(catId, el) {
  document.querySelectorAll('#categoryTabs .cat-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const items = catId === 'all' ? state.menu : state.menu.filter(i => i.category_id == catId);
  renderMenuGrid(items);
}

function renderMenuGrid(items) {
  const grid = $('menuGrid');
  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽</div><h3>No items found</h3></div>';
    return;
  }
  const foodEmojis = { 1:'🥗', 2:'🍖', 3:'🍝', 4:'🦐', 5:'🍰', 6:'🥤' };
  grid.innerHTML = items.map(item => `
    <div class="menu-card ${item.is_available ? '' : 'unavailable'}" onclick="addToCart(${item.id})">
      <span class="menu-emoji">${foodEmojis[item.category_id] || '🍽️'}</span>
      <span class="menu-tag ${item.is_available ? 'avail' : 'unavail'}">${item.is_available ? '● Available' : '✕ Unavail'}</span>
      <h4>${item.name}</h4>
      <p>${item.description || ''}</p>
      <div class="menu-price">${fmt(item.price)}</div>
      <div class="text-sm text-muted mt-8">~${item.preparation_time} min</div>
    </div>`).join('');
}

function addToCart(itemId) {
  const item = state.menu.find(i => i.id == itemId);
  if (!item || !item.is_available) return;
  const existing = state.cart.find(c => c.menu_item_id == itemId);
  if (existing) { existing.quantity++; existing.subtotal = existing.price * existing.quantity; }
  else { state.cart.push({ menu_item_id: item.id, name: item.name, price: parseFloat(item.price), quantity: 1, subtotal: parseFloat(item.price), instructions: '' }); }
  renderCart();
  showToast(`${item.name} added`, 'success');
}

function updateQty(idx, delta) {
  state.cart[idx].quantity += delta;
  if (state.cart[idx].quantity <= 0) { state.cart.splice(idx, 1); }
  else { state.cart[idx].subtotal = state.cart[idx].price * state.cart[idx].quantity; }
  renderCart();
}

function renderCart() {
  const items = $('cartItems');
  const subtotalEl = $('cartSubtotal');
  const taxEl = $('cartTax');
  const scEl = $('cartSC');
  const totalEl = $('cartTotal');
  const countEl = $('cartCount');

  countEl.textContent = state.cart.reduce((s, i) => s + i.quantity, 0);

  if (state.cart.length === 0) {
    items.innerHTML = '<div class="empty-state" style="padding:30px"><div class="empty-icon">🛒</div><p>Cart is empty</p></div>';
    subtotalEl.textContent = taxEl.textContent = scEl.textContent = totalEl.textContent = fmt(0);
    return;
  }

  items.innerHTML = state.cart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${fmt(item.subtotal)}</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="updateQty(${idx}, -1)">−</button>
        <span class="qty-num">${item.quantity}</span>
        <button class="qty-btn" onclick="updateQty(${idx}, 1)">+</button>
      </div>
    </div>`).join('');

  const subtotal = state.cart.reduce((s, i) => s + i.subtotal, 0);
  const discount = parseFloat($('discountAmt').value) || 0;
  const useSC = $('applyServiceCharge').checked;
  const taxable = subtotal - discount;
  const tax = taxable * 0.12;
  const sc = useSC ? taxable * 0.10 : 0;
  const total = taxable + tax + sc;

  subtotalEl.textContent = fmt(subtotal);
  taxEl.textContent = fmt(tax);
  scEl.textContent = fmt(sc);
  totalEl.textContent = fmt(total);
}

function clearCart() { state.cart = []; state.selectedTable = null; state.selectedCustomer = null; $('selectedTableDisplay').textContent = 'No table selected'; $('selectedCustomerDisplay').textContent = 'No customer'; renderCart(); }

async function placeOrder() {
  if (state.cart.length === 0) { showToast('Cart is empty', 'warning'); return; }
  const orderType = $('orderType').value;
  if (orderType === 'dine-in' && !state.selectedTable) { showToast('Please select a table for dine-in orders', 'warning'); return; }

  const subtotal = state.cart.reduce((s,i)=>s+i.subtotal,0);
  const discount = parseFloat($('discountAmt').value)||0;
  const useSC = $('applyServiceCharge').checked;

  const payload = {
    items: state.cart, table_id: state.selectedTable?.id || null,
    customer_id: state.selectedCustomer?.id || null,
    customer_name: $('walkInName').value || state.selectedCustomer?.name || 'Walk-in',
    order_type: orderType, discount, service_charge: useSC,
    notes: $('orderNotes').value
  };

  const btn = $('placeOrderBtn');
  btn.disabled = true; btn.textContent = 'Placing Order...';
  const r = await api('create_order', payload, 'POST');
  btn.disabled = false; btn.textContent = '✓ Place Order';

  if (r.success) {
    showToast(`Order ${r.order_number} placed! Total: ${fmt(r.total)}`, 'success');
    clearCart();
    loadTables();
  } else {
    showToast('Failed to place order: ' + (r.error||''), 'error');
  }
}

// ===================== TABLE SELECTION =====================
async function loadTables() {
  const r = await api('get_tables');
  if (!r.success) return;
  state.tables = r.tables;
  renderTableSelector();
}

function renderTableSelector() {
  const el = $('tableSelector');
  if (!el) return;
  el.innerHTML = state.tables.map(t => `
    <div class="table-card ${t.status}" onclick="selectTable(${t.id})" title="${t.status}">
      <div class="table-icon">${t.status === 'available' ? '🟢' : t.status === 'occupied' ? '🔴' : '🟡'}</div>
      <div class="table-number">${t.table_number}</div>
      <div class="table-capacity">👤 ${t.capacity}</div>
      <span class="badge badge-${t.status}">${t.status}</span>
    </div>`).join('');
}

function selectTable(id) {
  const table = state.tables.find(t => t.id == id);
  if (!table) return;
  if (table.status === 'occupied') { showToast('Table is occupied. Select another.', 'warning'); return; }
  state.selectedTable = table;
  $('selectedTableDisplay').textContent = `Table ${table.table_number} (${table.capacity} seats)`;
  closeModal('tableModal');
  showToast(`Table ${table.table_number} selected`, 'success');
}

// ===================== CUSTOMER LOOKUP =====================
async function searchCustomers() {
  const q = $('customerSearch').value;
  if (q.length < 1) { $('customerResults').innerHTML = ''; return; }
  const r = await api('get_customers', { search: q });
  if (!r.success) return;
  $('customerResults').innerHTML = r.customers.map(c => `
    <div onclick="selectCustomer(${c.id})" style="padding:10px;cursor:pointer;border-radius:8px;margin-bottom:6px;background:var(--surface2);transition:0.15s" onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background='var(--surface2)'">
      <strong>${c.name}</strong> <span class="text-muted text-sm">⭐ ${c.loyalty_points} pts</span>
      <div class="text-sm text-muted">${c.email||''} ${c.phone||''}</div>
    </div>`).join('') || '<div class="text-muted text-sm" style="padding:10px">No customers found</div>';
  state.customerList = r.customers;
}

function selectCustomer(id) {
  state.selectedCustomer = state.customerList?.find(c => c.id == id) || null;
  if (state.selectedCustomer) {
    $('selectedCustomerDisplay').textContent = `${state.selectedCustomer.name} (⭐${state.selectedCustomer.loyalty_points}pts)`;
    $('walkInName').value = state.selectedCustomer.name;
    closeModal('customerModal');
    showToast(`Customer: ${state.selectedCustomer.name}`, 'success');
  }
}

// ===================== ORDERS =====================
async function loadOrders() {
  const filter = state.activeOrderFilter;
  const params = filter === 'all' ? {} : { status: filter };
  const r = await api('get_orders', params);
  if (!r.success) return;
  state.orders = r.orders;
  renderOrdersList();
}

function renderOrdersList() {
  const tbody = $('ordersBody');
  if (!state.orders.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:40px"><div class="empty-icon">📋</div><p class="text-muted">No orders found</p></td></tr>';
    return;
  }
  tbody.innerHTML = state.orders.map(o => `
    <tr>
      <td><strong class="text-gold">${o.order_number}</strong></td>
      <td>${o.table_number || o.order_type}</td>
      <td>${o.customer_name || '-'}</td>
      <td><span class="badge badge-${o.status}">${o.status}</span></td>
      <td>${o.order_type}</td>
      <td class="text-gold"><strong>${fmt(o.total_amount)}</strong></td>
      <td>${fmtDate(o.created_at)}</td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-sm" onclick="viewOrderDetail(${o.id})">View</button>
          ${o.status === 'confirmed' ? `<button class="btn btn-sm" style="background:var(--warning-dim,rgba(240,168,48,0.15));color:var(--warning)" onclick="updateOrderStatus(${o.id},'preparing')">Prepare</button>` : ''}
          ${o.status === 'preparing' ? `<button class="btn btn-success btn-sm" onclick="updateOrderStatus(${o.id},'ready')">Ready</button>` : ''}
          ${o.status === 'ready' ? `<button class="btn btn-success btn-sm" onclick="updateOrderStatus(${o.id},'served')">Serve</button>` : ''}
          ${['confirmed','preparing'].includes(o.status) ? `<button class="btn btn-danger btn-sm" onclick="cancelOrder(${o.id})">Cancel</button>` : ''}
          ${o.status === 'served' ? `<button class="btn btn-primary btn-sm" onclick="openPayment(${o.id})">Pay</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

async function viewOrderDetail(id) {
  const r = await api('get_order_detail', { id });
  if (!r.success) return;
  const o = r.order;
  $('orderDetailContent').innerHTML = `
    <div class="grid-2 mb-16">
      <div><div class="text-muted text-sm">Order #</div><strong class="text-gold">${o.order_number}</strong></div>
      <div><div class="text-muted text-sm">Status</div><span class="badge badge-${o.status}">${o.status}</span></div>
      <div><div class="text-muted text-sm">Table</div>${o.table_number||o.order_type}</div>
      <div><div class="text-muted text-sm">Customer</div>${o.customer_name||'Walk-in'}</div>
      <div><div class="text-muted text-sm">Type</div>${o.order_type}</div>
      <div><div class="text-muted text-sm">Time</div>${fmtDate(o.created_at)}</div>
    </div>
    <div class="card card-sm mb-16">
      <table class="data-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th><th>Status</th></tr></thead>
        <tbody>${r.items.map(i=>`<tr><td>${i.item_name}${i.special_instructions?'<br><span class="text-sm text-muted">'+i.special_instructions+'</span>':''}</td><td>${i.quantity}</td><td>${fmt(i.item_price)}</td><td>${fmt(i.subtotal)}</td><td><span class="badge badge-${i.status}">${i.status}</span></td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div style="text-align:right">
      <div class="cart-summary-row"><span>Subtotal</span><span>${fmt(o.subtotal)}</span></div>
      ${o.discount_amount>0?`<div class="cart-summary-row"><span>Discount</span><span class="text-danger">-${fmt(o.discount_amount)}</span></div>`:''}
      <div class="cart-summary-row"><span>Tax (12%)</span><span>${fmt(o.tax_amount)}</span></div>
      ${o.service_charge>0?`<div class="cart-summary-row"><span>Service Charge</span><span>${fmt(o.service_charge)}</span></div>`:''}
      <div class="cart-summary-row total"><span>Total</span><span>${fmt(o.total_amount)}</span></div>
    </div>
    ${o.special_notes?`<div class="mt-16 text-sm text-muted">📝 ${o.special_notes}</div>`:''}`;
  openModal('orderDetailModal');
}

async function updateOrderStatus(id, status) {
  const r = await api('update_order_status', { id, status }, 'POST');
  if (r.success) { showToast(`Order marked as ${status}`, 'success'); loadOrders(); }
}

async function cancelOrder(id) {
  if (!confirm('Cancel this order?')) return;
  const r = await api('cancel_order', { id }, 'POST');
  if (r.success) { showToast('Order cancelled', 'warning'); loadOrders(); }
}

// ===================== PAYMENT =====================
let paymentOrderId = null;
async function openPayment(orderId) {
  paymentOrderId = orderId;
  const r = await api('get_order_detail', { id: orderId });
  if (!r.success) return;
  const o = r.order;
  $('paymentOrderNum').textContent = o.order_number;
  $('paymentTotal').textContent = fmt(o.total_amount);
  $('paymentTotalHidden').value = o.total_amount;
  $('amountPaid').value = '';
  $('changeDisplay').textContent = fmt(0);
  openModal('paymentModal');
}

function calcChange() {
  const total = parseFloat($('paymentTotalHidden').value) || 0;
  const paid = parseFloat($('amountPaid').value) || 0;
  $('changeDisplay').textContent = fmt(Math.max(0, paid - total));
}

async function processPayment() {
  const method = $('paymentMethod').value;
  const paid = parseFloat($('amountPaid').value);
  const total = parseFloat($('paymentTotalHidden').value);
  if (!paid || paid < total) { showToast('Amount paid must be ≥ total', 'warning'); return; }

  const r = await api('process_payment', { order_id: paymentOrderId, payment_method: method, amount_paid: paid }, 'POST');
  if (r.success) {
    closeModal('paymentModal');
    showToast(`Payment received! Change: ${fmt(r.change)}`, 'success');
    if (confirm(`Payment successful! Receipt: ${r.receipt_number}\nPrint receipt?`)) {
      printReceipt(r.receipt_number);
    }
    loadOrders();
  } else {
    showToast('Payment failed: ' + (r.error||''), 'error');
  }
}

async function printReceipt(receiptNum) {
  const r = await api('get_receipt', { number: receiptNum });
  if (!r.success || !r.receipt) return;
  const rc = r.receipt;
  const win = window.open('', '_blank', 'width=420,height=700');
  win.document.write(`<!DOCTYPE html><html><head><title>Receipt ${rc.receipt_number}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
  <style>body{margin:0;padding:20px;background:#f5f5f5;font-family:'DM Sans',sans-serif;}</style></head><body>
  <div style="background:white;max-width:380px;margin:0 auto;padding:30px 28px;font-family:Courier New,monospace;font-size:13px">
    <div style="text-align:center;margin-bottom:14px">🍽️</div>
    <div style="font-family:'Playfair Display',serif;font-size:18px;text-align:center;font-weight:700">${'La Mesa Smart Restaurant'}</div>
    <div style="text-align:center;font-size:11px;color:#666;margin-bottom:4px">Cebu City, Philippines</div>
    <div style="text-align:center;font-size:11px;color:#666;margin-bottom:16px">TIN: 123-456-789-000</div>
    <hr style="border:none;border-top:1px dashed #ccc;margin:10px 0">
    <div style="display:flex;justify-content:space-between"><span>Receipt #</span><strong>${rc.receipt_number}</strong></div>
    <div style="display:flex;justify-content:space-between"><span>Order #</span><span>${rc.order_number}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Table</span><span>${rc.table_number||rc.order_type}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Date</span><span>${new Date(rc.created_at).toLocaleString('en-PH')}</span></div>
    <hr style="border:none;border-top:1px dashed #ccc;margin:10px 0">
    ${rc.items.map(i=>`<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>${i.quantity}x ${i.item_name}</span><span>₱${parseFloat(i.subtotal).toFixed(2)}</span></div>`).join('')}
    <hr style="border:none;border-top:1px dashed #ccc;margin:10px 0">
    <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>₱${parseFloat(rc.subtotal).toFixed(2)}</span></div>
    ${rc.discount_amount>0?`<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-₱${parseFloat(rc.discount_amount).toFixed(2)}</span></div>`:''}
    <div style="display:flex;justify-content:space-between"><span>VAT 12%</span><span>₱${parseFloat(rc.tax_amount).toFixed(2)}</span></div>
    ${rc.service_charge>0?`<div style="display:flex;justify-content:space-between"><span>Service Charge</span><span>₱${parseFloat(rc.service_charge).toFixed(2)}</span></div>`:''}
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;border-top:2px solid #111;padding-top:8px;margin-top:4px"><span>TOTAL</span><span>₱${parseFloat(rc.total_amount).toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;margin-top:8px"><span>Payment (${rc.payment_method})</span><span>₱${parseFloat(rc.amount_paid).toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Change</span><span>₱${parseFloat(rc.change_given).toFixed(2)}</span></div>
    <div style="text-align:center;margin-top:20px;font-style:italic;color:#555;font-size:12px">Thank you for dining with us!<br>Please come again 🌟</div>
  </div>
  <script>window.onload=()=>{window.print();}<\/script></body></html>`);
  win.document.close();
}

// ===================== KITCHEN DISPLAY =====================
async function loadKitchen() {
  const r = await api('get_orders', { status: 'confirmed' });
  const r2 = await api('get_orders', { status: 'preparing' });
  if (!r.success) return;
  const orders = [...r.orders, ...r2.orders].sort((a,b) => new Date(a.created_at)-new Date(b.created_at));

  const grid = $('kitchenGrid');
  if (orders.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">👨‍🍳</div><h3>All clear! No pending orders</h3></div>';
    return;
  }

  const details = await Promise.all(orders.map(o => api('get_order_detail', { id: o.id })));
  grid.innerHTML = details.filter(d=>d.success).map((d, i) => {
    const o = d.order;
    const elapsed = Math.floor((Date.now() - new Date(o.created_at)) / 60000);
    const urgentClass = elapsed > 20 ? 'style="border-color:var(--danger)"' : elapsed > 10 ? 'style="border-color:var(--warning)"' : '';
    return `
    <div class="kitchen-card" ${urgentClass}>
      <div class="kitchen-card-header">
        <div>
          <strong class="text-gold">${o.order_number}</strong>
          <div class="text-sm text-muted">${o.table_number||o.order_type} · ${o.customer_name||'Walk-in'}</div>
        </div>
        <div class="timer">⏱ ${elapsed}m</div>
      </div>
      <div class="kitchen-card-body">
        ${d.items.map(item => `
          <div class="kitchen-item">
            <span>${item.item_name}${item.special_instructions?'<br><span class="text-sm text-muted">'+item.special_instructions+'</span>':''}</span>
            <span class="kitchen-qty">×${item.quantity}</span>
          </div>`).join('')}
        ${o.special_notes ? `<div class="text-sm text-muted mt-8">📝 ${o.special_notes}</div>` : ''}
      </div>
      <div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px">
        ${o.status==='confirmed'?`<button class="btn btn-sm" style="flex:1;background:rgba(240,168,48,0.1);color:var(--warning)" onclick="kitchenUpdate(${o.id},'preparing')">Start Cooking</button>`:''}
        ${o.status==='preparing'?`<button class="btn btn-success btn-sm" style="flex:1" onclick="kitchenUpdate(${o.id},'ready')">✓ Mark Ready</button>`:''}
      </div>
    </div>`;
  }).join('');
}

async function kitchenUpdate(id, status) {
  const r = await api('update_order_status', { id, status }, 'POST');
  if (r.success) { showToast(`Order marked as ${status}`, 'success'); loadKitchen(); }
}

// ===================== TABLES PAGE =====================
async function loadTablesPage() {
  const r = await api('get_tables');
  if (!r.success) return;
  state.tables = r.tables;
  const grid = $('tablesPageGrid');
  grid.innerHTML = state.tables.map(t => `
    <div class="table-card ${t.status}" onclick="viewTableDetail(${t.id})">
      <div class="table-icon">${t.status==='available'?'🟢':t.status==='occupied'?'🔴':t.status==='reserved'?'🟡':'🔵'}</div>
      <div class="table-number">${t.table_number}</div>
      <div class="table-capacity">👤 Capacity: ${t.capacity}</div>
      <span class="badge badge-${t.status}">${t.status}</span>
      ${t.order_number?`<div class="text-sm text-gold mt-8">${t.order_number}</div>`:''}
      <div class="flex gap-8 mt-8" style="justify-content:center">
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();changeTableStatus(${t.id},'available')">Free</button>
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();changeTableStatus(${t.id},'reserved')">Reserve</button>
      </div>
    </div>`).join('');
}

async function changeTableStatus(id, status) {
  const r = await api('update_table_status', { id, status }, 'POST');
  if (r.success) { showToast('Table status updated', 'success'); loadTablesPage(); }
}

// ===================== MENU ADMIN =====================
async function loadMenuAdmin() {
  const r = await api('get_menu');
  if (!r.success) return;
  state.menu = r.items;
  state.categories = r.categories;
  renderMenuAdmin();
  renderCategoryFilter();
}

function renderCategoryFilter() {
  const sel = $('menuCategoryFilter');
  sel.innerHTML = '<option value="all">All Categories</option>' + state.categories.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}

function renderMenuAdmin(catFilter = 'all', search = '') {
  const tbody = $('menuAdminBody');
  let items = state.menu;
  if (catFilter !== 'all') items = items.filter(i => i.category_id == catFilter);
  if (search) items = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  tbody.innerHTML = items.map(item => `
    <tr>
      <td><strong>${item.name}</strong></td>
      <td>${item.category_name}</td>
      <td class="text-gold">${fmt(item.price)}</td>
      <td>${item.preparation_time}m</td>
      <td>${item.stock_quantity}</td>
      <td><span class="badge ${item.is_available?'badge-available':'badge-cancelled'}">${item.is_available?'Available':'Unavailable'}</span></td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-sm" onclick="toggleAvailability(${item.id},${item.is_available})">${item.is_available?'Disable':'Enable'}</button>
          <button class="btn btn-primary btn-sm" onclick="editMenuItem(${item.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMenuItem(${item.id})">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

async function toggleAvailability(id, current) {
  const r = await api('update_item_availability', { id, is_available: current ? 0 : 1 }, 'POST');
  if (r.success) { showToast('Availability updated', 'success'); loadMenuAdmin(); }
}

function editMenuItem(id) {
  const item = state.menu.find(i => i.id == id);
  if (!item) return;
  $('menuItemId').value = item.id;
  $('menuItemName').value = item.name;
  $('menuItemDesc').value = item.description;
  $('menuItemPrice').value = item.price;
  $('menuItemCategory').value = item.category_id;
  $('menuItemPrep').value = item.preparation_time;
  $('menuItemStock').value = item.stock_quantity;
  $('menuItemAvail').value = item.is_available;
  $('menuItemModalTitle').textContent = 'Edit Menu Item';
  openModal('menuItemModal');
}

function openAddMenuItem() {
  $('menuItemId').value = '';
  $('menuItemName').value = $('menuItemDesc').value = $('menuItemPrice').value = '';
  $('menuItemPrep').value = 15; $('menuItemStock').value = 100; $('menuItemAvail').value = 1;
  $('menuItemCategory').value = state.categories[0]?.id || 1;
  $('menuItemModalTitle').textContent = 'Add Menu Item';
  // populate category select
  $('menuItemCategory').innerHTML = state.categories.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  openModal('menuItemModal');
}

async function saveMenuItem() {
  const id = $('menuItemId').value;
  const data = {
    id, name: $('menuItemName').value, description: $('menuItemDesc').value,
    price: $('menuItemPrice').value, category_id: $('menuItemCategory').value,
    preparation_time: $('menuItemPrep').value, stock_quantity: $('menuItemStock').value,
    is_available: $('menuItemAvail').value
  };
  if (!data.name || !data.price) { showToast('Name and price are required', 'warning'); return; }
  const r = await api(id ? 'update_menu_item' : 'add_menu_item', data, 'POST');
  if (r.success) { showToast(id ? 'Item updated' : 'Item added', 'success'); closeModal('menuItemModal'); loadMenuAdmin(); }
}

async function deleteMenuItem(id) {
  if (!confirm('Delete this menu item?')) return;
  const r = await api('delete_menu_item', { id }, 'POST');
  if (r.success) { showToast('Item deleted', 'success'); loadMenuAdmin(); }
}

// ===================== CUSTOMERS =====================
async function loadCustomers() {
  const r = await api('get_customers', { search: '' });
  if (!r.success) return;
  state.customers = r.customers;
  renderCustomers(r.customers);
}

function renderCustomers(list) {
  const tbody = $('customersBody');
  tbody.innerHTML = list.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.email||'-'}</td>
      <td>${c.phone||'-'}</td>
      <td><span class="text-gold">⭐ ${c.loyalty_points}</span></td>
      <td>${c.total_visits}</td>
      <td>${fmt(c.total_spent)}</td>
      <td>${c.preferences||'-'}</td>
      <td>${new Date(c.created_at).toLocaleDateString('en-PH')}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editCustomer(${c.id})">Edit</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="9" class="text-center text-muted" style="padding:30px">No customers found</td></tr>';
}

async function searchCustomerList() {
  const q = $('customerSearchAdmin').value;
  const r = await api('get_customers', { search: q });
  if (r.success) renderCustomers(r.customers);
}

function openAddCustomer() {
  $('custId').value = ''; $('custName').value = ''; $('custEmail').value = '';
  $('custPhone').value = ''; $('custPref').value = '';
  $('custModalTitle').textContent = 'Add Customer';
  openModal('customerAdminModal');
}

function editCustomer(id) {
  const c = state.customers.find(c => c.id == id);
  if (!c) return;
  $('custId').value = c.id; $('custName').value = c.name; $('custEmail').value = c.email||'';
  $('custPhone').value = c.phone||''; $('custPref').value = c.preferences||'';
  $('custModalTitle').textContent = 'Edit Customer';
  openModal('customerAdminModal');
}

async function saveCustomer() {
  const id = $('custId').value;
  const data = { id, name: $('custName').value, email: $('custEmail').value, phone: $('custPhone').value, preferences: $('custPref').value };
  if (!data.name) { showToast('Name is required', 'warning'); return; }
  const r = await api(id ? 'update_customer' : 'add_customer', data, 'POST');
  if (r.success) { showToast(id ? 'Customer updated' : 'Customer added', 'success'); closeModal('customerAdminModal'); loadCustomers(); }
  else showToast(r.error || 'Failed', 'error');
}

// ===================== FEEDBACK =====================
let fbRatings = { overall: 0, food: 0, service: 0, ambiance: 0 };

function setRating(type, val) {
  fbRatings[type] = val;
  const map = { overall: 'starOverall', food: 'starFood', service: 'starService', ambiance: 'starAmbiance' };
  document.querySelectorAll(`#${map[type]} .star`).forEach((s, i) => {
    s.classList.toggle('active', i < val);
  });
}

function buildStars(id, type) {
  return `<div class="star-rating" id="${id}">${[1,2,3,4,5].map(n=>`<span class="star" onclick="setRating('${type}',${n})">★</span>`).join('')}</div>`;
}

async function submitFeedback() {
  if (!fbRatings.overall) { showToast('Please rate your overall experience', 'warning'); return; }
  const data = {
    customer_name: $('fbName').value || 'Anonymous',
    rating: fbRatings.overall, food_rating: fbRatings.food||fbRatings.overall,
    service_rating: fbRatings.service||fbRatings.overall,
    ambiance_rating: fbRatings.ambiance||fbRatings.overall,
    comment: $('fbComment').value, order_id: $('fbOrderId').value || null
  };
  const r = await api('submit_feedback', data, 'POST');
  if (r.success) { showToast('Thank you for your feedback! ⭐', 'success'); $('fbName').value=''; $('fbComment').value=''; $('fbOrderId').value=''; fbRatings={overall:0,food:0,service:0,ambiance:0}; document.querySelectorAll('.star').forEach(s=>s.classList.remove('active')); loadFeedback(); }
}

async function loadFeedback() {
  const r = await api('get_feedback');
  if (!r.success) return;
  const tbody = $('feedbackBody');
  tbody.innerHTML = r.feedback.map(f => `
    <tr>
      <td>${f.customer_name||'Anonymous'}</td>
      <td>${'★'.repeat(f.rating)}${'☆'.repeat(5-f.rating)}</td>
      <td>${'★'.repeat(f.food_rating)}${'☆'.repeat(5-f.food_rating)}</td>
      <td>${'★'.repeat(f.service_rating)}${'☆'.repeat(5-f.service_rating)}</td>
      <td>${'★'.repeat(f.ambiance_rating)}${'☆'.repeat(5-f.ambiance_rating)}</td>
      <td>${f.comment||'-'}</td>
      <td>${new Date(f.created_at).toLocaleDateString('en-PH')}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted" style="padding:30px">No feedback yet</td></tr>';
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  // Build feedback star widgets
  $('starOverallWrap').innerHTML = buildStars('starOverall', 'overall');
  $('starFoodWrap').innerHTML = buildStars('starFood', 'food');
  $('starServiceWrap').innerHTML = buildStars('starService', 'service');
  $('starAmbianceWrap').innerHTML = buildStars('starAmbiance', 'ambiance');

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });
  });

  // Category filter and search for menu admin
  document.addEventListener('input', e => {
    if (e.target.id === 'menuSearch' || e.target.id === 'menuCategoryFilter') {
      renderMenuAdmin($('menuCategoryFilter').value, $('menuSearch').value);
    }
  });

  // Cart inputs
  if($('discountAmt')) $('discountAmt').addEventListener('input', renderCart);
  if($('applyServiceCharge')) $('applyServiceCharge').addEventListener('change', renderCart);
  if($('amountPaid')) $('amountPaid').addEventListener('input', calcChange);

  setPage('dashboard');
});
