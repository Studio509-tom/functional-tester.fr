// Functional Tester frontend helpers
// - Theme management (light/dark) with localStorage persistence
// - Enhance JSON textarea with CodeMirror + JSON lint
// - No-code Step Builder: add/edit/reorder steps visually, preview via API
// - Small UI polish: staggered animations for lists/tables
//
// NOTE: The Step Builder hides the raw JSON editor by default to keep the UI
// approachable, but keeps content in sync on submit.
//
// Enhance JSON textarea into a CodeMirror editor with linting and helpers
(function () {
	if (typeof document === 'undefined') return;
	// Theme management
	const THEME_KEY = 'theme'; // localStorage key
	function getPreferredTheme() {
		try {
			const stored = localStorage.getItem(THEME_KEY);
			if (stored === 'dark' || stored === 'light') return stored;
		} catch (_) {}
		return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
	}
	// Apply theme to <html data-bs-theme> and sync CodeMirror theme
	function applyTheme(theme) {
		document.documentElement.setAttribute('data-bs-theme', theme);
		try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
		// Sync CodeMirror theme
		const cmTheme = theme === 'dark' ? 'dracula' : 'default';
		if (window.__cmEditors && window.__cmEditors.length) {
			window.__cmEditors.forEach(ed => ed.setOption('theme', cmTheme));
		}
		// Toggle button label
		const btn = document.getElementById('themeToggle');
		if (btn) btn.textContent = theme === 'dark' ? 'Mode clair' : 'Mode sombre';
	}
	// Toggle between light/dark (used by the navbar button)
	function toggleTheme() {
		const cur = document.documentElement.getAttribute('data-bs-theme') || getPreferredTheme();
		applyTheme(cur === 'dark' ? 'light' : 'dark');
	}
	document.addEventListener('DOMContentLoaded', () => {
		const btn = document.getElementById('themeToggle');
		if (btn) {
			btn.addEventListener('click', toggleTheme);
			// Initialize button label
			const cur = document.documentElement.getAttribute('data-bs-theme') || getPreferredTheme();
			applyTheme(cur);
		}
	});
	// Ensure jsonlint is globally available for CodeMirror lint addon
	if (typeof window !== 'undefined' && typeof window.jsonlint === 'undefined' && typeof window.jsonlint !== 'function' && typeof jsonlint !== 'undefined') {
		window.jsonlint = jsonlint;
	}



	// Upgrade any textarea.json-editor into CodeMirror with builder attached
	function initJsonEditors() {
		const areas = document.querySelectorAll('textarea.json-editor');
			areas.forEach((ta) => {
			// Avoid double init
			if (ta.dataset.cmInitialized) return;
			ta.dataset.cmInitialized = '1';

			// Wrap with container and add builder container before the textarea
			const wrapper = document.createElement('div');
			wrapper.className = 'json-editor-container';
			ta.parentNode.insertBefore(wrapper, ta);
			// Step builder placeholder (will be filled after editor creation)
			const builderHost = document.createElement('div');
			builderHost.className = 'mb-3';
			wrapper.appendChild(builderHost);
			// Toolbar to toggle between Builder and Advanced JSON
			const toolbar = document.createElement('div');
			toolbar.className = 'd-flex justify-content-end gap-2 mb-2';
			const toggleBtn = document.createElement('button');
			toggleBtn.type = 'button';
			toggleBtn.className = 'btn btn-sm btn-outline-secondary';
			toggleBtn.id = 'sb-toggle-mode';
			toggleBtn.textContent = 'Basculer en mode JSON avancé';
			// Quick Snippets controls
			const snippetSelect = document.createElement('select');
			snippetSelect.className = 'form-select form-select-sm w-auto';
			snippetSelect.id = 'sb-snippet';
			snippetSelect.innerHTML = [
				'<option value="" selected>— Snippet —</option>',
				'<option value="basic">Exemple basique</option>',
				'<option value="visitClick">Visiter puis cliquer</option>',
				'<option value="login">Formulaire de login (faux)</option>',
				'<option value="waitThenClick">Attendre un sélecteur puis cliquer</option>',
				'<option value="mobileViewport">Preset mobile (viewport + UA)</option>'
			].join('');
			const snippetBtn = document.createElement('button');
			snippetBtn.type = 'button';
			snippetBtn.className = 'btn btn-sm btn-outline-primary';
			snippetBtn.id = 'sb-insert-snippet';
			snippetBtn.textContent = 'Insérer';
			// Order: snippets then toggle
			toolbar.appendChild(snippetSelect);
			toolbar.appendChild(snippetBtn);
			toolbar.appendChild(toggleBtn);
			wrapper.appendChild(toolbar);
			wrapper.appendChild(ta);

			// Move the Unit Test Builder block before the "Définition des tests (JSON)" label
			try {
				const group = ta.closest('.mb-3');
				if (group) {
					const labelEl = group.querySelector('label.form-label');
					if (labelEl) {
						group.insertBefore(builderHost, labelEl);
					}
				}
			} catch(_){ }

					// Initialize CodeMirror if available, else keep textarea
					if (window.CodeMirror) {
				const editor = window.CodeMirror.fromTextArea(ta, {
					mode: { name: 'javascript', json: true },
					lineNumbers: true,
					matchBrackets: true,
					autoCloseBrackets: true,
					gutters: ['CodeMirror-lint-markers'],
							lint: true,
							theme: (document.documentElement.getAttribute('data-bs-theme') === 'dark') ? 'dracula' : 'default',
				});
				editor.setSize(null, 380);
						// Keep a global reference for theme syncing
						window.__cmEditors = window.__cmEditors || [];
						window.__cmEditors.push(editor);
						// Wrap/containers
						const cmWrap = editor.getWrapperElement();
				// Attach a visual Step Builder to manipulate JSON without typing
			attachStepBuilder(builderHost, editor, ta);
						// Toggle button logic with localStorage persistence
						const MODE_KEY = 'sb-mode:' + (ta.id || ta.name || location.pathname);
						function showBuilder() {
							builderHost.style.display = '';
							cmWrap.style.display = 'none';
							toggleBtn.textContent = 'Basculer en mode JSON avancé';
							try { localStorage.setItem(MODE_KEY, 'builder'); } catch(_){}
						}
						function showJson() {
							builderHost.style.display = 'none';
							cmWrap.style.display = '';
							try { editor.refresh && editor.refresh(); } catch(_){}
							toggleBtn.textContent = 'Revenir au constructeur visuel';
							try { localStorage.setItem(MODE_KEY, 'json'); } catch(_){}
						}
						// Apply initial mode from storage (default: builder)
						let initialMode = 'builder';
						try { initialMode = localStorage.getItem(MODE_KEY) || 'builder'; } catch(_){}
						if (initialMode === 'json') { showJson(); } else { showBuilder(); }
						toggleBtn.addEventListener('click', () => {
							const isBuilderVisible = builderHost.style.display !== 'none';
							if (isBuilderVisible) {
								// Switch to JSON view
								showJson();
							} else {
								// when returning to builder, try to parse and render
								try {
									const v = editor.getValue();
									JSON.parse(v); // validation only; builder reads from editor internally
								} catch (e) {
									if (!confirm('Le JSON n\'est pas valide. Revenir quand même au constructeur ?')) return;
								}
								showBuilder();
							}
						});

						// Snippets insertion
						function buildSnippet(id) {
							switch(id) {
								case 'basic':
									return [
										{ action: 'goto', url: 'https://example.org' },
										{ action: 'expectTitle', text: 'Example' }
									];
								case 'visitClick':
									return [
										{ action: 'goto', url: 'https://example.org' },
										{ action: 'click', selector: 'a' },
										{ action: 'wait', ms: 500 }
									];
								case 'login':
									return [
										{ action: 'goto', url: 'https://example.org/login' },
										{ action: 'fill', selector: '[name=email]', value: 'john@doe.com' },
										{ action: 'fill', selector: '[name=password]', value: 'secret' },
										{ action: 'click', selector: 'button[type=submit]' },
										{ action: 'waitFor', selector: '#dashboard', timeout: 3000 }
									];
								case 'waitThenClick':
									return [
										{ action: 'goto', url: 'https://example.org' },
										{ action: 'waitFor', selector: 'a.more', timeout: 2000 },
										{ action: 'click', selector: 'a.more' }
									];
								case 'mobileViewport':
									return [
										{ action: 'viewport', width: 390, height: 844 },
										{ action: 'userAgent', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
									];
								case 'multiPageSum':
									return [
										{
											name: 'Enter 1 on Page A',
											method: 'POST',
											url: 'https://example.com/page-a',
											headers: { 'Content-Type': 'application/json' },
											body: { value: 1 },
											assert: { status: 200 }
										},
										{
											name: 'Enter 2 on Page B',
											method: 'POST',
											url: 'https://example.com/page-b',
											headers: { 'Content-Type': 'application/json' },
											body: { value: 2 },
											assert: { status: 200 }
										},
										{
											name: 'Verify sum on Page C',
											method: 'GET',
											url: 'https://example.com/page-c',
											assert: {
												status: 200,
												json: { path: 'result.sum', equals: 3 }
											}
										}
									];
								default:
									return null;
							}
						}
						snippetBtn.addEventListener('click', () => {
							const id = snippetSelect.value;
							if (!id) return;
							const snippet = buildSnippet(id);
							if (!snippet) return;
							const cur = (function(){ try { return JSON.parse(editor.getValue()||'[]'); } catch(_) { return []; } })();
							const next = cur.concat(snippet);
							// Prefer builder's API to update and re-render list
							if (typeof builderHost.__sbSetSteps === 'function') {
								builderHost.__sbSetSteps(next);
							} else {
								editor.setValue(JSON.stringify(next, null, 2));
							}
							snippetSelect.value = '';
						});

						// On form submit, sync editor content back to textarea
				const form = ta.closest('form');
				if (form) {
					form.addEventListener('submit', (e) => {
						// Sync
						ta.value = editor.getValue();
						// Validate
						try {
							JSON.parse(ta.value);
						} catch (err) {
							e.preventDefault();
							alert('Veuillez corriger le JSON avant de soumettre : ' + err.message);
						}
					});
				}

				// Pretty-print initial value if valid and minified
				try {
					const v = ta.value || '';
					if (v.trim()) {
						editor.setValue(JSON.stringify(JSON.parse(v), null, 2));
					}
				} catch (_) {
					// ignore
				}
					}
					else {
						// No CodeMirror available, still attach builder using a minimal adapter
						const adapter = {
							getValue: () => ta.value,
							setValue: (v) => { ta.value = v; }
						};
						attachStepBuilder(builderHost, adapter, ta);
						// Bind snippet insertion in fallback as well
						function buildSnippet(id) {
							switch(id) {
								case 'basic':
									return [
										{ action: 'goto', url: 'https://example.org' },
										{ action: 'expectTitle', text: 'Example' }
									];
								case 'visitClick':
									return [
										{ action: 'goto', url: 'https://example.org' },
										{ action: 'click', selector: 'a' },
										{ action: 'wait', ms: 500 }
									];
								case 'login':
									return [
										{ action: 'goto', url: 'https://example.org/login' },
										{ action: 'fill', selector: '[name=email]', value: 'john@doe.com' },
										{ action: 'fill', selector: '[name=password]', value: 'secret' },
										{ action: 'click', selector: 'button[type=submit]' },
										{ action: 'waitFor', selector: '#dashboard', timeout: 3000 }
									];
								case 'waitThenClick':
									return [
										{ action: 'goto', url: 'https://example.org' },
										{ action: 'waitFor', selector: 'a.more', timeout: 2000 },
										{ action: 'click', selector: 'a.more' }
									];
								case 'mobileViewport':
									return [
										{ action: 'viewport', width: 390, height: 844 },
										{ action: 'userAgent', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
									];
								case 'multiPageSum':
									return [
										{
											name: 'Enter 1 on Page A',
											method: 'POST',
											url: 'https://example.com/page-a',
											headers: { 'Content-Type': 'application/json' },
											body: { value: 1 },
											assert: { status: 200 }
										},
										{
											name: 'Enter 2 on Page B',
											method: 'POST',
											url: 'https://example.com/page-b',
											headers: { 'Content-Type': 'application/json' },
											body: { value: 2 },
											assert: { status: 200 }
										},
										{
											name: 'Verify sum on Page C',
											method: 'GET',
											url: 'https://example.com/page-c',
											assert: {
												status: 200,
												json: { path: 'result.sum', equals: 3 }
											}
										}
									];
								default:
									return null;
							}
						}
						snippetBtn.addEventListener('click', () => {
							const id = snippetSelect.value;
							if (!id) return;
							const snippet = buildSnippet(id);
							if (!snippet) return;
							const cur = (function(){ try { return JSON.parse(adapter.getValue()||'[]'); } catch(_) { return []; } })();
							const next = cur.concat(snippet);
							if (typeof builderHost.__sbSetSteps === 'function') {
								builderHost.__sbSetSteps(next);
							} else {
								adapter.setValue(JSON.stringify(next, null, 2));
							}
							snippetSelect.value = '';
						});
					}
		});
	}

	// Upgrade any textarea.unit-tests-editor into CodeMirror with Unit Test Builder attached
	function initUnitJsonEditors() {
		const areas = document.querySelectorAll('textarea.unit-tests-editor');
		areas.forEach((ta) => {
			if (ta.dataset.cmInitialized) return;
			ta.dataset.cmInitialized = '1';

			const wrapper = document.createElement('div');
			wrapper.className = 'json-editor-container';
			ta.parentNode.insertBefore(wrapper, ta);

			const builderHost = document.createElement('div');
			builderHost.className = 'mb-2';
			wrapper.appendChild(builderHost);

			const toolbar = document.createElement('div');
			toolbar.className = 'd-flex justify-content-end gap-2 mb-2';
			const toggleBtn = document.createElement('button');
			toggleBtn.type = 'button';
			toggleBtn.className = 'btn btn-sm btn-outline-secondary';
			toggleBtn.textContent = 'Basculer en mode JSON avancé';
			const snippetSelect = document.createElement('select');
			snippetSelect.className = 'form-select form-select-sm w-auto';
			snippetSelect.innerHTML = [
				'<option value="" selected>— Snippet —</option>',
				'<option value="get200">GET / -> 200</option>',
				'<option value="postJson201">POST JSON -> 201</option>'
			].join('');
			const snippetBtn = document.createElement('button');
			snippetBtn.type = 'button';
			snippetBtn.className = 'btn btn-sm btn-outline-primary';
			snippetBtn.textContent = 'Insérer';
			toolbar.appendChild(snippetSelect);
			toolbar.appendChild(snippetBtn);
			toolbar.appendChild(toggleBtn);
			wrapper.appendChild(toolbar);
			wrapper.appendChild(ta);

			function buildSnippet(id) {
				switch(id) {
					case 'get200':
						return [{ name: 'GET / returns 200', method: 'GET', url: '/', assert: { status: 200 } }];
					case 'postJson201':
						return [{ name: 'POST /api/items returns 201', method: 'POST', url: '/api/items', headers: { 'Content-Type': 'application/json' }, body: { name: 'Item' }, assert: { status: 201 } }];
					case 'loginExtranet':
						return [
							{
								name: 'Login extranet.startengo.fr',
								method: 'POST',
								url: 'https://extranet.startengo.fr',
								headers: { 'Content-Type': 'application/json' },
								body: {
									email: 'tom.delva@startengo.fr',
									password: 'TDelva@82'
								},
								assert: { status: 200 }
							}
						];
					case 'multiPageSum':
						return [
							{
								name: 'Enter 1 on Page A',
								method: 'POST',
								url: 'https://example.com/page-a',
								headers: { 'Content-Type': 'application/json' },
								body: { value: 1 },
								assert: { status: 200 }
							},
							{
								name: 'Enter 2 on Page B',
								method: 'POST',
								url: 'https://example.com/page-b',
								headers: { 'Content-Type': 'application/json' },
								body: { value: 2 },
								assert: { status: 200 }
							},
							{
								name: 'Verify sum on Page C',
								method: 'GET',
								url: 'https://example.com/page-c',
								assert: {
									status: 200,
									json: { path: 'result.sum', equals: 3 }
								}
							}
						];
					default:
						return null;
				}
			}

			if (window.CodeMirror) {
				const editor = window.CodeMirror.fromTextArea(ta, {
					mode: { name: 'javascript', json: true },
					lineNumbers: true,
					matchBrackets: true,
					autoCloseBrackets: true,
					gutters: ['CodeMirror-lint-markers'],
					lint: true,
					theme: (document.documentElement.getAttribute('data-bs-theme') === 'dark') ? 'dracula' : 'default',
				});
				editor.setSize(null, 380);
				window.__cmEditors = window.__cmEditors || [];
				window.__cmEditors.push(editor);
				const cmWrap = editor.getWrapperElement();
				attachUnitTestBuilder(builderHost, editor, ta);
				const MODE_KEY = 'ub-mode:' + (ta.id || ta.name || location.pathname);
				function showBuilder() { builderHost.style.display=''; cmWrap.style.display='none'; toggleBtn.textContent='Basculer en mode JSON avancé'; try { localStorage.setItem(MODE_KEY, 'builder'); } catch(_){} }
				function showJson() { builderHost.style.display='none'; cmWrap.style.display=''; try { editor.refresh && editor.refresh(); } catch(_){} toggleBtn.textContent='Revenir au constructeur visuel'; try { localStorage.setItem(MODE_KEY, 'json'); } catch(_){} }
				let initialMode = 'builder'; try { initialMode = localStorage.getItem(MODE_KEY) || 'builder'; } catch(_){ }
				if (initialMode === 'json') { showJson(); } else { showBuilder(); }
				toggleBtn.addEventListener('click', () => {
					const isBuilderVisible = builderHost.style.display !== 'none';
					if (isBuilderVisible) showJson(); else {
						try { JSON.parse(editor.getValue()||'[]'); } catch(e){ if(!confirm('Le JSON n\'est pas valide. Revenir quand même au constructeur ?')) return; }
						showBuilder();
					}
				});

				snippetBtn.addEventListener('click', () => {
					const id = snippetSelect.value; if (!id) return;
					const sn = buildSnippet(id); if (!sn) return;
					const cur = (function(){ try { return JSON.parse(editor.getValue()||'[]'); } catch(_) { return []; } })();
					const next = cur.concat(sn);
					if (typeof builderHost.__ubSetTests === 'function') builderHost.__ubSetTests(next); else editor.setValue(JSON.stringify(next, null, 2));
					snippetSelect.value = '';
				});

				const form = ta.closest('form');
				if (form) {
					form.addEventListener('submit', (e) => {
						ta.value = editor.getValue();
						try { JSON.parse(ta.value); } catch(err) { e.preventDefault(); alert('Veuillez corriger le JSON avant de soumettre : ' + err.message); }
					});
				}

				try { const v = ta.value||''; if (v.trim()) editor.setValue(JSON.stringify(JSON.parse(v), null, 2)); } catch(_) {}
			} else {
				const adapter = { getValue: () => ta.value, setValue: (v) => { ta.value = v; } };
				attachUnitTestBuilder(builderHost, adapter, ta);
				snippetBtn.addEventListener('click', () => {
					const id = snippetSelect.value; if(!id) return; const sn = buildSnippet(id); if (!sn) return;
					const cur = (function(){ try { return JSON.parse(adapter.getValue()||'[]'); } catch(_) { return []; } })();
					const next = cur.concat(sn);
					if (typeof builderHost.__ubSetTests === 'function') builderHost.__ubSetTests(next); else adapter.setValue(JSON.stringify(next, null, 2));
					snippetSelect.value='';
				});
			}
		});
	}

	document.addEventListener('DOMContentLoaded', () => { initJsonEditors(); initUnitJsonEditors(); });
})();

console.log('Functional Tester app.js loaded with JSON editor enhancements');

// ----------------------
// Visual Step Builder UI
// ----------------------
function attachStepBuilder(host, editor, textarea) {
	// Utilities
	function escapeHtml(str){return String(str).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]);});}
	function getSteps() {
		try { return JSON.parse(editor.getValue() || '[]'); } catch (_) { return []; }
	}
	function setSteps(steps) {
		editor.setValue(JSON.stringify(steps, null, 2));
		renderList();
	}
	// Variables store (UI-only; optional apply into steps)
	let vars = {};
	let editIndex = null;

	// Create controls
	const card = document.createElement('div');
	card.className = 'card';
	const body = document.createElement('div');
	body.className = 'card-body';
	const title = document.createElement('h6');
	title.className = 'card-title mb-3';
	title.textContent = 'Constructeur d\'étapes (no-code)';

	const row = document.createElement('div');
	row.className = 'row g-2 align-items-end';

	// Fragments toolbar
	const fragBar = document.createElement('div');
	fragBar.className = 'd-flex justify-content-end gap-2 mb-2';
	const fragSelect = document.createElement('select');
	fragSelect.className = 'form-select form-select-sm w-auto';
	fragSelect.id = 'sb-fragment';
	fragSelect.innerHTML = [
		'<option value="" selected>— Fragment —</option>',
		'<option value="login">Login (email/mot de passe)</option>',
		'<option value="logout">Logout (bouton)</option>',
		'<option value="openMenu">Ouvrir menu</option>',
		'<option value="dashboardCheck">Vérifier dashboard</option>'
	].join('');
	const fragBtn = document.createElement('button');
	fragBtn.type = 'button';
	fragBtn.className = 'btn btn-sm btn-outline-primary';
	fragBtn.id = 'sb-insert-fragment';
	fragBtn.textContent = 'Insérer';
	fragBar.appendChild(fragSelect);
	fragBar.appendChild(fragBtn);
	const varsCard = document.createElement('div');
	varsCard.className = 'card mb-2';
	varsCard.innerHTML = [
		'<div class="card-body">',
		'  <div class="d-flex justify-content-between align-items-center mb-2">',
		'    <strong>Variables (facultatif)</strong>',
		'    <button type="button" class="btn btn-sm btn-outline-secondary" id="sb-apply-vars" title="Remplacer {{var}} dans les étapes">Appliquer aux étapes</button>',
		'  </div>',
		'  <div class="input-group input-group-sm mb-2">',
		'    <span class="input-group-text">Nom</span>',
		'    <input type="text" class="form-control" id="sb-var-name" placeholder="ex: email">',
		'    <span class="input-group-text">Valeur</span>',
		'    <input type="text" class="form-control" id="sb-var-value" placeholder="ex: admin@exemple.fr">',
		'    <button type="button" class="btn btn-outline-secondary" id="sb-add-var">Ajouter</button>',
		'  </div>',
		'  <ul class="list-group list-group-flush small" id="sb-vars-list"></ul>',
		'</div>'
	].join('');


	// Action select
		const colAction = document.createElement('div');
	colAction.className = 'col-12 col-md-3';
	colAction.innerHTML = [
		'<label class="form-label">Action</label>',
		'<select class="form-select form-select-sm" id="sb-action">',
		'  <option value="goto">Aller à une URL</option>',
		'  <option value="fill">Remplir un champ</option>',
		'  <option value="click">Cliquer</option>',
		'  <option value="hover">Survoler</option>',
		'  <option value="select">Sélectionner (liste)</option>',
		'  <option value="wait">Attendre (millisecondes)</option>',
		'  <option value="waitFor">Attendre un sélecteur</option>',
		'  <option value="scroll">Faire défiler vers sélecteur</option>',
		'  <option value="press">Appuyer sur une touche</option>',
		'  <option value="expectText">Vérifier un texte</option>',
		'  <option value="expectUrl">Vérifier l\'URL contient</option>',
		'  <option value="expectTitle">Vérifier le titre contient</option>',
		'  <option value="expectVisible">Vérifier visible</option>',
		'  <option value="expectHidden">Vérifier caché</option>',
		'  <option value="expectAttribute">Vérifier attribut</option>',
		'  <option value="expectCount">Vérifier nombre d\'éléments</option>',
		'  <option value="screenshot">Capturer une image</option>',
		'  <option value="viewport">Définir le viewport</option>',
					'  <option value="userAgent">Définir le User-Agent</option>',
					'  <option value="raw">Étape personnalisée (JSON)</option>',
		'</select>'
	].join('');

	// Params columns
	const colUrl = document.createElement('div');
	colUrl.className = 'col-12 col-md-3 sb-field sb-field-url';
	colUrl.innerHTML = '<label class="form-label">URL</label><input type="url" class="form-control form-control-sm" id="sb-url" placeholder="https://exemple.com">';

	const colSelector = document.createElement('div');
	colSelector.className = 'col-12 col-md-3 sb-field sb-field-selector';
	colSelector.innerHTML = '<label class="form-label">Sélecteur</label><input type="text" class="form-control form-control-sm" id="sb-selector" placeholder="#id, .classe, [name=...]">';

	const colValue = document.createElement('div');
	colValue.className = 'col-12 col-md-3 sb-field sb-field-value';
	colValue.innerHTML = '<label class="form-label">Valeur</label><input type="text" class="form-control form-control-sm" id="sb-value" placeholder="texte à saisir">';

	// Champ pour nom d'attribut (expectAttribute)
	const colAttr = document.createElement('div');
	colAttr.className = 'col-12 col-md-3 sb-field sb-field-attr';
	colAttr.innerHTML = '<label class="form-label">Attribut</label><input type="text" class="form-control form-control-sm" id="sb-attr" placeholder="ex: href, data-id">';

	// Champ pour nombre attendu (expectCount)
	const colCount = document.createElement('div');
	colCount.className = 'col-12 col-md-3 sb-field sb-field-count';
	colCount.innerHTML = '<label class="form-label">Nombre attendu</label><input type="number" min="0" class="form-control form-control-sm" id="sb-count" placeholder="ex: 3">';

	const colText = document.createElement('div');
	colText.className = 'col-12 col-md-3 sb-field sb-field-text';
	colText.innerHTML = '<label class="form-label">Texte attendu</label><input type="text" class="form-control form-control-sm" id="sb-text" placeholder="texte à vérifier">';

	// Additional fields
	const colMs = document.createElement('div');
	colMs.className = 'col-6 col-md-3 sb-field sb-field-ms';
	colMs.innerHTML = '<label class="form-label">Millisecondes</label><input type="number" min="0" class="form-control form-control-sm" id="sb-ms" placeholder="ex: 1000">';

	const colContains = document.createElement('div');
	colContains.className = 'col-12 col-md-3 sb-field sb-field-contains';
	colContains.innerHTML = '<label class="form-label">Contient</label><input type="text" class="form-control form-control-sm" id="sb-contains" placeholder="fragment">';

	const colKey = document.createElement('div');
	colKey.className = 'col-6 col-md-3 sb-field sb-field-key';
	colKey.innerHTML = '<label class="form-label">Touche</label><input type="text" class="form-control form-control-sm" id="sb-key" placeholder="Enter, Tab, ArrowDown...">';

	const colWidth = document.createElement('div');
	colWidth.className = 'col-6 col-md-2 sb-field sb-field-width';
	colWidth.innerHTML = '<label class="form-label">Largeur</label><input type="number" min="320" class="form-control form-control-sm" id="sb-width" placeholder="1280">';

	const colHeight = document.createElement('div');
	colHeight.className = 'col-6 col-md-2 sb-field sb-field-height';
	colHeight.innerHTML = '<label class="form-label">Hauteur</label><input type="number" min="480" class="form-control form-control-sm" id="sb-height" placeholder="800">';

	const colUA = document.createElement('div');
	colUA.className = 'col-12 col-md-6 sb-field sb-field-ua';
	colUA.innerHTML = '<label class="form-label">User-Agent</label><input type="text" class="form-control form-control-sm" id="sb-ua" placeholder="Mozilla/5.0 ...">';

	// Raw JSON step
	const colRaw = document.createElement('div');
	colRaw.className = 'col-12 sb-field sb-field-raw';
	colRaw.innerHTML = '<label class="form-label">Objet JSON de l\'étape</label><textarea class="form-control form-control-sm" id="sb-raw" rows="4" placeholder="{ \"action\": \"custom\", ... }"></textarea>';

	// Buttons
	const colBtns = document.createElement('div');
	colBtns.className = 'col-12 col-md-12 d-flex gap-2';
		colBtns.innerHTML = [
			'<button type="button" class="btn btn-sm btn-primary" id="sb-add">Ajouter l\'étape</button>',
			'<button type="button" class="btn btn-sm btn-success d-none" id="sb-save">Mettre à jour</button>',
		'<button type="button" class="btn btn-sm btn-outline-secondary" id="sb-clear">Vider</button>',
		'<button type="button" class="btn btn-sm btn-outline-primary" id="sb-example">Exemple basique</button>',
		'<button type="button" class="btn btn-sm btn-outline-success" id="sb-test">Tester</button>'
	].join(' ');

	row.append(colAction, colUrl, colSelector, colValue, colAttr, colCount, colText, colMs, colContains, colKey, colWidth, colHeight, colUA, colRaw, colBtns);

	const list = document.createElement('ul');
	list.className = 'list-group mt-3';
	list.id = 'sb-list';

	// Output panel for run results (inline, no alert)
	const validateOut = document.createElement('div');
	validateOut.id = 'sb-validate-output';
	validateOut.className = 'mt-2 small';

	const runOut = document.createElement('div');
	runOut.id = 'sb-run-output';
	runOut.className = 'mt-3 small';
	runOut.setAttribute('role', 'status');
	runOut.setAttribute('aria-live', 'polite');

	body.append(title, fragBar, row, varsCard, validateOut, list, runOut);
	card.appendChild(body);
	host.appendChild(card);

	const selAction = card.querySelector('#sb-action');
	const inpUrl = card.querySelector('#sb-url');
	const inpSel = card.querySelector('#sb-selector');
	const inpVal = card.querySelector('#sb-value');
	const inpText = card.querySelector('#sb-text');
	const inpMs = () => document.getElementById('sb-ms');
	const inpContains = () => document.getElementById('sb-contains');
	const inpKey = () => document.getElementById('sb-key');
	const inpWidth = () => document.getElementById('sb-width');
	const inpHeight = () => document.getElementById('sb-height');
	const inpUA = () => document.getElementById('sb-ua');

	// Field highlighting helpers for validation feedback
	const fieldCols = [colUrl, colSelector, colValue, colAttr, colCount, colText, colMs, colContains, colKey, colWidth, colHeight, colUA, colRaw];
	function clearFieldErrors() {
		fieldCols.forEach(c => { if (c && c.classList) c.classList.remove('sb-field-error'); });
		try { card.querySelectorAll('.form-control').forEach(i => i.removeAttribute('aria-invalid')); } catch(_){}
	}
	function markFieldForError(msg) {
		if (!msg) return null;
		const m = String(msg).toLowerCase();
		// Order matters to avoid ambiguous matches
		if (m.includes('selector')) { if (colSelector) colSelector.classList.add('sb-field-error'); return colSelector && colSelector.querySelector('input,textarea'); }
		if (m.includes('attribute') || m.includes('attribute name')) { if (colAttr) colAttr.classList.add('sb-field-error'); return colAttr && colAttr.querySelector('input'); }
		if (m.includes('count')) { if (colCount) colCount.classList.add('sb-field-error'); return colCount && colCount.querySelector('input'); }
		if (m.includes('(goto):') || m.includes('url') || m.includes('invalid url')) { if (colUrl) colUrl.classList.add('sb-field-error'); return colUrl && colUrl.querySelector('input'); }
		if (m.includes('ms') || m.includes('timeout')) { if (colMs) colMs.classList.add('sb-field-error'); return colMs && colMs.querySelector('input'); }
		if (m.includes('key')) { if (colKey) colKey.classList.add('sb-field-error'); return colKey && colKey.querySelector('input'); }
		if (m.includes('title')) { if (colText) colText.classList.add('sb-field-error'); return colText && colText.querySelector('input'); }
		if (m.includes('text')) { if (colValue) colValue.classList.add('sb-field-error'); return colValue && colValue.querySelector('input'); }
		if (m.includes('contains')) { if (colContains) colContains.classList.add('sb-field-error'); return colContains && colContains.querySelector('input'); }
		if (m.includes('value')) { if (colValue) colValue.classList.add('sb-field-error'); return colValue && colValue.querySelector('input'); }
		// fallback: highlight selector container
		if (colSelector) { colSelector.classList.add('sb-field-error'); return colSelector.querySelector('input,textarea'); }
		return null;
	}

	// Help texts under fields (shown on focus)
	function makeHelp(text) { const d = document.createElement('div'); d.className = 'form-text d-none'; d.textContent = text; return d; }
	function attachHelp(input, help) { if (!input || !help) return; input.addEventListener('focus', () => help.classList.remove('d-none')); input.addEventListener('blur', () => help.classList.add('d-none')); }

	const helpUrl = makeHelp("Adresse complète de la page à ouvrir (ex: https://exemple.com)");
	inpUrl && inpUrl.insertAdjacentElement('afterend', helpUrl);
	attachHelp(inpUrl, helpUrl);

	const helpSel = makeHelp("Sélecteur CSS de l'élément cible (ex: #id, .classe, [name=email])");
	inpSel && inpSel.insertAdjacentElement('afterend', helpSel);
	attachHelp(inpSel, helpSel);

	const helpVal = makeHelp("Texte ou valeur à saisir (ex: john@doe.com)");
	inpVal && inpVal.insertAdjacentElement('afterend', helpVal);
	attachHelp(inpVal, helpVal);

	const helpText = makeHelp("Fragment de texte attendu pour la vérification");
	inpText && inpText.insertAdjacentElement('afterend', helpText);
	attachHelp(inpText, helpText);

	const msEl = inpMs(); if (msEl) { const h = makeHelp("Durée d'attente en millisecondes (1000 = 1 seconde)"); msEl.insertAdjacentElement('afterend', h); attachHelp(msEl, h); }
	const containsEl = inpContains(); if (containsEl) { const h = makeHelp("Fragment devant être présent dans l'URL courante"); containsEl.insertAdjacentElement('afterend', h); attachHelp(containsEl, h); }
	const keyEl = inpKey(); if (keyEl) { const h = makeHelp("Nom de la touche à simuler (ex: Enter, Tab, ArrowDown)"); keyEl.insertAdjacentElement('afterend', h); attachHelp(keyEl, h); }
	const widthEl = inpWidth(); if (widthEl) { const h = makeHelp("Largeur du viewport en pixels"); widthEl.insertAdjacentElement('afterend', h); attachHelp(widthEl, h); }
	const heightEl = inpHeight(); if (heightEl) { const h = makeHelp("Hauteur du viewport en pixels"); heightEl.insertAdjacentElement('afterend', h); attachHelp(heightEl, h); }
	const uaEl = inpUA(); if (uaEl) { const h = makeHelp("Chaîne User-Agent envoyée au site"); uaEl.insertAdjacentElement('afterend', h); attachHelp(uaEl, h); }

	// Permanent help text for the action select
	function getActionHelp(a) {
		switch (a) {
			case 'goto': return "Ouvre l'URL fournie et attend le chargement de la page.";
			case 'fill': return "Saisit une valeur dans le champ ciblé par un sélecteur CSS.";
			case 'click': return "Clique sur l'élément ciblé; attend brièvement l'activité réseau.";
			case 'hover': return "Survole l'élément ciblé (ex: pour faire apparaître un menu).";
			case 'select': return "Choisit une option dans une liste déroulante.";
			case 'wait': return "Met en pause l'exécution pendant X millisecondes.";
			case 'waitFor': return "Attend l'apparition d'un élément correspondant au sélecteur.";
			case 'scroll': return "Fait défiler la page jusqu’à l’élément ciblé.";
			case 'press': return "Simule l'appui d'une touche clavier (ex: Enter).";
			case 'expectText': return "Vérifie qu'un élément contient un texte donné.";
			case 'expectUrl': return "Vérifie que l'URL courante contient un fragment texte.";
			case 'expectTitle': return "Vérifie que le titre de la page contient un fragment texte.";
			case 'expectVisible': return "Vérifie que l'élément ciblé est présent et visible (affiché).";
			case 'expectHidden': return "Vérifie que l'élément ciblé est absent ou masqué (non visible).";
			case 'expectAttribute': return "Vérifie que l'attribut spécifié possède la valeur attendue.";
			case 'expectCount': return "Vérifie que le nombre d'éléments correspondant au sélecteur est égal au nombre attendu.";
			case 'screenshot': return "Capture une image de la page à cet instant.";
			case 'viewport': return "Définit la taille de la fenêtre (utile pour le responsive).";
			case 'userAgent': return "Change le User-Agent envoyé aux sites (détection mobile/bot).";
			case 'raw': return "Définissez manuellement une étape au format JSON (avancé).";
			default: return "Sélectionnez une action à ajouter à votre scénario.";
		}
	}
	const helpAction = document.createElement('div');
	helpAction.className = 'form-text mt-1';
	const setActionHelp = () => { helpAction.textContent = getActionHelp(selAction.value); };
	selAction.insertAdjacentElement('afterend', helpAction);
	setActionHelp();

	function updateVisibleFields() {
		const a = selAction.value;
		// reset all
		[colUrl, colSelector, colValue, colAttr, colCount, colText, colMs, colContains, colKey, colWidth, colHeight, colUA, colRaw].forEach(c => c.style.display = 'none');
		if (a === 'goto') colUrl.style.display = '';
		if (a === 'fill') { colSelector.style.display=''; colValue.style.display=''; }
		if (a === 'click' || a === 'hover' || a === 'scroll') { colSelector.style.display=''; }
		if (a === 'select') { colSelector.style.display=''; colValue.style.display=''; }
		if (a === 'wait') { colMs.style.display=''; }
		if (a === 'waitFor') { colSelector.style.display=''; colMs.style.display=''; }
		if (a === 'press') { colKey.style.display=''; colSelector.style.display=''; }
		if (a === 'expectText') { colSelector.style.display=''; colText.style.display=''; }
		if (a === 'expectUrl') { colContains.style.display=''; }
		if (a === 'expectTitle') { colText.style.display=''; }
		if (a === 'expectVisible' || a === 'expectHidden') { colSelector.style.display=''; }
		if (a === 'expectAttribute') { colSelector.style.display=''; colAttr.style.display=''; colValue.style.display=''; }
		if (a === 'expectCount') { colSelector.style.display=''; colCount.style.display=''; }
		if (a === 'viewport') { colWidth.style.display=''; colHeight.style.display=''; }
		if (a === 'userAgent') { colUA.style.display=''; }
		if (a === 'raw') { colRaw.style.display=''; }
		setActionHelp();
	}
	selAction.addEventListener('change', updateVisibleFields);
	updateVisibleFields();

	// Actions
		function buildStepFromFields() {
		const a = selAction.value;
		const step = { action: a };
		if (a === 'goto') {
			let url = (inpUrl.value||'').trim();
			if (!url) { alert('Veuillez saisir une URL'); return; }
			// Auto-compléter si l’utilisateur oublie le schéma
			if (!/^https?:\/\//i.test(url)) {
				if (/^[\w.-]+\.[A-Za-z]{2,}(?:\/.*)?$/.test(url)) {
					url = 'https://' + url;
				} else {
					alert('Veuillez saisir une URL complète commençant par http:// ou https://');
					return;
				}
			}
			step.url = url;
		} else if (a === 'fill') {
			if (!inpSel.value) { alert('Veuillez saisir un sélecteur'); return; }
			step.selector = inpSel.value;
			step.value = inpVal.value || '';
		} else if (a === 'click') {
			if (!inpSel.value) { alert('Veuillez saisir un sélecteur'); return; }
			step.selector = inpSel.value;
		} else if (a === 'hover') {
			if (!inpSel.value) { alert('Veuillez saisir un sélecteur'); return; }
			step.selector = inpSel.value;
		} else if (a === 'select') {
			if (!inpSel.value) { alert('Veuillez saisir un sélecteur'); return; }
			step.selector = inpSel.value;
			step.value = inpVal.value || '';
		} else if (a === 'wait') {
			const ms = parseInt((document.getElementById('sb-ms').value||'0'), 10);
			if (!ms || ms < 0) { alert('Veuillez saisir un nombre de millisecondes'); return; }
			step.ms = ms;
		} else if (a === 'waitFor') {
			if (!inpSel.value) { alert('Veuillez saisir un sélecteur'); return; }
			step.selector = inpSel.value;
			const ms = parseInt((document.getElementById('sb-ms').value||'0'), 10);
			if (ms > 0) step.timeout = ms;
		} else if (a === 'scroll') {
			if (!inpSel.value) { alert('Veuillez saisir un sélecteur'); return; }
			step.selector = inpSel.value;
		} else if (a === 'press') {
			const key = (document.getElementById('sb-key').value||'').trim();
			if (!key) { alert('Veuillez saisir une touche (ex: Enter)'); return; }
			step.key = key; if (inpSel.value) step.selector = inpSel.value;
		} else if (a === 'expectText') {
			if (!inpSel.value) { alert('Veuillez saisir un sélecteur'); return; }
			step.selector = inpSel.value;
			step.text = inpText.value || '';
		} else if (a === 'expectUrl') {
			const c = (document.getElementById('sb-contains').value||'').trim();
			if (!c) { alert("Veuillez saisir un fragment d'URL"); return; }
			step.contains = c;
		} else if (a === 'expectTitle') {
			const t = (inpText.value||'').trim();
			if (!t) { alert('Veuillez saisir un fragment de titre'); return; }
			step.text = t;
		} else if (a === 'expectVisible') {
			if (!inpSel.value) { alert('Veuillez saisir un sélecteur'); return; }
			step.selector = inpSel.value;
		} else if (a === 'expectHidden') {
			if (!inpSel.value) { alert('Veuillez saisir un sélecteur'); return; }
			step.selector = inpSel.value;
		} else if (a === 'expectAttribute') {
			if (!inpSel.value) { alert('Veuillez saisir un sélecteur'); return; }
			const attr = (document.getElementById('sb-attr').value||'').trim();
			if (!attr) { alert("Veuillez saisir un nom d'attribut"); return; }
			const val = (document.getElementById('sb-value').value||'').trim();
			if (!val) { alert('Veuillez saisir une valeur attendue'); return; }
			step.selector = inpSel.value; step.attribute = attr; step.value = val;
		} else if (a === 'expectCount') {
			if (!inpSel.value) { alert('Veuillez saisir un sélecteur'); return; }
			const cnt = parseInt((document.getElementById('sb-count').value||'').trim(), 10);
			if (isNaN(cnt)) { alert('Veuillez saisir un nombre attendu'); return; }
			step.selector = inpSel.value; step.count = cnt;
		} else if (a === 'screenshot') {
			// nothing to configure
		} else if (a === 'viewport') {
			const w = parseInt((document.getElementById('sb-width').value||'1280'), 10);
			const h = parseInt((document.getElementById('sb-height').value||'800'), 10);
			step.width = w; step.height = h;
		} else if (a === 'userAgent') {
			const ua = (document.getElementById('sb-ua').value||'').trim();
			if (!ua) { alert('Veuillez saisir un User-Agent'); return; }
			step.ua = ua;
		} else if (a === 'raw') {
			const raw = (document.getElementById('sb-raw').value||'').trim();
			if (!raw) { alert('Veuillez saisir un objet JSON'); return; }
			try {
				const obj = JSON.parse(raw);
				if (typeof obj !== 'object' || Array.isArray(obj)) throw new Error('L\'étape doit être un objet JSON');
				return obj; // bypass default 'step' wrapper
			} catch (e) {
				alert('JSON invalide: ' + e.message);
				return;
			}
		}
			return step;
		}
		function resetFields() {
			inpUrl.value = ''; inpSel.value=''; inpVal.value=''; inpText.value='';
		}
		const btnAdd = card.querySelector('#sb-add');
		const btnSave = card.querySelector('#sb-save');
		btnAdd.addEventListener('click', () => {
			(async function(){
				const step = buildStepFromFields();
				if (!step) return;
				validateOut.innerHTML = '';
				clearFieldErrors();
				btnAdd.disabled = true;
				try {
					const resp = await fetch('/scenario/builder/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ steps: [step] }) });
					const data = await resp.json();
					if (!data.success && Array.isArray(data.errors) && data.errors.length) {
						// Show messages and highlight corresponding fields
						validateOut.innerHTML = '<div class="text-danger">' + data.errors.map(e => escapeHtml(String(e))).join('<br>') + '</div>';
						let firstFocus = null;
						for (const e of data.errors) {
							const el = markFieldForError(e);
							if (el && !firstFocus) firstFocus = el;
						}
						if (firstFocus) { try { firstFocus.focus(); firstFocus.setAttribute('aria-invalid', 'true'); } catch(_){} }
						return;
					}
					if (Array.isArray(data.warnings) && data.warnings.length) {
						validateOut.innerHTML = '<div class="text-warning">' + data.warnings.map(e => escapeHtml(String(e))).join('<br>') + '</div>';
					} else {
						validateOut.innerHTML = '<div class="text-success">Validation OK</div>';
					}
					const steps = getSteps();
					steps.push(step);
					setSteps(steps);
					resetFields();
				} catch (e) {
					validateOut.textContent = (e && e.message) ? 'Validation failed: ' + e.message : 'Validation failed';
				} finally { btnAdd.disabled = false; }
			})();
		});
		btnSave.addEventListener('click', () => {
			(async function(){
				const step = buildStepFromFields();
				if (!step) return;
				validateOut.innerHTML = '';
				clearFieldErrors();
				btnSave.disabled = true;
				try {
					const resp = await fetch('/scenario/builder/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ steps: [step] }) });
					const data = await resp.json();
					if (!data.success && Array.isArray(data.errors) && data.errors.length) {
						validateOut.innerHTML = '<div class="text-danger">' + data.errors.map(e => escapeHtml(String(e))).join('<br>') + '</div>';
						let firstFocus = null;
						for (const e of data.errors) {
							const el = markFieldForError(e);
							if (el && !firstFocus) firstFocus = el;
						}
						if (firstFocus) { try { firstFocus.focus(); firstFocus.setAttribute('aria-invalid', 'true'); } catch(_){} }
						return;
					}
					if (Array.isArray(data.warnings) && data.warnings.length) {
						validateOut.innerHTML = '<div class="text-warning">' + data.warnings.map(e => escapeHtml(String(e))).join('<br>') + '</div>';
					} else {
						validateOut.innerHTML = '<div class="text-success">Validation OK</div>';
					}
					const steps = getSteps();
					if (editIndex === null || editIndex < 0 || editIndex >= steps.length) return;
					steps[editIndex] = step;
					setSteps(steps);
					editIndex = null;
					btnSave.classList.add('d-none');
					btnAdd.classList.remove('d-none');
					resetFields();
				} catch (e) {
					validateOut.textContent = (e && e.message) ? 'Validation failed: ' + e.message : 'Validation failed';
				} finally { btnSave.disabled = false; }
			})();
		});

	card.querySelector('#sb-clear').addEventListener('click', () => {
		if (confirm('Vider toutes les étapes ?')) setSteps([]);
	});

	card.querySelector('#sb-example').addEventListener('click', () => {
		const sample = [
			{ action: 'goto', url: 'https://example.org' },
			{ action: 'expectText', selector: 'h1', text: 'Example Domain' }
		];
		setSteps(sample);
	});

	// Variables UI behavior
	const varsList = () => document.getElementById('sb-vars-list');
	const inVarName = () => document.getElementById('sb-var-name');
	const inVarValue = () => document.getElementById('sb-var-value');
	function renderVars() {
		const ul = varsList(); if (!ul) return;
		ul.innerHTML = '';
		Object.keys(vars).forEach((k) => {
			const li = document.createElement('li');
			li.className = 'list-group-item d-flex justify-content-between align-items-center';
			li.innerHTML = '<span><code>{{'+k+'}}</code> = ' + escapeHtml(String(vars[k])) + '</span>'+
				'<div class="btn-group btn-group-sm">'+
				'<button type="button" class="btn btn-outline-secondary" data-k="'+k+'" data-act="edit">Éditer</button>'+
				'<button type="button" class="btn btn-outline-danger" data-k="'+k+'" data-act="del">Suppr.</button>'+
				'</div>';
			li.addEventListener('click', (e) => {
				const btn = e.target.closest('button'); if (!btn) return;
				const key = btn.getAttribute('data-k'); const act = btn.getAttribute('data-act');
				if (act === 'del') { delete vars[key]; renderVars(); }
				if (act === 'edit') { const nv = prompt('Nouvelle valeur pour '+key, vars[key]||''); if (nv!==null) { vars[key]=nv; renderVars(); } }
			});
			ul.appendChild(li);
		});
	}
	function replaceVarsInString(s) {
		if (typeof s !== 'string' || !s) return s;
		return s.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (m, g1) => {
			return Object.prototype.hasOwnProperty.call(vars, g1) ? String(vars[g1]) : m;
		});
	}
	function applyVarsToSteps() {
		const steps = getSteps();
		const walk = (obj) => {
			if (Array.isArray(obj)) return obj.map(walk);
			if (obj && typeof obj === 'object') {
				const out = {}; Object.keys(obj).forEach(k => { out[k] = walk(obj[k]); }); return out;
			}
			if (typeof obj === 'string') return replaceVarsInString(obj);
			return obj;
		};
		setSteps(steps.map(walk));
	}
	const btnAddVar = () => document.getElementById('sb-add-var');
	const btnApplyVars = () => document.getElementById('sb-apply-vars');
	if (btnAddVar()) btnAddVar().addEventListener('click', () => {
		const k = (inVarName().value||'').trim(); const v = (inVarValue().value||'').trim(); if (!k) return;
		vars[k] = v; renderVars();
		// Ne pas vider les champs pour que l'utilisateur puisse appliquer plusieurs fois ou ajuster
	});
	if (btnApplyVars()) btnApplyVars().addEventListener('click', () => { applyVarsToSteps(); });
	renderVars();

	// Fragments insertion
	function buildFragment(id) {
		switch(id) {
			case 'login':
				return [
					{ action: 'goto', url: '/login' },
					{ action: 'fill', selector: '[name=email], #email, input[type=email]', value: '{{email}}' },
					{ action: 'fill', selector: '[name=password], #password, input[type=password]', value: '{{password}}' },
					{ action: 'click', selector: 'button[type=submit], .btn-primary' },
					{ action: 'waitFor', selector: '#dashboard, [data-page="dashboard"]', timeout: 5000 }
				];
			case 'logout':
				return [
					{ action: 'click', selector: 'a[href*="logout"], .logout, [data-action="logout"]' },
					{ action: 'wait', ms: 500 }
				];
			case 'openMenu':
				return [
					{ action: 'click', selector: '.navbar-toggler, [data-bs-toggle="collapse"]' },
					{ action: 'wait', ms: 300 }
				];
			case 'dashboardCheck':
				return [
					{ action: 'expectText', selector: 'h1, h2', text: 'Dashboard' }
				];
			default:
				return null;
		}
	}
	fragBtn.addEventListener('click', () => {
		const id = fragSelect.value; if (!id) return;
		const frag = buildFragment(id); if (!frag) return;
		const cur = getSteps(); setSteps(cur.concat(frag)); fragSelect.value = '';
	});

	const btnTest = card.querySelector('#sb-test');
	btnTest.addEventListener('click', async () => {
		const steps = getSteps();
			// Read baseUrl live from form if present
			let baseUrl = null;
			const baseInput = document.querySelector('input[name="test_scenario[baseUrl]"]');
			if (baseInput && baseInput.value.trim()) baseUrl = baseInput.value.trim();
		// UX feedback
		const orig = btnTest.textContent;
		btnTest.disabled = true;
		btnTest.textContent = 'Exécution…';
		runOut.textContent = 'Exécution en cours…';
		runOut.classList.remove('text-danger', 'text-success');
		try {
			// Post to the correct Symfony route under /scenario prefix
			const resp = await fetch('/scenario/builder/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ steps, baseUrl })
			});
			let data;
			try { data = await resp.json(); }
			catch(_) { throw new Error('Réponse invalide du serveur'); }
			const ok = !!data.success;
			let html = (ok ? '<span class="text-success">Test réussi ✅</span>' : '<span class="text-danger">Échec du test ❌</span>');
			// Affiche erreurs si présentes
			if (data.errors && data.errors.length) {
				html += '<ul class="mt-2 mb-0">' + data.errors.map(e => '<li>' + String(e) + '</li>').join('') + '</ul>';
			}
			// Affiche un bref résumé des étapes si fourni
			let firstFailedIndex = -1;
			if (Array.isArray(data.steps) && data.steps.length) {
				const items = data.steps.slice(0, 50).map((s, i) => {
					const label = (s.action || s.name || ('Étape ' + (i+1)));
					const okStep = (s.ok === true || s.success === true);
					if (!okStep && firstFailedIndex === -1) firstFailedIndex = i;
					return '<li>' + (i+1) + '. ' + (okStep ? '✔ ' : '• ') + String(label) + '</li>';
				}).join('');
				html += '<div class="mt-2">Aperçu des étapes:</div><ul class="mb-0">' + items + '</ul>';
			}
			runOut.innerHTML = html;
			runOut.classList.add(ok ? 'text-success' : 'text-danger');
			// Mettre en évidence l’étape en échec dans la liste visuelle
			if (!ok) {
				// Essayer de déduire la première étape non ok si non fournie
				if (typeof firstFailedIndex === 'number' && firstFailedIndex >= 0) {
					const li = list && list.children && list.children[firstFailedIndex];
					if (li) { li.classList.add('border','border-danger'); li.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
				}
			}
		} catch (e) {
			runOut.textContent = (e && e.message) ? e.message : 'Erreur inconnue lors du test';
			runOut.classList.add('text-danger');
		} finally {
			btnTest.disabled = false;
			btnTest.textContent = orig;
		}
	});

	function renderList() {
		const steps = getSteps();
		list.innerHTML = '';
			steps.forEach((s, idx) => {
			const li = document.createElement('li');
			li.className = 'list-group-item d-flex justify-content-between align-items-center';
			const summary = summarizeStep(s);
				li.innerHTML = '<span>' + summary + '</span>' +
					'<span class="btn-group btn-group-sm">' +
					'<button type="button" class="btn btn-outline-primary" data-act="edit">Éditer</button>' +
				'<button type="button" class="btn btn-outline-secondary" data-act="up">↑</button>' +
				'<button type="button" class="btn btn-outline-secondary" data-act="down">↓</button>' +
				'<button type="button" class="btn btn-outline-danger" data-act="del">Suppr.</button>' +
				'</span>';
				li.querySelector('[data-act="edit"]').addEventListener('click', () => edit(idx));
			li.querySelector('[data-act="up"]').addEventListener('click', () => move(idx, -1));
			li.querySelector('[data-act="down"]').addEventListener('click', () => move(idx, +1));
			li.querySelector('[data-act="del"]').addEventListener('click', () => del(idx));
			list.appendChild(li);
		});
	}
	function summarizeStep(s) {
		switch (s.action) {
			case 'goto': return 'Aller à: ' + (s.url || '');
			case 'fill': return 'Remplir ' + (s.selector || '') + ' avec "' + (s.value || '') + '"';
			case 'click': return 'Cliquer ' + (s.selector || '');
			case 'hover': return 'Survoler ' + (s.selector || '');
			case 'select': return 'Sélectionner ' + (s.selector || '') + ' valeur "' + (s.value || '') + '"';
			case 'wait': return 'Attendre ' + (s.ms || s.timeout || 0) + ' ms';
			case 'waitFor': return 'Attendre le sélecteur ' + (s.selector || '') + (s.timeout ? ' ('+s.timeout+'ms)' : '');
			case 'scroll': return 'Faire défiler vers ' + (s.selector || '');
			case 'press': return 'Appuyer sur la touche ' + (s.key || '');
			case 'expectText': return 'Vérifier ' + (s.selector || '') + ' contient "' + (s.text || '') + '"';
			case 'expectUrl': return 'Vérifier URL contient "' + (s.contains || s.urlContains || '') + '"';
			case 'expectTitle': return 'Vérifier le titre contient "' + (s.text || '') + '"';
			case 'expectVisible': return 'Vérifier visible: ' + (s.selector || '');
			case 'expectHidden': return 'Vérifier caché: ' + (s.selector || '');
			case 'expectAttribute': return 'Vérifier attribut ' + (s.selector || '') + ' ' + (s.attribute || '') + '="' + (s.value || '') + '"';
			case 'expectCount': return 'Vérifier nombre (' + (s.selector || '') + ') = ' + (typeof s.count !== 'undefined' ? s.count : '0');
			case 'screenshot': return 'Capturer une image';
			case 'viewport': return 'Viewport ' + (s.width || 0) + 'x' + (s.height || 0);
			case 'userAgent': return 'User-Agent personnalisé';
			default:
				// If user provided a raw step without known action
				if (s && typeof s === 'object' && !s.action) return 'Étape personnalisée (JSON)';
				return JSON.stringify(s);
		}
	}
	function move(i, delta) {
		const steps = getSteps();
		const j = i + delta;
		if (j < 0 || j >= steps.length) return;
		const tmp = steps[i];
		steps[i] = steps[j];
		steps[j] = tmp;
		setSteps(steps);
	}
	function del(i) {
		const steps = getSteps();
		steps.splice(i, 1);
		setSteps(steps);
	}
		function edit(i) {
			const steps = getSteps();
			const s = steps[i];
			if (!s) return;
			selAction.value = s.action || 'goto';
			updateVisibleFields();
			inpUrl.value = s.url || '';
			inpSel.value = s.selector || '';
			inpVal.value = s.value || '';
			inpText.value = s.text || '';
			editIndex = i;
			btnAdd.classList.add('d-none');
			btnSave.classList.remove('d-none');
		}

	// Expose minimal API to outer context (snippets, etc.)
	host.__sbSetSteps = setSteps;
	host.__sbRenderList = renderList;

	// Initial render from existing JSON
	renderList();
}

