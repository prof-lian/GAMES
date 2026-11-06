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

  /* ---------- Ranking (salvo neste navegador) ---------- */
  const Ranking = {
    all: game => store.get('lian_rank_' + game, []),
    add(game, entry) {
      const list = Ranking.all(game);
      const id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      list.push({ ...entry, id, data: Date.now() });
      list.sort((a, b) => b.pontos - a.pontos || a.tempo - b.tempo);
      store.set('lian_rank_' + game, list.slice(0, 200));
      return { id, posicao: list.findIndex(e => e.id === id) + 1 };
    },
    top(game, filtro, n = 10) {
      return Ranking.all(game).filter(e => !filtro || Object.keys(filtro).every(k => e[k] === filtro[k])).slice(0, n);
    },
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
