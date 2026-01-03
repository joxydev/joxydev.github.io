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
const apiEndpointInput = $('apiEndpoint');
const saveEndpointBtn = $('saveEndpoint');
const messageEl = $('message');
const pttBtn = $('pttBtn');
const autoStopTimeoutInput = $('autoStopTimeout');
const confidenceEl = $('confidence');
const retryBtn = $('retryBtn');
const retryStatus = $('retryStatus');
const testEndpointBtn = $('testEndpoint');
const ttsRate = $('ttsRate');
const ttsPitch = $('ttsPitch');
const ttsVolume = $('ttsVolume');
const ttsRateVal = $('ttsRateVal');
const ttsPitchVal = $('ttsPitchVal');
const ttsVolumeVal = $('ttsVolumeVal');
const autoVoice = $('autoVoice');
const playSampleBtn = $('playSample');
const historySearch = $('historySearch');
const historyList = $('historyList');
const exportJsonBtn = $('exportJsonBtn');
const exportTxtBtn = $('exportTxtBtn');
const clearHistoryBtn = $('clearHistoryBtn');
const sttEndpointInput = $('sttEndpoint');
const saveSttEndpointBtn = $('saveSttEndpoint');
const audioFileInput = $('audioFile');
const uploadAudioBtn = $('uploadAudioBtn');
const convertAudioBtn = $('convertAudioBtn');
const exportSrtBtn = $('exportSrtBtn');
const audioStatus = $('audioStatus');
const downloadLogsBtn = $('downloadLogsBtn');
const clearLogsBtn = $('clearLogsBtn');
const logsList = $('logsList');

let recognition, recognizing = false;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.interimResults = true;
  recognition.lang = (navigator.language || 'en-US');
  // auto-stop timer id
  let autoStopTimer = null;
  function clearAutoStop(){ if (autoStopTimer) { clearTimeout(autoStopTimer); autoStopTimer = null; } }
  function resetAutoStop(){
    clearAutoStop();
    const ms = parseInt(autoStopTimeoutInput && autoStopTimeoutInput.value, 10) || 1500;
    autoStopTimer = setTimeout(()=>{
      try { recognition.stop(); } catch(e){}
    }, ms);
  }

  recognition.onstart = () => { recognizing = true; statusEl.textContent = 'Запись...'; toggleBtn.textContent = 'Остановить'; };
  recognition.onend = () => { recognizing = false; statusEl.textContent = 'Готов'; toggleBtn.textContent = 'Начать запись'; clearAutoStop(); };

  recognition.onresult = async (evt) => {
    // Build final and interim transcripts
    let finalTranscript = '';
    let interimTranscript = '';
    let confidences = [];
    for (let i = 0; i < evt.results.length; i++) {
      const res = evt.results[i];
      const alt = res[0];
      if (res.isFinal) {
        finalTranscript += alt.transcript + ' ';
        if (typeof alt.confidence === 'number') confidences.push(alt.confidence);
      } else {
        interimTranscript += alt.transcript + ' ';
      }
    }
    // show final and interim separately
    if (finalTranscript.trim()) recognizedEl.value = finalTranscript.trim();
    const interimEl = document.getElementById('interim');
    if (interimEl) interimEl.textContent = interimTranscript.trim();

    // reset auto-stop on any incoming speech
    try{ resetAutoStop(); }catch(e){}

    // If a final result arrived, run translation
    if (finalTranscript.trim()) {
      try {
        const src = sourceLangSel.value === 'auto' ? 'auto' : sourceLangSel.value;
        const tgt = targetLangSel.value;
        translatedEl.value = 'Переводится...';
        const trRes = await doTranslateAndStore(finalTranscript.trim(), src, tgt);
        // save history entry
        try{
          addHistoryEntry({
            ts: new Date().toISOString(),
            source: src,
            target: tgt,
            detected: trRes.detectedLanguage || null,
            recognized: finalTranscript.trim(),
            translated: trRes.translatedText || '',
            confidence: (confidences.length ? (confidences.reduce((a,b)=>a+b,0)/confidences.length) : null),
            endpoint: (localStorage.getItem('vt_endpoint') || 'https://libretranslate.de/translate')
          });
        }catch(e){/* ignore history errors */}
        translatedEl.value = trRes.translatedText || '';
        if (trRes.detectedLanguage && sourceLangSel.value === 'auto') {
          const detEl = document.getElementById('detectedLang');
          if (detEl) detEl.textContent = 'Определённый язык: ' + trRes.detectedLanguage;
          showMessage('Определённый язык: ' + trRes.detectedLanguage, 'ok');
        }
        // display average confidence if available
        if (confidences.length && confidenceEl) {
          const avg = Math.round((confidences.reduce((a,b)=>a+b,0)/confidences.length)*100)/100;
          confidenceEl.textContent = 'Confidence: ' + avg;
        } else if (confidenceEl) {
          confidenceEl.textContent = 'Confidence: —';
        }
      } catch (err) {
        translatedEl.value = 'Ошибка перевода: ' + (err.message||err);
        showMessage('Ошибка перевода: ' + (err.message||err));
      }
    }
  };
  recognition.onspeechstart = () => { try{ resetAutoStop(); }catch(e){} };
  recognition.onspeechend = () => { /* speech paused — auto-stop will trigger */ };
  recognition.onerror = (ev) => {
    showMessage('Recognition error: ' + (ev.error || ev.message || ev));
  };
  recognition.onnomatch = () => {
    showMessage('Речь не распознана. Попробуйте говорить громче или проверить микрофон/разрешения.');
  };
} else {
  statusEl.textContent = 'Web Speech API не поддерживается в этом браузере';
  toggleBtn.disabled = true;
  showMessage('Ваш браузер не поддерживает Web Speech API. Попробуйте Chrome/Edge/Firefox Nightly. Проверьте, что сайт загружен по HTTPS или используйте localhost.');
}

