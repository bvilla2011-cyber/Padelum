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
  user = await account.get();
  if (!user.email || user.emailVerification !== true) throw new Error("Inicia sesión con tu cuenta verificada para usar PADELUM Online.");
  $("onlineName").value = user.name || localStorage.getItem("padelum-player-name") || "";
  status("Conectado a PADELUM Online · cuenta verificada", "success");
}
let uiBound = false;
let sdkReady = false;
window.addEventListener("padelum:authenticated", async event => {
  if (!event.detail?.user) return;
  if (!sdkReady) {
    status("Cuenta iniciada. Terminando de conectar con el servidor…");
    return;
  }
  try { await ensureAuth(); }
  catch (e) {
    console.error("PADELUM Online auth refresh:", e);
    status("Cuenta iniciada, pero el servidor rechazó la sesión: " + (e?.message || String(e)), "error");
  }
});
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

let activeChampionship=null;
function renderChampLobby(champ,players){
 activeChampionship=champ;
 $("champOptions").hidden=true;$("privateOptions").hidden=true;$("tournamentLobby").hidden=false;
 $("tourneyTitle").textContent=champ.championshipName||"PADELUM OPEN";
 $("tourneyCode").textContent="CÓDIGO · "+champ.code;
 const max=Number(champ.maxPlayers)||8;
 $("tourneyCount").textContent=players.length+" / "+max;
 $("tourneyMembers").innerHTML="";
 for(let i=0;i<max;i++){
  const p=players[i],card=document.createElement("div");
  card.className="tourneyMember"+(p?"":" empty");
  const avatar=document.createElement("div");avatar.className="tourneyAvatar";avatar.textContent=p?(p.name||"J").trim().charAt(0).toUpperCase():"＋";
  const name=document.createElement("strong");name.textContent=p?(p.name||"Jugador"):"PLAZA LIBRE";
  card.append(avatar,name);$("tourneyMembers").append(card);
 }
 const isHost=champ.hostId===user.$id;
 $("tourneyStart").hidden=!isHost||champ.status!=="waiting"||players.length!==max;
 $("tourneyNote").textContent=champ.status==="waiting"?(isHost?(players.length===max?"¡Todos listos! Puedes iniciar el sorteo.":"Comparte el código. El torneo comienza cuando se completen las plazas."):"Esperando a que el anfitrión inicie el torneo…"):"Sorteo realizado. Preparando el cuadro de eliminatorias.";
 if(champ.bracket){try{renderBracket(JSON.parse(champ.bracket))}catch{}}
}
function renderBracket(bracket){
 const root=$("tourneyBracket");root.hidden=false;root.innerHTML="";
 const rounds=bracket.rounds||[];
 const draw=document.createElement("div");draw.className="bracketDraw";draw.textContent="¡SORTEO!";root.append(draw);
 rounds.forEach((matches,ri)=>{
  const section=document.createElement("div");section.className="bracketRound";
  const title=document.createElement("h5");title.textContent=ri===rounds.length-1?"FINAL":ri===rounds.length-2?"SEMIFINALES":ri===rounds.length-3?"CUARTOS DE FINAL":"RONDA "+(ri+1);section.append(title);
  matches.forEach((m,mi)=>{const row=document.createElement("div");row.className="bracketMatch";const names=document.createElement("span");names.textContent=(m.a?.name||"Por decidir")+"  VS  "+(m.b?.name||"Por decidir");const tag=document.createElement("b");tag.textContent=m.winner?.name||"PENDIENTE";row.append(names,tag);section.append(row)});
  root.append(section);
 });
}
async function startChampionship(){
 if(!activeChampionship||activeChampionship.hostId!==user.$id)return;
 try{
  const latest=await db.getRow({databaseId:DATABASE_ID,tableId:"championships",rowId:activeChampionship.$id});
  const players=JSON.parse(latest.players||"[]");
  if(players.length!==Number(latest.maxPlayers))return status("Faltan participantes para iniciar el torneo.","error");
  const shuffled=[...players].sort(()=>Math.random()-.5),first=[];
  for(let i=0;i<shuffled.length;i+=2)first.push({a:shuffled[i],b:shuffled[i+1],winner:null,matchId:null});
  const bracket={rounds:[first],champion:null,pointsToWin:5,winBy:2,startedAt:new Date().toISOString()};
  await db.updateRow({databaseId:DATABASE_ID,tableId:"championships",rowId:latest.$id,data:{status:"in_progress",bracket:JSON.stringify(bracket)}});
  for(let i=0;i<first.length;i++){
   const m=first[i],row=await db.createRow({databaseId:DATABASE_ID,tableId:"tournament_matches",rowId:ID.unique(),data:{championshipCode:latest.code,round:1,matchNumber:i+1,playerA:m.a.id,playerB:m.b.id,winnerId:"",status:"pending",scoreA:0,scoreB:0},permissions:[Permission.read(Role.any())]});
   m.matchId=row.$id;
  }
  bracket.rounds[0]=first;
  await db.updateRow({databaseId:DATABASE_ID,tableId:"championships",rowId:latest.$id,data:{bracket:JSON.stringify(bracket)}});
  activeChampionship={...latest,status:"in_progress",bracket:JSON.stringify(bracket)};
  renderChampLobby(activeChampionship,players);
  $("tourneyStart").hidden=true;
  $("tourneyNote").textContent="Sorteo completado. Los enfrentamientos ya están definidos.";
  status("Sorteo de "+latest.championshipName+" completado.","success");
 }catch(e){status("No se pudo iniciar el torneo: "+(e.message||e),"error")}
}
async function createChampionship(){
 stopPolling();clearCode();saveName();
 const championshipName=$("champName").value.trim().replace(/\\s+/g," ");
 if(championshipName.length<3||championshipName.length>48)return status("Pon un nombre de campeonato de entre 3 y 48 caracteres.","error");
 const maxPlayers=Number($("champSize").value),code=code6(),now=new Date().toISOString(),player={id:user.$id,name:cleanName()};
 try{
  const champ=await db.createRow({databaseId:DATABASE_ID,tableId:"championships",rowId:ID.unique(),data:{code,championshipName,hostId:user.$id,hostName:player.name,status:"waiting",maxPlayers,playerIds:JSON.stringify([user.$id]),players:JSON.stringify([player]),bracket:"",createdAt:now},permissions:ownerPerms(user.$id)});
  renderChampLobby(champ,[player]);status("Torneo creado. Comparte el código para reunir a los participantes.","success");
  currentPoll=setInterval(async()=>{
   try{
    const latest=await db.getRow({databaseId:DATABASE_ID,tableId:"championships",rowId:champ.$id}),players=JSON.parse(latest.players||"[]");
    renderChampLobby(latest,players);
    if(latest.status!=="waiting"){stopPolling();return}
    const reqs=await db.listRows({databaseId:DATABASE_ID,tableId:"championship_join_requests",queries:[Query.equal("championshipCode",code),Query.equal("status","waiting"),Query.limit(40)]});
    let changed=false;
    for(const req of reqs.rows){if(players.length>=maxPlayers)break;if(!players.some(p=>p.id===req.playerId)){players.push({id:req.playerId,name:req.playerName});changed=true}}
    if(changed){
     const updated=await db.updateRow({databaseId:DATABASE_ID,tableId:"championships",rowId:champ.$id,data:{players:JSON.stringify(players),playerIds:JSON.stringify(players.map(p=>p.id))},permissions:[...ownerPerms(user.$id),...players.filter(p=>p.id!==user.$id).map(p=>Permission.read(Role.user(p.id)))]});
     renderChampLobby(updated,players);
    }
   }catch(e){console.warn("Tournament lobby poll:",e)}
  },1500);
 }catch(e){status("No se pudo crear el campeonato: "+e.message,"error")}
}
async function joinChampionship(){
 stopPolling();clearCode();saveName();
 const code=$("champCode").value.trim().toUpperCase();
 if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))return status("Introduce un código de torneo válido.","error");
 try{
  const found=await db.listRows({databaseId:DATABASE_ID,tableId:"championships",queries:[Query.equal("code",code),Query.limit(1)]}),champ=found.rows[0];
  if(!champ||champ.status!=="waiting")return status("No hay un campeonato abierto con ese código.","error");
  const ids=JSON.parse(champ.playerIds||"[]");
  if(ids.includes(user.$id))return status("Ya estás inscrito en este campeonato.","error");
  if(ids.length>=champ.maxPlayers)return status("El campeonato está completo.","error");
  await db.createRow({databaseId:DATABASE_ID,tableId:"championship_join_requests",rowId:ID.unique(),data:{championshipCode:code,playerId:user.$id,playerName:cleanName(),status:"waiting",createdAt:new Date().toISOString()},permissions:ownerPerms(user.$id)});
  status("Solicitud enviada. Esperando confirmación del anfitrión…");
  currentPoll=setInterval(async()=>{
   try{
    const latest=await db.listRows({databaseId:DATABASE_ID,tableId:"championships",queries:[Query.equal("code",code),Query.limit(1)]}),row=latest.rows[0];
    if(!row)return;
    const playerIds=JSON.parse(row.playerIds||"[]");
    if(playerIds.includes(user.$id)){
     const players=JSON.parse(row.players||"[]");renderChampLobby(row,players);
     if(row.status==="in_progress"){stopPolling();$("tourneyNote").textContent="El sorteo ya está hecho. Esperando la organización de tu partido."}
    }
   }catch(e){console.warn("Tournament join poll:",e)}
  },1500);
 }catch(e){status("No se pudo unir al campeonato: "+e.message,"error")}
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
  $("tourneyStart").addEventListener("click", startChampionship);
  $("tourneyBack").addEventListener("click", () => { stopPolling(); $("tournamentLobby").hidden=true; $("champOptions").hidden=false; });
  $("champJoin").addEventListener("click", runWhenConnected(joinChampionship));
  $("onlineBack").addEventListener("click", () => { stopPolling(); clearCode(); $("privateOptions").hidden = true; $("champOptions").hidden = true; $("tournamentLobby").hidden = true; });
  document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => { $(button.dataset.close).hidden = true; }));
  $("onlineCode").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6); });
  $("champCode").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 6); });
}
async function boot() {
  status("Cargando el servicio de juego…");
  try {
    // Mismo SDK que auth.js para compartir la sesión sin incompatibilidades.
    const sdk = await import("https://cdn.jsdelivr.net/npm/appwrite@28.0.0/+esm");
    ({ Client, Account, TablesDB, ID, Query, Permission, Role } = sdk);
    if (!Client || !Account || !TablesDB) throw new Error("El SDK de Appwrite no contiene los módulos necesarios.");
    client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
    account = new Account(client);
    db = new TablesDB(client);
    sdkReady = true;
    if (!uiBound) { bindUI(); uiBound = true; }
    // El cliente online se prepara aunque todavía no haya sesión iniciada.
    try {
      await ensureAuth();
    } catch (authError) {
      console.warn("PADELUM Online espera a la autenticación:", authError);
      setConnection("INICIA SESIÓN", "");
      const el = $("onlineStatus");
      if (el) {
        el.textContent = "Servidor disponible. Inicia sesión con tu cuenta verificada para jugar online.";
        el.className = "onlineStatus";
      }
    }
  } catch (e) {
    console.error("PADELUM Online boot error:", e);
    status("No se pudo cargar el servicio online: " + (e?.message || String(e)), "error");
    setConnection("ERROR DE SERVICIO", "error");
    if (!uiBound) { bindUI(); uiBound = true; }
  }
}
boot();