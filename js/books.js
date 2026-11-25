// Free book finder using the Open Library Search API.
// Docs: https://openlibrary.org/dev/docs/api/search

const BOOKS_PER_PAGE = 24;

const languageNames = {
  eng: "English", fre: "French", spa: "Spanish", ger: "German", por: "Portuguese",
  ita: "Italian", swa: "Swahili", ara: "Arabic", chi: "Chinese", rus: "Russian",
  dut: "Dutch", jpn: "Japanese", lat: "Latin", hin: "Hindi", kin: "Kinyarwanda"
};

const bookState = {
  query: "",
  searchBy: "q",
  page: 1,
  totalFound: 0,
  books: [] // every book loaded for the current search
};

let savedBooks = loadData("studyshelf-saved", []);

// Build the Open Library URL from what the user picked.
function buildBookURL() {
  const freeOnly = document.getElementById("free-only").checked;
  const sort = document.getElementById("book-sort").value;

  const params = new URLSearchParams();
  let mainQuery = bookState.searchBy === "q" ? bookState.query : "";
  if (freeOnly) {
    mainQuery = (mainQuery + " ebook_access:public").trim();
  }
  if (mainQuery) params.set("q", mainQuery);
  if (bookState.searchBy !== "q") params.set(bookState.searchBy, bookState.query);
  if (sort) params.set("sort", sort);
  params.set("page", bookState.page);
  params.set("limit", BOOKS_PER_PAGE);
  params.set("fields", "key,title,author_name,first_publish_year,cover_i,ebook_access,ia,language,edition_count,subject");

  return "https://openlibrary.org/search.json?" + params.toString();
}

// Start a new search (page 1).
async function searchBooks() {
  const input = document.getElementById("book-query");
  const query = input.value.trim();
  const status = document.getElementById("book-status");

  if (query.length < 2) {
    showStatus(status, "Please type at least 2 characters to search.", "error");
    input.focus();
    return;
  }

  bookState.query = query;
  bookState.searchBy = document.getElementById("search-by").value;
  bookState.page = 1;
  bookState.books = [];
  document.getElementById("book-filter").value = "";
  document.getElementById("book-results").innerHTML = "";
  await loadBooks();
}

// Load one page of results and add it to the list.
async function loadBooks() {
  const status = document.getElementById("book-status");
  const moreButton = document.getElementById("load-more");
  showStatus(status, "Searching Open Library...");
  moreButton.classList.add("hidden");

  try {
    const data = await getJSON(buildBookURL());
    if (!data || !Array.isArray(data.docs)) {
      throw new Error("Open Library sent an unexpected answer. Please try again.");
    }
    bookState.totalFound = data.numFound || 0;
    bookState.books = bookState.books.concat(data.docs);

    if (bookState.books.length === 0) {
      const freeOnly = document.getElementById("free-only").checked;
      showStatus(status, "No books found for \"" + bookState.query + "\"." +
        (freeOnly ? " Try unticking \"Free to read online only\" or use a different word." : " Try a different word."), "error");
      return;
    }

    fillLanguageFilter();
    showBooks();
    if (bookState.books.length < bookState.totalFound) {
      moreButton.classList.remove("hidden");
    }
  } catch (error) {
    showStatus(status, error.message, "error");
  }
}

// Fill the language dropdown with the languages found in the results.
function fillLanguageFilter() {
  const select = document.getElementById("book-lang");
  const current = select.value;
  const codes = new Set();
  bookState.books.forEach(book => (book.language || []).forEach(code => codes.add(code)));

  let options = '<option value="">All languages</option>';
  Array.from(codes).sort().forEach(code => {
    const name = languageNames[code] || code;
    options += '<option value="' + escapeHTML(code) + '">' + escapeHTML(name) + "</option>";
  });
  select.innerHTML = options;
  if (codes.has(current)) select.value = current;
}

// Apply the language and text filters, then draw the cards.
function showBooks() {
  const lang = document.getElementById("book-lang").value;
  const text = document.getElementById("book-filter").value.trim().toLowerCase();

  const visible = bookState.books.filter(book => {
    if (lang && !(book.language || []).includes(lang)) return false;
    if (text) {
      const words = (book.title + " " + (book.author_name || []).join(" ")).toLowerCase();
      if (!words.includes(text)) return false;
    }
    return true;
  });

  document.getElementById("book-results").innerHTML = visible.map(bookCard).join("");
  showStatus(document.getElementById("book-status"),
    "Showing " + visible.length + " of " + bookState.books.length + " loaded books (" +
    bookState.totalFound.toLocaleString() + " found in total).", "success");
}

