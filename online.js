let Client, Account, TablesDB, ID, Query, Permission, Role;
let client, account, db;

const PROJECT_ID = "padelum-online";
const DATABASE_ID = "padelum_online_db";
const ENDPOINT = "https://fra.cloud.appwrite.io/v1";
function setConnection(message, kind = "") {
  const pill = $("connectionPill");
  if (!pill) return;
  pill.querySelector("span").textContent = message;
  const dot = pill.querySelector("i");
  dot.style.background = kind === "success" ? "#a9d85a" : kind === "error" ? "#f07868" : "#d5ad4b";
  dot.style.boxShadow = kind === "success" ? "0 0 12px #a9d85a" : kind === "error" ? "0 0 12px #f07868" : "0 0 12px #d5ad4b";
}
const $ = (id) => document.getElementById(id);
// Appwrite SDK is loaded asynchronously in boot() so startup errors can be shown in the menu.
let user = null;
let currentPoll = null;
let activeRoom = null;

function status(message, kind = "") {
  const el = $("onlineStatus");
  if (!el) return;
  el.textContent = message;
  el.className = "onlineStatus" + (kind ? " " + kind : "");
  if (kind === "success") setConnection("CONECTADO", "success");
  else if (kind === "error") setConnection("SIN CONEXIÓN", "error");
  else setConnection("CONECTANDO", "");
}
function showCode(code, label) {
  const el = $("onlineCodeCard");
  el.hidden = false;
  el.innerHTML = "<small>" + label + "</small><strong>" + code + "</strong><small>Comparte este código con tus amigos</small>";
}
function clearCode() { $("onlineCodeCard").hidden = true; $("onlineCodeCard").textContent = ""; }
function stopPolling() { if (currentPoll) clearInterval(currentPoll); currentPoll = null; }
function cleanName() {
  const raw = $("onlineName").value.trim();
  return (raw || ("Jugador" + user.$id.slice(-4))).replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 24) || "Jugador";
}
function code6() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
const ownerPerms = (id) => [Permission.read(Role.any()), Permission.update(Role.user(id)), Permission.delete(Role.user(id))];
const publicReadOwnerUpdate = (id) => [Permission.read(Role.any()), Permission.update(Role.user(id))];
async function ensureAuth() {
  try { user = await account.get(); }
  catch { await account.createAnonymousSession(); user = await account.get(); }
  $("onlineName").value = user.name || localStorage.getItem("padelum-player-name") || "";
  status("Conectado a PADELUM Online · sesión de invitado activa", "success");
}
function saveName() { localStorage.setItem("padelum-player-name", cleanName()); }

async function createPrivateRoom() {
  stopPolling(); clearCode(); saveName();
  const code = code6(), now = new Date().toISOString(), name = cleanName();
  try {
    const room = await db.createRow({
      databaseId: DATABASE_ID, tableId: "game_rooms", rowId: ID.unique(),
      data: { code, mode: "private", status: "waiting", hostId: user.$id, guestId: "", hostName: name, guestName: "", createdAt: now, updatedAt: now, gameState: "" },
      permissions: ownerPerms(user.$id)
    });
    activeRoom = room;
    showCode(code, "SALA PRIVADA · ESPERANDO RIVAL");
    status("Sala creada. Cuando tu amigo introduzca el código, aparecerá aquí.", "success");
    currentPoll = setInterval(async () => {
      try {
        const requests = await db.listRows({ databaseId: DATABASE_ID, tableId: "room_join_requests", queries: [Query.equal("roomCode", code), Query.equal("status", "waiting"), Query.limit(5)] });
        if (!requests.rows.length) return;
        const request = requests.rows[0];
        const updated = await db.updateRow({
          databaseId: DATABASE_ID, tableId: "game_rooms", rowId: room.$id,
          data: { guestId: request.playerId, guestName: request.playerName, status: "ready", updatedAt: new Date().toISOString() },
          permissions: [...ownerPerms(user.$id), Permission.read(Role.user(request.playerId))]
        });
        activeRoom = updated; stopPolling();
        status("¡Rival conectado: " + request.playerName + "! La sala está completa.", "success");
      } catch (e) { status("Esperando rival… " + (e.message || ""), ""); }
    }, 1500);
  } catch (e) { status("No se pudo crear la sala: " + e.message, "error"); }
}
async function joinPrivateRoom() {
  stopPolling(); clearCode(); saveName();
  const code = $("onlineCode").value.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return status("Introduce un código válido de 6 caracteres.", "error");
  try {
    const found = await db.listRows({ databaseId: DATABASE_ID, tableId: "game_rooms", queries: [Query.equal("code", code), Query.limit(1)] });
    const room = found.rows[0];
    if (!room || room.mode !== "private" || room.status !== "waiting") return status("No existe una sala disponible con ese código.", "error");
    if (room.hostId === user.$id) return status("Esta sala la has creado tú.", "error");
    await db.createRow({
      databaseId: DATABASE_ID, tableId: "room_join_requests", rowId: ID.unique(),
      data: { roomCode: code, playerId: user.$id, playerName: cleanName(), status: "waiting", createdAt: new Date().toISOString() },
      permissions: ownerPerms(user.$id)
    });
    status("Solicitud enviada. Esperando a que el anfitrión acepte…");
    currentPoll = setInterval(async () => {
      try {
        const latest = await db.listRows({ databaseId: DATABASE_ID, tableId: "game_rooms", queries: [Query.equal("code", code), Query.limit(1)] });
        const r = latest.rows[0];
        if (r && r.guestId === user.$id && r.status === "ready") {
          activeRoom = r; stopPolling(); showCode(code, "TE HAS UNIDO A LA SALA");
          status("¡Conectado con " + r.hostName + "! Sala lista.", "success");
        }
      } catch (e) { status("Esperando confirmación… " + e.message); }
    }, 1500);
  } catch (e) { status("No se pudo unir a la sala: " + e.message, "error"); }
}

