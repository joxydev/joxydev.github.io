// translations.js — simple UI translations for common keys across pages
(function(){
  const key = 'site_lang';
  const translations = {
    en: {
      back: '← Back',
      voice_title: 'Voice Translation — Demo',
      start_record: 'Start recording',
      stop_record: 'Stop recording',
      speak: 'Play translation',
      clear: 'Clear',
      monitor_title: 'Live Monitor (Demo)',
      results_label: 'Results:',
      server_alt: 'If the browser shows CORS/network errors, run the server monitor (no CORS restrictions):',
      crypto_title: 'Crypto Tracker (Demo)',
      fetch_now: 'Fetch Now',
      clear_history: 'Clear History',
      text_analyzer_title: 'Text Analyzer (Demo)',
      check_btn: 'Check',
      apply_all: 'Apply All',
      copy: 'Copy',
      download: 'Download'
    },
    ru: {
      back: '← Назад',
      voice_title: 'Голосовой переводчик — Demo',
      start_record: 'Начать запись',
      stop_record: 'Остановить запись',
      speak: 'Воспроизвести перевод',
      clear: 'Очистить',
      monitor_title: 'Live Monitor (Demo)',
      results_label: 'Результаты:',
      server_alt: 'Если браузер показывает CORS/сетевые ошибки, запустите серверный монитор (нет ограничений CORS):',
      crypto_title: 'Crypto Tracker (Demo)',
      fetch_now: 'Получить',
      clear_history: 'Очистить историю',
      text_analyzer_title: 'Text Analyzer (Demo)',
      check_btn: 'Проверить',
      apply_all: 'Применить всё',
      copy: 'Копировать',
      download: 'Скачать'
    },
    ro: {
      back: '← Înapoi',
      voice_title: 'Traducere vocală — Demo',
      start_record: 'Începe înregistrarea',
      stop_record: 'Oprește înregistrarea',
      speak: 'Redă traducerea',
      clear: 'Curăță',
      monitor_title: 'Live Monitor (Demo)',
      results_label: 'Rezultate:',
      server_alt: 'Dacă browserul arată erori CORS/rețea, rulați monitorul server (fără restricții CORS):',
      crypto_title: 'Crypto Tracker (Demo)',
      fetch_now: 'Preia acum',
      clear_history: 'Șterge istoricul',
      text_analyzer_title: 'Text Analyzer (Demo)',
      check_btn: 'Verifică',
      apply_all: 'Aplică tot',
      copy: 'Copiază',
      download: 'Descarcă'
    }
  };

  function setLang(lang){
    if (!translations[lang]) lang = 'en';
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const key = el.dataset.i18n;
      if (!key) return;
      const str = translations[lang][key];
      if (str === undefined) return;
      if (el.placeholder !== undefined && el.dataset.i18nPlaceholder) el.placeholder = str;
      else el.textContent = str;
    });
    document.querySelectorAll('.lang-btn').forEach(b=>b.classList.toggle('active', b.dataset.lang===lang));
    localStorage.setItem(key, lang);
  }

  function init(){
    const stored = localStorage.getItem(key);
    const lang = stored && translations[stored] ? stored : 'en';
    document.querySelectorAll('.lang-btn').forEach(btn=>{
      btn.addEventListener('click', ()=> setLang(btn.dataset.lang));
    });
    setLang(lang);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
