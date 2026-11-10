/**
 * Dashboard HTML for the caching lab.
 * Kept as one string so there is no build step and no frontend framework.
 */
export function dashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Redis Caching Lab · Cache-Aside</title>
<style>
  :root {
    --bg: #080e1a;
    --panel: #0f1829;
    --panel-2: #131f36;
    --border: #1e2d4a;
    --text: #e6edf7;
    --muted: #8da0bf;
    --accent: #38bdf8;
    --green: #34d399;
    --red: #fb7185;
    --amber: #fbbf24;
    --purple: #c084fc;
    --mono: ui-monospace, "JetBrains Mono", "Cascadia Code", Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    background:
      radial-gradient(900px 500px at 8% -10%, #12325a33, transparent 60%),
      radial-gradient(700px 400px at 100% 0%, #38bdf81a, transparent 55%),
      var(--bg);
    color: var(--text);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: 14px;
  }
  header {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 22px 28px 14px;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo {
    width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center;
    background: linear-gradient(140deg, #0ea5e9, #22d3ee); color: #04121f; font-size: 20px;
    box-shadow: 0 8px 24px #0ea5e944;
  }
  h1 { margin: 0; font-size: 19px; letter-spacing: .2px; }
  .brand p { margin: 3px 0 0; color: var(--muted); font-size: 12.5px; }
  .pills { display: flex; align-items: center; gap: 10px; }
  .pill {
    display: inline-flex; align-items: center; gap: 7px;
    background: var(--panel); border: 1px solid var(--border); color: var(--muted);
    padding: 7px 12px; border-radius: 999px; font-size: 12px; font-family: var(--mono);
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--amber); box-shadow: 0 0 10px currentColor; }
  .pill.ok { color: var(--green); border-color: #1f6b4f; }
  .pill.ok .dot { background: var(--green); }
  .pill.bad { color: var(--red); border-color: #7a2437; }
  .pill.bad .dot { background: var(--red); }

  .tabs { display: flex; gap: 6px; padding: 0 28px; flex-wrap: wrap; }
  .tab {
    background: transparent; border: 1px solid transparent; border-bottom: 2px solid transparent;
    color: var(--muted); padding: 9px 14px; border-radius: 9px 9px 0 0; font-size: 13px;
    cursor: default; font-family: inherit;
  }
  .tab.active { color: var(--text); background: var(--panel); border-color: var(--border); border-bottom-color: var(--accent); }
  .tab[disabled] { opacity: .38; }

  main {
    display: grid; grid-template-columns: 330px minmax(0, 1fr) 372px;
    gap: 16px; padding: 16px 28px 28px; align-items: start;
  }
  @media (max-width: 1180px) { main { grid-template-columns: 1fr; } }

  .panel {
    background: linear-gradient(180deg, var(--panel), #0c1526);
    border: 1px solid var(--border); border-radius: 14px; padding: 16px;
    box-shadow: 0 18px 40px #00000055;
  }
  .panel h2 {
    margin: 0 0 12px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--muted); font-weight: 600;
  }
  .panel h2:not(:first-child) { margin-top: 20px; }

  label { display: block; font-size: 11.5px; color: var(--muted); margin-bottom: 6px; }
  select {
    width: 100%; padding: 10px 12px; border-radius: 9px; background: #0a1322;
    color: var(--text); border: 1px solid var(--border); font-family: var(--mono); font-size: 13px;
  }
  .btns { display: grid; gap: 8px; margin-top: 14px; }
  button.action {
    text-align: left; padding: 11px 13px; border-radius: 10px; cursor: pointer;
    background: var(--panel-2); border: 1px solid var(--border); color: var(--text);
    font-family: inherit; font-size: 13px; transition: .15s;
  }
  button.action:hover { border-color: #2f4a75; transform: translateY(-1px); background: #17253f; }
  button.action em { display: block; color: var(--muted); font-style: normal; font-size: 11.5px; margin-top: 2px; }
  button.action.warn { border-color: #6b3b18; }
  button.action.warn:hover { border-color: #a8622a; }
  button.action.ghost { background: transparent; }
  button.ghost {
    background: transparent; border: 1px solid var(--border); color: var(--muted);
    padding: 7px 12px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: 12px;
  }
  button.ghost:hover { color: var(--text); border-color: #2f4a75; }

  pre#result {
    margin: 0; background: #060c17; border: 1px solid var(--border); border-radius: 10px;
    padding: 12px; font-family: var(--mono); font-size: 12px; color: #a5e6c8;
    white-space: pre-wrap; word-break: break-word; max-height: 250px; overflow: auto;
  }
  .hint { color: var(--muted); font-size: 11.5px; line-height: 1.55; margin: 12px 0 0; }
  .hint code { background: #0a1322; border: 1px solid var(--border); padding: 1px 5px; border-radius: 5px; font-family: var(--mono); font-size: 11px; }

  .log-panel { padding-bottom: 10px; }
  .panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .panel-head h2 { margin: 0; }
  .log {
    height: 560px; overflow-y: auto; font-family: var(--mono); font-size: 12px;
    display: flex; flex-direction: column; gap: 1px;
    background: #060c17; border: 1px solid var(--border); border-radius: 10px; padding: 8px;
  }
  .row { display: grid; grid-template-columns: 82px 76px minmax(0, 1fr); gap: 8px; padding: 5px 6px; border-radius: 6px; align-items: baseline; }
  .row:hover { background: #0d1728; }
  .row .time { color: #55678a; font-size: 11px; }
  .row .msg { color: #c9d6ea; word-break: break-word; }
  .badge { font-size: 9.5px; letter-spacing: .06em; padding: 2px 6px; border-radius: 5px; text-align: center; font-weight: 700; }
  .badge.hit { background: #0b3b2e; color: var(--green); }
  .badge.miss { background: #3d1420; color: var(--red); }
  .badge.set { background: #0b2c44; color: var(--accent); }
  .badge.del { background: #2c1640; color: var(--purple); }
  .badge.info { background: #1b2334; color: #9fb2d0; }
  .badge.error { background: #41151a; color: #fca5a5; }
  .badge.db-read, .badge.db-write { background: #3a2a09; color: var(--amber); }
  .row.t-hit .msg { color: #a7f3d0; }
  .row.t-miss .msg { color: #fecdd3; }

  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat { background: #0a1322; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
  .stat span { display: block; color: var(--muted); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; }
  .stat strong { font-size: 20px; font-weight: 650; font-family: var(--mono); }
  .stat.good strong { color: var(--green); }
  .stat.warn strong { color: var(--amber); }
  .stat.bad strong { color: var(--red); }

  table { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 11.5px; }
  th { text-align: left; color: var(--muted); font-weight: 500; padding: 6px 4px; border-bottom: 1px solid var(--border); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
  td { padding: 7px 4px; border-bottom: 1px solid #131f36; vertical-align: top; }
  td.key { color: var(--accent); word-break: break-all; }
  td.ttl { color: var(--green); white-space: nowrap; }
  td.val { color: #7c8db0; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { color: #4b5c7d; font-family: var(--mono); font-size: 12px; padding: 10px 4px; }
</style>
</head>
<body>
<header>
  <div class="brand">
    <div class="logo">⚡</div>
    <div>
      <h1>Redis Caching Lab</h1>
      <p>Module 1 · Cache-Aside (lazy loading)</p>
    </div>
  </div>
  <div class="pills">
    <span id="redis-pill" class="pill"><span class="dot"></span><span id="redis-text">redis: …</span></span>
    <button id="reset" class="ghost">Reset lab</button>
  </div>
</header>

<nav class="tabs">
  <button class="tab active">1 · Cache-Aside</button>
  <button class="tab" disabled>2 · Read-Through</button>
  <button class="tab" disabled>3 · Write-Through</button>
  <button class="tab" disabled>4 · Write-Behind</button>
</nav>

<main>
  <section class="panel">
    <h2>Controls</h2>
    <label for="user">User</label>
    <select id="user"></select>

    <div class="btns">
      <button class="action" data-act="read">GET /users/:id<em>cached read — hit ≈ 1ms, miss ≈ 260ms</em></button>
      <button class="action" data-act="rename">PUT /users/:id<em>write DB, then DEL the key</em></button>
      <button class="action warn" data-act="direct">Direct DB write<em>another service bypasses the API → stale cache</em></button>
      <button class="action ghost" data-act="evict">DELETE cache key<em>manual invalidation</em></button>
    </div>

    <h2>Last response</h2>
    <pre id="result">Press a button above to start.</pre>

    <p class="hint">
      Try this: <b>GET</b> (miss, 260ms) → <b>GET</b> again (hit, ~1ms) → <b>Direct DB write</b> →
      <b>GET</b> returns the OLD name. Press <code>DELETE cache key</code> and the next GET is fresh again.
    </p>
  </section>

  <section class="panel log-panel">
    <div class="panel-head">
      <h2>Live log</h2>
      <span class="hint" style="margin:0">every cache decision</span>
    </div>
    <div id="log" class="log"></div>
  </section>

  <aside class="panel">
    <h2>Stats</h2>
    <div class="stat-grid">
      <div class="stat good"><span>Hits</span><strong id="s-hits">0</strong></div>
      <div class="stat bad"><span>Misses</span><strong id="s-misses">0</strong></div>
      <div class="stat"><span>Hit rate</span><strong id="s-rate">—</strong></div>
      <div class="stat"><span>Avg latency</span><strong id="s-avg">—</strong></div>
      <div class="stat warn"><span>DB reads</span><strong id="s-dbreads">0</strong></div>
      <div class="stat warn"><span>DB writes</span><strong id="s-dbwrites">0</strong></div>
    </div>

    <h2>Redis keys</h2>
    <table>
      <thead><tr><th>Key</th><th>TTL</th><th>Value</th></tr></thead>
      <tbody id="keys"><tr><td colspan="3" class="empty">no keys yet</td></tr></tbody>
    </table>
    <p class="hint">TTL is the safety net: even a missed invalidation heals within 60s.</p>
  </aside>
</main>

<script>
  var lastId = 0;
  var selected = '1';
  var $ = function (id) { return document.getElementById(id); };

  function fmtTime(ts) {
    return new Date(ts).toISOString().slice(11, 23);
  }

  function appendLog(entry) {
    var box = $('log');
    var row = document.createElement('div');
    row.className = 'row t-' + entry.type;

    var time = document.createElement('span');
    time.className = 'time';
    time.textContent = fmtTime(entry.ts);

    var badge = document.createElement('span');
    badge.className = 'badge ' + entry.type;
    badge.textContent = entry.type.toUpperCase();

    var msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = entry.msg;

    row.appendChild(time);
    row.appendChild(badge);
    row.appendChild(msg);
    box.appendChild(row);

    while (box.children.length > 240) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }

  async function api(path, options) {
    try {
      var res = await fetch(path, options);
      var data = await res.json().catch(function () { return {}; });
      return { status: res.status, data: data };
    } catch (error) {
      return { status: 0, data: { error: String(error) } };
    }
  }

  function showResult(res) {
    var data = res.data || {};
    var head = '';
    if (data.source) head += 'source: ' + data.source + '  ·  ';
    if (typeof data.ms === 'number') head += data.ms + ' ms';
    $('result').textContent = head + '\\n' + JSON.stringify(data, null, 2);
  }

  async function loadUsers() {
    var res = await api('/api/cache-aside/users');
    var list = (res.data && res.data.users) || [];
    var select = $('user');
    var current = select.value || selected;
    select.innerHTML = '';
    list.forEach(function (user) {
      var option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.id + ' · ' + user.name;
      select.appendChild(option);
    });
    if (current) select.value = current;
    if (!select.value && list.length > 0) select.value = list[0].id;
    selected = select.value;
    if (selected) $('result').textContent = 'Selected user ' + selected + '. Press a button above.';
  }

  async function loadState() {
    var res = await api('/api/state?after=' + lastId);
    if (res.status !== 200) return;
    var state = res.data;

    var pill = $('redis-pill');
    var text = $('redis-text');
    var online = state.redis && state.redis.status === 'ready';
    pill.className = 'pill ' + (online ? 'ok' : 'bad');
    text.textContent = online
      ? 'redis: ready · ' + state.redis.ping + 'ms'
      : 'redis: ' + ((state.redis && state.redis.status) || 'down');

    var s = state.stats && state.stats.aside ? state.stats.aside : {};
    var total = (s.hits || 0) + (s.misses || 0);
    $('s-hits').textContent = s.hits || 0;
    $('s-misses').textContent = s.misses || 0;
    $('s-rate').textContent = total ? Math.round(((s.hits || 0) / total) * 100) + '%' : '—';
    $('s-avg').textContent = s.requests ? Math.round((s.totalMs || 0) / s.requests) + 'ms' : '—';
    $('s-dbreads').textContent = s.dbReads || 0;
    $('s-dbwrites').textContent = s.dbWrites || 0;

    (state.logs || []).forEach(function (entry) {
      lastId = Math.max(lastId, entry.id);
      appendLog(entry);
    });

    var body = $('keys');
    body.innerHTML = '';
    var keys = state.keys || [];
    if (keys.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'empty';
      td.textContent = 'no keys yet';
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      keys.forEach(function (k) {
        var row = document.createElement('tr');
        var c1 = document.createElement('td');
        c1.className = 'key';
        c1.textContent = k.key;
        var c2 = document.createElement('td');
        c2.className = 'ttl';
        c2.textContent = k.ttl >= 0 ? k.ttl + 's' : 'no ttl';
        var c3 = document.createElement('td');
        c3.className = 'val';
        c3.textContent = k.value;
        c3.title = k.value;
        row.appendChild(c1);
        row.appendChild(c2);
        row.appendChild(c3);
        body.appendChild(row);
      });
    }
  }

  document.querySelectorAll('[data-act]').forEach(function (button) {
    button.addEventListener('click', async function () {
      var id = $('user').value;
      if (!id) {
        $('result').textContent = 'No user selected. Reload the page (the user list did not load).';
        return;
      }
      var act = button.getAttribute('data-act');
      var options = { method: 'GET' };
      var path = '';

      if (act === 'read') {
        path = '/api/cache-aside/users/' + id;
      } else if (act === 'rename') {
        path = '/api/cache-aside/users/' + id;
        options = {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Piyush ' + new Date().toLocaleTimeString() })
        };
      } else if (act === 'direct') {
        path = '/api/cache-aside/dev/direct-db-write/' + id;
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Direct write ' + new Date().toLocaleTimeString() })
        };
      } else if (act === 'evict') {
        path = '/api/cache-aside/cache/' + id;
        options = { method: 'DELETE' };
      }

      var res = await api(path, options);
      showResult(res);
      await loadUsers();
      await loadState();
    });
  });

  $('user').addEventListener('change', function (event) {
    selected = event.target.value;
  });

  $('reset').addEventListener('click', async function () {
    await api('/api/reset', { method: 'POST' });
    lastId = 0;
    $('log').innerHTML = '';
    $('result').textContent = 'Lab reset.';
    await loadUsers();
    await loadState();
  });

  loadUsers();
  loadState();
  setInterval(loadState, 800);
</script>
</body>
</html>`;
}