async function createChampionship() {
  stopPolling(); clearCode(); saveName();
  const championshipName = $("champName").value.trim().replace(/\s+/g, " ");
  if (championshipName.length < 3 || championshipName.length > 48) return status("Pon un nombre de campeonato de entre 3 y 48 caracteres.", "error");
  const maxPlayers = Number($("champSize").value), code = code6(), now = new Date().toISOString();
  const player = { id: user.$id, name: cleanName() };
  try {
    const champ = await db.createRow({
      databaseId: DATABASE_ID, tableId: "championships", rowId: ID.unique(),
      data: { code, championshipName, hostId: user.$id, hostName: player.name, status: "waiting", maxPlayers, playerIds: JSON.stringify([user.$id]), players: JSON.stringify([player]), bracket: "", createdAt: now },
      permissions: ownerPerms(user.$id)
    });
    showCode(code, championshipName.toUpperCase() + " · " + maxPlayers + " JUGADORES");
    status("«" + championshipName + "» creado. " + maxPlayers + " plazas disponibles; esperando participantes.", "success");
    currentPoll = setInterval(async () => {
      try {
        const reqs = await db.listRows({ databaseId: DATABASE_ID, tableId: "championship_join_requests", queries: [Query.equal("championshipCode", code), Query.equal("status", "waiting"), Query.limit(40)] });
        const latest = await db.getRow({ databaseId: DATABASE_ID, tableId: "championships", rowId: champ.$id });
        let players = JSON.parse(latest.players || "[]");
        for (const req of reqs.rows) {
          if (players.length >= maxPlayers) break;
          if (!players.some(p => p.id === req.playerId)) players.push({ id: req.playerId, name: req.playerName });
        }
        if (players.length !== JSON.parse(latest.players || "[]").length) {
          await db.updateRow({ databaseId: DATABASE_ID, tableId: "championships", rowId: champ.$id, data: { players: JSON.stringify(players), playerIds: JSON.stringify(players.map(p => p.id)) }, permissions: [...ownerPerms(user.$id), ...players.filter(p => p.id !== user.$id).map(p => Permission.read(Role.user(p.id)))] });
        }
        if (players.length === maxPlayers && maxPlayers % 2 === 0 && latest.status === "waiting") {
          const shuffled = [...players].sort(() => Math.random() - 0.5);
          const firstRound = [];
          for (let i = 0; i < shuffled.length; i += 2) firstRound.push({ a: shuffled[i], b: shuffled[i + 1], winner: null });
          const bracket = { rounds: [firstRound], champion: null, pointsToWin: 5, winBy: 2 };
          await db.updateRow({ databaseId: DATABASE_ID, tableId: "championships", rowId: champ.$id, data: { status: "in_progress", bracket: JSON.stringify(bracket) } });
          for (let i = 0; i < firstRound.length; i++) {
            const m = firstRound[i];
            await db.createRow({ databaseId: DATABASE_ID, tableId: "tournament_matches", rowId: ID.unique(), data: { championshipCode: code, round: 1, matchNumber: i + 1, playerA: m.a.id, playerB: m.b.id, winnerId: "", status: "pending", scoreA: 0, scoreB: 0 }, permissions: [Permission.read(Role.any())] });
          }
          stopPolling(); status("¡Cuadro de «" + championshipName + "» creado! " + maxPlayers + " jugadores · " + firstRound.length + " enfrentamientos en la primera ronda.", "success");
        } else {
          status("Inscritos: " + players.length + " / " + maxPlayers + ". El sorteo comenzará al completar las plazas.");
        }
      } catch (e) { status("Actualizando campeonato… " + e.message); }
    }, 1800);
  } catch (e) { status("No se pudo crear el campeonato: " + e.message, "error"); }
}
async function joinChampionship() {
  stopPolling(); clearCode(); saveName();
  const code = $("champCode").value.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return status("Introduce un código de torneo válido.", "error");
  try {
    const found = await db.listRows({ databaseId: DATABASE_ID, tableId: "championships", queries: [Query.equal("code", code), Query.limit(1)] });
    const champ = found.rows[0];
    if (!champ || champ.status !== "waiting") return status("No hay un campeonato abierto con ese código.", "error");
    const ids = JSON.parse(champ.playerIds || "[]");
    if (ids.includes(user.$id)) return status("Ya estás inscrito en este campeonato.", "error");
    if (ids.length >= champ.maxPlayers) return status("El campeonato está completo.", "error");
    await db.createRow({ databaseId: DATABASE_ID, tableId: "championship_join_requests", rowId: ID.unique(), data: { championshipCode: code, playerId: user.$id, playerName: cleanName(), status: "waiting", createdAt: new Date().toISOString() }, permissions: ownerPerms(user.$id) });
    showCode(code, "SOLICITUD DE INSCRIPCIÓN ENVIADA");
    status("Solicitud enviada. El anfitrión está actualizando la lista de participantes…");
    currentPoll = setInterval(async () => {
      try {
        const latest = await db.listRows({ databaseId: DATABASE_ID, tableId: "championships", queries: [Query.equal("code", code), Query.limit(1)] });
        const row = latest.rows[0];
        if (!row) return;
        const playerIds = JSON.parse(row.playerIds || "[]");
        if (playerIds.includes(user.$id)) {
          if (row.status === "in_progress") { stopPolling(); status("¡Inscripción confirmada! El cuadro de eliminatorias está listo.", "success"); }
          else status("Inscripción confirmada en «" + (row.championshipName || "campeonato") + "» · " + playerIds.length + " / " + row.maxPlayers + " jugadores.");
        }
      } catch (e) { status("Esperando confirmación… " + e.message); }
    }, 1800);
  } catch (e) { status("No se pudo unir al campeonato: " + e.message, "error"); }
}

