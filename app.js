
const CFG = window.TOURNAMENT_CONFIG || {};
const PHASE_META = {
  Oitavas: { key: "oitavas", rows: [4, 4] },
  Quartas: { key: "quartas", rows: [4, 4] },
  Semifinal: { key: "semifinal", rows: [3, 3] },
  Triangular: { key: "triangular", rows: [3, 3] },
  Final: { key: "final", rows: [1, 1] }
};

const state = {
  config: {},
  teams: [],
  phases: {},
  sponsors: [],
  champions: []
};

const els = {
  title: document.getElementById("site-title"),
  subtitle: document.getElementById("site-subtitle"),
  refreshChip: document.getElementById("refresh-chip"),
  sourceChip: document.getElementById("source-chip"),
  views: document.querySelectorAll(".view"),
  tabs: document.querySelectorAll(".nav-btn"),
  statTeams: document.getElementById("stat-teams"),
  statFinished: document.getElementById("stat-finished"),
  statLive: document.getElementById("stat-live"),
  statTri: document.getElementById("stat-tri"),
  homePhase: document.getElementById("home-current-phase"),
  homeTri: document.getElementById("home-tri-standings"),
  teamsGrid: document.getElementById("teams-grid"),
  sponsorsGrid: document.getElementById("sponsors-grid"),
  championsGrid: document.getElementById("champions-grid"),
  triStandings: document.getElementById("tri-standings"),
  localWarn: document.getElementById("local-warn"),
};

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(n => n.classList.toggle("active", n === btn));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === btn.dataset.target));
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

if (location.protocol === "file:") {
  els.localWarn.textContent = "Abra este site por localhost ou GitHub Pages. Em file:/// o navegador pode bloquear a leitura da planilha.";
}

async function loadAll() {
  setStatus("Atualizando…", "neutral");
  try {
    const [configSheet, teamsSheet, oitavas, quartas, semifinal, triangular, finalSheet, sponsorsSheet, championsSheet] = await Promise.all([
      fetchSheet(CFG.tabs?.config || "Config"),
      fetchSheet(CFG.tabs?.teams || "Equipes"),
      fetchSheet(CFG.tabs?.oitavas || "Oitavas"),
      fetchSheet(CFG.tabs?.quartas || "Quartas"),
      fetchSheet(CFG.tabs?.semifinal || "Semifinal"),
      fetchSheet(CFG.tabs?.triangular || "Triangular"),
      fetchSheet(CFG.tabs?.final || "Final"),
      fetchSheet(CFG.tabs?.sponsors || "Patrocinadores"),
      fetchSheet(CFG.tabs?.champions || "Campeoes")
    ]);

    state.config = parseConfig(configSheet);
    state.teams = parseTeams(teamsSheet);
    state.phases = {
      Oitavas: parsePhase("Oitavas", oitavas),
      Quartas: parsePhase("Quartas", quartas),
      Semifinal: parsePhase("Semifinal", semifinal),
      Triangular: parsePhase("Triangular", triangular),
      Final: parsePhase("Final", finalSheet)
    };
    state.sponsors = parseSponsors(sponsorsSheet);
    state.champions = parseChampions(championsSheet);

    render();
    setStatus(`Atualizado • ${new Date().toLocaleTimeString("pt-BR")}`, "ok");
  } catch (error) {
    console.error(error);
    setStatus("Erro ao atualizar", "error");
  }
}

function setStatus(text, kind) {
  els.refreshChip.textContent = text;
  els.refreshChip.className = "status-chip" + (kind === "error" ? " error" : "");
}

async function fetchSheet(sheetName) {
  const encoded = encodeURIComponent(sheetName);
  const url = `https://docs.google.com/spreadsheets/d/${CFG.sheetId}/gviz/tq?sheet=${encoded}&tqx=out:json`;
  const res = await fetch(url);
  const txt = await res.text();
  const match = txt.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
  if (!match) throw new Error(`Resposta inválida da aba ${sheetName}`);
  const json = JSON.parse(match[1]);
  const rows = (json.table.rows || []).map(r => {
    const arr = [];
    (r.c || []).forEach((cell, idx) => {
      arr[idx] = cell ? (cell.f ?? cell.v ?? "") : "";
    });
    return arr;
  });
  return rows;
}

function cell(rows, rowIdx, colIdx) {
  return (rows[rowIdx] && rows[rowIdx][colIdx] != null) ? String(rows[rowIdx][colIdx]).trim() : "";
}

function parseConfig(rows) {
  const map = {};
  for (let i = 3; i < rows.length; i++) {
    const key = cell(rows, i, 0);
    const value = cell(rows, i, 1);
    if (key) map[key] = value;
  }
  return map;
}