toggleBtn.addEventListener('click', ()=>{
  if (!recognition) return;
  if (recognizing) {
    recognition.stop();
  } else {
    const lang = sourceLangSel.value === 'auto' ? 'ru-RU' : (sourceLangSel.value+'-'+sourceLangSel.value.toUpperCase());
    recognition.lang = lang;
    // Try to ensure microphone permission first (gives friendlier message on denial)
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream=>{
        // immediately stop the acquired stream - we only wanted the permission
        stream.getTracks().forEach(t=>t.stop());
        recognition.start();
        try{ resetAutoStop(); }catch(e){}
      }).catch(err=>{
        showMessage('Доступ к микрофону отклонён или отсутствует: ' + (err.message||err));
      });
    } else {
      // fallback - start anyway and let browser prompt
      recognition.start();
      try{ resetAutoStop(); }catch(e){}
    }
  }
});

// Push-to-talk (start on press, stop on release)
if (pttBtn) {
  const startPTT = () => {
    if (!recognition) return;
    if (recognizing) return;
    try {
      recognition.lang = (sourceLangSel.value === 'auto' ? (navigator.language||'en-US') : (sourceLangSel.value+'-'+sourceLangSel.value.toUpperCase()));
      recognition.start();
      resetAutoStop();
    } catch(e){ showMessage('Не удалось запустить распознавание: '+(e.message||e)); }
  };
  const stopPTT = () => {
    if (!recognition) return;
    try { recognition.stop(); } catch(e){}
  };
  pttBtn.addEventListener('mousedown', (e)=>{ e.preventDefault(); startPTT(); });
  pttBtn.addEventListener('mouseup', (e)=>{ e.preventDefault(); stopPTT(); });
  pttBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); startPTT(); });
  pttBtn.addEventListener('touchend', (e)=>{ e.preventDefault(); stopPTT(); });
}

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
  // apply advanced params
  utter.rate = parseFloat(localStorage.getItem('vt_tts_rate') || (ttsRate && ttsRate.value) || 1);
  utter.pitch = parseFloat(localStorage.getItem('vt_tts_pitch') || (ttsPitch && ttsPitch.value) || 1);
  utter.volume = parseFloat(localStorage.getItem('vt_tts_volume') || (ttsVolume && ttsVolume.value) || 1);
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
});

