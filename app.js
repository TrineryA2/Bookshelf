/* ===================== DATA ===================== */
const STORAGE_KEY = 'readowl_books';
const BOOKS_PER_PANEL = 9; // 3x3

let books = [];
let editingId = null;

function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    books = raw ? JSON.parse(raw) : [];
  } catch (e) {
    books = [];
  }
}

function saveBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function addBook(title, author, color, status, coverImage) {
  const book = {
    id: Date.now().toString(),
    title: title.trim(),
    author: author.trim(),
    color,
    status,
    coverImage: coverImage || null
  };
  books.push(book);
  saveBooks();
  return book;
}

function updateBook(id, title, author, color, status, coverImage) {
  const idx = books.findIndex(b => b.id === id);
  if (idx !== -1) {
    books[idx] = { ...books[idx], title, author, color, status, coverImage: coverImage !== undefined ? coverImage : books[idx].coverImage };
    saveBooks();
  }
}

function deleteBook(id) {
  books = books.filter(b => b.id !== id);
  saveBooks();
}

/* ===================== IMAGE COMPRESSION FIX ===================== */
function compressImage(file, maxWidth = 600, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ===================== SHELF RENDERING ===================== */
function getShelfPanels() {
  const panels = [];
  for (let i = 0; i < books.length; i += BOOKS_PER_PANEL) {
    panels.push(books.slice(i, i + BOOKS_PER_PANEL));
  }
  if (panels.length === 0) panels.push([]);
  return panels;
}

function renderShelf() {
  const container = document.getElementById('shelfContainer');
  container.innerHTML = '';

  const panels = getShelfPanels();

  if (books.length === 0) {
    const panel = document.createElement('div');
    panel.className = 'shelf-panel';
    panel.innerHTML = `
      <div class="empty-shelf">
        <div class="empty-shelf-icon">📚</div>
        <div class="empty-shelf-text">Your shelf is empty</div>
        <div class="empty-shelf-sub">Tap "+ Add Book" to get started</div>
      </div>
    `;
    container.appendChild(panel);
    updatePageDots(0, 1);
    updateArrows(0, 1);
    return;
  }

  panels.forEach((panelBooks, panelIdx) => {
    const panel = document.createElement('div');
    panel.className = 'shelf-panel';

    for (let row = 0; row < 3; row++) {
      const shelfRow = document.createElement('div');
      shelfRow.className = 'shelf-row';

      const shelfBooks = document.createElement('div');
      shelfBooks.className = 'shelf-books';

      for (let col = 0; col < 3; col++) {
        const bookIdx = row * 3 + col;
        const book = panelBooks[bookIdx];

        if (book) {
          const el = createBookEl(book);
          shelfBooks.appendChild(el);
        } else {
          const slot = document.createElement('div');
          slot.className = 'book-slot';
          shelfBooks.appendChild(slot);
        }
      }

      const plank = document.createElement('div');
      plank.className = 'shelf-plank';

      shelfRow.appendChild(shelfBooks);
      shelfRow.appendChild(plank);
      panel.appendChild(shelfRow);
    }

    container.appendChild(panel);
  });

  updatePageDots(0, panels.length);
  updateArrows(0, panels.length);
  setupScrollSync();
}

function createBookEl(book) {
  const el = document.createElement('div');
  el.className = 'book';

  if (book.coverImage) {
    el.style.background = 'none';
    el.style.backgroundImage = `url(${book.coverImage})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.innerHTML = `<div class="book-status-dot dot-${book.status}"></div>`;
  } else {
    el.style.background = buildBookGradient(book.color);
    el.innerHTML = `
      <div class="book-status-dot dot-${book.status}"></div>
      <div class="book-title-spine">${escHtml(book.title)}</div>
      ${book.author ? `<div class="book-author-spine">${escHtml(book.author)}</div>` : ''}
    `;
  }

  return el;
}

function buildBookGradient(color) {
  return `linear-gradient(165deg, ${lighten(color, 15)} 0%, ${color} 40%, ${darken(color, 15)} 100%)`;
}

function lighten(hex, pct) {
  const [r,g,b] = hexToRgb(hex);
  return `rgb(${Math.min(255,r+pct*2)},${Math.min(255,g+pct*2)},${Math.min(255,b+pct*2)})`;
}
function darken(hex, pct) {
  const [r,g,b] = hexToRgb(hex);
  return `rgb(${Math.max(0,r-pct*2)},${Math.max(0,g-pct*2)},${Math.max(0,b-pct*2)})`;
}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r,g,b];
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ===================== PAGE DOTS ===================== */
let pageDots;

function initPageDots() {
  pageDots = document.createElement('div');
  pageDots.className = 'page-dots';
  document.body.appendChild(pageDots);
}

function updatePageDots(current, total) {
  if (!pageDots) return;
  pageDots.innerHTML = '';
  if (total <= 1) return;
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'page-dot' + (i === current ? ' active' : '');
    pageDots.appendChild(dot);
  }
}

/* ===================== SCROLL ARROWS ===================== */
let leftArrow, rightArrow;

function initArrows() {
  leftArrow = document.createElement('button');
  leftArrow.className = 'scroll-arrow left';
  leftArrow.innerHTML = '‹';
  leftArrow.onclick = () => scrollShelf(-1);
  document.body.appendChild(leftArrow);

  rightArrow = document.createElement('button');
  rightArrow.className = 'scroll-arrow right';
  rightArrow.innerHTML = '›';
  rightArrow.onclick = () => scrollShelf(1);
  document.body.appendChild(rightArrow);
}

function getCurrentPanel() {
  const c = document.getElementById('shelfContainer');
  if (!c) return 0;
  return Math.round(c.scrollLeft / window.innerWidth);
}

function scrollShelf(dir) {
  const c = document.getElementById('shelfContainer');
  if (!c) return;
  const panels = getShelfPanels();
  const current = getCurrentPanel();
  const next = Math.max(0, Math.min(panels.length - 1, current + dir));
  c.scrollTo({ left: next * window.innerWidth, behavior: 'smooth' });
}

function updateArrows(current, total) {
  if (!leftArrow || !rightArrow) return;
  const onHome = document.getElementById('page-home').classList.contains('active');
  if (!onHome || total <= 1) {
    leftArrow.classList.remove('visible');
    rightArrow.classList.remove('visible');
    return;
  }
  leftArrow.classList.toggle('visible', current > 0);
  rightArrow.classList.toggle('visible', current < total - 1);
}

function setupScrollSync() {
  const c = document.getElementById('shelfContainer');
  if (!c) return;
  c.onscroll = () => {
    const panels = getShelfPanels();
    const current = getCurrentPanel();
    updatePageDots(current, panels.length);
    updateArrows(current, panels.length);
  };
}

/* ===================== MANAGE LIST RENDERING ===================== */
function renderManage(filter = 'all') {
  const list = document.getElementById('manageList');
  const filtered = filter === 'all' ? books : books.filter(b => b.status === filter);

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="manage-empty">
        <span class="manage-empty-icon">📭</span>
        <div>No books here yet</div>
      </div>
    `;
    return;
  }

  list.innerHTML = '';
  filtered.forEach((book, i) => {
    const card = document.createElement('div');
    card.className = 'manage-card';
    card.style.animationDelay = `${i * 0.04}s`;

    const statusLabel = { not_started: 'Not Started', reading: 'Reading', complete: 'Complete' }[book.status];
    const statusClass = `status-${book.status}`;

    const coverStyle = book.coverImage
      ? `background-image:url(${book.coverImage});background-size:cover;background-position:center;`
      : `background:${buildBookGradient(book.color)}`;

    card.innerHTML = `
      <div class="card-cover" style="${coverStyle}"></div>
      <div class="card-info">
        <div class="card-title">${escHtml(book.title)}</div>
        <div class="card-author">${escHtml(book.author || 'Unknown Author')}</div>
      </div>
      <div class="card-status ${statusClass}">${statusLabel}</div>
    `;
    card.onclick = () => openEditModal(book.id);
    list.appendChild(card);
  });
}

/* ===================== IMAGE UPLOAD HELPERS ===================== */
let selectedCoverImage = null;
let editCoverImage = null; // null = unchanged, '' = cleared, or data URL

function setupImageUpload(inputId, previewId, clearId, onImage) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const clearBtn = document.getElementById(clearId);

  preview.onclick = () => input.click();

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    
    // COMPRESS THE IMAGE HERE
    const compressedDataUrl = await compressImage(file);
    onImage(compressedDataUrl);
    
    preview.style.backgroundImage = `url(${compressedDataUrl})`;
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
    preview.querySelector('.cover-upload-icon').style.display = 'none';
    preview.querySelector('.cover-upload-text').style.display = 'none';
    clearBtn.style.display = 'block';
  };

  clearBtn.onclick = (e) => {
    e.stopPropagation();
    onImage(null);
    input.value = '';
    preview.style.backgroundImage = '';
    preview.querySelector('.cover-upload-icon').style.display = '';
    preview.querySelector('.cover-upload-text').style.display = '';
    clearBtn.style.display = 'none';
  };
}

