/*
 * Scenario page behaviors (new/edit):
 * - Viewport preset dropdown fills width/height inputs.
 * - AI steps modal: open/close/generate and insert into builder/JSON.
 * - Disable AI button if backend reports AI disabled.
 */
(function(){
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function(){
    // (Builder géré par app.js via CodeMirror ou fallback)
    // Viewport preset logic
    var sel = document.getElementById('viewportPreset');
    if (sel) {
      var wid = sel.getAttribute('data-w-input-id');
      var hid = sel.getAttribute('data-h-input-id');
      sel.addEventListener('change', function(){
        var v = sel.value; if (!v) return;
        var parts = v.split('x'); if (parts.length !== 2) return;
        var w = wid ? document.getElementById(wid) : null;
        var h = hid ? document.getElementById(hid) : null;
        if (w) w.value = parts[0];
        if (h) h.value = parts[1];
      });
    }

    // AI enablement guard and modal wiring (if present)
    var aiBtn = document.getElementById('aiStepsBtn');
    if (aiBtn) {
      fetch('/api/ai/enabled').then(function(r){ return r.json(); }).then(function(j){
        if (!j.enabled) {
          aiBtn.disabled = true; aiBtn.classList.add('disabled'); aiBtn.title = 'Fonction IA désactivée (clé API manquante)';
        }
      }).catch(function(){});
    }

    var modal = document.getElementById('aiStepsModal');
    var closeBtn = document.getElementById('aiStepsClose');
    var cancelBtn = document.getElementById('aiStepsCancel');
    var genBtn = document.getElementById('aiStepsGenerate');
    var promptArea = document.getElementById('aiStepsPrompt');
    var errorBox = document.getElementById('aiStepsError');

    function show(){ if (modal) modal.style.display = 'block'; }
    function hide(){ if (modal) modal.style.display = 'none'; }

    if (aiBtn && modal) aiBtn.addEventListener('click', show);
    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (cancelBtn) cancelBtn.addEventListener('click', hide);

    if (genBtn) {
      genBtn.addEventListener('click', function(){
        if (!promptArea || !errorBox) return;
        errorBox.classList.add('d-none'); errorBox.textContent = '';
        var prompt = (promptArea.value||'').trim();
        if (!prompt) { errorBox.textContent = 'Veuillez saisir un prompt'; errorBox.classList.remove('d-none'); return; }
        genBtn.disabled = true; genBtn.textContent = 'Génération…';
        fetch('/api/ai/generate-scenario', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt: prompt }) })
          .then(function(resp){ return Promise.all([resp.status, resp.json()]); })
          .then(function(tuple){
            var status = tuple[0]; var data = tuple[1] || {};
            if (status !== 200 || data.error) {
              var msg = (status===429) ? 'Limite atteinte, réessayez dans quelques secondes.' : (data.error || ('Erreur ' + status));
              throw new Error(msg);
            }
            var steps = Array.isArray(data.steps) ? data.steps : [];
            var form = document.querySelector('form'); if (!form) return;
            var taJson = form.querySelector('textarea.json-editor'); if (!taJson) return;
            // builderHost is two siblings before the textarea in our layout
            var host = taJson.previousElementSibling && taJson.previousElementSibling.previousElementSibling ? taJson.previousElementSibling.previousElementSibling : null;
            if (host && typeof host.__sbSetSteps === 'function') { host.__sbSetSteps(steps); }
            else { taJson.value = JSON.stringify(steps, null, 2); }
            hide();
          })
          .catch(function(e){ errorBox.textContent = e.message; errorBox.classList.remove('d-none'); })
          .finally(function(){ genBtn.disabled = false; genBtn.textContent = 'Générer'; });
      });
    }
  });
})();