async function translateText(text, source, target){
  const endpoint = (localStorage.getItem('vt_endpoint') || 'https://libretranslate.de/translate');
  const body = { q: text, source: source==='auto'? 'auto' : source, target, format: 'text' };
  const maxRetries = 3;
  const baseDelay = 500;
  let lastErr = null;
  for (let attempt=1; attempt<=maxRetries; attempt++){
    try{
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok){
        const txt = await res.text().catch(()=>res.statusText||res.status);
        // Retry on server errors (5xx) or ambiguous network statuses
        if (res.status >= 500 || res.status === 0){
          lastErr = new Error(txt || res.statusText || res.status);
          // fall through to retry
        } else {
          // client error — don't retry
          throw new Error(txt || res.statusText || res.status);
        }
      } else {
        const data = await res.json();
        const detected = data.detectedLanguage || data.detected_language || data.detected || null;
        return { translatedText: (data.translatedText || ''), detectedLanguage: detected };
      }
    }catch(err){
      // network or CORS errors end up here — consider retrying
      lastErr = err;
    }
    // if we are here, we will retry (unless last attempt)
    if (attempt < maxRetries){
      const delay = baseDelay * Math.pow(2, attempt-1);
      await new Promise(r=>setTimeout(r, delay));
    }
  }
  // all retries exhausted
  throw new Error('Не удалось получить ответ от ' + endpoint + '. Последняя ошибка: ' + (lastErr && (lastErr.message||lastErr)));
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
  // if autoVoice enabled, try auto-select voice that matches target language
  try{
    const useAuto = localStorage.getItem('vt_auto_voice') === '1';
    if (useAuto && targetLangSel && targetLangSel.value){
      const lang = targetLangSel.value;
      const match = voices.find(v=>v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase()));
      if (match) { voiceSelect.value = match.name; localStorage.setItem('vt_voice', match.name); }
    }
  }catch(e){}
}

function showMessage(msg, type){
  if (!messageEl) return;
  messageEl.textContent = msg || '';
  if (type === 'ok') messageEl.style.color = '#070';
  else if (type === 'warn') messageEl.style.color = '#a60';
  else messageEl.style.color = '#a00';
}

// endpoint persistence UI
if (apiEndpointInput) {
  apiEndpointInput.value = localStorage.getItem('vt_endpoint') || 'https://libretranslate.de/translate';
}
if (saveEndpointBtn) {
  saveEndpointBtn.addEventListener('click', ()=>{
    const v = apiEndpointInput.value.trim();
    if (!v) return showMessage('Введите корректный URL эндпойнта.');
    localStorage.setItem('vt_endpoint', v);
    showMessage('Эндпойнт сохранён: ' + v, 'ok');
  });
}
if (testEndpointBtn) {
  testEndpointBtn.addEventListener('click', async ()=>{
    const ep = apiEndpointInput.value.trim() || localStorage.getItem('vt_endpoint');
    if (!ep) return showMessage('Сначала укажите эндпойнт.');
    showMessage('Проверка эндпойнта: ' + ep, 'ok');
    try{
      // Try a lightweight POST with short body to test connectivity/CORS
      const res = await fetch(ep, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({q:'test', source:'en', target:'ru', format:'text'}) });
      if (!res.ok) {
        const txt = await res.text().catch(()=>res.statusText||res.status);
        showMessage('Эндпойнт ответил: ' + (txt||res.statusText||res.status));
      } else {
        showMessage('Эндпойнт доступен и отвечает.', 'ok');
      }
    }catch(err){
      showMessage('Не удалось подключиться к эндпойнту: ' + (err.message||err));
    }
  });
}

// STT endpoint persistence and audio handlers
if (sttEndpointInput) sttEndpointInput.value = localStorage.getItem('vt_stt_endpoint') || '';
if (saveSttEndpointBtn) saveSttEndpointBtn.addEventListener('click', ()=>{
  const v = sttEndpointInput.value.trim();
  if (!v) return showMessage('Введите URL STT эндпойнта.');
  localStorage.setItem('vt_stt_endpoint', v);
  showMessage('STT эндпойнт сохранён: ' + v, 'ok');
});

let _uploadedAudioFile = null;
if (audioFileInput) audioFileInput.addEventListener('change', (e)=>{ _uploadedAudioFile = e.target.files && e.target.files[0] ? e.target.files[0] : null; if (audioStatus) audioStatus.textContent = _uploadedAudioFile ? ('Файл выбран: '+_uploadedAudioFile.name) : 'Файл не выбран'; });
if (uploadAudioBtn) uploadAudioBtn.addEventListener('click', ()=>{ if (_uploadedAudioFile) audioStatus.textContent = 'Файл готов для конвертации: ' + _uploadedAudioFile.name; else audioStatus.textContent = 'Выберите аудиофайл сначала.'; });

