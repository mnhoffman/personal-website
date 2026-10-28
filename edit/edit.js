/* ------------------------------------------------------------------
   edit.js — a small editor for content.json.

   Loads content.json straight from the GitHub repository, shows every
   field with a Markdown toolbar and a live preview, and publishes by
   committing the file back through the GitHub API. The token lives in
   this browser's localStorage and goes only to api.github.com.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var PATH = 'content.json';
  var SCHEMA = [
    { section: 'home', title: 'Home', fields: [
      { key: 'intro', label: 'Intro paragraph', kind: 'md', inline: true } ] },
    { section: 'currently', title: 'Currently', fields: [
      { key: 'subtitle', label: 'Handwritten subtitle', kind: 'text' },
      { key: 'note1', label: 'First note', kind: 'md' },
      { key: 'note2', label: 'Second note', kind: 'md' } ] },
    { section: 'projects', title: 'Projects', fields: [
      { key: 'subtitle', label: 'Handwritten subtitle', kind: 'text' },
      { key: 'note1', label: 'First note', kind: 'md' },
      { key: 'note2', label: 'Second note', kind: 'md' },
      { key: 'note3', label: 'Third note (full width)', kind: 'md' } ] },
    { section: 'dance', title: 'Dance', fields: [
      { key: 'subtitle', label: 'Handwritten subtitle', kind: 'text' },
      { key: 'lead', label: 'Intro note', kind: 'md' },
      { key: 'aside', label: 'Handwritten aside under the videos', kind: 'text' } ] },
    { section: 'advice', title: 'Advice', fields: [
      { key: 'subtitle', label: 'Handwritten subtitle', kind: 'text' },
      { key: 'intro', label: 'Intro note', kind: 'md' } ] },
    { section: 'contact', title: 'Contact', fields: [
      { key: 'subtitle', label: 'Handwritten subtitle', kind: 'text' },
      { key: 'links', label: 'Handwritten links', kind: 'links' },
      { key: 'note', label: 'Second note', kind: 'md' } ] }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var status = $('status'), msg = $('msg'), fieldsEl = $('fields'), publishBtn = $('publish');
  var content = null, sha = null, original = '';
  var token = gh.token;
  function setStatus(text, cls) { status.textContent = text; status.className = 'status ' + (cls || ''); }
  function setMsg(text, cls) { msg.textContent = text; msg.className = 'msg ' + (cls || ''); }

  // ---------- load ----------
  function load() {
    setStatus('Loading content.json from GitHub…');
    fieldsEl.innerHTML = '';
    gh.read(PATH)
      .then(function (f) {
        sha = f.sha;
        original = f.text;
        content = JSON.parse(original);
        render();
        setStatus(token() ? 'Connected to GitHub. Ready to publish.' : 'Loaded (read-only until you connect a token).', token() ? 'ok' : '');
        $('setup').open = !token();
        $('forget').hidden = !token();
        markDirty();
      })
      .catch(function (e) { setStatus(e.message, 'bad'); $('setup').open = true; });
  }

  // ---------- render fields ----------
  function render() {
    SCHEMA.forEach(function (sec) {
      var h2 = document.createElement('h2'); h2.textContent = sec.title; h2.id = 'sec-' + sec.section;
      var block = document.createElement('div'); block.className = 'section'; block.dataset.section = sec.section;
      block.appendChild(h2);
      sec.fields.forEach(function (f) {
        var wrap = document.createElement('div'); wrap.className = 'field';
        var label = document.createElement('label');
        label.innerHTML = f.label + ' <span class="kind">· ' + ({ md: 'markdown', text: 'plain text', links: 'links' })[f.kind] + '</span>';
        wrap.appendChild(label);
        var value = (content[sec.section] || {})[f.key];
        if (f.kind === 'md') wrap.appendChild(mdField(sec.section, f, value || ''));
        else if (f.kind === 'text') wrap.appendChild(textField(sec.section, f, value || ''));
        else wrap.appendChild(linksField(sec.section, f, Array.isArray(value) ? value : []));
        block.appendChild(wrap);
      });
      fieldsEl.appendChild(block);
    });
  }

  function setValue(section, key, value) {
    content[section] = content[section] || {};
    content[section][key] = value;
    markDirty();
  }

  function mdField(section, f, value) {
    var grid = document.createElement('div'); grid.className = 'md';
    var bar = document.createElement('div'); bar.className = 'toolbar';
    var ta = document.createElement('textarea'); ta.value = value; ta.spellcheck = true;
    var pv = document.createElement('div'); pv.className = 'preview' + (f.inline ? ' inline' : '');
    function update() {
      pv.innerHTML = f.inline ? marked.parseInline(ta.value) : marked.parse(ta.value);
      setValue(section, f.key, ta.value);
    }
    [
      ['B', 'Bold', function () { wrap(ta, '**', '**', 'bold text'); }],
      ['I', 'Italic', function () { wrap(ta, '*', '*', 'italic text'); }],
      ['Link', 'Link', function () { link(ta); }],
      ['• List', 'Bulleted list', function () { linePrefix(ta, '- '); }],
      ['¶', 'New paragraph', function () { insert(ta, '\n\n'); }]
    ].forEach(function (b) {
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'small'; btn.textContent = b[0]; btn.title = b[1];
      btn.addEventListener('click', function () { b[2](); update(); ta.focus(); });
      bar.appendChild(btn);
    });
    ta.addEventListener('input', update);
    grid.appendChild(bar); grid.appendChild(ta); grid.appendChild(pv);
    pv.innerHTML = f.inline ? marked.parseInline(value) : marked.parse(value);
    return grid;
  }

  function textField(section, f, value) {
    var box = document.createElement('div');
    var input = document.createElement('input'); input.type = 'text'; input.value = value;
    var pv = document.createElement('div'); pv.className = 'preview hand'; pv.textContent = value;
    input.addEventListener('input', function () { pv.textContent = input.value; setValue(section, f.key, input.value); });
    box.appendChild(input); box.appendChild(pv);
    return box;
  }

  function linksField(section, f, value) {
    var list = document.createElement('div'); list.className = 'links-list';
    var links = value.map(function (l) { return { label: l.label || '', url: l.url || '' }; });
    function commit() { setValue(section, f.key, links.map(function (l) { return { label: l.label, url: l.url }; })); }
    function draw() {
      list.innerHTML = '';
      links.forEach(function (l, i) {
        var row = document.createElement('div'); row.className = 'row';
        var lab = document.createElement('input'); lab.type = 'text'; lab.placeholder = 'what it says'; lab.value = l.label;
        var url = document.createElement('input'); url.type = 'text'; url.placeholder = 'https://… or mailto:…'; url.value = l.url;
        var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'small'; rm.textContent = 'remove';
        lab.addEventListener('input', function () { l.label = lab.value; commit(); });
        url.addEventListener('input', function () { l.url = url.value; commit(); });
        rm.addEventListener('click', function () { links.splice(i, 1); draw(); commit(); });
        row.appendChild(lab); row.appendChild(url); row.appendChild(rm);
        list.appendChild(row);
      });
      var add = document.createElement('button'); add.type = 'button'; add.className = 'small'; add.textContent = '+ add a link';
      add.addEventListener('click', function () { links.push({ label: '', url: '' }); draw(); commit(); });
      list.appendChild(add);
    }
    draw();
    return list;
  }

  // ---------- textarea helpers ----------
  function wrap(ta, before, after, placeholder) {
    var s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || placeholder;
    ta.setRangeText(before + sel + after, s, e, 'end');
    if (!ta.value.slice(s, e)) ta.setSelectionRange(s + before.length, s + before.length + sel.length);
  }
  function insert(ta, text) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); }
  function link(ta) {
    var s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e);
    var url = window.prompt('Link to (paste the address):', 'https://');
    if (!url) return;
    var text = sel || window.prompt('Link text:', '') || url;
    ta.setRangeText('[' + text + '](' + url + ')', s, e, 'end');
  }
  function linePrefix(ta, prefix) {
    var s = ta.selectionStart, e = ta.selectionEnd;
    var start = ta.value.lastIndexOf('\n', s - 1) + 1;
    var end = ta.value.indexOf('\n', e); if (end === -1) end = ta.value.length;
    var lines = ta.value.slice(start, end).split('\n').map(function (l) { return l.startsWith(prefix) ? l : prefix + l; });
    ta.setRangeText(lines.join('\n'), start, end, 'end');
  }

  // ---------- publish ----------
  function serialise() { return JSON.stringify(content, null, 2) + '\n'; }
  function markDirty() {
    var dirty = content && serialise() !== original;
    publishBtn.disabled = !dirty || !token();
    document.querySelectorAll('.section').forEach(function (b) {
      var sec = b.dataset.section;
      var was = JSON.stringify(JSON.parse(original)[sec]), now = JSON.stringify(content[sec]);
      b.classList.toggle('dirty', was !== now);
    });
    if (!dirty) setMsg('Nothing changed yet.');
    else if (!token()) setMsg('Changes ready, but connect a token to publish.', 'bad');
    else setMsg('Unpublished changes.');
  }

  publishBtn.addEventListener('click', function () {
    publishBtn.disabled = true;
    setMsg('Publishing…');
    var changed = SCHEMA.filter(function (s) { return JSON.stringify(JSON.parse(original)[s.section]) !== JSON.stringify(content[s.section]); }).map(function (s) { return s.title; });
    gh.write(PATH, serialise(), 'Update ' + (changed.join(', ') || 'content') + ' (via /edit/)', sha)
      .then(function (newSha) {
        sha = newSha;
        original = serialise();
        markDirty();
        setMsg('Published. It will be live in a minute or two.', 'ok');
      })
      .catch(function (e) { setMsg(e.message, 'bad'); publishBtn.disabled = false; });
  });

  // ---------- token ----------
  gh.tokenUI(load);
  $('reload').addEventListener('click', function () {
    if (content && serialise() !== original && !window.confirm('You have unpublished changes. Reload and lose them?')) return;
    load();
  });
  window.addEventListener('beforeunload', function (ev) {
    if (content && serialise() !== original) { ev.preventDefault(); ev.returnValue = ''; }
  });

  load();
})();