function parseTeams(rows) {
  const result = [];
  for (let i = 3; i < rows.length; i++) {
    const ativo = cell(rows, i, 0);
    const id = cell(rows, i, 1);
    if (!id) continue;
    result.push({
      ativo, id,
      nome: cell(rows, i, 2),
      jogador1: cell(rows, i, 3),
      jogador2: cell(rows, i, 4),
      seed: cell(rows, i, 5)
    });
  }
  return result.filter(t => t.ativo !== "NAO");
}

function parsePhase(name, rows) {
  const matches = [];
  const picks = [];
  const topStart = 4;
  const maxMatches = PHASE_META[name].rows[0];
  for (let i = 0; i < maxMatches; i++) {
    const r = topStart + i;
    const serieId = cell(rows, r, 2);
    if (!serieId) continue;
    matches.push({
      ativo: cell(rows, r, 0),
      ordem: cell(rows, r, 1),
      serieId,
      timeAId: cell(rows, r, 5) || cell(rows, r, 3),
      timeBId: cell(rows, r, 6) || cell(rows, r, 4),
      timeANome: cell(rows, r, 7),
      timeBNome: cell(rows, r, 8),
      j1: cell(rows, r, 9),
      j2: cell(rows, r, 10),
      j3: cell(rows, r, 11),
      scoreA: Number(cell(rows, r, 12) || 0),
      scoreB: Number(cell(rows, r, 13) || 0),
      winnerId: cell(rows, r, 14),
      winnerName: cell(rows, r, 15),
      status: cell(rows, r, 16),
      obs: cell(rows, r, 17)
    });
  }
  for (let i = 15; i < rows.length; i++) {
    const serieId = cell(rows, i, 0);
    const teamId = cell(rows, i, 1);
    const playerName = cell(rows, i, 4);
    if (!serieId || !teamId || !playerName) continue;
    picks.push({
      serieId,
      teamId,
      teamName: cell(rows, i, 2),
      slot: cell(rows, i, 3),
      playerName,
      picks: [5,6,7,8,9].map(c => cell(rows, i, c)).filter(Boolean),
      bans: [10,11].map(c => cell(rows, i, c)).filter(Boolean),
      games: [12,13,14].map(c => cell(rows, i, c)).filter(Boolean),
      obs: cell(rows, i, 15)
    });
  }
  return { matches, picks };
}

function parseSponsors(rows) {
  const result = [];
  for (let i = 3; i < rows.length; i++) {
    const ativo = cell(rows, i, 0);
    const nome = cell(rows, i, 1);
    if (!nome || ativo === "NAO") continue;
    result.push({
      nome,
      cota: cell(rows, i, 2),
      valor: cell(rows, i, 3),
      link: cell(rows, i, 4),
      desc: cell(rows, i, 5)
    });
  }
  return result;
}

function parseChampions(rows) {
  const result = [];
  for (let i = 3; i < rows.length; i++) {
    const ativo = cell(rows, i, 0);
    const camp = cell(rows, i, 2);
    if (!camp || ativo === "NAO") continue;
    result.push({
      temporada: cell(rows, i, 1),
      campeonato: camp,
      equipe: cell(rows, i, 3),
      jogadores: cell(rows, i, 4),
      vice: cell(rows, i, 5),
      data: cell(rows, i, 6),
      obs: cell(rows, i, 7)
    });
  }
  return result;
}

function render() {
  els.title.textContent = state.config["Nome do site"] || CFG.fallbackTitle || "Torneio Mythology MD3";
  els.subtitle.textContent = state.config["Subtitulo"] || "Campeonato em duplas • MD3 • Google Sheets";

  renderTeams();
  renderPhase("Oitavas");
  renderPhase("Quartas");
  renderPhase("Semifinal");
  renderPhase("Triangular");
  renderPhase("Final");
  renderSponsors();
  renderChampions();
  renderStats();
  renderTriStandings();
  renderHomePhase();
}

function renderTeams() {
  if (!state.teams.length) {
    els.teamsGrid.innerHTML = `<div class="empty-box">Nenhuma equipe cadastrada.</div>`;
    return;
  }
  els.teamsGrid.innerHTML = state.teams.map(team => `
    <article class="team-card">
      <div class="eyebrow">Equipe ${escapeHtml(team.id)}</div>
      <h3>${escapeHtml(team.nome)}</h3>
      <div class="meta">${escapeHtml(team.jogador1)} • ${escapeHtml(team.jogador2)}</div>
      <div class="badges">
        <span class="badge">Seed ${escapeHtml(team.seed || "—")}</span>
      </div>
    </article>
  `).join("");
}

