// langs.js — shared language lists for demo projects
(function(){
  // LibreTranslate-friendly short codes
  const libre = [
    {code:'en', name:'English'},
    {code:'ru', name:'Русский'},
    {code:'es', name:'Español'},
    {code:'fr', name:'Français'},
    {code:'de', name:'Deutsch'},
    {code:'it', name:'Italiano'},
    {code:'pt', name:'Português'},
    {code:'nl', name:'Nederlands'},
    {code:'pl', name:'Polski'},
    {code:'zh', name:'中文'},
    {code:'ja', name:'日本語'},
    {code:'ko', name:'한국어'},
    {code:'ar', name:'العربية'},
    {code:'hi', name:'हिन्दी'},
    {code:'tr', name:'Türkçe'},
    {code:'sv', name:'Svenska'},
    {code:'ro', name:'Română'}
  ];

  // LanguageTool-style locale codes for grammar checking / selections
  const languagetool = [
    {code:'auto', name:'Auto-detect'},
    {code:'en-US', name:'English (US)'},
    {code:'en-GB', name:'English (UK)'},
    {code:'ru-RU', name:'Русский'},
    {code:'ro-RO', name:'Română'},
    {code:'es-ES', name:'Español'},
    {code:'fr-FR', name:'Français'},
    {code:'de-DE', name:'Deutsch'},
    {code:'it-IT', name:'Italiano'},
    {code:'pt-PT', name:'Português'},
    {code:'nl-NL', name:'Nederlands'},
    {code:'pl-PL', name:'Polski'}
  ];

  window.DEMO_LANGS = { libre, languagetool };
})();