function resetImageUpload(previewId, clearId, inputId) {
  const preview = document.getElementById(previewId);
  const clearBtn = document.getElementById(clearId);
  const input = document.getElementById(inputId);
  preview.style.backgroundImage = '';
  if (preview.querySelector('.cover-upload-icon')) preview.querySelector('.cover-upload-icon').style.display = '';
  if (preview.querySelector('.cover-upload-text')) preview.querySelector('.cover-upload-text').style.display = '';
  clearBtn.style.display = 'none';
  input.value = '';
}

function loadImageIntoUpload(dataUrl, previewId, clearId) {
  const preview = document.getElementById(previewId);
  const clearBtn = document.getElementById(clearId);
  if (dataUrl) {
    preview.style.backgroundImage = `url(${dataUrl})`;
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
    if (preview.querySelector('.cover-upload-icon')) preview.querySelector('.cover-upload-icon').style.display = 'none';
    if (preview.querySelector('.cover-upload-text')) preview.querySelector('.cover-upload-text').style.display = 'none';
    clearBtn.style.display = 'block';
  } else {
    preview.style.backgroundImage = '';
    if (preview.querySelector('.cover-upload-icon')) preview.querySelector('.cover-upload-icon').style.display = '';
    if (preview.querySelector('.cover-upload-text')) preview.querySelector('.cover-upload-text').style.display = '';
    clearBtn.style.display = 'none';
  }
}

