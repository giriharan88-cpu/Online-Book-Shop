import { BOOKS } from './data.js';

const state = {
  query: '',
  maxPrice: 100,
  sort: 'relevance',
  selectedCategories: new Set(),
  cart: new Map(), // id -> { book, qty }
};

const elements = {
  searchInput: document.getElementById('searchInput'),
  categoryFilters: document.getElementById('categoryFilters'),
  priceRange: document.getElementById('priceRange'),
  priceRangeValue: document.getElementById('priceRangeValue'),
  sortSelect: document.getElementById('sortSelect'),
  resultsMeta: document.getElementById('resultsMeta'),
  bookGrid: document.getElementById('bookGrid'),
  modal: document.getElementById('productModal'),
  modalContent: document.getElementById('modalContent'),
  cartButton: document.getElementById('cartButton'),
  cartDrawer: document.getElementById('cartDrawer'),
  cartItems: document.getElementById('cartItems'),
  cartSubtotal: document.getElementById('cartSubtotal'),
  cartCount: document.getElementById('cartCount'),
  checkoutButton: document.getElementById('checkoutButton'),
};

// Init
init();

function init(){
  setupYear();
  loadCartFromStorage();
  setupFilters();
  wireEvents();
  render();
}

function setupYear(){
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

function loadCartFromStorage(){
  try {
    const raw = localStorage.getItem('obs_cart');
    if (!raw) return;
    const obj = JSON.parse(raw);
    for (const [id, entry] of Object.entries(obj)){
      state.cart.set(id, { book: entry.book, qty: entry.qty });
    }
  } catch {}
}

function saveCartToStorage(){
  const obj = {};
  for (const [id, entry] of state.cart.entries()){
    obj[id] = { book: entry.book, qty: entry.qty };
  }
  localStorage.setItem('obs_cart', JSON.stringify(obj));
}

function setupFilters(){
  // populate categories
  const categories = Array.from(new Set(BOOKS.map(b => b.category))).sort();
  for (const category of categories){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = category;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      if (state.selectedCategories.has(category)){
        state.selectedCategories.delete(category);
        btn.setAttribute('aria-pressed', 'false');
      } else {
        state.selectedCategories.add(category);
        btn.setAttribute('aria-pressed', 'true');
      }
      render();
    });
    elements.categoryFilters.appendChild(btn);
  }

  // price range
  const maxBookPrice = Math.ceil(Math.max(...BOOKS.map(b => b.price)));
  elements.priceRange.max = String(maxBookPrice);
  elements.priceRange.value = String(Math.min(state.maxPrice, maxBookPrice));
  elements.priceRangeValue.textContent = `$${elements.priceRange.value}`;
}

function wireEvents(){
  elements.searchInput.addEventListener('input', (e) => {
    state.query = e.target.value.trim();
    render();
  });
  elements.priceRange.addEventListener('input', (e) => {
    state.maxPrice = Number(e.target.value);
    elements.priceRangeValue.textContent = `$${state.maxPrice}`;
    render();
  });
  elements.sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });

  // modal close on click backdrop not supported in <dialog>; use form button

  // cart
  elements.cartButton.addEventListener('click', () => {
    const isOpen = elements.cartDrawer.open;
    if (isOpen) {
      elements.cartDrawer.close();
      elements.cartButton.setAttribute('aria-expanded', 'false');
    } else {
      elements.cartDrawer.showModal();
      elements.cartButton.setAttribute('aria-expanded', 'true');
    }
  });

  elements.checkoutButton.addEventListener('click', () => {
    if (state.cart.size === 0) return;
    alert('Thank you for your purchase!');
    state.cart.clear();
    saveCartToStorage();
    updateCartUI();
  });
}

