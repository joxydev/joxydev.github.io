const $ = id => document.getElementById(id);
const sourceEl = $('source');
const preview = $('preview');
const checkBtn = $('checkBtn');
const langSel = $('lang');
const suggestList = $('suggestList');
const applyAllBtn = $('applyAllBtn');
const copyBtn = $('copyBtn');
const downloadBtn = $('downloadBtn');

let currentText = '';

function renderPreview(text, matches=[]) {
  if (!matches.length) { preview.textContent = text; return; }
  let out = '';
  let idx = 0;
  matches.sort((a,b)=>a.offset-b.offset);
  for (const m of matches) {
    const before = text.slice(idx, m.offset);
    const mid = text.slice(m.offset, m.offset + m.length);
    out += escapeHtml(before) + `<span class="highlight" data-off="${m.offset}" data-len="${m.length}">${escapeHtml(mid)}</span>`;
    idx = m.offset + m.length;
  }
  out += escapeHtml(text.slice(idx));
  preview.innerHTML = out;
}

function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

async function callLanguageTool(text, lang) {
  const endpoint = 'https://api.languagetool.org/v2/check';
  const body = new URLSearchParams();
  body.append('text', text);
  if (lang && lang !== 'auto') body.append('language', lang);
  const res = await fetch(endpoint, { method: 'POST', body });
  if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
  return res.json();
}

function buildMatchesFromLT(data){
  return (data.matches||[]).map(m=>({
    offset: m.offset,
    length: m.length,
    message: m.message,
    replacements: (m.replacements||[]).map(r=>r.value),
    ruleId: m.rule && m.rule.id ? m.rule.id : null
  }));
}

function showSuggestions(matches){
  if (!matches.length) { suggestList.textContent = 'Ошибок не найдено.'; return; }
  suggestList.innerHTML = '';
  matches.forEach((m, i) => {
    const div = document.createElement('div'); div.className='suggestion';
    const meta = document.createElement('div'); meta.className='meta';
    meta.innerHTML = `<strong>${escapeHtml(m.message)}</strong><div class="muted">Предложения: ${escapeHtml((m.replacements||[]).join(', ') || '(нет вариантов)')}</div>`;
    const actions = document.createElement('div');
    const applyBtn = document.createElement('button'); applyBtn.textContent='Применить';
    const ignoreBtn = document.createElement('button'); ignoreBtn.textContent='Игнорировать'; ignoreBtn.style.marginLeft='6px';
    applyBtn.addEventListener('click', ()=>{ applySuggestion(i); });
    ignoreBtn.addEventListener('click', ()=>{ removeHighlightAtMatch(i); });
    actions.appendChild(applyBtn); actions.appendChild(ignoreBtn);
    div.appendChild(meta); div.appendChild(actions);
    suggestList.appendChild(div);
  });
}

let lastMatches = [];

// populate LanguageTool select from shared list if present
function populateLTSelect(){
  try{
    const lt = window.DEMO_LANGS && window.DEMO_LANGS.languagetool ? window.DEMO_LANGS.languagetool : null;
    if (!lt) return;
    langSel.innerHTML = '';
    lt.forEach(o=>{
      const el = document.createElement('option'); el.value = o.code; el.textContent = o.name;
      if (o.code === 'ru-RU') el.selected = true;
      langSel.appendChild(el);
    });
  }catch(e){}
}

populateLTSelect();

async function doCheck(){
  const text = sourceEl.value || '';
  if (!text.trim()) return alert('Введите текст.');
  currentText = text;
  preview.textContent = 'Проверка...';
  suggestList.textContent = '';
  try {
    const lang = langSel.value === 'auto' ? '' : langSel.value;
    const data = await callLanguageTool(text, lang);
    lastMatches = buildMatchesFromLT(data);
    renderPreview(text, lastMatches);
    showSuggestions(lastMatches);
  } catch (err) {
    preview.textContent = 'Ошибка: ' + (err.message || err);
    suggestList.innerHTML = '<div style="color:crimson">Не удалось связаться с LanguageTool. Возможно CORS или сеть. См. README.</div>';
  }
}

function applySuggestion(index){
  const m = lastMatches[index];
  if (!m || !m.replacements.length) return alert('Нет предложений для применения.');
  const replacement = m.replacements[0];
  currentText = currentText.slice(0, m.offset) + replacement + currentText.slice(m.offset + m.length);
  sourceEl.value = currentText;
  doCheck();
}

function removeHighlightAtMatch(index){
  const filtered = lastMatches.slice(); filtered.splice(index,1);
  renderPreview(currentText, filtered);
}

applyAllBtn.addEventListener('click', ()=>{
  if (!lastMatches.length) return;
  let txt = currentText;
  const ordered = [...lastMatches].sort((a,b)=>b.offset-a.offset);
  for (const m of ordered) {
    const rep = m.replacements[0] || '';
    txt = txt.slice(0, m.offset) + rep + txt.slice(m.offset + m.length);
  }
  currentText = txt; sourceEl.value = txt; doCheck();
});

copyBtn.addEventListener('click', async ()=>{
  try { await navigator.clipboard.writeText(sourceEl.value); alert('Скопировано в буфер'); } catch(e){ alert('Не удалось скопировать: '+e); }
});

downloadBtn.addEventListener('click', ()=>{
  const blob = new Blob([sourceEl.value], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'text-fixed.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

checkBtn.addEventListener('click', doCheck);

renderPreview('');