// logs
const LOG_KEY = 'vt_logs';
function addLog(level, msg, meta){
  try{
    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    logs.unshift({ ts: new Date().toISOString(), level, msg: String(msg), meta: meta||null });
    if (logs.length > 1000) logs.length = 1000;
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    renderLogs();
  }catch(e){ console.error('log error', e); }
}
function loadLogs(){ try{ return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); }catch(e){ return []; } }
function renderLogs(){ if (!logsList) return; const logs = loadLogs(); logsList.innerHTML = logs.map(l=>`<div style="font-size:12px;border-bottom:1px solid #eee;padding:6px"><div style="color:#666">${new Date(l.ts).toLocaleString()} — ${l.level}</div><div>${l.msg}</div></div>`).join('') || '<div style="color:#666">Логи пусты</div>'; }
if (downloadLogsBtn) downloadLogsBtn.addEventListener('click', ()=>{ const b = new Blob([JSON.stringify(loadLogs(),null,2)], { type: 'application/json' }); const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = `vt-logs-${new Date().toISOString()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); });
if (clearLogsBtn) clearLogsBtn.addEventListener('click', ()=>{ if (!confirm('Очистить логи?')) return; localStorage.setItem(LOG_KEY, JSON.stringify([])); renderLogs(); });
renderLogs();

// convert uploaded audio via STT endpoint, then optionally translate segments
let _lastSegments = null;
async function convertUploadedAudio(){
  if (!_uploadedAudioFile) return showMessage('Нет загруженного аудиофайла.');
  const ep = (localStorage.getItem('vt_stt_endpoint') || localStorage.getItem('vt_endpoint') || null);
  if (!ep) return showMessage('Укажите STT эндпойнт в поле выше.');
  if (audioStatus) audioStatus.textContent = 'Отправка файла на распознавание...';
  addLog('info','Uploading audio to STT', { file: _uploadedAudioFile.name, endpoint: ep });
  try{
    const fd = new FormData();
    fd.append('file', _uploadedAudioFile, _uploadedAudioFile.name);
    fd.append('language', sourceLangSel.value === 'auto' ? '' : sourceLangSel.value);
    const res = await fetch(ep, { method: 'POST', body: fd });
    if (!res.ok) {
      const txt = await res.text().catch(()=>res.statusText||res.status);
      addLog('error','STT returned error', { status: res.status, txt });
      if (audioStatus) audioStatus.textContent = 'Ошибка распознавания: ' + (txt||res.statusText||res.status);
      return;
    }
    const data = await res.json();
    addLog('info','STT response', { resp: data });
    let segments = null;
    if (Array.isArray(data.segments) && data.segments.length) segments = data.segments;
    else if (data.segments && typeof data.segments === 'object') segments = Object.values(data.segments);
    if (!segments && data.text) { segments = [{ start: 0, end: 0, text: data.text }]; }
    if (!segments) { if (audioStatus) audioStatus.textContent = 'Не удалось получить сегменты из ответа STT.'; addLog('warn','No segments in STT response', { resp: data }); return; }

    addHistoryEntry({ ts: new Date().toISOString(), source: sourceLangSel.value, target: targetLangSel.value, detected: data.language||null, recognized: segments.map(s=>s.text).join('\n'), translated: '', fileName: _uploadedAudioFile.name, segments });
    recognizedEl.value = segments.map(s=>s.text).join('\n');
    translatedEl.value = '';
    if (audioStatus) audioStatus.textContent = 'Распознано ' + segments.length + ' сегментов.';
    _lastSegments = { segments, fileName: _uploadedAudioFile.name, language: data.language || null };
  }catch(err){ addLog('error','STT request failed', { error: err.message||err }); if (audioStatus) audioStatus.textContent = 'Ошибка при распознавании: ' + (err.message||err); }
}

function makeSrt(segments){
  function fmt(t){ const ms = Math.max(0, Math.floor(t*1000)); const hh = Math.floor(ms/3600000); const mm = Math.floor((ms%3600000)/60000); const ss = Math.floor((ms%60000)/1000); const mmm = ms%1000; return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')},${String(mmm).padStart(3,'0')}`; }
  return segments.map((s,i)=>`${i+1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`).join('\n');
}