function getFilteredSortedBooks(){
  let results = BOOKS.filter(b => b.price <= state.maxPrice);
  if (state.selectedCategories.size > 0){
    results = results.filter(b => state.selectedCategories.has(b.category));
  }
  if (state.query){
    const q = state.query.toLowerCase();
    results = results.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  switch(state.sort){
    case 'price-asc': results.sort((a,b) => a.price - b.price); break;
    case 'price-desc': results.sort((a,b) => b.price - a.price); break;
    case 'rating-desc': results.sort((a,b) => b.rating - a.rating); break;
    case 'newest': results.sort((a,b) => b.year - a.year); break;
    default:
      // relevance: boost by query match, rating, and recency
      results.sort((a, b) => relevanceScore(b) - relevanceScore(a));
  }

  return results;
}

function relevanceScore(book){
  let score = 0;
  if (state.query){
    const q = state.query.toLowerCase();
    if (book.title.toLowerCase().includes(q)) score += 5;
    if (book.author.toLowerCase().includes(q)) score += 3;
    if (book.tags.some(t => t.toLowerCase().includes(q))) score += 2;
  }
  score += book.rating; // minor weight
  const currentYear = new Date().getFullYear();
  score += Math.max(0, (book.year > 0 ? book.year : 0) / currentYear);
  return score;
}

function render(){
  const books = getFilteredSortedBooks();
  elements.resultsMeta.textContent = `${books.length} book${books.length!==1?'s':''} found`;
  renderGrid(books);
  updateCartUI();
}

function renderGrid(books){
  elements.bookGrid.innerHTML = '';
  for (const book of books){
    const card = document.createElement('article');

    card.className = 'card';
    card.innerHTML = `
      <div class="cover" role="img" aria-label="${escapeHtml(book.title)} cover">📘</div>
      <div class="card-body">
        <div class="title-row">
          <h3 class="book-title">${escapeHtml(book.title)}</h3>
          <div class="price">$${book.price.toFixed(2)}</div>
        </div>
        <div class="meta">${escapeHtml(book.author)} · <span class="rating">★ ${book.rating.toFixed(1)}</span> · ${book.year}</div>
        <div class="tags">${book.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
        <div class="actions">
          <button class="button" data-action="details">Details</button>
          <button class="button primary" data-action="add">Add to cart</button>
        </div>
      </div>`;

    card.querySelector('[data-action="details"]').addEventListener('click', () => openDetails(book));
    card.querySelector('[data-action="add"]').addEventListener('click', () => addToCart(book));

    elements.bookGrid.appendChild(card);
  }
}

function openDetails(book){
  elements.modalContent.innerHTML = `
    <header style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="cover" style="width:64px; height:84px; font-size:28px; border-radius:8px;">📘</div>
        <div>
          <h3 style="margin:0">${escapeHtml(book.title)}</h3>
          <div class="meta">${escapeHtml(book.author)} · <span class="rating">★ ${book.rating.toFixed(1)}</span> · ${book.year}</div>
        </div>
      </div>
      <div class="price" style="font-size:18px;">$${book.price.toFixed(2)}</div>
    </header>
    <p style="margin-top:12px">${escapeHtml(book.description)}</p>
    <div class="tags">${book.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
    <div class="actions" style="margin-top:12px">
      <button class="button" id="modalAdd">Add to cart</button>
    </div>`;

  elements.modal.showModal();
  const addBtn = document.getElementById('modalAdd');
  if (addBtn) addBtn.addEventListener('click', () => {
    addToCart(book);
    elements.modal.close();
  });
}

function addToCart(book){
  const existing = state.cart.get(book.id);
  if (existing){
    existing.qty += 1;
  } else {
    state.cart.set(book.id, { book, qty: 1 });
  }
  saveCartToStorage();
  updateCartUI();
}

function removeFromCart(id){
  state.cart.delete(id);
  saveCartToStorage();
  updateCartUI();
}

function changeQty(id, delta){
  const entry = state.cart.get(id);
  if (!entry) return;
  entry.qty = Math.max(1, entry.qty + delta);
  saveCartToStorage();
  updateCartUI();
}

function updateCartUI(){
  // items
  const items = Array.from(state.cart.values());
  elements.cartItems.innerHTML = '';
  for (const { book, qty } of items){
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="thumb">📘</div>
      <div>
        <div class="name">${escapeHtml(book.title)}</div>
        <div class="meta">$${book.price.toFixed(2)} · <span class="rating">★ ${book.rating.toFixed(1)}</span></div>
        <div class="qty">
          <button data-action="dec">−</button>
          <span aria-live="polite">${qty}</span>
          <button data-action="inc">+</button>
        </div>
      </div>
      <div style="display:grid; gap:8px; align-content:start;">
        <div><strong>$${(book.price * qty).toFixed(2)}</strong></div>
        <button data-action="remove">Remove</button>
      </div>`;

    row.querySelector('[data-action="inc"]').addEventListener('click', () => changeQty(book.id, +1));
    row.querySelector('[data-action="dec"]').addEventListener('click', () => changeQty(book.id, -1));
    row.querySelector('[data-action="remove"]').addEventListener('click', () => removeFromCart(book.id));

    elements.cartItems.appendChild(row);
  }

  const subtotal = items.reduce((sum, {book, qty}) => sum + book.price * qty, 0);
  elements.cartSubtotal.textContent = `$${subtotal.toFixed(2)}`;
  const totalQty = items.reduce((sum, {qty}) => sum + qty, 0);
  elements.cartCount.textContent = String(totalQty);
}

function escapeHtml(text){
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
