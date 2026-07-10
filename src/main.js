const year = document.querySelector("#current-year");

if (year) {
  year.textContent = String(new Date().getFullYear());
}