// ------------------------------
// Unit Test Builder (HTTP no-code)
// ------------------------------
function attachUnitTestBuilder(host, editor, textarea) {
	function getTests() { try { return JSON.parse(editor.getValue()||'[]'); } catch(_) { return []; } }
	function setTests(arr) { editor.setValue(JSON.stringify(arr, null, 2)); renderList(); }
	let editIndex = null;

	const card = document.createElement('div');
	card.className = 'card';
	const body = document.createElement('div');
	body.className = 'card-body';
	const title = document.createElement('h6');
	title.className = 'card-title mb-3';
	title.textContent = 'Constructeur de tests HTTP (no-code)';

	const row = document.createElement('div');
	row.className = 'row g-2 align-items-end';

	const colName = document.createElement('div');
	colName.className = 'col-12 col-md-4';
	colName.innerHTML = [
		'<div class="input-group input-group-sm mb-1">',
		'<span class="input-group-text" title="Nom du test">🧪</span>',
		'<input type="text" class="form-control" id="ub-name" placeholder="Nom du test (ex: GET / 200)">',
		'</div>',
		'<div class="form-text">Nom lisible du test. S’affiche en gras dans la liste.</div>'
	].join('');

	// New: Folder field for grouping tests visually
	const colFolder = document.createElement('div');
	colFolder.className = 'col-6 col-md-2';
	colFolder.innerHTML = [
		'<div class="input-group input-group-sm mb-1">',
		'<span class="input-group-text" title="Groupe / dossier">📁</span>',
		'<input type="text" class="form-control" id="ub-folder" placeholder="Dossier (ex: Auth)">',
		'</div>',
		'<div class="form-text">Regroupe visuellement les tests (badge).</div>'
	].join('');

	const colMethod = document.createElement('div');
	colMethod.className = 'col-6 col-md-2';
	colMethod.innerHTML = '<label class="form-label">Méthode</label><select class="form-select form-select-sm" id="ub-method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option></select>';

	const colUrl = document.createElement('div');
	colUrl.className = 'col-12 col-md-6';
	colUrl.innerHTML = '<label class="form-label">URL</label><input type="text" class="form-control form-control-sm" id="ub-url" placeholder="/api/... ou https://...">';

	const colHeaders = document.createElement('div');
	colHeaders.className = 'col-12 col-md-6';
	colHeaders.innerHTML = '<label class="form-label">En-têtes (JSON)</label><textarea class="form-control form-control-sm" id="ub-headers" rows="3" placeholder="{\n  \"Accept\": \"application/json\"\n}"></textarea>';

	const colBody = document.createElement('div');
	colBody.className = 'col-12 col-md-6';
	colBody.innerHTML = '<label class="form-label">Corps</label><textarea class="form-control form-control-sm" id="ub-body" rows="3" placeholder="Texte ou JSON"></textarea><div class="form-check mt-1"><input class="form-check-input" type="checkbox" id="ub-body-json"><label for="ub-body-json" class="form-check-label">Corps en JSON</label></div>';

	const colAssertStatus = document.createElement('div');
	colAssertStatus.className = 'col-6 col-md-2';
	colAssertStatus.innerHTML = '<label class="form-label">Statut attendu</label><input type="number" min="100" max="599" class="form-control form-control-sm" id="ub-astatus" placeholder="200">';

	const colAssertContains = document.createElement('div');
	colAssertContains.className = 'col-12 col-md-4';
	colAssertContains.innerHTML = '<label class="form-label">Contient (corps)</label><input type="text" class="form-control form-control-sm" id="ub-acontains" placeholder="fragment attendu dans la réponse">';

	const colAssertJsonPath = document.createElement('div');
	colAssertJsonPath.className = 'col-12 col-md-3';
	colAssertJsonPath.innerHTML = '<label class="form-label">JSON path</label><input type="text" class="form-control form-control-sm" id="ub-ajpath" placeholder="a.b.0.c">';

	const colAssertJsonEq = document.createElement('div');
	colAssertJsonEq.className = 'col-12 col-md-3';
	colAssertJsonEq.innerHTML = '<label class="form-label">Valeur attendue</label><input type="text" class="form-control form-control-sm" id="ub-ajeq" placeholder="valeur">';

	// Additional assertion inputs: variable and expression
	const colAssertJsonEqVar = document.createElement('div');
	colAssertJsonEqVar.className = 'col-12 col-md-3';
	colAssertJsonEqVar.innerHTML = '<label class="form-label">Valeur attendue (variable)</label><input type="text" class="form-control form-control-sm" id="ub-ajeqvar" placeholder="ex: A">';

	const colAssertJsonEqExpr = document.createElement('div');
	colAssertJsonEqExpr.className = 'col-12 col-md-3';
	colAssertJsonEqExpr.innerHTML = '<label class="form-label">Valeur attendue (expression)</label><input type="text" class="form-control form-control-sm" id="ub-ajeqexpr" placeholder="ex: A + B">';

	// Capture controls (no-code)
	const colCaptureVar = document.createElement('div');
	colCaptureVar.className = 'col-6 col-md-2';
	colCaptureVar.innerHTML = '<label class="form-label">Capture: variable</label><input type="text" class="form-control form-control-sm" id="ub-capvar" placeholder="ex: A">';

	const colCaptureType = document.createElement('div');
	colCaptureType.className = 'col-6 col-md-2';
	colCaptureType.innerHTML = '<label class="form-label">Type</label><select class="form-select form-select-sm" id="ub-captype"><option value="">—</option><option value="json">JSON path</option><option value="regex">Regex</option><option value="header">Header</option></select>';

	const colCaptureJson = document.createElement('div');
	colCaptureJson.className = 'col-12 col-md-3 ub-cap-field ub-cap-json';
	colCaptureJson.innerHTML = '<label class="form-label">Chemin JSON à capturer</label><input type="text" class="form-control form-control-sm" id="ub-capjson" placeholder="ex: value ou data.total">';

	const colCaptureRegex = document.createElement('div');
	colCaptureRegex.className = 'col-12 col-md-3 ub-cap-field ub-cap-regex';
	colCaptureRegex.innerHTML = '<label class="form-label">Regex sur le corps</label><input type="text" class="form-control form-control-sm" id="ub-capregex" placeholder="ex: total=(\\d+)">';

	const colCaptureHeader = document.createElement('div');
	colCaptureHeader.className = 'col-12 col-md-3 ub-cap-field ub-cap-header';
	colCaptureHeader.innerHTML = '<label class="form-label">Nom d\'en-tête</label><input type="text" class="form-control form-control-sm" id="ub-capheader" placeholder="ex: Set-Cookie">';

	// Extra captures container (repeatable rows)
	const colCapsExtra = document.createElement('div');
	colCapsExtra.className = 'col-12';
	colCapsExtra.innerHTML = [
		'<div class="d-flex justify-content-between align-items-center mb-1">',
		'<label class="form-label mb-0">Captures supplémentaires (optionnel)</label>',
		'<button type="button" class="btn btn-sm btn-outline-secondary" id="ub-capadd">Ajouter une capture</button>',
		'</div>',
		'<div id="ub-caps-list" class="d-flex flex-column gap-2"></div>'
	].join('');

	const colBtns = document.createElement('div');
	colBtns.className = 'col-12 d-flex flex-wrap gap-2';
	colBtns.innerHTML = '<button type="button" class="btn btn-sm btn-primary" id="ub-add">Ajouter le test</button> <button type="button" class="btn btn-sm btn-success d-none" id="ub-save">Mettre à jour</button> <button type="button" class="btn btn-sm btn-outline-secondary" id="ub-clear">Vider</button> <button type="button" class="btn btn-sm btn-outline-primary" id="ub-example">Exemple basique</button> <button type="button" class="btn btn-sm btn-outline-success" id="ub-run">Exécuter la suite</button>';

	row.append(colName, colFolder, colMethod, colUrl, colHeaders, colBody,
		// Capture group
		colCaptureVar, colCaptureType, colCaptureJson, colCaptureRegex, colCaptureHeader, colCapsExtra,
		// Assertions
		colAssertStatus, colAssertContains, colAssertJsonPath, colAssertJsonEq, colAssertJsonEqVar, colAssertJsonEqExpr,
		colBtns);

	const list = document.createElement('ul');
	list.className = 'list-group mt-3';
	list.id = 'ub-list';

	body.append(title, row, list);
	// Live preview of name + dossier stylisation
	const preview = document.createElement('div');
	preview.id = 'ub-preview';
	preview.className = 'small mt-2 mb-2 pb-2 border-bottom';
	body.insertBefore(preview, list);
	// Output panel for run results
	const runOut = document.createElement('div');
	runOut.id = 'ub-run-output';
	runOut.className = 'mt-3 small';
	body.appendChild(runOut);
	card.appendChild(body);
	host.appendChild(card);

	const inpName = () => document.getElementById('ub-name');
	const inpFolder = () => document.getElementById('ub-folder');
	function updatePreview() {
		const nameVal = (inpName().value||'').trim();
		const folderVal = (inpFolder().value||'').trim();
		const badge = folderVal ? '<span class="badge rounded-pill text-bg-secondary me-2">' + folderVal + '</span>' : '';
		const title = nameVal || '<em class="text-muted">Nom du test…</em>';
		preview.innerHTML = badge + '<strong>' + title + '</strong>' + '<span class="ms-2 text-muted">(aperçu)</span>';
	}
	inpName().addEventListener('input', updatePreview);
	inpFolder().addEventListener('input', updatePreview);
	updatePreview();
	const selMethod = () => document.getElementById('ub-method');
	const inpUrl = () => document.getElementById('ub-url');
	const taHeaders = () => document.getElementById('ub-headers');
	const taBody = () => document.getElementById('ub-body');
	const cbBodyJson = () => document.getElementById('ub-body-json');
	const inStatus = () => document.getElementById('ub-astatus');
	const inContains = () => document.getElementById('ub-acontains');
	const inJPath = () => document.getElementById('ub-ajpath');
	const inJEq = () => document.getElementById('ub-ajeq');
	const inJEqVar = () => document.getElementById('ub-ajeqvar');
	const inJEqExpr = () => document.getElementById('ub-ajeqexpr');
	const inCapVar = () => document.getElementById('ub-capvar');
	const inCapType = () => document.getElementById('ub-captype');
	const inCapJson = () => document.getElementById('ub-capjson');
	const inCapRegex = () => document.getElementById('ub-capregex');
	const inCapHeader = () => document.getElementById('ub-capheader');

	// Helpers to manage extra capture rows
	const extraCapsList = () => card.querySelector('#ub-caps-list');
	function createCapRow(prefill) {
		const row = document.createElement('div');
		row.className = 'ub-cap-row row g-2 align-items-end border rounded p-2';
		row.innerHTML = [
			'<div class="col-6 col-md-2"><label class="form-label">Variable</label><input type="text" class="form-control form-control-sm ub-ce-var" placeholder="ex: X"></div>',
			'<div class="col-6 col-md-2"><label class="form-label">Type</label><select class="form-select form-select-sm ub-ce-type"><option value="">—</option><option value="json">JSON path</option><option value="regex">Regex</option><option value="header">Header</option></select></div>',
			'<div class="col-12 col-md-3 ub-ce-field ub-ce-json"><label class="form-label">Chemin JSON</label><input type="text" class="form-control form-control-sm ub-ce-json-input" placeholder="ex: data.id"></div>',
			'<div class="col-12 col-md-3 ub-ce-field ub-ce-regex"><label class="form-label">Regex</label><input type="text" class="form-control form-control-sm ub-ce-regex-input" placeholder="ex: total=(\\d+)"></div>',
			'<div class="col-12 col-md-3 ub-ce-field ub-ce-header"><label class="form-label">En-tête</label><input type="text" class="form-control form-control-sm ub-ce-header-input" placeholder="ex: Set-Cookie"></div>',
			'<div class="col-12 col-md-2 text-end"><button type="button" class="btn btn-sm btn-outline-danger ub-ce-del">Supprimer</button></div>'
		].join('');
		const varEl = row.querySelector('.ub-ce-var');
		const typeEl = row.querySelector('.ub-ce-type');
		const jsonWrap = row.querySelector('.ub-ce-json');
		const regexWrap = row.querySelector('.ub-ce-regex');
		const headerWrap = row.querySelector('.ub-ce-header');
		const jsonInput = row.querySelector('.ub-ce-json-input');
		const regexInput = row.querySelector('.ub-ce-regex-input');
		const headerInput = row.querySelector('.ub-ce-header-input');
		function updateVis() {
			jsonWrap.style.display = 'none'; regexWrap.style.display = 'none'; headerWrap.style.display = 'none';
			if (typeEl.value === 'json') jsonWrap.style.display = '';
			if (typeEl.value === 'regex') regexWrap.style.display = '';
			if (typeEl.value === 'header') headerWrap.style.display = '';
		}
		typeEl.addEventListener('change', updateVis);
		row.querySelector('.ub-ce-del').addEventListener('click', () => { row.remove(); });
		// prefill
		if (prefill) {
			varEl.value = prefill.var || '';
			if (typeof prefill.json !== 'undefined') { typeEl.value = 'json'; jsonInput.value = prefill.json; }
			else if (typeof prefill.regex !== 'undefined') { typeEl.value = 'regex'; regexInput.value = prefill.regex; }
			else if (typeof prefill.header !== 'undefined') { typeEl.value = 'header'; headerInput.value = prefill.header; }
		}
		updateVis();
		return row;
	}
	const btnAddCap = card.querySelector('#ub-capadd');
	if (btnAddCap) btnAddCap.addEventListener('click', () => { extraCapsList().appendChild(createCapRow()); });

	// Capture field visibility toggle
	(function(){
		const sel = inCapType(); if (!sel) return;
		function updateCapVis() {
			const v = sel.value;
			[colCaptureJson, colCaptureRegex, colCaptureHeader].forEach(c => c.style.display = 'none');
			if (v === 'json') colCaptureJson.style.display = '';
			if (v === 'regex') colCaptureRegex.style.display = '';
			if (v === 'header') colCaptureHeader.style.display = '';
		}
		sel.addEventListener('change', updateCapVis);
		updateCapVis();
	})();

	function parseHeaders() {
		try { const raw = (taHeaders().value||'').trim(); return raw ? JSON.parse(raw) : {}; } catch(e) { alert('En-têtes JSON invalides: ' + e.message); return null; }
	}

	function buildCaseFromFields() {
		const name = (inpName().value||'').trim();
		const folder = (inpFolder().value||'').trim();
		const method = (selMethod().value||'GET').toUpperCase();
		const url = (inpUrl().value||'').trim();
		if (!url) { alert('Veuillez saisir une URL'); return; }
		const headers = parseHeaders(); if (headers === null) return;
		const bodyText = (taBody().value||'').trim();
		const bodyJson = cbBodyJson().checked;
		const aStatus = parseInt(inStatus().value||'', 10);
		const aContains = (inContains().value||'').trim();
		const aJPath = (inJPath().value||'').trim();
		const aJEq = (inJEq().value||'').trim();
		const aJEqVar = (inJEqVar().value||'').trim();
		const aJEqExpr = (inJEqExpr().value||'').trim();
		const test = { name: name || (method + ' ' + url), method, url };
		if (folder) test.folder = folder;
		if (headers && Object.keys(headers).length) test.headers = headers;
		if (bodyText) test.body = bodyJson ? (function(){ try { return JSON.parse(bodyText); } catch(e) { alert('Corps JSON invalide: ' + e.message); throw e; } })() : bodyText;
		const asrt = {};
		if (!isNaN(aStatus)) asrt.status = aStatus;
		if (aContains) asrt.contains = aContains;
		if (aJPath) {
			asrt.json = { path: aJPath };
			if (aJEqVar) asrt.json.equalsVar = aJEqVar; else if (aJEqExpr) asrt.json.equalsExpr = aJEqExpr; else if (aJEq) asrt.json.equals = aJEq;
		}

		// Capture block (primary + extra rows)
		const captures = [];
		const cVar = (inCapVar().value||'').trim();
		const cType = (inCapType().value||'').trim();
		if (cVar && cType) {
			const cap = { var: cVar };
			if (cType === 'json') { const p = (inCapJson().value||'').trim(); if (p) cap.json = p; }
			if (cType === 'regex') { const r = (inCapRegex().value||'').trim(); if (r) cap.regex = r; }
			if (cType === 'header') { const h = (inCapHeader().value||'').trim(); if (h) cap.header = h; }
			captures.push(cap);
		}
		// extras
		card.querySelectorAll('.ub-cap-row').forEach(row => {
			const v = (row.querySelector('.ub-ce-var').value||'').trim();
			const t = (row.querySelector('.ub-ce-type').value||'').trim();
			if (!v || !t) return;
			const cap = { var: v };
			if (t === 'json') { const p = (row.querySelector('.ub-ce-json-input').value||'').trim(); if (p) cap.json = p; }
			if (t === 'regex') { const r = (row.querySelector('.ub-ce-regex-input').value||'').trim(); if (r) cap.regex = r; }
			if (t === 'header') { const h = (row.querySelector('.ub-ce-header-input').value||'').trim(); if (h) cap.header = h; }
			if (Object.keys(cap).length > 1) captures.push(cap);
		});
		if (captures.length === 1) test.capture = captures[0];
		else if (captures.length > 1) test.capture = captures;
		if (Object.keys(asrt).length) test.assert = asrt;
		return test;
	}

	function summarizeCase(t) {
		// Header line: folder badge + strong name
		const folderBadge = t.folder ? '<span class="badge rounded-pill text-bg-secondary me-2">' + String(t.folder) + '</span>' : '';
		const title = (t.name && t.name.trim()) ? t.name : ((t.method||'GET') + ' ' + (t.url||''));
		let header = folderBadge + '<strong>' + title + '</strong>';
		// Detail line: method + url + asserts + capture info
		let detail = '<span class="text-muted">' + (t.method||'GET') + '</span> ' + (t.url||'');
		if (t.assert) {
			const parts = [];
			if (typeof t.assert.status !== 'undefined') parts.push('status:' + t.assert.status);
			if (t.assert.contains) parts.push("contient:'" + t.assert.contains + "'");
			if (t.assert.json && t.assert.json.path) {
				let rhs = '';
				if (typeof t.assert.json.equals !== 'undefined') rhs = t.assert.json.equals;
				if (typeof t.assert.json.equalsVar !== 'undefined') rhs = '{{' + t.assert.json.equalsVar + '}}';
				if (typeof t.assert.json.equalsExpr !== 'undefined') rhs = '(' + t.assert.json.equalsExpr + ')';
				parts.push('json ' + t.assert.json.path + ' == ' + rhs);
			}
			if (parts.length) detail += ' — ' + parts.join(', ');
		}
		if (t.capture) {
			if (Array.isArray(t.capture)) detail += ' — cap:' + t.capture.length; else if (t.capture.var) detail += ' — cap:' + t.capture.var;
		}
		return header + '<div class="small text-muted">' + detail + '</div>';
	}

	function renderList() {
		const tests = getTests();
		list.innerHTML = '';
		tests.forEach((t, idx) => {
			const li = document.createElement('li');
			li.className = 'list-group-item d-flex justify-content-between align-items-center';
			li.innerHTML = '<span>' + summarizeCase(t) + '</span>' +
				'<span class="btn-group btn-group-sm">' +
				'<button type="button" class="btn btn-outline-primary" data-act="edit">Éditer</button>' +
				'<button type="button" class="btn btn-outline-secondary" data-act="up">↑</button>' +
				'<button type="button" class="btn btn-outline-secondary" data-act="down">↓</button>' +
				'<button type="button" class="btn btn-outline-danger" data-act="del">Suppr.</button>' +
				'</span>';
			li.querySelector('[data-act="edit"]').addEventListener('click', () => edit(idx));
			li.querySelector('[data-act="up"]').addEventListener('click', () => move(idx, -1));
			li.querySelector('[data-act="down"]').addEventListener('click', () => move(idx, +1));
			li.querySelector('[data-act="del"]').addEventListener('click', () => del(idx));
			list.appendChild(li);
		});
	}

	function resetFields() {
		inpName().value = ''; inpFolder().value = ''; selMethod().value = 'GET'; inpUrl().value=''; taHeaders().value=''; taBody().value=''; cbBodyJson().checked=false; inStatus().value=''; inContains().value=''; inJPath().value=''; inJEq().value=''; inJEqVar().value=''; inJEqExpr().value=''; inCapVar().value=''; inCapType().value=''; inCapJson().value=''; inCapRegex().value=''; inCapHeader().value='';
		// update capture visibility
		const evt = new Event('change'); inCapType().dispatchEvent(evt);
		// clear extra captures
		extraCapsList().innerHTML = '';
		updatePreview();
	}

	function move(i, delta) { const tests = getTests(); const j = i+delta; if (j<0 || j>=tests.length) return; const tmp = tests[i]; tests[i]=tests[j]; tests[j]=tmp; setTests(tests); }
	function del(i) { const tests = getTests(); tests.splice(i,1); setTests(tests); }
	function edit(i) {
		const tests = getTests(); const t = tests[i]; if (!t) return;
		inpName().value = t.name || '';
		inpFolder().value = t.folder || '';
		updatePreview();
		selMethod().value = (t.method||'GET').toUpperCase();
		inpUrl().value = t.url || '';
		taHeaders().value = t.headers ? JSON.stringify(t.headers, null, 2) : '';
		if (typeof t.body === 'string') { taBody().value = t.body; cbBodyJson().checked = false; } else if (typeof t.body !== 'undefined') { taBody().value = JSON.stringify(t.body, null, 2); cbBodyJson().checked = true; } else { taBody().value=''; cbBodyJson().checked=false; }
		inStatus().value = (t.assert && typeof t.assert.status !== 'undefined') ? t.assert.status : '';
		inContains().value = (t.assert && t.assert.contains) ? t.assert.contains : '';
		inJPath().value = (t.assert && t.assert.json && t.assert.json.path) ? t.assert.json.path : '';
		inJEq().value = (t.assert && t.assert.json && typeof t.assert.json.equals !== 'undefined') ? t.assert.json.equals : '';
		inJEqVar().value = (t.assert && t.assert.json && typeof t.assert.json.equalsVar !== 'undefined') ? t.assert.json.equalsVar : '';
		inJEqExpr().value = (t.assert && t.assert.json && typeof t.assert.json.equalsExpr !== 'undefined') ? t.assert.json.equalsExpr : '';
		// capture(s)
		extraCapsList().innerHTML = '';
		const caps = (t.capture ? (Array.isArray(t.capture) ? t.capture : [t.capture]) : []);
		if (caps.length > 0) {
			// primary takes first
			const first = caps[0];
			inCapVar().value = first.var || '';
			let type = '';
			if (typeof first.json !== 'undefined') { type = 'json'; inCapJson().value = first.json; }
			else if (typeof first.regex !== 'undefined') { type = 'regex'; inCapRegex().value = first.regex; }
			else if (typeof first.header !== 'undefined') { type = 'header'; inCapHeader().value = first.header; }
			inCapType().value = type; const evt = new Event('change'); inCapType().dispatchEvent(evt);
			// rest to extra rows
			for (let i2 = 1; i2 < caps.length; i2++) {
				extraCapsList().appendChild(createCapRow(caps[i2]));
			}
		} else {
			inCapVar().value = ''; inCapType().value = ''; inCapJson().value=''; inCapRegex().value=''; inCapHeader().value=''; const evt = new Event('change'); inCapType().dispatchEvent(evt);
		}
		editIndex = i;
		card.querySelector('#ub-add').classList.add('d-none');
		card.querySelector('#ub-save').classList.remove('d-none');
	}

	card.querySelector('#ub-add').addEventListener('click', () => {
		try {
			const t = buildCaseFromFields(); if (!t) return;
			const tests = getTests(); tests.push(t); setTests(tests); resetFields();
		} catch(_){}
	});
	card.querySelector('#ub-save').addEventListener('click', () => {
		try {
			const t = buildCaseFromFields(); if (!t) return;
			const tests = getTests(); if (editIndex===null || editIndex<0 || editIndex>=tests.length) return; tests[editIndex] = t; setTests(tests);
			editIndex = null; card.querySelector('#ub-save').classList.add('d-none'); card.querySelector('#ub-add').classList.remove('d-none'); resetFields();
		} catch(_){}
	});
	card.querySelector('#ub-clear').addEventListener('click', () => { if (confirm('Vider tous les tests ?')) setTests([]); });
	// Replace the basic example with a richer A+B=C demo below

	// Replace basic example with multi-step variable capture sum demonstration
	const exBtn = card.querySelector('#ub-example');
	if (exBtn) {
		exBtn.textContent = 'Exemple A+B=C';
		exBtn.addEventListener('click', (e) => {
			e.preventDefault();
			const demo = [
				{
					name: 'Page A met 1',
					method: 'POST',
					url: 'https://example.com/page-a',
					headers: { 'Content-Type': 'application/json' },
					body: { value: 1 },
					assert: { status: 200 },
					capture: { var: 'A', json: 'value' }
				},
				{
					name: 'Page B met 2',
					method: 'POST',
					url: 'https://example.com/page-b',
					headers: { 'Content-Type': 'application/json' },
					body: { value: 2 },
					assert: { status: 200 },
					capture: { var: 'B', json: 'value' }
				},
				{
					name: 'Vérifier somme sur Page C',
					method: 'GET',
					url: 'https://example.com/page-c',
					assert: { status: 200, json: { path: 'result.sum', equalsExpr: 'A + B' } }
				}
			];
			setTests(demo);
		});
	}

	// Run button logic (AJAX)
	const btnRun = card.querySelector('#ub-run');
	btnRun.addEventListener('click', async () => {
		const tests = getTests();
		if (!tests.length) { alert('Aucun test à exécuter'); return; }
		btnRun.disabled = true; const orig = btnRun.textContent; btnRun.textContent = 'Exécution…';
		runOut.textContent = 'Exécution en cours...'; runOut.classList.remove('text-danger','text-success');
		try {
			const resp = await fetch('/api/unit-tests/run', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tests }) });
			const data = await resp.json();
			if (resp.status !== 200 || data.error) {
				throw new Error(data.error || ('Erreur ' + resp.status));
			}
			// Build summary
			let html = '';
			html += 'Total: ' + data.total + ' — Réussis: ' + data.passed + ' — Échecs: ' + data.failed + '<br>';
			html += '<ul class="list-unstyled mb-0">';
			(data.cases||[]).forEach(c => {
				const statusTxt = (c.status !== null && typeof c.status !== 'undefined' ? c.status : '—');
				const okBadge = c.ok ? '<span class="text-success">✔</span>' : '<span class="text-danger">✖</span>';
				const err = c.error ? (' <span class="text-danger">' + c.error + '</span>') : '';
				const folderBadge = c.folder ? '<span class="badge rounded-pill text-bg-secondary me-2">' + String(c.folder) + '</span>' : '';
				const title = (c.name && String(c.name).trim()) ? c.name : '';
				html += '<li>' + okBadge + ' ' + folderBadge + '<strong>' + title + '</strong> <span class="text-muted">(' + statusTxt + ', ' + c.durationMs + 'ms)</span>' + err + '</li>';
			});
			html += '</ul>';
			runOut.innerHTML = html;
			runOut.classList.add(data.failed ? 'text-danger' : 'text-success');
		} catch(e) {
			runOut.textContent = e.message;
			runOut.classList.add('text-danger');
		} finally {
			btnRun.disabled = false; btnRun.textContent = orig;
		}
	});

	// Expose for snippets
	host.__ubSetTests = setTests;
	host.__ubRenderList = renderList;

	renderList();
}

// Staggered reveal for tables and lists when page loads
document.addEventListener('DOMContentLoaded', () => {
	const stagger = (nodes) => {
		Array.prototype.forEach.call(nodes, (el, i) => {
			el.classList.add('fade-in-up');
			el.style.animationDelay = Math.min(i * 60, 600) + 'ms';
		});
	};
	stagger(document.querySelectorAll('table tbody tr'));
	stagger(document.querySelectorAll('.list-group .list-group-item'));
});