/* ===================== MODALS ===================== */
let selectedColor = '#6B8F71';
let selectedStatus = 'not_started';
let editColor = '#6B8F71';
let editStatus = 'not_started';
let currentFilter = 'all';

function openAddModal() {
  selectedColor = '#6B8F71';
  selectedStatus = 'not_started';
  selectedCoverImage = null;
  document.getElementById('bookTitle').value = '';
  document.getElementById('bookAuthor').value = '';
  resetImageUpload('coverUploadPreview', 'coverImageClear', 'coverImageInput');
  document.querySelectorAll('#colorPicker .color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === selectedColor);
  });
  document.querySelectorAll('#statusPicker .status-opt').forEach(s => {
    s.classList.toggle('selected', s.dataset.status === selectedStatus);
  });
  document.getElementById('addModal').classList.add('open');
  setTimeout(() => document.getElementById('bookTitle').focus(), 300);
}

function closeAddModal() {
  document.getElementById('addModal').classList.remove('open');
}

function openEditModal(id) {
  const book = books.find(b => b.id === id);
  if (!book) return;
  editingId = id;
  editColor = book.color;
  editStatus = book.status;
  editCoverImage = book.coverImage || null;

  document.getElementById('editTitle').value = book.title;
  document.getElementById('editAuthor').value = book.author || '';

  loadImageIntoUpload(book.coverImage, 'editCoverUploadPreview', 'editCoverImageClear');
  document.getElementById('editCoverImageInput').value = '';

  document.querySelectorAll('#editColorPicker .color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === editColor);
  });
  document.querySelectorAll('#editStatusPicker .status-opt').forEach(s => {
    s.classList.toggle('selected', s.dataset.status === editStatus);
  });
  document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
  editingId = null;
}