// The link where a student can read or find the book.
function readLink(book) {
  if (book.ebook_access === "public" && book.ia && book.ia.length) {
    return "https://archive.org/details/" + encodeURIComponent(book.ia[0]);
  }
  return "https://openlibrary.org" + book.key;
}

function accessLabel(access) {
  if (access === "public") return '<span class="badge free">Free to read</span>';
  if (access === "borrowable") return '<span class="badge borrow">Free to borrow</span>';
  return '<span class="badge none">Info only</span>';
}

// HTML for one book card.
function bookCard(book) {
  const isSaved = savedBooks.some(saved => saved.key === book.key);
  const cover = book.cover_i
    ? '<img src="https://covers.openlibrary.org/b/id/' + Number(book.cover_i) + '-M.jpg" alt="Cover of ' + escapeHTML(book.title) + '" loading="lazy">'
    : '<div class="no-cover">No cover</div>';
  const authors = (book.author_name || ["Unknown author"]).slice(0, 2).join(", ");
  const subjects = (book.subject || []).slice(0, 3).join(" · ");

  return '<article class="book">' + cover +
    '<div class="book-info">' +
      "<h3>" + escapeHTML(book.title) + "</h3>" +
      '<p class="author">' + escapeHTML(authors) + "</p>" +
      '<p class="meta">' + (book.first_publish_year ? "First published " + book.first_publish_year : "Year unknown") +
        " · " + (book.edition_count || 1) + " edition(s)</p>" +
      (subjects ? '<p class="subjects">' + escapeHTML(subjects) + "</p>" : "") +
      accessLabel(book.ebook_access) +
      '<div class="row">' +
        '<a class="button" href="' + escapeHTML(readLink(book)) + '" target="_blank" rel="noopener">' +
          (book.ebook_access === "public" ? "Read now" : "View book") + "</a>" +
        '<button class="secondary save-btn" data-key="' + escapeHTML(book.key) + '">' +
          (isSaved ? "Remove" : "Save") + "</button>" +
      "</div>" +
    "</div></article>";
}

// Save or remove a book from the reading list.
function toggleSave(key) {
  if (savedBooks.some(book => book.key === key)) {
    savedBooks = savedBooks.filter(book => book.key !== key);
  } else {
    const book = bookState.books.find(b => b.key === key);
    if (book) savedBooks.push(book);
  }
  saveData("studyshelf-saved", savedBooks);
  if (bookState.books.length) showBooks();
  showSavedBooks();
}

function showSavedBooks() {
  document.getElementById("saved-count").textContent = savedBooks.length;
  document.getElementById("saved-results").innerHTML = savedBooks.map(bookCard).join("");
  showStatus(document.getElementById("saved-status"), savedBooks.length
    ? "You have " + savedBooks.length + " book(s) saved. They stay here on this device."
    : "Your reading list is empty. Press \"Save\" on any book to keep it here.");
}

function setupBooks() {
  document.getElementById("book-form").addEventListener("submit", event => {
    event.preventDefault();
    searchBooks();
  });

  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.getElementById("search-by").value = "q";
      document.getElementById("book-query").value = chip.dataset.term;
      searchBooks();
    });
  });

  // Changing these needs new data from the API.
  ["free-only", "book-sort"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      if (bookState.query) searchBooks();
    });
  });

  // These only filter what is already loaded.
  document.getElementById("book-lang").addEventListener("change", showBooks);
  document.getElementById("book-filter").addEventListener("input", () => {
    if (bookState.books.length) showBooks();
  });

  document.getElementById("load-more").addEventListener("click", () => {
    bookState.page += 1;
    loadBooks();
  });

  // One click listener for every Save/Remove button.
  document.querySelector("main").addEventListener("click", event => {
    const button = event.target.closest(".save-btn");
    if (button) toggleSave(button.dataset.key);
  });

  showSavedBooks();
}
