// theme.js — simple theme toggle, persists 'theme' in localStorage
(function(){
  const key = 'site_theme';
  const root = document.documentElement;

  function apply(theme){
    if (theme === 'light') root.setAttribute('data-theme','light');
    else root.removeAttribute('data-theme');
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.setAttribute('data-icon', theme === 'light' ? '🌞' : '🌙');
      btn.textContent = '';
    }
  }

  function toggle(){
    const cur = localStorage.getItem(key) === 'light' ? 'light' : 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    localStorage.setItem(key,next);
    apply(next);
  }

  function ensureButton(){
    let btn = document.getElementById('themeToggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'themeToggle';
      btn.setAttribute('aria-label','Toggle theme');
      document.body.appendChild(btn);
    }
    return btn;
  }

  function init(){
    const stored = localStorage.getItem(key);
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const saved = stored === 'light' || stored === 'dark' ? stored : (prefersLight ? 'light' : 'dark');
    const btn = ensureButton();
    apply(saved);
    btn.addEventListener('click', toggle);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
