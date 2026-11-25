// Quiz practice using the Open Trivia Database API.
// Docs: https://opentdb.com/api_config.php

// Subjects that are most useful for studying are listed first.
const STUDY_CATEGORIES = [9, 17, 18, 19, 22, 23, 24, 25, 10, 20, 27, 30];

// Meaning of the response_code Open Trivia DB sends back.
const TRIVIA_ERRORS = {
  1: "There are not enough questions for these settings. Try fewer questions or a different difficulty.",
  2: "Some quiz settings were not valid. Please pick again.",
  3: "Session expired. Please start the quiz again.",
  4: "You have answered every question for these settings. Try a different subject or difficulty.",
  5: "Too many requests. Please wait 5 seconds and try again."
};

const quiz = {
  questions: [],
  current: 0,
  score: 0,
  answers: [], // what the user picked for each question
  categoryName: "",
  difficulty: ""
};

let history = loadData("studyshelf-history", []);
let historySort = { field: "date", ascending: false };

// Open Trivia DB returns text encoded with encodeURIComponent when we ask for url3986.
function decode(text) {
  try {
    return decodeURIComponent(text);
  } catch (e) {
    return text;
  }
}

// Put answers in a random order.
function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadCategories() {
  const select = document.getElementById("quiz-category");
  const status = document.getElementById("quiz-status");
  try {
    const data = await getJSON("https://opentdb.com/api_category.php");
    const categories = data.trivia_categories;
    if (!Array.isArray(categories) || categories.length === 0) {
      throw new Error("No subjects came back from the quiz server.");
    }
    const study = categories.filter(c => STUDY_CATEGORIES.includes(c.id));
    const other = categories.filter(c => !STUDY_CATEGORIES.includes(c.id));
    const option = c => '<option value="' + c.id + '">' + escapeHTML(c.name) + "</option>";

    select.innerHTML = '<option value="">Any subject</option>' +
      '<optgroup label="Study subjects">' + study.map(option).join("") + "</optgroup>" +
      '<optgroup label="Other">' + other.map(option).join("") + "</optgroup>";
    showStatus(status, "");
  } catch (error) {
    select.innerHTML = '<option value="">Any subject</option>';
    showStatus(status, "Could not load the subject list (" + error.message + ") You can still start a quiz on any subject.", "error");
  }
}

// Show how many questions exist for the chosen subject.
async function showCategoryInfo() {
  const id = document.getElementById("quiz-category").value;
  const info = document.getElementById("category-info");
  if (!id) {
    info.textContent = "";
    return;
  }
  try {
    const data = await getJSON("https://opentdb.com/api_count.php?category=" + encodeURIComponent(id));
    const c = data.category_question_count;
    info.textContent = c.total_question_count + " questions available: " +
      c.total_easy_question_count + " easy, " + c.total_medium_question_count + " medium, " +
      c.total_hard_question_count + " hard.";
  } catch (error) {
    info.textContent = "";
  }
}

async function startQuiz() {
  const status = document.getElementById("quiz-status");
  const button = document.getElementById("start-quiz");
  const categorySelect = document.getElementById("quiz-category");
  const amount = parseInt(document.getElementById("quiz-amount").value, 10);
  const category = categorySelect.value;
  const difficulty = document.getElementById("quiz-difficulty").value;
  const type = document.getElementById("quiz-type").value;

  // Input validation before calling the API.
  if (!(amount >= 1 && amount <= 50)) {
    showStatus(status, "Please choose between 1 and 50 questions.", "error");
    return;
  }

  const params = new URLSearchParams({ amount: amount, encode: "url3986" });
  if (category) params.set("category", category);
  if (difficulty) params.set("difficulty", difficulty);
  if (type) params.set("type", type);

  button.disabled = true;
  showStatus(status, "Loading questions...");
  try {
    // No cache here so every quiz gets fresh questions.
    const data = await getJSON("https://opentdb.com/api.php?" + params.toString(), false);
    if (data.response_code !== 0) {
      throw new Error(TRIVIA_ERRORS[data.response_code] || "The quiz server sent an unknown error.");
    }

    quiz.questions = data.results.map(q => ({
      category: decode(q.category),
      difficulty: decode(q.difficulty),
      question: decode(q.question),
      correct: decode(q.correct_answer),
      options: q.type === "boolean"
        ? ["True", "False"]
        : shuffle([q.correct_answer].concat(q.incorrect_answers).map(decode))
    }));
    quiz.current = 0;
    quiz.score = 0;
    quiz.answers = [];
    quiz.categoryName = category ? categorySelect.options[categorySelect.selectedIndex].text : "Any subject";
    quiz.difficulty = difficulty || "any";

    showStatus(status, "");
    document.getElementById("quiz-setup").classList.add("hidden");
    document.getElementById("quiz-result").classList.add("hidden");
    document.getElementById("quiz-play").classList.remove("hidden");
    showQuestion();
  } catch (error) {
    showStatus(status, error.message, "error");
  } finally {
    // Open Trivia DB allows one request every 5 seconds per user.
    setTimeout(() => { button.disabled = false; }, 5000);
  }
}