function renderStats() {
  const allMatches = Object.values(state.phases).flatMap(p => p.matches);
  const finished = allMatches.filter(m => m.winnerId).length;
  const live = allMatches.filter(m => (m.timeAId || m.timeBId) && !m.winnerId && (m.scoreA || m.scoreB)).length;
  const triReady = new Set(state.phases.Triangular.matches.flatMap(m => [m.timeAId, m.timeBId]).filter(Boolean)).size;
  els.statTeams.textContent = String(state.teams.length);
  els.statFinished.textContent = String(finished);
  els.statLive.textContent = String(live);
  els.statTri.textContent = `${triReady}/3`;
}

function renderHomePhase() {
  const priority = ["Final", "Triangular", "Semifinal", "Quartas", "Oitavas"];
  const found = priority.map(name => ({ name, phase: state.phases[name] }))
    .find(item => item.phase.matches.some(m => m.timeAId || m.timeBId || m.winnerId));
  if (!found) {
    els.homePhase.innerHTML = `<div class="empty-box">Nenhuma fase preenchida ainda.</div>`;
    return;
  }
  const target = found.phase.matches.filter(m => m.timeAId || m.timeBId || m.winnerId).slice(0, 3);
  els.homePhase.innerHTML = `<div class="cards-grid">${target.map(matchCardHtml).join("")}</div>`;
}

function renderPhase(name) {
  const slot = document.getElementById(`phase-${name.toLowerCase()}`);
  const phase = state.phases[name];
  const matches = phase.matches.filter(m => m.timeAId || m.timeBId || m.winnerId || m.obs);
  if (!matches.length) {
    slot.innerHTML = `<div class="empty-box">Sem confrontos preenchidos nesta fase.</div>`;
    return;
  }
  slot.innerHTML = `<div class="cards-grid">${matches.map(matchCardHtml).join("")}</div>`;
}

function getTeam(id) {
  return state.teams.find(t => t.id === id) || null;
}

function playerCardsHtml(match) {
  const picks = state.phases[findPhaseBySerie(match.serieId)].picks.filter(p => p.serieId === match.serieId);
  if (!picks.length) return `<div class="empty-box">Sem picks e bans preenchidos.</div>`;
  return `<div class="picks-grid">${picks.map(p => `
    <article class="player-pick-card">
      <div class="eyebrow">${escapeHtml(p.teamName || p.teamId)} • ${escapeHtml(p.slot)}</div>
      <h3>${escapeHtml(p.playerName)}</h3>
      <div class="meta">Picks</div>
      <div class="pick-list">${p.picks.map(g => `<span class="pick-pill">${escapeHtml(g)}</span>`).join("") || '<span class="pick-pill">—</span>'}</div>
      <div class="meta" style="margin-top:10px">Bans</div>
      <div class="pick-list">${p.bans.map(g => `<span class="pick-pill ban">${escapeHtml(g)}</span>`).join("") || '<span class="pick-pill">—</span>'}</div>
      <div class="meta" style="margin-top:10px">Deuses usados</div>
      <div class="pick-list">${p.games.map((g, idx) => `<span class="pick-pill played">J${idx+1}: ${escapeHtml(g)}</span>`).join("") || '<span class="pick-pill">—</span>'}</div>
      ${p.obs ? `<div class="meta" style="margin-top:10px">${escapeHtml(p.obs)}</div>` : ""}
    </article>
  `).join("")}</div>`;
}

function findPhaseBySerie(serieId) {
  return Object.keys(state.phases).find(name => state.phases[name].matches.some(m => m.serieId === serieId)) || "Semifinal";
}

function matchCardHtml(match) {
  const teamA = getTeam(match.timeAId);
  const teamB = getTeam(match.timeBId);
  const nameA = match.timeANome || teamA?.nome || "Aguardando";
  const nameB = match.timeBNome || teamB?.nome || "Aguardando";
  const playersA = teamA ? `${teamA.jogador1} • ${teamA.jogador2}` : "";
  const playersB = teamB ? `${teamB.jogador1} • ${teamB.jogador2}` : "";
  const badgeClass = match.winnerId ? "win" : ((match.scoreA || match.scoreB) ? "live" : "wait");
  const badgeText = match.winnerId ? `Vencedor: ${escapeHtml(match.winnerName || match.winnerId)}` : (match.status || "Aguardando");
  return `
    <article class="series-card">
      <div class="series-head">
        <div>
          <div class="eyebrow">${escapeHtml(match.serieId)}</div>
          <h3>Confronto ${escapeHtml(String(match.ordem || ""))}</h3>
          ${match.obs ? `<div class="meta">${escapeHtml(match.obs)}</div>` : ""}
        </div>
        <div>
          <div class="scoreline">${escapeHtml(String(match.scoreA || 0))} x ${escapeHtml(String(match.scoreB || 0))}</div>
          <div class="badges"><span class="badge ${badgeClass}">${badgeText}</span></div>
        </div>
      </div>
      <div class="team-versus">
        <div class="team-box">
          <strong>${escapeHtml(nameA)}</strong>
          <div class="players">${escapeHtml(playersA)}</div>
        </div>
        <div class="vs">VS</div>
        <div class="team-box">
          <strong>${escapeHtml(nameB)}</strong>
          <div class="players">${escapeHtml(playersB)}</div>
        </div>
      </div>
      <details>
        <summary>Ver picks, bans e deuses</summary>
        ${playerCardsHtml(match)}
      </details>
    </article>
  `;
}

