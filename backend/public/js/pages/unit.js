/*
 * Unit tests page behaviors (new/edit):
 * - AI HTTP tests modal: open/close/generate and insert into builder/JSON.
 * - Disable AI button if backend reports AI disabled.
 */
(function(){
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function(){
    var aiBtn = document.getElementById('aiHttpBtn');
    if (aiBtn) {
      fetch('/api/ai/enabled').then(function(r){ return r.json(); }).then(function(j){
        if (!j.enabled) { aiBtn.disabled = true; aiBtn.classList.add('disabled'); aiBtn.title = 'Fonction IA désactivée (clé API manquante)'; }
      }).catch(function(){});
    }

    var modal = document.getElementById('aiHttpModal');
    var closeBtn = document.getElementById('aiHttpClose');
    var cancelBtn = document.getElementById('aiHttpCancel');
    var genBtn = document.getElementById('aiHttpGenerate');
    var promptArea = document.getElementById('aiHttpPrompt');
    var errorBox = document.getElementById('aiHttpError');

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
        fetch('/api/ai/generate-http-tests', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt: prompt }) })
          .then(function(resp){ return Promise.all([resp.status, resp.json()]); })
          .then(function(tuple){
            var status = tuple[0]; var data = tuple[1] || {};
            if (status !== 200 || data.error) {
              var msg = (status===429) ? 'Limite atteinte, réessayez dans quelques secondes.' : (data.error || ('Erreur ' + status));
              throw new Error(msg);
            }
            var tests = Array.isArray(data.tests) ? data.tests : [];
            var form = document.querySelector('form'); if (!form) return;
            var taJson = form.querySelector('textarea.unit-tests-editor'); if (!taJson) return;
            var host = taJson.previousElementSibling && taJson.previousElementSibling.previousElementSibling ? taJson.previousElementSibling.previousElementSibling : null;
            if (host && typeof host.__ubSetTests === 'function') { host.__ubSetTests(tests); }
            else { taJson.value = JSON.stringify(tests, null, 2); }
            hide();
          })
          .catch(function(e){ errorBox.textContent = e.message; errorBox.classList.remove('d-none'); })
          .finally(function(){ genBtn.disabled = false; genBtn.textContent = 'Générer'; });
      });
    }
  });
})();
