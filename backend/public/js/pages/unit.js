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

    // Example button: inject a ready-to-use tests suite (temps & coût)
    var exBtn = document.getElementById('exampleTestsBtn');
    if (exBtn) {
      exBtn.addEventListener('click', function(){
        var form = document.querySelector('form');
        if (!form) return;
        var taJson = form.querySelector('textarea.unit-tests-editor');
        if (!taJson) return;

        // Build example tests array
        var tests = [
          {
            name: 'GET / (dashboard) renvoie 200 et contient le titre',
            method: 'GET',
            url: '/',
            headers: { 'Accept': 'text/html' },
            assert: { status: 200, contains: 'Functional Tester' }
          },
          {
            name: 'API AI enabled renvoie JSON',
            method: 'GET',
            url: '/api/ai/enabled',
            headers: { 'Accept': 'application/json' },
            assert: { status: 200, json: { path: 'enabled', equals: true } }
          },
          // Exemple métier: saisie temps + vérification totaux (à adapter à votre API)
          {
            name: 'Créer une tâche (exemple) – à adapter',
            method: 'POST',
            url: '/api/tasks',
            headers: { 'Accept': 'application/json' },
            body: { title: 'Tâche A' },
            assert: { status: 201 },
            capture: [{ json: 'id', var: 'TASK_A_ID' }]
          },
          {
            name: 'Saisir temps Utilisateur 1 (8h @ R1) – à adapter',
            method: 'POST',
            url: '/api/time',
            headers: { 'Accept': 'application/json' },
            body: { taskId: '{{TASK_A_ID}}', hours: 8, userId: 12 },
            assert: { status: 201 },
            capture: [ { json: 'hours', var: 'H1' }, { json: 'rate', var: 'R1' }, { json: 'cost', var: 'C1' } ]
          },
          {
            name: 'Saisir temps Utilisateur 2 (9.5h @ R2) – à adapter',
            method: 'POST',
            url: '/api/time',
            headers: { 'Accept': 'application/json' },
            body: { taskId: '{{TASK_A_ID}}', hours: 9.5, userId: 37 },
            assert: { status: 201 },
            capture: [ { json: 'hours', var: 'H2' }, { json: 'rate', var: 'R2' }, { json: 'cost', var: 'C2' } ]
          },
          {
            name: 'Résumé global: total heures = H1+H2 – à adapter',
            method: 'GET',
            url: '/api/report/time-summary?taskId={{TASK_A_ID}}',
            headers: { 'Accept': 'application/json' },
            assert: { status: 200, json: { path: 'global.totalHours', equalsExpr: 'H1 + H2' } },
            capture: [ { json: 'global.totalCost', var: 'TOTAL_COST_REPORTED' } ]
          },
          {
            name: 'Résumé global: total coût = H1*R1 + H2*R2 – à adapter',
            method: 'GET',
            url: '/api/report/time-summary?taskId={{TASK_A_ID}}',
            headers: { 'Accept': 'application/json' },
            assert: { status: 200, json: { path: 'global.totalCost', equalsExpr: '(H1 * R1) + (H2 * R2)' } }
          }
        ];

        // Insert into builder/textarea
        var host = taJson.previousElementSibling && taJson.previousElementSibling.previousElementSibling ? taJson.previousElementSibling.previousElementSibling : null;
        if (host && typeof host.__ubSetTests === 'function') { host.__ubSetTests(tests); }
        else { taJson.value = JSON.stringify(tests, null, 2); }

        // Small UX hint
        exBtn.blur();
        taJson.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  });
})();