async function matchmaking() {
  stopPolling(); clearCode(); saveName();
  const name = cleanName(), createdAt = new Date().toISOString();
  status("Buscando rival… si nadie aparece en 15 segundos jugarás contra una CPU avanzada.");
  let queueRow;
  try {
    queueRow = await db.createRow({ databaseId: DATABASE_ID, tableId: "match_queue", rowId: ID.unique(), data: { playerId: user.$id, displayName: name, status: "waiting", roomCode: "", createdAt }, permissions: ownerPerms(user.$id) });
  } catch (e) { return status("No se pudo entrar en la cola: " + e.message, "error"); }
  const started = Date.now();
  currentPoll = setInterval(async () => {
    try {
      const joinedRooms = await db.listRows({ databaseId: DATABASE_ID, tableId: "game_rooms", queries: [Query.equal("guestId", user.$id), Query.equal("mode", "matchmaking"), Query.equal("status", "ready"), Query.limit(1)] });
      if (joinedRooms.rows.length) { activeRoom = joinedRooms.rows[0]; stopPolling(); try { await db.deleteRow({ databaseId: DATABASE_ID, tableId: "match_queue", rowId: queueRow.$id }); } catch {} showCode(activeRoom.code, "RIVAL ENCONTRADO"); status("¡Te has emparejado con " + activeRoom.hostName + "! Sala online creada. La sincronización de pista se completará en la siguiente fase.", "success"); return; }
      const waiting = await db.listRows({ databaseId: DATABASE_ID, tableId: "match_queue", queries: [Query.equal("status", "waiting"), Query.orderAsc("createdAt"), Query.limit(20)] });
      const fresh = waiting.rows.filter(r => Date.now() - new Date(r.createdAt).getTime() < 30000).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
      const entries = fresh.filter(r => r.playerId !== user.$id);
      const all = fresh;
      if (entries.length) {
        const first = all[0];
        if (first && first.playerId === user.$id) {
          const opponent = entries[0], code = code6(), now = new Date().toISOString();
          await db.createRow({ databaseId: DATABASE_ID, tableId: "game_rooms", rowId: ID.unique(), data: { code, mode: "matchmaking", status: "ready", hostId: user.$id, guestId: opponent.playerId, hostName: name, guestName: opponent.displayName, createdAt: now, updatedAt: now, gameState: "" }, permissions: ownerPerms(user.$id) });
          await db.updateRow({ databaseId: DATABASE_ID, tableId: "match_queue", rowId: queueRow.$id, data: { status: "matched", roomCode: code } });
          activeRoom = { code, hostId: user.$id, guestId: opponent.playerId, hostName: name, guestName: opponent.displayName };
          stopPolling(); showCode(code, "RIVAL ENCONTRADO");
          status("¡Te has emparejado con " + opponent.displayName + "! La sala online está creada. La sincronización del partido se activará en la siguiente fase.", "success");
        } else {
          const mine = all.find(r => r.playerId === user.$id);
          if (mine && mine.status === "matched") {
            const room = await db.listRows({ databaseId: DATABASE_ID, tableId: "game_rooms", queries: [Query.equal("code", mine.roomCode), Query.limit(1)] });
            if (room.rows[0]) { activeRoom = room.rows[0]; stopPolling(); showCode(mine.roomCode, "RIVAL ENCONTRADO"); status("¡Te has emparejado con " + room.rows[0].hostName + "! La sala online está creada. La sincronización del partido se activará en la siguiente fase.", "success"); }
          }
        }
        return;
      }
      if (Date.now() - started >= 15000) {
        stopPolling();
        try { await db.deleteRow({ databaseId: DATABASE_ID, tableId: "match_queue", rowId: queueRow.$id }); } catch {}
        status("No encontramos rival. Entrando contra una CPU avanzada…", "success");
        window.PADELUMHighCPU = true;
        if (typeof window.PADELUMStartCPU === "function") window.PADELUMStartCPU();
        else status("CPU alternativa lista, pero el motor de juego no ha terminado de inicializarse.", "error");
      }
    } catch (e) { status("Buscando rival… " + e.message); }
  }, 1300);
}

