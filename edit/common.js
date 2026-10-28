/* ------------------------------------------------------------------
   common.js — shared by the editors: the GitHub token, and reading and
   writing files in the repository through the GitHub contents API.
   The token lives in this browser's localStorage and goes only to
   api.github.com.
   ------------------------------------------------------------------ */
window.gh = (function () {
  'use strict';
  var OWNER = 'mnhoffman', REPO = 'personal-website', BRANCH = 'main';
  var TOKEN_KEY = 'mh-site-editor-token';
  var base = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/';

  function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); return true; } catch (e) { return false; } }
  function headers(extra) {
    var h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token()) h['Authorization'] = 'Bearer ' + token();
    return Object.assign(h, extra || {});
  }
  function b64decode(s) { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), function (c) { return c.charCodeAt(0); })); }
  function b64encode(s) { var bytes = new TextEncoder().encode(s), bin = ''; bytes.forEach(function (b) { bin += String.fromCharCode(b); }); return btoa(bin); }
  function bytesToB64(bytes) { var bin = ''; for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }

  function explain(status) {
    if (status === 401) return 'GitHub rejected the token. Open "Connect to GitHub" and paste a fresh one.';
    if (status === 403) return 'GitHub said no (rate-limited, or the token lacks Contents: read and write on this repository).';
    if (status === 404) return 'Not found on GitHub (wrong path, or the token cannot see the repository).';
    if (status === 409) return 'The file changed on GitHub since it was loaded (another tab?). Reload and try again.';
    return 'GitHub answered ' + status + '.';
  }

  // Read a file: resolves {text, sha} (or {bytes, sha} when binary is true).
  function read(path, binary) {
    return fetch(base + path + '?ref=' + BRANCH + '&t=' + Date.now(), { headers: headers() })
      .then(function (r) { if (!r.ok) throw new Error(explain(r.status)); return r.json(); })
      .then(function (d) {
        if (binary) return { bytes: Uint8Array.from(atob(d.content.replace(/\n/g, '')), function (c) { return c.charCodeAt(0); }), sha: d.sha };
        return { text: b64decode(d.content), sha: d.sha };
      });
  }
  // Just the sha of a file, or null if it doesn't exist.
  function sha(path) {
    return fetch(base + path + '?ref=' + BRANCH + '&t=' + Date.now(), { headers: headers() })
      .then(function (r) { if (r.status === 404) return null; if (!r.ok) throw new Error(explain(r.status)); return r.json(); })
      .then(function (d) { return d && d.sha; });
  }
  // Write a file (text string or Uint8Array). sha is required when replacing. Resolves the new sha.
  function write(path, content, message, fileSha) {
    var body = { message: message, branch: BRANCH, content: typeof content === 'string' ? b64encode(content) : bytesToB64(content) };
    if (fileSha) body.sha = fileSha;
    return fetch(base + path, { method: 'PUT', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j && j.message && r.status !== 409) ? j.message : explain(r.status)); return j.content.sha; }); });
  }
  function remove(path, message, fileSha) {
    return fetch(base + path, { method: 'DELETE', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ message: message, branch: BRANCH, sha: fileSha }) })
      .then(function (r) { if (!r.ok) throw new Error(explain(r.status)); });
  }

  // Wire up the shared token UI (#status, #setup, #token, #savetoken, #forget) on a page.
  function tokenUI(onChange) {
    var $ = function (id) { return document.getElementById(id); };
    $('savetoken').addEventListener('click', function () {
      var t = $('token').value.trim(); if (!t) return;
      if (!setToken(t)) { $('status').textContent = 'This browser will not keep the token (private mode?).'; $('status').className = 'status bad'; return; }
      $('token').value = ''; onChange();
    });
    $('forget').addEventListener('click', function () { setToken(''); onChange(); });
  }

  return { token: token, read: read, sha: sha, write: write, remove: remove, tokenUI: tokenUI, b64encode: b64encode, b64decode: b64decode };
})();
