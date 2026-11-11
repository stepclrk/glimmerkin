// A browser that has played before goes straight to the game. /?home shows this page anyway.
(() => {
  let played = false, signedIn = false;
  try { played = !!localStorage.getItem('glimmerkin.v1'); signedIn = !!localStorage.getItem('glimmerkin.account'); } catch (e) { }
  if (played && !/[?&]home\b/.test(location.search)) { location.replace('/play'); return; }
  if (signedIn) document.addEventListener('DOMContentLoaded', () => { const a = document.getElementById('nav-account'); a.textContent = 'Your account'; a.href = '/account'; });
})();
