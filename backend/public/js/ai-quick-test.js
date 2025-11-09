// Bouton de test rapide de l'API IA (1 + 1)
(function(){
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('aiQuickTestBtn');
    var out = document.getElementById('aiQuickTestResult');
    if (!btn || !out) return;

    // Vérifier si l'IA est configurée
    fetch('/api/ai/enabled').then(function(r){ return r.json(); }).then(function(j){
      if (!j.enabled) {
        btn.disabled = true; btn.classList.add('disabled'); btn.title = 'IA désactivée (clé API manquante)';
        out.textContent = 'IA off';
      }
    }).catch(function(){ /* ignore */ });

    btn.addEventListener('click', function(){
      if (btn.disabled) return;
      out.textContent = '';
      btn.disabled = true;
      var original = btn.textContent;
      btn.textContent = 'Test…';
      fetch('/api/ai/quick-test').then(function(resp){ return Promise.all([resp.status, resp.json()]); })
        .then(function(tuple){
          var status = tuple[0]; var data = tuple[1] || {};
          if (!data.ok || status !== 200) {
            var msg = (status === 429) ? 'Limite atteinte' : (data.error || ('Erreur ' + status));
            out.textContent = '❌ ' + msg;
          } else {
            out.textContent = '✅ Réponse: ' + data.answer;
          }
        })
        .catch(function(e){ out.textContent = '❌ ' + e.message; })
        .finally(function(){ btn.disabled = false; btn.textContent = original; });
    });
  });
})();