function showQuestion() {
  const q = quiz.questions[quiz.current];
  const total = quiz.questions.length;

  document.getElementById("progress-bar").style.width = (quiz.current / total * 100) + "%";
  document.getElementById("question-meta").textContent =
    "Question " + (quiz.current + 1) + " of " + total + " · " + q.category + " · " + q.difficulty +
    " · Score: " + quiz.score;
  document.getElementById("question-text").textContent = q.question;
  document.getElementById("feedback").textContent = "";
  document.getElementById("next-question").classList.add("hidden");

  document.getElementById("answers").innerHTML = q.options.map(option =>
    '<button class="answer" data-answer="' + escapeHTML(option) + '">' + escapeHTML(option) + "</button>"
  ).join("");
}

function chooseAnswer(button) {
  const q = quiz.questions[quiz.current];
  const picked = button.dataset.answer;
  const isCorrect = picked === q.correct;
  const feedback = document.getElementById("feedback");

  quiz.answers.push(picked);
  if (isCorrect) quiz.score++;

  // Lock all buttons and colour the right and wrong answers.
  document.querySelectorAll(".answer").forEach(b => {
    b.disabled = true;
    if (b.dataset.answer === q.correct) b.classList.add("correct");
  });
  if (!isCorrect) button.classList.add("wrong");

  feedback.textContent = isCorrect ? "Correct!" : "Not quite. The answer is: " + q.correct;
  feedback.className = isCorrect ? "good" : "bad";

  const next = document.getElementById("next-question");
  next.textContent = quiz.current + 1 < quiz.questions.length ? "Next question" : "See my results";
  next.classList.remove("hidden");
  next.focus();
}

