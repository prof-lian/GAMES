/* ==========================================================
   Cabeçalho compartilhado + jogador + ranking
   Professor Lian Ribeiro · Aulas de Computação
   ========================================================== */
(function () {
  const LOGO = 'https://aniversariomariah22.my.canva.site/jgg/_assets/media/e51924df3888b4556d8a33aedcdc2ffc.png';
  const ROOT = new URL('../', document.currentScript.src).href;   // raiz do site

  /* ---------- Escolas e turmas (mesmas do quadro de horários) ---------- */
  const ESCOLAS = {
    'Escola Municipal Professor Anísio Teixeira':
      ['2º ANO B', '2º ANO D', '3º ANO B', '3º ANO C', '4º ANO B', '4º ANO C', '5º ANO B', '5º ANO C'],
    'Escola Municipal Cívico-Militar José Geraldo Guimarães':
      ['2º ANO G', '3º ANO A', '3º ANO B', '3º ANO C', '3º ANO D', '3º ANO E', '3º ANO F', '5º ANO D', '5º ANO E', '5º ANO F'],
  };
  const SIGLA = {
    'Escola Municipal Professor Anísio Teixeira': 'Anísio Teixeira',
    'Escola Municipal Cívico-Militar José Geraldo Guimarães': 'José Geraldo',
  };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Jogador ---------- */
  const Player = {
    escolas: ESCOLAS,
    sigla: e => SIGLA[e] || e,
    get: () => store.get('lian_player', null),
    set(p) { store.set('lian_player', p); renderPlayer(); },
  };

  /* ---------- Ranking online (Firebase Firestore, projeto "games") ---------- */
  const FIREBASE = { projectId: 'games-4efa7', apiKey: 'AIzaSyC_zod0fusdZj3LbgTmKKOc9ndAiSCbDg4' };
  const DB = `projects/${FIREBASE.projectId}/databases/(default)/documents`;
  const API = `https://firestore.googleapis.com/v1/${DB}`;

  const enc = v => typeof v === 'string' ? { stringValue: v }
    : Number.isInteger(v) ? { integerValue: String(v) }
    : typeof v === 'number' ? { doubleValue: v }
    : v && typeof v === 'object' ? { mapValue: { fields: encFields(v) } }
    : { nullValue: null };
  const encFields = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)]));
  const dec = v => 'stringValue' in v ? v.stringValue
    : 'integerValue' in v ? Number(v.integerValue)
    : 'doubleValue' in v ? v.doubleValue
    : 'timestampValue' in v ? Date.parse(v.timestampValue)
    : 'mapValue' in v ? decFields(v.mapValue.fields || {})
    : null;
  const decFields = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, dec(v)]));

  async function call(path, body) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(`${API}${path}?key=${FIREBASE.apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal,
      });
      const json = await r.json().catch(() => ({}));
      const err = Array.isArray(json) ? (json.find(x => x && x.error) || {}).error : json.error;
      if (!r.ok || err) throw Object.assign(new Error((err && err.message) || r.status), { status: err && err.status });
      return json;
    } finally { clearTimeout(t); }
  }

  const Cloud = {
    async add(id, game, e) {
      const fields = encFields({ jogo: game, nome: e.nome, escola: e.escola, turma: e.turma, pontos: e.pontos, tempo: e.tempo, niveis: e.niveis });
      await call(':commit', { writes: [{
        update: { name: `${DB}/ranking/${id}`, fields },
        updateTransforms: [{ fieldPath: 'data', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      }] });
    },
    async list(game) {
      const q = ordered => ({ structuredQuery: {
        from: [{ collectionId: 'ranking' }],
        where: { fieldFilter: { field: { fieldPath: 'jogo' }, op: 'EQUAL', value: { stringValue: game } } },
        ...(ordered ? { orderBy: [{ field: { fieldPath: 'pontos' }, direction: 'DESCENDING' }] } : {}),
        limit: ordered ? 500 : 1000,
      } });
      let rows;
      try { rows = await call(':runQuery', q(true)); }
      catch (err) {                                   // índice ainda não criado: busca sem ordenar
        if (err.status !== 'FAILED_PRECONDITION') throw err;
        rows = await call(':runQuery', q(false));
      }
      return rows.filter(r => r.document).map(r => ({ ...decFields(r.document.fields || {}), id: r.document.name.split('/').pop() }));
    },
  };

  /* ---------- Ranking: online quando der, e sempre uma cópia neste navegador ---------- */
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
        <a class="lian-home" href="${ROOT}jogos-educacionais.html">🎮 Jogos</a>
      </div>`;
    document.body.prepend(bar);
    renderPlayer();
  }

  window.Lian = { Player, Ranking, esc, mount };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