function computeTriStandings() {
  const tri = state.phases.Triangular.matches.filter(m => m.timeAId && m.timeBId);
  const ids = [...new Set(tri.flatMap(m => [m.timeAId, m.timeBId]).filter(Boolean))];
  const board = new Map(ids.map(id => [id, {
    id,
    team: getTeam(id)?.nome || id,
    jogadores: getTeam(id) ? `${getTeam(id).jogador1} • ${getTeam(id).jogador2}` : "",
    p: 0, md3: 0, v: 0, d: 0, partidasPro: 0, partidasContra: 0, saldo: 0
  }]));
  tri.forEach(m => {
    const a = board.get(m.timeAId), b = board.get(m.timeBId);
    if (!a || !b) return;
    if (m.scoreA || m.scoreB || m.winnerId) {
      a.md3 += 1; b.md3 += 1;
      a.partidasPro += Number(m.scoreA || 0); a.partidasContra += Number(m.scoreB || 0);
      b.partidasPro += Number(m.scoreB || 0); b.partidasContra += Number(m.scoreA || 0);
      if (m.winnerId === m.timeAId) { a.v += 1; a.p += 3; b.d += 1; }
      else if (m.winnerId === m.timeBId) { b.v += 1; b.p += 3; a.d += 1; }
    }
  });
  [...board.values()].forEach(t => t.saldo = t.partidasPro - t.partidasContra);
  return [...board.values()].sort((x,y) => y.p - x.p || y.v - x.v || y.saldo - x.saldo || y.partidasPro - x.partidasPro || x.team.localeCompare(y.team));
}

function standingsHtml(items) {
  if (!items.length) return `<div class="empty-box">O triangular ainda não tem três equipes definidas.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Pos</th><th>Equipe</th><th>P</th><th>MD3</th><th>V</th><th>D</th><th>Partidas</th><th>Saldo</th></tr>
        </thead>
        <tbody>
          ${items.map((t, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${escapeHtml(t.team)}</strong><div class="meta">${escapeHtml(t.jogadores)}</div></td>
              <td>${t.p}</td>
              <td>${t.md3}</td>
              <td>${t.v}</td>
              <td>${t.d}</td>
              <td>${t.partidasPro} - ${t.partidasContra}</td>
              <td>${t.saldo > 0 ? "+" : ""}${t.saldo}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTriStandings() {
  const board = computeTriStandings();
  const html = standingsHtml(board);
  els.triStandings.innerHTML = html;
  els.homeTri.innerHTML = html;
}

function renderSponsors() {
  if (!state.sponsors.length) {
    els.sponsorsGrid.innerHTML = `<div class="empty-box">Nenhum patrocinador ativo.</div>`;
    return;
  }
  els.sponsorsGrid.innerHTML = state.sponsors.map(s => `
    <article class="sponsor-card">
      <div class="eyebrow">${escapeHtml(s.cota || "Patrocínio")}</div>
      <h3>${escapeHtml(s.nome)}</h3>
      <div class="meta">${escapeHtml(s.valor || "")}</div>
      <p>${escapeHtml(s.desc || "")}</p>
      ${s.link ? `<a href="${escapeAttr(s.link)}" target="_blank" rel="noopener noreferrer">Abrir link</a>` : ""}
    </article>
  `).join("");
}

function renderChampions() {
  if (!state.champions.length) {
    els.championsGrid.innerHTML = `<div class="empty-box">Nenhum campeão registrado ainda.</div>`;
    return;
  }
  els.championsGrid.innerHTML = state.champions.map(c => `
    <article class="champion-card">
      <div class="eyebrow">${escapeHtml(c.temporada || "")}</div>
      <h3>${escapeHtml(c.equipe)}</h3>
      <div class="meta">${escapeHtml(c.campeonato)}</div>
      <div class="meta">${escapeHtml(c.jogadores)}</div>
      <div class="badges">
        ${c.vice ? `<span class="badge">Vice: ${escapeHtml(c.vice)}</span>` : ""}
        ${c.data ? `<span class="badge">${escapeHtml(c.data)}</span>` : ""}
      </div>
      ${c.obs ? `<p>${escapeHtml(c.obs)}</p>` : ""}
    </article>
  `).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function escapeAttr(value) { return escapeHtml(value); }

loadAll();
setInterval(loadAll, Math.max(10, Number(CFG.refreshSeconds || 30)) * 1000);
