const $ = id => document.getElementById(id);

const toggleBtn = $('toggleRec');
const statusEl = $('status');
const recognizedEl = $('recognized');
const translatedEl = $('translated');
const speakBtn = $('speakBtn');
const clearBtn = $('clearBtn');
const sourceLangSel = $('sourceLang');
const targetLangSel = $('targetLang');
const voiceSelect = $('voiceSelect');

let recognition, recognizing = false;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.interimResults = false;
  recognition.lang = 'ru-RU';

  recognition.onstart = () => { recognizing = true; statusEl.textContent = 'Запись...'; toggleBtn.textContent = 'Остановить'; };
  recognition.onend = () => { recognizing = false; statusEl.textContent = 'Готов'; toggleBtn.textContent = 'Начать запись'; };

  recognition.onresult = async (evt) => {
    const t = Array.from(evt.results).map(r=>r[0].transcript).join(' ');
    recognizedEl.value = t;
    try {
      const src = sourceLangSel.value === 'auto' ? 'auto' : sourceLangSel.value;
      const tgt = targetLangSel.value;
      translatedEl.value = 'Переводится...';
      const tr = await translateText(t, src, tgt);
      translatedEl.value = tr;
    } catch (err) {
      translatedEl.value = 'Ошибка перевода: ' + (err.message||err);
    }
  };
} else {
  statusEl.textContent = 'Web Speech API не поддерживается в этом браузере';
  toggleBtn.disabled = true;
}

toggleBtn.addEventListener('click', ()=>{
  if (!recognition) return;
  if (recognizing) {
    recognition.stop();
  } else {
    const lang = sourceLangSel.value === 'auto' ? 'ru-RU' : (sourceLangSel.value+'-'+sourceLangSel.value.toUpperCase());
    recognition.lang = lang;
    recognition.start();
  }
});

clearBtn.addEventListener('click', ()=>{ recognizedEl.value=''; translatedEl.value=''; });

speakBtn.addEventListener('click', ()=>{
  const text = translatedEl.value.trim();
  if (!text) return;
  const lang = targetLangSel.value;
  if (!('speechSynthesis' in window)) return alert('SpeechSynthesis не поддерживается в этом браузере');
  const utter = new SpeechSynthesisUtterance(text);
  // normalize to BCP47 for TTS where possible (e.g. 'ru' -> 'ru-RU')
  const ttsLang = (lang && lang.length===2) ? (lang + '-' + lang.toUpperCase()) : lang;
  utter.lang = ttsLang;
  const selected = voiceSelect.value;
  if (selected) {
    const v = speechSynthesis.getVoices().find(x=>x.name === selected);
    if (v) utter.voice = v;
  }
  speechSynthesis.speak(utter);
});

async function translateText(text, source, target){
  const endpoint = 'https://libretranslate.de/translate';
  const body = { q: text, source: source==='auto'? 'auto' : source, target, format: 'text' };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>res.statusText||res.status);
    if (res.status === 0) throw new Error('Ошибка сети или CORS. Попробуйте запустить локальный прокси или свой экземпляр LibreTranslate.');
    throw new Error(txt || res.statusText || res.status);
  }
  const data = await res.json();
  return data.translatedText || '';
}

// Populate available voices for TTS and persist selection
function populateVoices(){
  if (!('speechSynthesis' in window)) {
    voiceSelect.innerHTML = '<option value="">(TTS не поддерживается)</option>';
    voiceSelect.disabled = true;
    return;
  }
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return; // will be retried on voiceschanged
  const saved = localStorage.getItem('vt_voice') || '';
  voiceSelect.innerHTML = '';
  voices.forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} — ${v.lang}`;
    if (v.name === saved) opt.selected = true;
    voiceSelect.appendChild(opt);
  });
}

voiceSelect.addEventListener('change', ()=>{
  localStorage.setItem('vt_voice', voiceSelect.value);
});

if ('speechSynthesis' in window) {
  populateVoices();
  window.speechSynthesis.onvoiceschanged = populateVoices;
}

// populate language selects from shared list if available
function populateLanguageSelects(){
  try{
    const libs = window.DEMO_LANGS && window.DEMO_LANGS.libre ? window.DEMO_LANGS.libre : null;
    if (!libs) return;
    // source: keep an "auto" option
    sourceLangSel.innerHTML = '';
    const auto = document.createElement('option'); auto.value='auto'; auto.textContent='Auto (auto)';
    sourceLangSel.appendChild(auto);
    libs.forEach(l=>{
      const o = document.createElement('option'); o.value = l.code; o.textContent = l.name;
      if (l.code === 'ru') o.selected = true;
      sourceLangSel.appendChild(o);
    });
    // target
    targetLangSel.innerHTML = '';
    libs.forEach(l=>{
      const o = document.createElement('option'); o.value = l.code; o.textContent = l.name;
      if (l.code === 'ru') o.selected = true;
      targetLangSel.appendChild(o);
    });
  }catch(e){/* ignore */}
}

populateLanguageSelects();