if (uploadAudioBtn) uploadAudioBtn.addEventListener('click', ()=>{ if (_uploadedAudioFile) audioStatus.textContent = 'Файл готов для конвертации: ' + _uploadedAudioFile.name; else audioStatus.textContent = 'Выберите аудиофайл сначала.'; });
if (convertAudioBtn) convertAudioBtn.addEventListener('click', async ()=>{ await convertUploadedAudio(); });
if (exportSrtBtn) exportSrtBtn.addEventListener('click', ()=>{ if (!_lastSegments || !_lastSegments.segments) return showMessage('Нет доступных сегментов для экспорта.'); const srt = makeSrt(_lastSegments.segments); const blob = new Blob([srt], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${_lastSegments.fileName || 'subtitles'}.srt`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); });

// store last translation request so retry button can call it
let _lastRequest = null;
async function doTranslateAndStore(text, src, tgt){
  _lastRequest = { text, src, tgt };
  retryStatus.textContent = '';
  try{
    const res = await translateText(text, src, tgt);
    return res;
  }catch(err){
    retryStatus.textContent = 'Ошибка: ' + (err.message||err);
    throw err;
  }
}

if (retryBtn) {
  retryBtn.addEventListener('click', async ()=>{
    if (!_lastRequest) return showMessage('Нет предыдущего запроса для повтора.');
    retryStatus.textContent = 'Повтор выполняется...';
    try{
      const res = await translateText(_lastRequest.text, _lastRequest.src, _lastRequest.tgt);
      translatedEl.value = res.translatedText || '';
      retryStatus.textContent = 'Повтор выполнен.';
    }catch(err){
      retryStatus.textContent = 'Повтор не удался: ' + (err.message||err);
    }
  });
}

// History management
const HISTORY_KEY = 'vt_history';
function loadHistory(){
  try{ return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }catch(e){ return []; }
}
function saveHistory(arr){ localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); }
function addHistoryEntry(entry){
  const h = loadHistory();
  h.unshift(entry);
  if (h.length > 500) h.length = 500;
  saveHistory(h);
  renderHistory();
}

function renderHistory(filter){
  if (!historyList) return;
  const h = loadHistory();
  const q = (filter || (historySearch && historySearch.value) || '').toLowerCase().trim();
  const items = h.filter(it=>{
    if (!q) return true;
    return (''+it.recognized).toLowerCase().includes(q) || (''+it.translated).toLowerCase().includes(q) || (it.detected||'').toLowerCase().includes(q);
  });
  historyList.innerHTML = items.map((it, idx)=>{
    const t = new Date(it.ts).toLocaleString();
    const rec = (it.recognized||'').replace(/</g,'&lt;');
    const tr = (it.translated||'').replace(/</g,'&lt;');
    return `
      <div class="hist-item" data-idx="${idx}" style="padding:6px;border-bottom:1px solid #eee">
        <div style="font-size:12px;color:#666">${t} — ${it.source || ''}→${it.target || ''} ${it.detected?('(det:'+it.detected+')'):''}</div>
        <div style="margin-top:4px"><strong>Распознано:</strong> ${rec}</div>
        <div style="margin-top:4px"><strong>Перевод:</strong> ${tr}</div>
        <div style="margin-top:6px">
          <button class="history-replay">Восстановить</button>
          <button class="history-copy">Копировать</button>
          <button class="history-download">Скачать</button>
          <button class="history-delete" style="color:#a00">Удалить</button>
        </div>
      </div>`;
  }).join('') || '<div style="color:#666">История пуста</div>';
}

if (historySearch) historySearch.addEventListener('input', ()=>renderHistory());

// delegate clicks in historyList
if (historyList) historyList.addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if (!btn) return;
  const itemDiv = e.target.closest('.hist-item');
  if (!itemDiv) return;
  const idx = parseInt(itemDiv.getAttribute('data-idx'),10);
  const h = loadHistory();
  const item = h[idx];
  if (!item) return;
  if (btn.classList.contains('history-replay')){
    recognizedEl.value = item.recognized || '';
    translatedEl.value = item.translated || '';
    const detEl = document.getElementById('detectedLang'); if (detEl) detEl.textContent = item.detected ? ('Определённый язык: '+item.detected) : '';
  } else if (btn.classList.contains('history-copy')){
    const txt = `${item.recognized || ''}\n\n${item.translated || ''}`;
    navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : (function(){ prompt('Copy:', txt); })();
  } else if (btn.classList.contains('history-download')){
    const blob = new Blob([ (item.recognized||'') + '\n\n' + (item.translated||'') ], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `vt_${item.ts}.txt`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } else if (btn.classList.contains('history-delete')){
    if (!confirm('Удалить эту запись из истории?')) return;
    h.splice(idx,1); saveHistory(h); renderHistory();
  }
});

if (exportJsonBtn) exportJsonBtn.addEventListener('click', ()=>{
  const h = loadHistory();
  const blob = new Blob([JSON.stringify(h, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `vt-history-${new Date().toISOString()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

if (exportTxtBtn) exportTxtBtn.addEventListener('click', ()=>{
  const h = loadHistory();
  const lines = h.map(it=>`${it.ts}\t${it.source || ''}->${it.target || ''}\nRECOGNIZED:\n${it.recognized}\nTRANSLATED:\n${it.translated}\n---\n`);
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `vt-history-${new Date().toISOString()}.txt`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', ()=>{
  if (!confirm('Очистить всю историю?')) return;
  saveHistory([]); renderHistory();
});

// initial render
renderHistory();

// TTS controls persistence and preview
if (ttsRate && ttsPitch && ttsVolume) {
  const savedRate = localStorage.getItem('vt_tts_rate') || '1';
  const savedPitch = localStorage.getItem('vt_tts_pitch') || '1';
  const savedVolume = localStorage.getItem('vt_tts_volume') || '1';
  ttsRate.value = savedRate; ttsPitch.value = savedPitch; ttsVolume.value = savedVolume;
  if (ttsRateVal) ttsRateVal.textContent = ttsRate.value;
  if (ttsPitchVal) ttsPitchVal.textContent = ttsPitch.value;
  if (ttsVolumeVal) ttsVolumeVal.textContent = ttsVolume.value;
  ttsRate.addEventListener('input', ()=>{ if (ttsRateVal) ttsRateVal.textContent = ttsRate.value; localStorage.setItem('vt_tts_rate', ttsRate.value); });
  ttsPitch.addEventListener('input', ()=>{ if (ttsPitchVal) ttsPitchVal.textContent = ttsPitch.value; localStorage.setItem('vt_tts_pitch', ttsPitch.value); });
  ttsVolume.addEventListener('input', ()=>{ if (ttsVolumeVal) ttsVolumeVal.textContent = ttsVolume.value; localStorage.setItem('vt_tts_volume', ttsVolume.value); });
}

if (autoVoice) {
  autoVoice.checked = (localStorage.getItem('vt_auto_voice') === '1');
  autoVoice.addEventListener('change', ()=>{ localStorage.setItem('vt_auto_voice', autoVoice.checked ? '1' : '0'); if (autoVoice.checked) populateVoices(); });
}

function selectVoiceForLang(langCode){
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices() || [];
  if (!voices.length) return;
  const match = voices.find(v=>v.lang && v.lang.toLowerCase().startsWith(langCode.toLowerCase()));
  if (match) { voiceSelect.value = match.name; localStorage.setItem('vt_voice', match.name); }
}

if (targetLangSel) targetLangSel.addEventListener('change', ()=>{ if (autoVoice && autoVoice.checked) selectVoiceForLang(targetLangSel.value); });

// play sample using current TTS settings and voice
async function playSample(){
  if (!('speechSynthesis' in window)) return showMessage('SpeechSynthesis не поддерживается в этом браузере');
  const sampleTextMap = { ru: 'Пример воспроизведения голоса.', en: 'This is a voice sample.', es: 'Ejemplo de voz.' };
  const lang = targetLangSel && targetLangSel.value ? targetLangSel.value : (navigator.language || 'en').split('-')[0];
  const sample = sampleTextMap[lang] || sampleTextMap['en'];
  const utter = new SpeechSynthesisUtterance(sample);
  utter.lang = (lang && lang.length===2) ? (lang + '-' + lang.toUpperCase()) : lang;
  const sel = voiceSelect.value;
  if (sel) {
    const v = speechSynthesis.getVoices().find(x=>x.name === sel);
    if (v) utter.voice = v;
  }
  utter.rate = parseFloat(localStorage.getItem('vt_tts_rate') || (ttsRate && ttsRate.value) || 1);
  utter.pitch = parseFloat(localStorage.getItem('vt_tts_pitch') || (ttsPitch && ttsPitch.value) || 1);
  utter.volume = parseFloat(localStorage.getItem('vt_tts_volume') || (ttsVolume && ttsVolume.value) || 1);
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

if (playSampleBtn) playSampleBtn.addEventListener('click', playSample);

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
