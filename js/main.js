// Starts the app and handles switching between tabs.

function openTab(name) {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  document.querySelectorAll(".panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === name);
  });
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => openTab(tab.dataset.tab));
});

window.addEventListener("offline", () => {
  alert("You are offline. Searches and quizzes need an internet connection.");
});

setupBooks();
setupQuiz();