/* ===================== EVENT LISTENERS ===================== */
function initEvents() {
  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const page = document.getElementById(`page-${tab.dataset.page}`);
      page.classList.add('active');

      if (tab.dataset.page === 'manage') {
        renderManage(currentFilter);
        updateArrows(0, 0);
      } else {
        const panels = getShelfPanels();
        const current = getCurrentPanel();
        updateArrows(current, panels.length);
      }
    };
  });

  // Add book button
  document.getElementById('openAddModal').onclick = openAddModal;
  document.getElementById('closeAddModal').onclick = closeAddModal;
  document.getElementById('cancelAdd').onclick = closeAddModal;

  // Close modals on overlay click
  document.getElementById('addModal').onclick = (e) => {
    if (e.target === document.getElementById('addModal')) closeAddModal();
  };
  document.getElementById('editModal').onclick = (e) => {
    if (e.target === document.getElementById('editModal')) closeEditModal();
  };

  // Image upload
  setupImageUpload('coverImageInput', 'coverUploadPreview', 'coverImageClear', (dataUrl) => {
    selectedCoverImage = dataUrl;
  });
  setupImageUpload('editCoverImageInput', 'editCoverUploadPreview', 'editCoverImageClear', (dataUrl) => {
    editCoverImage = dataUrl;
  });

  // Color pickers
  document.querySelectorAll('#colorPicker .color-swatch').forEach(s => {
    s.onclick = () => {
      selectedColor = s.dataset.color;
      document.querySelectorAll('#colorPicker .color-swatch').forEach(x => x.classList.remove('selected'));
      s.classList.add('selected');
    };
  });

  document.querySelectorAll('#editColorPicker .color-swatch').forEach(s => {
    s.onclick = () => {
      editColor = s.dataset.color;
      document.querySelectorAll('#editColorPicker .color-swatch').forEach(x => x.classList.remove('selected'));
      s.classList.add('selected');
    };
  });

  // Status pickers
  document.querySelectorAll('#statusPicker .status-opt').forEach(s => {
    s.onclick = () => {
      selectedStatus = s.dataset.status;
      document.querySelectorAll('#statusPicker .status-opt').forEach(x => x.classList.remove('selected'));
      s.classList.add('selected');
    };
  });

  document.querySelectorAll('#editStatusPicker .status-opt').forEach(s => {
    s.onclick = () => {
      editStatus = s.dataset.status;
      document.querySelectorAll('#editStatusPicker .status-opt').forEach(x => x.classList.remove('selected'));
      s.classList.add('selected');
    };
  });

  // Save new book
  document.getElementById('saveBook').onclick = () => {
    const title = document.getElementById('bookTitle').value.trim();
    if (!title) {
      document.getElementById('bookTitle').focus();
      document.getElementById('bookTitle').style.borderColor = '#C0392B';
      setTimeout(() => document.getElementById('bookTitle').style.borderColor = '', 1000);
      return;
    }
    const author = document.getElementById('bookAuthor').value;
    addBook(title, author, selectedColor, selectedStatus, selectedCoverImage);
    closeAddModal();
    renderShelf();
    if (document.getElementById('page-manage').classList.contains('active')) {
      renderManage(currentFilter);
    }
  };

  // Save edited book
  document.getElementById('updateBook').onclick = () => {
    const title = document.getElementById('editTitle').value.trim();
    if (!title || !editingId) return;
    const author = document.getElementById('editAuthor').value;
    updateBook(editingId, title, author, editColor, editStatus, editCoverImage);
    closeEditModal();
    renderShelf();
    renderManage(currentFilter);
  };

  // Delete book
  document.getElementById('deleteBook').onclick = () => {
    if (!editingId) return;
    if (confirm('Remove this book from your library?')) {
      deleteBook(editingId);
      closeEditModal();
      renderShelf();
      renderManage(currentFilter);
    }
  };

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderManage(currentFilter);
    };
  });

  // Edit modal close
  document.getElementById('closeEditModal').onclick = closeEditModal;

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAddModal();
      closeEditModal();
    }
    if (e.key === 'ArrowLeft' && document.getElementById('page-home').classList.contains('active')) {
      scrollShelf(-1);
    }
    if (e.key === 'ArrowRight' && document.getElementById('page-home').classList.contains('active')) {
      scrollShelf(1);
    }
  });
}

/* ===================== INIT ===================== */
function init() {
  loadBooks();
  initPageDots();
  initArrows();
  initEvents();
  renderShelf();
}

document.addEventListener('DOMContentLoaded', init);

/* ===================== SERVICE WORKER REGISTRATION ===================== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('BookShelf SW registered:', reg.scope))
      .catch(err => console.log('SW error:', err));
  });
}