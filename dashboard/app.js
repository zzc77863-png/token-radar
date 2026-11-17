// Token Radar, model radar-2. It reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, a filterable table,
// a per-protocol detail drawer with the model's own inputs, the farm plan,
// the comparables the model is priced off, and the live-token view.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watch: false, tab: 'board', sort: 'implied', dir: -1, page: 0, selected: null };
  var PAGE = 25;

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // The model in one function: the page recomputes a row from the snapshot
  // figures and checks the number board.json carries, so the page's code
  // and the board's data are visibly the same arithmetic.
  function impliedOf(row) {
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * row.growth_multiplier * row.maturity_multiplier * row.breadth_multiplier));
  }

  // The farm plan is the same derivation main.ts writes to board.json:
  // category, chains, TVL and age decide the action, the capital, the hold
  // and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('chain') >= 0) return 'Use ' + name + ' on ' + chain + ' for one real transaction a week and keep the activity on record.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + ' Hold the position and check the protocol\'s own page.';
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week on ' + chain + ', such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('w') === '1') state.watch = true;
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('sort')) state.sort = params.get('sort');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watch) params.set('w', '1');
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.selected) params.set('p', state.selected);
    var h = params.toString();
    if (('' + window.location.hash).replace(/^#/, '') !== h) {
      try { window.history.replaceState(null, '', h ? '#' + h : window.location.pathname); } catch (e) { /* hash only */ }
    }
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.watch && !r.on_watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorized') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      var d = 0;
      if (key === 'tvl') d = a.tvl_usd - b.tvl_usd;
      else if (key === 'change') d = (a.change_7d === null ? -9999 : a.change_7d) - (b.change_7d === null ? -9999 : b.change_7d);
      else if (key === 'score') d = a.score - b.score;
      else d = a.implied_value_usd - b.implied_value_usd;
      return d * state.dir;
    });
    return rows;
  }

  function sortButton(label, key) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' ▼' : ' ▲') : '';
    return el('button', {
      text: label + arrow,
      onclick: function () {
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = -1; }
        state.page = 0;
        render();
      }
    });
  }

  function renderBoard() {
    var rows = filteredRows();
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (state.page >= pages) state.page = pages - 1;
    var pageRows = rows.slice(state.page * PAGE, state.page * PAGE + PAGE);
    var cats = {};
    DATA.rows.forEach(function (r) { cats[r.category || 'Uncategorized'] = true; });
    var chains = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { chains[c] = true; }); });
    var wrap = el('div');
    var controls = el('div', { class: 'controls' });
    var search = el('input', { type: 'search', placeholder: 'Search name or slug…', value: state.q, 'aria-label': 'Search protocols' });
    search.addEventListener('input', function () { state.q = search.value; state.page = 0; render(); });
    controls.appendChild(search);
    var catSel = el('select', { 'aria-label': 'Category' });
    catSel.appendChild(el('option', { value: 'all', text: 'All categories' }));
    Object.keys(cats).sort().forEach(function (c) { catSel.appendChild(el('option', { value: c, text: c })); });
    catSel.value = state.category;
    catSel.addEventListener('change', function () { state.category = catSel.value; state.page = 0; render(); });
    controls.appendChild(catSel);
    var chainSel = el('select', { 'aria-label': 'Chain' });
    chainSel.appendChild(el('option', { value: 'all', text: 'All chains' }));
    Object.keys(chains).sort().forEach(function (c) { chainSel.appendChild(el('option', { value: c, text: c })); });
    chainSel.value = state.chain;
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; state.page = 0; render(); });
    controls.appendChild(chainSel);
    var watchLabel = el('label');
    var watchBox = el('input', { type: 'checkbox' });
    watchBox.checked = state.watch;
    watchBox.addEventListener('change', function () { state.watch = watchBox.checked; state.page = 0; render(); });
    watchLabel.appendChild(watchBox);
    watchLabel.appendChild(document.createTextNode(' Watchlist only'));
    controls.appendChild(watchLabel);
    controls.appendChild(el('span', { class: 'count', text: rows.length + ' of ' + DATA.rows.length + ' protocols' }));
    wrap.appendChild(controls);

    var table = el('table');
    var thead = el('thead');
    var hr = el('tr');
    hr.appendChild(el('th', {}, sortButton('Rank', 'implied')));
    hr.appendChild(el('th', {}, document.createTextNode('Protocol')));
    hr.appendChild(el('th', {}, document.createTextNode('Category · Chains')));
    hr.appendChild(el('th', {}, sortButton('TVL', 'tvl')));
    hr.appendChild(el('th', {}, sortButton('7d', 'change')));
    hr.appendChild(el('th', {}, sortButton('Implied value', 'implied')));
    hr.appendChild(el('th', {}, sortButton('Score', 'score')));
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el('tbody');
    pageRows.forEach(function (r) {
      var tr = el('tr', { class: state.selected === r.slug ? 'sel' : '', onclick: function () { state.selected = r.slug; render(); } });
      tr.appendChild(el('td', { class: 'rank num', text: '#' + r.rank }));
      var nameTd = el('td');
      nameTd.appendChild(el('strong', { text: r.name }));
      nameTd.appendChild(el('span', { class: r.on_watchlist ? 'badge watch' : 'badge early', text: r.on_watchlist ? 'WATCHLIST' : 'EARLY' }));
      nameTd.appendChild(el('div', { class: 'muted', text: r.slug }));
      tr.appendChild(nameTd);
      tr.appendChild(el('td', {}, (r.category || '—') + ' · ' + (r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : ''))));
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }));
      var ch = el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) });
      tr.appendChild(ch);
      var imp = el('td', { class: 'num' });
      imp.appendChild(el('div', { text: fmtUsd(r.implied_value_usd) }));
      imp.appendChild(el('div', { class: 'bar' }, el('span', { style: 'width:' + Math.max(2, r.score) + '%' })));
      tr.appendChild(imp);
      tr.appendChild(el('td', { class: 'num', text: String(r.score) }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    var pager = el('div', { class: 'pager' });
    var prev = el('button', { text: '← Previous', disabled: state.page === 0 ? true : null, onclick: function () { state.page--; render(); } });
    var next = el('button', { text: 'Next →', disabled: state.page >= pages - 1 ? true : null, onclick: function () { state.page++; render(); } });
    pager.appendChild(el('span', { class: 'muted', text: 'Page ' + (state.page + 1) + ' of ' + pages }));
    pager.appendChild(prev);
    pager.appendChild(next);
    wrap.appendChild(pager);
    return wrap;
  }

  function renderModel() {
    var wrap = el('div');
    var p1 = el('div', { class: 'panel' });
    p1.appendChild(el('h2', { text: 'How the value is priced — radar-2' }));
    p1.appendChild(el('p', { text: 'No flat multiple of TVL. Each category is priced off its own token-bearing protocols: the median market-cap per dollar of TVL in that category, shrunk toward the global median so a category with two protocols cannot set its own price. Growth, survival and chain breadth then adjust that base.' }));
    p1.appendChild(el('div', { class: 'formula', text: 'implied = TVL × category multiple × (1 + clamp(7d, −60, 120)% × 0.35) × maturity × breadth' }));
    p1.appendChild(el('p', { text: 'Maturity is 0.70 + up to 0.30 for three years of history (365 days when no listing date is recorded). Breadth is 1 + 0.04 per extra chain, capped at 1.20. The same function scores every row; no protocol name is special-cased. A protocol is said to record no token, never to have none: its DefiLlama record may simply not carry one.' }));
    wrap.appendChild(p1);
    var p2 = el('div', { class: 'panel' });
    p2.appendChild(el('h2', { text: 'Comparables — what the market pays per $1 of TVL' }));
    p2.appendChild(el('p', { text: 'Global median across ' + DATA.comparables.reduce(function (a, c) { return a + c.n; }, 0) + ' token-bearing protocols: ' + DATA.global_median_mcap_per_tvl + '×. The table shows the categories with the most comparables.' }));
    var table = el('table');
    var thead = el('thead');
    var hr = el('tr');
    ['Category', 'Protocols', 'Median mcap / TVL', 'Multiple used'].forEach(function (h) { hr.appendChild(el('th', {}, document.createTextNode(h))); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el('tbody');
    DATA.comparables.slice(0, 12).forEach(function (c) {
      var tr = el('tr');
      tr.appendChild(el('td', { text: c.category }));
      tr.appendChild(el('td', { class: 'num', text: String(c.n) }));
      tr.appendChild(el('td', { class: 'num', text: c.median_mcap_per_tvl.toFixed(3) + '×' }));
      tr.appendChild(el('td', { class: 'num', text: c.multiple.toFixed(3) + '×' }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    p2.appendChild(table);
    wrap.appendChild(p2);
    return wrap;
  }

  function renderLive() {
    var wrap = el('div');
    var p = el('div', { class: 'panel' });
    p.appendChild(el('h2', { text: 'Live tokens — the market’s own values' }));
    p.appendChild(el('p', { text: 'These protocols already trade, so the board shows the market’s value, never a model’s. They are the comparables the pre-token board is priced off: the same market-cap per TVL the model uses, shown here per protocol.' }));
    var table = el('table');
    var thead = el('thead');
    var hr = el('tr');
    ['Protocol', 'Category', 'TVL', 'Market cap', 'Mcap / TVL', '7d'].forEach(function (h) { hr.appendChild(el('th', {}, document.createTextNode(h))); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', {}, r.name));
      tr.appendChild(el('td', { text: r.category || '—' }));
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }));
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }));
      tr.appendChild(el('td', { class: 'num', text: r.mcap_usd && r.tvl_usd ? (r.mcap_usd / r.tvl_usd).toFixed(2) + '×' : 'n/a' }));
      tr.appendChild(el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    p.appendChild(table);
    wrap.appendChild(p);
    return wrap;
  }

  function renderDrawer() {
    if (!state.selected) return null;
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === state.selected) row = r; });
    if (!row) return null;
    var d = el('aside', { class: 'drawer', role: 'dialog', 'aria-label': row.name + ' detail' });
    d.appendChild(el('button', { class: 'close', text: 'Close ×', onclick: function () { state.selected = null; render(); } }));
    d.appendChild(el('div', { class: 'muted', text: 'Rank #' + row.rank + ' · Score ' + row.score + ' / 100' }));
    d.appendChild(el('h2', { text: row.name }));
    d.appendChild(el('div', { class: 'sub', text: (row.category || 'Uncategorized') + ' · ' + row.chains.join(', ') + (row.on_watchlist ? ' · on the watchlist' : ' · early find') }));
    var kv = el('table', { class: 'kv' });
    var body = el('tbody');
    var check = impliedOf(row);
    [
      ['Implied launch value', fmtUsd(row.implied_value_usd)],
      ['TVL', fmtUsd(row.tvl_usd)],
      ['TVL change, 7 days', fmtPct(row.change_7d)],
      ['Category multiple', row.category_multiple.toFixed(3) + '× market cap per TVL'],
      ['Growth multiplier', '×' + row.growth_multiplier.toFixed(4)],
      ['Maturity multiplier', '×' + row.maturity_multiplier.toFixed(4)],
      ['Chain breadth multiplier', '×' + row.breadth_multiplier.toFixed(4)],
      ['Listed', row.listed_at || 'unknown'],
      ['Age', fmtAge(row.age_days)],
      ['Page recomputes', fmtUsd(check) + (check === row.implied_value_usd ? ' — matches the board' : ' — differs from the board')]
    ].forEach(function (pair) {
      var tr = el('tr');
      tr.appendChild(el('td', { text: pair[0] }));
      tr.appendChild(el('td', { class: 'num', text: pair[1] }));
      body.appendChild(tr);
    });
    kv.appendChild(body);
    d.appendChild(kv);
    d.appendChild(el('h3', { text: 'Farm plan — six steps' }));
    var ol = el('ol', { class: 'steps' });
    farmSteps(row).forEach(function (s) { ol.appendChild(el('li', { text: s })); });
    d.appendChild(ol);
    d.appendChild(el('div', { class: 'warn', text: 'Read this as a research board, not advice: ' + row.name + ' records no token in this snapshot, which is not proof it has none, and no launch is promised. Never pay to claim an airdrop and never share a seed phrase.' }));
    return d;
  }

  function render() {
    writeHash();
    app.setAttribute('aria-busy', 'false');
    while (app.firstChild) app.removeChild(app.firstChild);
    var band = el('header', { class: 'band' });
    var inner = el('div', { class: 'band-inner' });
    var brand = el('div', { class: 'brand' });
    brand.appendChild(el('span', { class: 'dot' }));
    brand.appendChild(el('span', { class: 'name', text: 'TOKEN RADAR · MODEL radar-2' }));
    inner.appendChild(brand);
    inner.appendChild(el('h1', { text: 'Pre-token protocols, ranked by what their launch would be worth' }));
    inner.appendChild(el('p', { class: 'lede', text: 'Every protocol in the snapshot that records no token, priced off what the market already pays per dollar of TVL for its kind of protocol — with the steps to farm each one. The watchlist is the floor, never the ceiling: ' + DATA.early_size + ' of these ' + DATA.board_size + ' rows sit outside it.' }));
    var meta = el('div', { class: 'meta' });
    meta.appendChild(el('span', { text: 'Snapshot: ' + DATA.as_of }));
    meta.appendChild(el('span', { text: 'Source: ' + DATA.source }));
    meta.appendChild(el('span', { text: 'Floor: ' + fmtUsd(DATA.floor_usd) + ' TVL' }));
    inner.appendChild(meta);
    band.appendChild(inner);
    app.appendChild(band);

    var shell = el('div', { class: 'shell' });
    var top = DATA.rows[0];
    var med = DATA.rows[Math.floor(DATA.rows.length / 2)];
    var stats = el('div', { class: 'stats' });
    [
      ['Board', String(DATA.board_size), 'ranked protocols'],
      ['Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'every slug on it'],
      ['Early finds', String(DATA.early_size), 'outside the watchlist'],
      ['Top implied value', fmtUsd(top ? top.implied_value_usd : 0), top ? top.name : ''],
      ['Median implied value', fmtUsd(med ? med.implied_value_usd : 0), 'across the board'],
      ['Live tokens priced', String(DATA.live_size), 'as comparables']
    ].forEach(function (s) {
      var st = el('div', { class: 'stat' });
      st.appendChild(el('div', { class: 'k', text: s[0] }));
      st.appendChild(el('div', { class: 'v num', text: s[1] }));
      st.appendChild(el('div', { class: 's', text: s[2] }));
      stats.appendChild(st);
    });
    shell.appendChild(stats);

    var tabs = el('div', { class: 'tabs', role: 'tablist' });
    [['board', 'Board'], ['model', 'Model & comparables'], ['live', 'Live tokens']].forEach(function (t) {
      tabs.appendChild(el('button', {
        class: 'tab', role: 'tab', 'aria-selected': state.tab === t[0] ? 'true' : 'false', text: t[1],
        onclick: function () { state.tab = t[0]; state.page = 0; render(); }
      }));
    });
    shell.appendChild(tabs);
    if (state.tab === 'model') shell.appendChild(renderModel());
    else if (state.tab === 'live') shell.appendChild(renderLive());
    else shell.appendChild(renderBoard());
    app.appendChild(shell);
    var drawer = renderDrawer();
    if (drawer) app.appendChild(drawer);
  }

  readHash();
  render();
})();