function bindUI() {
  $("onlineCreate").addEventListener("click", () => {
    $("privateOptions").hidden = false; $("champOptions").hidden = true; $("onlineCodeCard").hidden = true;
    $("privateOptions").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  const runWhenConnected = (action) => () => {
    if (!user || !db) return status("El servidor todavía no está conectado. Revisa el mensaje de conexión de arriba.", "error");
    action();
  };
  $("privateCreateBtn").addEventListener("click", runWhenConnected(createPrivateRoom));
  $("onlineJoin").addEventListener("click", runWhenConnected(joinPrivateRoom));
  $("onlineRandom").addEventListener("click", runWhenConnected(matchmaking));
  $("champOpen").addEventListener("click", () => {
    $("champOptions").hidden = false; $("privateOptions").hidden = true; $("onlineCodeCard").hidden = true;
    $("champOptions").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  $("champCreate").addEventListener("click", runWhenConnected(createChampionship));
  $("champJoin").addEventListener("click", runWhenConnected(joinChampionship));
  $("onlineBack").addEventListener("click", () => { stopPolling(); clearCode(); $("privateOptions").hidden = true; $("champOptions").hidden = true; });
  document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => { $(button.dataset.close).hidden = true; }));
  $("onlineCode").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6); });
  $("champCode").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6); });
}
async function boot() {
  status("Cargando el servicio de juego…");
  try {
    let sdk;
    try { sdk = await import("https://cdn.jsdelivr.net/npm/appwrite@17.0.0/+esm"); }
    catch (firstError) { console.warn("CDN principal no disponible; probando alternativa", firstError); sdk = await import("https://esm.sh/appwrite@17.0.0?bundle"); }
    ({ Client, Account, TablesDB, ID, Query, Permission, Role } = sdk);
    if (!Client || !Account || !TablesDB) throw new Error("El SDK de Appwrite no contiene los módulos necesarios.");
    client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
    account = new Account(client); db = new TablesDB(client);
    status("Conectando con el servidor de Frankfurt…");
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("La conexión tarda demasiado. Comprueba internet y que Appwrite permita sesiones anónimas.")), 12000));
    await Promise.race([ensureAuth(), timeout]);
    bindUI();
  } catch (e) {
    console.error("PADELUM Online boot error:", e);
    status("No se pudo iniciar PADELUM Online: " + (e?.message || String(e)), "error");
    setConnection("ERROR DE CONEXIÓN", "error");
    bindUI();
  }
}
boot();
