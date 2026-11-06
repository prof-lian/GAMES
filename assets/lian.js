/* ==========================================================
   Cabeçalho compartilhado + jogador + banco de dados + ranking
   Professor Lian Ribeiro · Aulas de Computação
   ========================================================== */
(function () {
  const LOGO = 'https://aniversariomariah22.my.canva.site/jgg/_assets/media/e51924df3888b4556d8a33aedcdc2ffc.png';
  const ROOT = new URL('../', document.currentScript.src).href;   // raiz do site

  /* ---------- Escolas padrão (usadas se o banco estiver vazio ou sem internet) ---------- */
  const ESCOLAS_PADRAO = [
    { id: 'anisio-teixeira', nome: 'Escola Municipal Professor Anísio Teixeira', sigla: 'Anísio Teixeira', ordem: 1,
      turmas: ['2º ANO B', '2º ANO D', '3º ANO B', '3º ANO C', '4º ANO B', '4º ANO C', '5º ANO B', '5º ANO C'] },
    { id: 'jose-geraldo', nome: 'Escola Municipal Cívico-Militar José Geraldo Guimarães', sigla: 'José Geraldo', ordem: 2,
      turmas: ['2º ANO G', '3º ANO A', '3º ANO B', '3º ANO C', '3º ANO D', '3º ANO E', '3º ANO F', '5º ANO D', '5º ANO E', '5º ANO F'] },
  ];

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ==========================================================
     Firebase (projeto "games") — acesso pela API REST do Firestore
     ========================================================== */
  const FIREBASE = { projectId: 'games-4efa7', apiKey: 'AIzaSyC_zod0fusdZj3LbgTmKKOc9ndAiSCbDg4' };
  const DB = `projects/${FIREBASE.projectId}/databases/(default)/documents`;
  const API = `https://firestore.googleapis.com/v1/${DB}`;

  const enc = v => typeof v === 'string' ? { stringValue: v }
    : typeof v === 'boolean' ? { booleanValue: v }
    : Number.isInteger(v) ? { integerValue: String(v) }
    : typeof v === 'number' ? { doubleValue: v }
    : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
    : v && typeof v === 'object' ? { mapValue: { fields: encFields(v) } }
    : { nullValue: null };
  const encFields = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)]));
  const dec = v => 'stringValue' in v ? v.stringValue
    : 'booleanValue' in v ? v.booleanValue
    : 'integerValue' in v ? Number(v.integerValue)
    : 'doubleValue' in v ? v.doubleValue
    : 'timestampValue' in v ? Date.parse(v.timestampValue)
    : 'arrayValue' in v ? (v.arrayValue.values || []).map(dec)
    : 'mapValue' in v ? decFields(v.mapValue.fields || {})
    : null;
  const decFields = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, dec(v)]));
  const docOf = d => ({ ...decFields(d.fields), id: d.name.split('/').pop() });

  /** Chamada genérica: rest('GET', '/escolas'), rest('POST', ':runQuery', corpo), rest('PATCH', '/x/y', corpo, token) */
  async function rest(method, path, body, token) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      const url = `${API}${path}${path.includes('?') ? '&' : '?'}key=${FIREBASE.apiKey}`;
      const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
      const json = await r.json().catch(() => ({}));
      const err = Array.isArray(json) ? (json.find(x => x && x.error) || {}).error : json.error;
      if (!r.ok || err) throw Object.assign(new Error((err && err.message) || ('HTTP ' + r.status)), { status: err && err.status, code: r.status });
      return json;
    } finally { clearTimeout(t); }
  }
  async function listAll(col, token) {
    let out = [], page = '';
    do {
      const r = await rest('GET', `/${col}?pageSize=300${page ? '&pageToken=' + encodeURIComponent(page) : ''}`, null, token);
      out = out.concat((r.documents || []).map(docOf));
      page = r.nextPageToken;
    } while (page);
    return out;
  }

  /* ---------- Dados cadastrados pelo professor (página admin-jogos) ---------- */
  const ordena = l => l.sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99) || String(a.nome).localeCompare(b.nome, 'pt'));
  const Data = {
    /** Escolas: do banco; se não der, a última cópia salva; senão as padrão */
    async escolas() {
      try {
        const l = await listAll('escolas');
        if (l.length) { const s = ordena(l.map(e => ({ ...e, turmas: e.turmas || [] }))); store.set('lian_escolas', s); return s; }
      } catch (e) { console.warn('Escolas offline:', e.message); }
      return store.get('lian_escolas', null) || ESCOLAS_PADRAO;
    },
    /** Alunos cadastrados: [{id, nome, escolaId, turma}] */
    async alunos() {
      try { const l = await listAll('alunos'); store.set('lian_alunos', l); return l; }
      catch (e) { return store.get('lian_alunos', []); }
    },
    /** Aviso do ranking: { texto, ativo } */
    async aviso() {
      try { const d = await rest('GET', '/config/ranking'); const c = decFields(d.fields); store.set('lian_aviso', c); return c; }
      catch (e) { return e.code === 404 ? {} : store.get('lian_aviso', {}); }
    },
    padrao: ESCOLAS_PADRAO,
  };

  /* ---------- Jogador ---------- */
  let siglas = Object.fromEntries((store.get('lian_escolas', null) || ESCOLAS_PADRAO).map(e => [e.nome, e.sigla || e.nome]));
  const Player = {
    sigla: nome => siglas[nome] || nome,
    setEscolas(l) { siglas = Object.fromEntries(l.map(e => [e.nome, e.sigla || e.nome])); },
    get: () => store.get('lian_player', null),
    set(p) { store.set('lian_player', p); renderPlayer(); },
  };

  /* ---------- Ranking: online quando der, e sempre uma cópia neste navegador ---------- */
  const Cloud = {
    async add(id, game, e) {
      const fields = encFields({ jogo: game, nome: e.nome, escola: e.escola, turma: e.turma, pontos: e.pontos, tempo: e.tempo, niveis: e.niveis });
      await rest('POST', ':commit', { writes: [{
        update: { name: `${DB}/ranking/${id}`, fields },
        updateTransforms: [{ fieldPath: 'data', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      }] });
    },
    async list(game, token) {
      const q = ordered => ({ structuredQuery: {
        from: [{ collectionId: 'ranking' }],
        where: { fieldFilter: { field: { fieldPath: 'jogo' }, op: 'EQUAL', value: { stringValue: game } } },
        ...(ordered ? { orderBy: [{ field: { fieldPath: 'pontos' }, direction: 'DESCENDING' }] } : {}),
        limit: ordered ? 500 : 1000,
      } });
      let rows;
      try { rows = await rest('POST', ':runQuery', q(true), token); }
      catch (err) {                                   // índice ainda não criado: busca sem ordenar
        if (err.status !== 'FAILED_PRECONDITION') throw err;
        rows = await rest('POST', ':runQuery', q(false), token);
      }
      return rows.filter(r => r.document).map(r => docOf(r.document));
    },
  };
  const sortRank = list => list.sort((a, b) => b.pontos - a.pontos || a.tempo - b.tempo);
  const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(20)),
    b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');
  const Ranking = {
    all: game => store.get('lian_rank_' + game, []),
    /** Lista do ranking: { online: true/false, list: [...] } */
    async load(game) {
      try { return { online: true, list: sortRank(await Cloud.list(game)) }; }
      catch (e) { console.warn('Ranking online indisponível:', e.message); return { online: false, list: Ranking.all(game) }; }
    },
    /** Salva o resultado; devolve { id, online, list } */
    async add(game, entry) {
      const id = newId();
      const local = Ranking.all(game);
      local.push({ ...entry, id, data: Date.now() });
      store.set('lian_rank_' + game, sortRank(local).slice(0, 200));
      try {
        await Cloud.add(id, game, entry);
        const r = await Ranking.load(game);
        if (r.online) return { id, ...r };
      } catch (e) { console.warn('Não foi possível salvar online:', e.message); }
      return { id, online: false, list: Ranking.all(game) };
    },
    filter: (list, filtro) => list.filter(e => !filtro || Object.keys(filtro).every(k => e[k] === filtro[k])),
    sort: sortRank,
  };

  /* ---------- Cabeçalho ---------- */
  function renderPlayer() {
    const el = document.getElementById('lianPlayer');
    if (!el) return;
    const p = Player.get();
    el.style.display = p ? '' : 'none';
    if (p) el.textContent = `👤 ${p.nome} · ${p.turma}`;
  }

  function mount() {
    const opts = document.body.dataset;
    if (opts.lianFullscreen !== undefined) document.body.classList.add('lian-fullscreen');
    if (opts.lianTransparent !== undefined) document.body.classList.add('lian-transparent-screens');
    const bar = document.createElement('header');
    bar.className = 'lian-bar';
    bar.innerHTML = `
      <a class="lian-brand" href="${ROOT}index.html" title="Início">
        <img src="${LOGO}" alt="Professor Lian Ribeiro"
             onerror="this.outerHTML='<span class=&quot;lian-fallback&quot;>🖥️</span>'">
        <span class="lian-brand-txt"><strong>Aulas de Computação</strong><span>Professor Lian Ribeiro</span></span>
      </a>
      <div class="lian-right">
        <span class="lian-player" id="lianPlayer" style="display:none"></span>
        <button class="lian-home lian-fs" id="lianFs" type="button" title="Tela cheia (F11)">⛶ Tela cheia</button>
        <a class="lian-home" href="${ROOT}jogos-educacionais.html">🎮 Jogos</a>
      </div>`;
    document.body.prepend(bar);
    renderPlayer();
    // botão de tela cheia: o jogo ocupa a tela inteira
    const fs = bar.querySelector('#lianFs');
    const el = document.documentElement;
    if (!(el.requestFullscreen || el.webkitRequestFullscreen)) fs.remove();
    else {
      const isFs = () => document.fullscreenElement || document.webkitFullscreenElement;
      const label = () => { fs.textContent = isFs() ? '✕ Sair da tela cheia' : '⛶ Tela cheia'; };
      fs.onclick = () => isFs()
        ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
        : (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      document.addEventListener('fullscreenchange', label);
      document.addEventListener('webkitfullscreenchange', label);
    }
  }

  window.Lian = {
    Player, Ranking, Data, esc, mount,
    // usados pela página admin-jogos
    db: { rest, listAll, encFields, decFields, docOf, DB, FIREBASE, Cloud },
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