function nextQuestion() {
  quiz.current++;
  if (quiz.current < quiz.questions.length) {
    showQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  const total = quiz.questions.length;
  const percent = Math.round(quiz.score / total * 100);

  document.getElementById("progress-bar").style.width = "100%";
  document.getElementById("quiz-play").classList.add("hidden");
  document.getElementById("quiz-result").classList.remove("hidden");
  document.getElementById("score-text").textContent = "You scored " + quiz.score + " / " + total + " (" + percent + "%)";

  let message = "Keep going! Read up on this subject and try again.";
  if (percent >= 80) message = "Excellent work, you know this subject well!";
  else if (percent >= 50) message = "Good job! A bit more practice and you will master it.";
  document.getElementById("score-message").textContent = message;

  // Hide the "find books" button when no single subject was chosen.
  document.getElementById("find-books").classList.toggle("hidden", quiz.categoryName === "Any subject");

  document.getElementById("only-wrong").checked = false;
  showReview();

  history.push({
    date: new Date().toISOString(),
    category: quiz.categoryName,
    difficulty: quiz.difficulty,
    score: quiz.score,
    total: total,
    percent: percent
  });
  saveData("studyshelf-history", history);
  showHistory();
}

function showReview() {
  const onlyWrong = document.getElementById("only-wrong").checked;
  const items = quiz.questions.map((q, i) => {
    const right = quiz.answers[i] === q.correct;
    if (onlyWrong && right) return "";
    return '<li class="' + (right ? "good" : "bad") + '">' +
      "<strong>" + escapeHTML(q.question) + "</strong><br>" +
      "Your answer: " + escapeHTML(quiz.answers[i]) +
      (right ? " ✓" : " ✗ · Correct answer: " + escapeHTML(q.correct)) + "</li>";
  }).join("");
  document.getElementById("review-list").innerHTML = items || "<li>No wrong answers. Perfect score!</li>";
}

// Draw the history table, sorted by the column the user clicked.
function showHistory() {
  const { field, ascending } = historySort;
  const sorted = history.slice().sort((a, b) => {
    const x = a[field], y = b[field];
    const result = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
    return ascending ? result : -result;
  });

  document.getElementById("history-body").innerHTML = sorted.length
    ? sorted.map(h => "<tr><td>" + new Date(h.date).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) + "</td><td>" + escapeHTML(h.category) +
        "</td><td>" + escapeHTML(h.difficulty) + "</td><td>" + h.score + "/" + h.total + " (" + h.percent + "%)</td></tr>").join("")
    : '<tr><td colspan="4">No quizzes yet. Your scores will show up here.</td></tr>';

  const summary = document.getElementById("history-summary");
  if (history.length) {
    const average = Math.round(history.reduce((sum, h) => sum + h.percent, 0) / history.length);
    const best = Math.max(...history.map(h => h.percent));
    summary.textContent = history.length + " quiz(zes) taken · Average " + average + "% · Best " + best + "%. Click a column title to sort.";
  } else {
    summary.textContent = "";
  }

  showChart();

  document.querySelectorAll("th[data-sort]").forEach(th => {
    th.classList.toggle("sorted", th.dataset.sort === field);
    th.dataset.arrow = th.dataset.sort === field ? (ascending ? "▲" : "▼") : "";
  });
}

// Bar chart of the last 10 quizzes (oldest on the left) so progress is easy to see.
function showChart() {
  const chart = document.getElementById("score-chart");
  const last = history.slice(-10);
  if (!last.length) {
    chart.innerHTML = "";
    return;
  }
  chart.innerHTML = last.map(h => {
    const level = h.percent >= 80 ? "high" : h.percent >= 50 ? "mid" : "low";
    const label = h.category.split(":").pop().trim();
    return '<div class="bar-col" title="' + escapeHTML(h.category + " - " + h.percent + "%") + '">' +
      '<span class="bar-value">' + h.percent + "%</span>" +
      '<div class="bar ' + level + '" style="height:' + Math.max(h.percent, 3) + '%"></div>' +
      '<span class="bar-label">' + escapeHTML(label) + "</span></div>";
  }).join("");
}

function setupQuiz() {
  loadCategories();
  showHistory();

  document.getElementById("quiz-category").addEventListener("change", showCategoryInfo);
  document.getElementById("start-quiz").addEventListener("click", startQuiz);
  document.getElementById("next-question").addEventListener("click", nextQuestion);
  document.getElementById("only-wrong").addEventListener("change", showReview);

  document.getElementById("answers").addEventListener("click", event => {
    const button = event.target.closest(".answer");
    if (button && !button.disabled) chooseAnswer(button);
  });

  document.getElementById("play-again").addEventListener("click", () => {
    document.getElementById("quiz-result").classList.add("hidden");
    document.getElementById("quiz-setup").classList.remove("hidden");
  });

  // Jump to the book finder with the quiz subject, e.g. "Science: Computers" -> "Computers".
  document.getElementById("find-books").addEventListener("click", () => {
    const subject = quiz.categoryName.split(":").pop().trim();
    document.getElementById("search-by").value = "q";
    document.getElementById("book-query").value = subject;
    openTab("books");
    searchBooks();
  });

  document.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      if (historySort.field === th.dataset.sort) {
        historySort.ascending = !historySort.ascending;
      } else {
        historySort = { field: th.dataset.sort, ascending: true };
      }
      showHistory();
    });
  });

  document.getElementById("clear-history").addEventListener("click", () => {
    if (confirm("Delete all your saved quiz scores?")) {
      history = [];
      saveData("studyshelf-history", history);
      showHistory();
    }
  });
}
