/*
 * Early theme applicator (light/dark) to avoid FOUC.
 * Reads localStorage 'theme' or OS preference and sets data-bs-theme on <html>.
 */
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored ? stored : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-bs-theme', theme);
  } catch (e) {}
})();
