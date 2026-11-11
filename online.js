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
let activePeer = null;
let onlineConnection = null;
let onlinePeerModule = null;
let onlineIsHostUser = false;

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
        status("¡Rival conectado: " + request.playerName + "! Abriendo la pista…", "success");
        connectOnlineRoom(updated);
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
    const waitStartedAt = Date.now();
    currentPoll = setInterval(async () => {
      try {
        const latest = await db.listRows({ databaseId: DATABASE_ID, tableId: "game_rooms", queries: [Query.equal("code", code), Query.limit(1)] });
        const r = latest.rows[0];
        if (Date.now() - waitStartedAt > 45000 || !r || r.status === "closed") { stopPolling(); return status("La sala ya no está disponible. Pide un código nuevo.", "error"); }
        if (r.guestId === user.$id && r.status === "ready") {
          activeRoom = r; stopPolling(); showCode(code, "TE HAS UNIDO A LA SALA");
          status("¡Conectado con " + r.hostName + "! Abriendo la pista…", "success");
          connectOnlineRoom(r);
        }
      } catch (e) { status("Esperando confirmación… " + e.message); }
    }, 1500);
  } catch (e) { status("No se pudo unir a la sala: " + e.message, "error"); }
}

async function connectOnlineRoom(room, tournamentMatch = null) {
  if (!room || !user) return;
  const host = room.hostId === user.$id;
  const code = room.code;
  const localPeerId = "padelum-" + code + "-" + (host ? "host" : "guest");
  const remotePeerId = "padelum-" + code + "-" + (host ? "guest" : "host");
  status("Conectando directamente con tu rival…");
  try {
    onlinePeerModule ||= import("https://cdn.jsdelivr.net/npm/peerjs@1.5.5/+esm");
    const { Peer } = await onlinePeerModule;
    if (!Peer) throw new Error("No se pudo cargar WebRTC.");
    activePeer?.destroy();
    const peer = new Peer(localPeerId, { debug: 0, config: { iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" }
    ] } });
    activePeer = peer;
    let started = false;
    const connectionTimeout=setTimeout(()=>{
      if(started)return;
      status("No se pudo conectar con el rival tras 25 segundos. Revisa la red y vuelve a intentarlo.","error");
      try{peer.destroy()}catch{}
      if(activePeer===peer)activePeer=null;
    },25000);
    const begin = connection => {
      if (started) return;
      started = true;clearTimeout(connectionTimeout);
      onlineConnection = connection;
      onlineIsHostUser = host;
      connection.on("close", () => window.dispatchEvent(new CustomEvent("padelum:online-disconnect")));
      connection.on("error", error => console.warn("PADELUM data channel:", error));
      connection.on("data", data => window.dispatchEvent(new CustomEvent("padelum:online-data", { detail: data })));
      status("Conexión directa lista. Entrando en pista…", "success");
      window.PADELUMStartOnline?.({ host, opponentName: host ? room.guestName : room.hostName, connection, tournamentMatch });
    };
    let dialing = false, dialTimer = null;
    const dial = () => {
      if (host || started || dialing) return;
      dialing = true;
      const connection = peer.connect(remotePeerId, { reliable: true, serialization: "json" });
      let settled = false, retryTimer = null;
      const retry = () => {
        if (started || settled) return;
        settled = true; dialing = false; clearTimeout(retryTimer); connection.close();
        setTimeout(dial, 650);
      };
      retryTimer = setTimeout(retry, 4000);
      connection.on("open", () => {
        if (settled || started) return;
        settled = true; dialing = false; clearTimeout(retryTimer); clearInterval(dialTimer); begin(connection);
      });
      connection.on("error", error => { console.warn("PADELUM peer connect:", error); retry(); });
      connection.on("close", retry);
    };
    peer.on("open", () => {
      if (host) return;
      dial();
      dialTimer = setInterval(() => {
        if (started) clearInterval(dialTimer);
        else dial();
      }, 2000);
    });
    if (host) peer.on("connection", connection => {
      if (connection.peer !== remotePeerId) { connection.close(); return; }
      connection.on("open", () => begin(connection));
    });
    peer.on("error", error => {
      console.warn("PADELUM WebRTC:", error);
      if (!started) status("No se pudo abrir la conexión directa: " + (error?.message || "revisa la red"), "error");
    });
  } catch (error) {
    console.error("PADELUM WebRTC setup:", error);
    status("No se pudo iniciar el partido online: " + (error?.message || error), "error");
  }
}

let activeChampionship=null, renderedLobbyPlayers="", renderedBracketData="", lobbyPollBusy=false, championshipAdvancing=false;
function parseBracket(champ){try{return JSON.parse(champ?.bracket||"{}")}catch{return {rounds:[]}}}
function matchForCurrentPlayer(champ){
 const bracket=parseBracket(champ),rounds=bracket.rounds||[];
 for(let ri=0;ri<rounds.length;ri++)for(let mi=0;mi<(rounds[ri]||[]).length;mi++){
  const match=rounds[ri][mi];
  if(!match.winner&&(match.a?.id===user?.$id||match.b?.id===user?.$id))return {match,round:ri+1,matchNumber:mi+1};
 }
 return null;
}
function renderChampLobby(champ,players){
 activeChampionship=champ;
 $("champOptions").hidden=true;$("privateOptions").hidden=true;$("onlineCodeCard").hidden=true;
 $("pvpSearchPanel").hidden=true;$("tournamentLobby").hidden=false;
 $("tourneyTitle").textContent=champ.championshipName||"PADELUM OPEN";
 $("tourneyCode").textContent="CÓDIGO · "+champ.code;
 const max=Number(champ.maxPlayers)||8;
 $("tourneyCount").textContent=players.length+" / "+max;
 const playerSignature=JSON.stringify(players.map(p=>({id:p.id,name:p.name})))+"|"+max;
 if(playerSignature!==renderedLobbyPlayers){
  const grid=$("tourneyMembers");
  for(let i=0;i<max;i++){
   const p=players[i],old=grid.children[i];
   if(old&&old.dataset.playerId===(p?.id||"")){
    old.querySelector(".tourneyAvatar").textContent=p?(p.name||"J").trim().charAt(0).toUpperCase():"＋";
    old.querySelector("strong").textContent=p?(p.name||"Jugador"):"PLAZA LIBRE";
    continue;
   }
   const card=document.createElement("div");card.className="tourneyMember"+(p?"":" empty");card.dataset.playerId=p?.id||"";
   const avatar=document.createElement("div");avatar.className="tourneyAvatar";avatar.textContent=p?(p.name||"J").trim().charAt(0).toUpperCase():"＋";
   const name=document.createElement("strong");name.textContent=p?(p.name||"Jugador"):"PLAZA LIBRE";
   card.append(avatar,name);if(old)grid.replaceChild(card,old);else grid.append(card);
  }
  while(grid.children.length>max)grid.lastElementChild.remove();
  renderedLobbyPlayers=playerSignature;
 }
 const isHost=champ.hostId===user?.$id;
 $("tourneyStart").hidden=!isHost;
 $("tourneyStart").disabled=!isHost||champ.status!=="waiting"||players.length<4||players.length!==max;
 $("tourneyStart").style.opacity=$("tourneyStart").disabled?".32":"1";
 $("tourneyStart").style.cursor=$("tourneyStart").disabled?"not-allowed":"pointer";
 const bracket=parseBracket(champ),match=matchForCurrentPlayer(champ);
 $("tourneyPlay").hidden=champ.status!=="in_progress"||!match;
 $("tourneyPlay").disabled=championshipAdvancing;
 if(bracket.rounds?.length){
  const sig=champ.bracket;
  if(sig!==renderedBracketData){renderBracket(bracket);renderedBracketData=sig}
 }
 if(champ.status==="finished"){
  $("tourneyNote").textContent="CAMPEÓN: "+(bracket.champion?.name||"Jugador")+" · El torneo ha terminado.";
 }else if(champ.status==="in_progress"){
  $("tourneyNote").textContent=match?"Tu partido está listo. Pulsa «JUGAR MI PARTIDO» para entrar a la pista.":"Esperando a que termine la ronda actual para organizar la siguiente.";
 }else{
  $("tourneyNote").textContent=isHost?(players.length===max?"¡Todos listos! Puedes iniciar el sorteo.":"Comparte el código. El torneo comienza cuando se completen las plazas."):"Esperando a que el anfitrión inicie el torneo…";
 }
}
function renderBracket(bracket){
 const root=$("tourneyBracket");root.hidden=false;root.innerHTML="";
 const rounds=bracket.rounds||[];
 rounds.forEach((matches,ri)=>{
  const section=document.createElement("div");section.className="bracketRound";
  const title=document.createElement("h5");title.textContent=ri===rounds.length-1?(rounds.length===1?"FINAL":"RONDA "+(ri+1)):"RONDA "+(ri+1);section.append(title);
  matches.forEach(m=>{
   const row=document.createElement("div");row.className="bracketMatch";
   const names=document.createElement("span");names.textContent=(m.a?.name||"Por decidir")+"  VS  "+(m.b?.name||"Por decidir");
   const tag=document.createElement("b");tag.textContent=m.winner?.name||"PENDIENTE";row.append(names,tag);section.append(row);
  });
  root.append(section);
 });
 if(bracket.champion){
  const champion=document.createElement("div");champion.className="bracketChampion";champion.textContent="CAMPEÓN · "+(bracket.champion.name||"Jugador");root.append(champion);
 }
}
function tournamentMatchPermissions(match){
 return [Permission.read(Role.any()),Permission.update(Role.user(match.a.id)),Permission.update(Role.user(match.b.id))];
}
async function ensureTournamentMatchRows(code,bracket){
 const found=await db.listRows({databaseId:DATABASE_ID,tableId:"tournament_matches",queries:[Query.equal("championshipCode",code),Query.limit(100)]});
 for(let ri=0;ri<(bracket.rounds||[]).length;ri++)for(let mi=0;mi<bracket.rounds[ri].length;mi++){
  const match=bracket.rounds[ri][mi];if(!match.a?.id||!match.b?.id)continue;
  const round=ri+1,matchNumber=mi+1;
  let row=found.rows.find(r=>Number(r.round)===round&&Number(r.matchNumber)===matchNumber&&r.playerA===match.a.id&&r.playerB===match.b.id);
  if(row){match.matchId=row.$id;continue}
  row=await db.createRow({databaseId:DATABASE_ID,tableId:"tournament_matches",rowId:ID.unique(),data:{championshipCode:code,round,matchNumber,playerA:match.a.id,playerB:match.b.id,winnerId:"",status:"pending",scoreA:0,scoreB:0},permissions:tournamentMatchPermissions(match)});
  match.matchId=row.$id;found.rows.push(row);
 }
 return bracket;
}
async function advanceChampionship(latest){
 if(championshipAdvancing||latest.hostId!==user?.$id||latest.status!=="in_progress")return latest;
 championshipAdvancing=true;
 try{
  const bracket=parseBracket(latest);bracket.rounds=bracket.rounds||[];
  const beforeRows=JSON.stringify(bracket);
  await ensureTournamentMatchRows(latest.code,bracket);
  const rows=await db.listRows({databaseId:DATABASE_ID,tableId:"tournament_matches",queries:[Query.equal("championshipCode",latest.code),Query.limit(100)]});
  let changed=JSON.stringify(bracket)!==beforeRows;
  for(let ri=0;ri<bracket.rounds.length;ri++)for(let mi=0;mi<bracket.rounds[ri].length;mi++){
   const match=bracket.rounds[ri][mi];
   const row=rows.rows.find(r=>r.$id===match.matchId)||rows.rows.find(r=>Number(r.round)===ri+1&&Number(r.matchNumber)===mi+1);
   if(row&&row.winnerId&&row.status==="completed"){
    const winner=row.winnerId===match.a?.id?match.a:row.winnerId===match.b?.id?match.b:null;
    if(winner&&match.winner?.id!==winner.id){match.winner=winner;changed=true}
   }
  }
  const current=bracket.rounds[bracket.rounds.length-1];
  if(current?.length&&current.every(match=>match.winner?.id)){
   if(current.length===1){
    bracket.champion=current[0].winner;
    const done=await db.updateRow({databaseId:DATABASE_ID,tableId:"championships",rowId:latest.$id,data:{status:"finished",bracket:JSON.stringify(bracket)}});
    activeChampionship=done;renderChampLobby(done,JSON.parse(done.players||"[]"));status("¡"+bracket.champion.name+" es campeón de "+(done.championshipName||"PADELUM OPEN")+"!","success");return done;
   }
   const winners=current.map(match=>match.winner),next=[];
   for(let i=0;i<winners.length;i+=2)next.push({a:winners[i],b:winners[i+1],winner:null,matchId:null});
   bracket.rounds.push(next);
   await ensureTournamentMatchRows(latest.code,bracket);
   changed=true;
  }
  if(changed){
   const updated=await db.updateRow({databaseId:DATABASE_ID,tableId:"championships",rowId:latest.$id,data:{bracket:JSON.stringify(bracket)}});
   activeChampionship=updated;renderChampLobby(updated,JSON.parse(updated.players||"[]"));return updated;
  }
  activeChampionship=latest;return latest;
 }catch(e){console.warn("Championship progression:",e);return latest}
 finally{championshipAdvancing=false}
}
async function pollChampionship(){
 if(lobbyPollBusy||!activeChampionship||!user)return;
 lobbyPollBusy=true;
 try{
  let latest=await db.getRow({databaseId:DATABASE_ID,tableId:"championships",rowId:activeChampionship.$id});
  let players=JSON.parse(latest.players||"[]");
  if(latest.status==="waiting"&&latest.hostId===user.$id){
   const requests=await db.listRows({databaseId:DATABASE_ID,tableId:"championship_join_requests",queries:[Query.equal("championshipCode",latest.code),Query.equal("status","waiting"),Query.limit(40)]});
   let changed=false;
   for(const req of requests.rows){if(players.length>=Number(latest.maxPlayers))break;if(!players.some(p=>p.id===req.playerId)){players.push({id:req.playerId,name:req.playerName});changed=true}}
   if(changed){
    latest=await db.updateRow({databaseId:DATABASE_ID,tableId:"championships",rowId:latest.$id,data:{players:JSON.stringify(players),playerIds:JSON.stringify(players.map(p=>p.id))},permissions:[...ownerPerms(user.$id),...players.filter(p=>p.id!==user.$id).map(p=>Permission.read(Role.user(p.id))) ]});
   }
  }
  players=JSON.parse(latest.players||"[]");
  if(players.some(p=>p.id===user.$id)||latest.hostId===user.$id){
   activeChampionship=latest;
   if(latest.status==="in_progress"&&latest.hostId===user.$id)latest=await advanceChampionship(latest);
   renderChampLobby(latest,JSON.parse(latest.players||"[]"));
   if(latest.status==="finished")stopPolling();
  }else if(latest.status!=="waiting"){
   stopPolling();status("La inscripción del torneo ya se ha cerrado.","error");
  }
 }catch(e){console.warn("Championship lobby poll:",e)}
 finally{lobbyPollBusy=false}
}
function startChampionshipPolling(){
 stopPolling();
 currentPoll=setInterval(pollChampionship,1500);
 pollChampionship();
}
async function startChampionship(){
 if(!activeChampionship||activeChampionship.hostId!==user?.$id||championshipAdvancing)return;
 const startButton=$("tourneyStart");startButton.disabled=true;championshipAdvancing=true;
 try{
  const latest=await db.getRow({databaseId:DATABASE_ID,tableId:"championships",rowId:activeChampionship.$id});
  const players=JSON.parse(latest.players||"[]");
  if(Number(latest.maxPlayers)<4||players.length<4||players.length!==Number(latest.maxPlayers)){
   startButton.disabled=false;return status("El torneo necesita al menos 4 jugadores y todas las plazas completas.","error");
  }
  const shuffled=[...players];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}const first=[];
  for(let i=0;i<shuffled.length;i+=2)first.push({a:shuffled[i],b:shuffled[i+1],winner:null,matchId:null});
  const bracket={rounds:[first],champion:null,pointsToWin:5,winBy:2,startedAt:new Date().toISOString()};
  const active=await db.updateRow({databaseId:DATABASE_ID,tableId:"championships",rowId:latest.$id,data:{status:"in_progress",bracket:JSON.stringify(bracket)}});
  await ensureTournamentMatchRows(latest.code,bracket);
  const updated=await db.updateRow({databaseId:DATABASE_ID,tableId:"championships",rowId:latest.$id,data:{bracket:JSON.stringify(bracket)}});
  activeChampionship={...active,...updated,status:"in_progress",bracket:JSON.stringify(bracket)};
  renderedBracketData="";renderChampLobby(activeChampionship,players);
  status("Sorteo de "+(latest.championshipName||"PADELUM OPEN")+" completado. ¡Ya podéis jugar los partidos!","success");
 }catch(e){startButton.disabled=false;status("No se pudo iniciar el torneo: "+(e.message||e),"error")}
 finally{championshipAdvancing=false}
}
async function createChampionship(){
 stopPolling();clearCode();saveName();
 const championshipName=$("champName").value.trim().replace(/\s+/g," ");
 if(championshipName.length<3||championshipName.length>48)return status("Pon un nombre de campeonato de entre 3 y 48 caracteres.","error");
 const maxPlayers=Number($("champSize").value),code=code6(),now=new Date().toISOString(),player={id:user.$id,name:cleanName()};
 if(![4,8,16,32].includes(maxPlayers))return status("El torneo debe tener un mínimo de 4 jugadores.","error");
 try{
  const champ=await db.createRow({databaseId:DATABASE_ID,tableId:"championships",rowId:ID.unique(),data:{code,championshipName,hostId:user.$id,hostName:player.name,status:"waiting",maxPlayers,playerIds:JSON.stringify([user.$id]),players:JSON.stringify([player]),bracket:"",createdAt:now},permissions:ownerPerms(user.$id)});
  renderChampLobby(champ,[player]);status("Torneo creado. Comparte el código para reunir a los participantes.","success");
  startChampionshipPolling();
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
  activeChampionship=champ;status("Solicitud enviada. Esperando confirmación del anfitrión…");
  startChampionshipPolling();
 }catch(e){status("No se pudo unir al campeonato: "+e.message,"error")}
}
function tournamentRoomCode(code,round,matchNumber){return (code+"T"+round+"M"+matchNumber).slice(0,12)}
async function playTournamentMatch(){
 if(!activeChampionship||!user||!db)return status("Abre el torneo antes de jugar el partido.","error");
 const current=matchForCurrentPlayer(activeChampionship);
 if(!current?.match?.matchId)return status("Tu partido todavía se está preparando. Prueba otra vez en unos segundos.");
 try{
  const match=await db.getRow({databaseId:DATABASE_ID,tableId:"tournament_matches",rowId:current.match.matchId});
  if(match.status==="completed")return status("Este partido ya ha terminado.","error");
  const code=tournamentRoomCode(activeChampionship.code,current.round,current.matchNumber);
  const playerA=current.match.a,playerB=current.match.b,now=new Date().toISOString();
  let room=null;
  const readRoom=async()=>{const rows=await db.listRows({databaseId:DATABASE_ID,tableId:"game_rooms",queries:[Query.equal("code",code),Query.limit(1)]});return rows.rows[0]||null};
  if(user.$id===match.playerA){
   room=await readRoom();
   if(!room){
    try{room=await db.createRow({databaseId:DATABASE_ID,tableId:"game_rooms",rowId:ID.unique(),data:{code,mode:"tournament",status:"ready",hostId:match.playerA,guestId:match.playerB,hostName:playerA.name,guestName:playerB.name,createdAt:now,updatedAt:now,gameState:""},permissions:ownerPerms(user.$id)})}
    catch(e){room=await readRoom();if(!room)throw e}
   }else if(room.status==="closed"){
    room=await db.updateRow({databaseId:DATABASE_ID,tableId:"game_rooms",rowId:room.$id,data:{status:"ready",updatedAt:now}})
   }
   activeTournamentMatch=match;activeRoom=room;showCode(code,"PARTIDO DE CAMPEONATO");
   startChampionshipPolling();status("Abriendo tu partido del campeonato…","success");connectOnlineRoom(room,match);
  }else if(user.$id===match.playerB){
   status("Esperando a que tu rival abra la pista del campeonato…");
   stopPolling();
   const matchWaitStartedAt=Date.now();
   currentPoll=setInterval(async()=>{
    try{
     const foundRoom=await readRoom();
     if(Date.now()-matchWaitStartedAt>60000){stopPolling();startChampionshipPolling();return status("No se pudo abrir el partido. Tu rival puede intentarlo otra vez.","error")}
     if(foundRoom?.status==="closed"){stopPolling();startChampionshipPolling();return status("Tu rival cerró la pista del partido.","error")}
     if(!foundRoom||foundRoom.status!=="ready"||foundRoom.guestId!==user.$id)return;
     stopPolling();activeTournamentMatch=match;activeRoom=foundRoom;showCode(code,"PARTIDO DE CAMPEONATO");
     startChampionshipPolling();status("Rival listo. Entrando a la pista…","success");connectOnlineRoom(foundRoom,match);
    }catch(e){status("Buscando la pista… "+(e.message||e))}
   },1000);
  }else status("Este partido no pertenece a tu cuenta.","error");
 }catch(e){status("No se pudo abrir el partido del campeonato: "+(e.message||e),"error")}
}
let activeTournamentMatch=null;
let pvpQueueRow=null,pvpStartedAt=0,pvpActive=false,pvpPollBusy=false,pvpCanStartCPU=false;
function formatPvpTime(seconds){return String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0")}
function updatePvpTimer(){if(!pvpActive)return;const elapsed=Math.floor((Date.now()-pvpStartedAt)/1000);$("pvpTimer").textContent=formatPvpTime(elapsed);$("pvpSearchHint").textContent=elapsed>=45?"Rival no encontrado.":"Buscando rival… "+(45-elapsed)+" s."}
async function cancelPvpSearch(){
 pvpCanStartCPU=false;pvpActive=false;stopPolling();const row=pvpQueueRow;pvpQueueRow=null;
 if(row&&db){try{await db.deleteRow({databaseId:DATABASE_ID,tableId:"match_queue",rowId:row.$id})}catch(e){console.warn("Queue cleanup:",e)}}
 $("pvpTimer").textContent="00:00";$("pvpSearchHint").textContent="Búsqueda cancelada.";
 $("pvpSearchBtn").disabled=false;$("pvpSearchBtn").textContent="BUSCAR PVP";$("pvpSearchBtn").onclick=null;
 status("Búsqueda cancelada.");
}
async function startPvpSearch(){
 if(pvpActive)return;pvpCanStartCPU=false;
 stopPolling();clearCode();saveName();$("pvpSearchBtn").onclick=null;
 $("pvpSearchBtn").disabled=true;$("pvpSearchBtn").textContent="BUSCANDO…";
 try{pvpQueueRow=await db.createRow({databaseId:DATABASE_ID,tableId:"match_queue",rowId:ID.unique(),data:{playerId:user.$id,displayName:cleanName(),status:"waiting",roomCode:"",createdAt:new Date().toISOString()},permissions:ownerPerms(user.$id)})}
 catch(e){$("pvpSearchBtn").disabled=false;$("pvpSearchBtn").textContent="BUSCAR PVP";return status("No se pudo entrar en la cola: "+e.message,"error")}
 pvpStartedAt=Date.now();pvpActive=true;pvpPollBusy=false;$("pvpTimer").textContent="00:00";$("pvpSearchHint").textContent="Buscando rival… 00:45.";status("Buscando rival PVP…");
 currentPoll=setInterval(async()=>{
  if(!pvpActive||pvpPollBusy)return;pvpPollBusy=true;
  try{
   const elapsed=(Date.now()-pvpStartedAt)/1000;
   const joined=await db.listRows({databaseId:DATABASE_ID,tableId:"game_rooms",queries:[Query.equal("guestId",user.$id),Query.equal("mode","matchmaking"),Query.equal("status","ready"),Query.limit(1)]});
   if(!pvpActive)return;
   if(joined.rows.length){activeRoom=joined.rows[0];pvpActive=false;stopPolling();try{await db.deleteRow({databaseId:DATABASE_ID,tableId:"match_queue",rowId:pvpQueueRow.$id})}catch{}pvpQueueRow=null;$("pvpSearchBtn").disabled=false;$("pvpSearchBtn").textContent="BUSCAR PVP";showCode(activeRoom.code,"RIVAL ENCONTRADO");status("¡Te has emparejado con "+activeRoom.hostName+"! Abriendo la pista online…","success");connectOnlineRoom(activeRoom);return}
   const waiting=await db.listRows({databaseId:DATABASE_ID,tableId:"match_queue",queries:[Query.equal("status","waiting"),Query.orderAsc("createdAt"),Query.limit(40)]});
   if(!pvpActive)return;
   const fresh=waiting.rows.filter(r=>Date.now()-new Date(r.createdAt).getTime()<60000).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),entries=fresh.filter(r=>r.playerId!==user.$id),all=fresh;
   if(entries.length){
    const first=all[0];
    if(first&&first.playerId===user.$id){
     const opponent=entries[0],code=code6(),now=new Date().toISOString();
     const createdRoom=await db.createRow({databaseId:DATABASE_ID,tableId:"game_rooms",rowId:ID.unique(),data:{code,mode:"matchmaking",status:"ready",hostId:user.$id,guestId:opponent.playerId,hostName:cleanName(),guestName:opponent.displayName,createdAt:now,updatedAt:now,gameState:""},permissions:ownerPerms(user.$id)});
     activeRoom=createdRoom;
     await db.updateRow({databaseId:DATABASE_ID,tableId:"match_queue",rowId:pvpQueueRow.$id,data:{status:"matched",roomCode:code}});
     try{await db.deleteRow({databaseId:DATABASE_ID,tableId:"match_queue",rowId:pvpQueueRow.$id})}catch{}pvpActive=false;stopPolling();pvpQueueRow=null;$("pvpSearchBtn").disabled=false;$("pvpSearchBtn").textContent="BUSCAR PVP";showCode(code,"RIVAL ENCONTRADO");status("Rival encontrado. Abriendo conexión directa…","success");connectOnlineRoom(activeRoom);return;
    }
    const mine=all.find(r=>r.playerId===user.$id);
    if(mine&&mine.status==="matched"){const room=await db.listRows({databaseId:DATABASE_ID,tableId:"game_rooms",queries:[Query.equal("code",mine.roomCode),Query.limit(1)]});if(room.rows[0]){activeRoom=room.rows[0];pvpActive=false;stopPolling();pvpQueueRow=null;$("pvpSearchBtn").disabled=false;$("pvpSearchBtn").textContent="BUSCAR PVP";showCode(mine.roomCode,"RIVAL ENCONTRADO");status("Rival encontrado. Abriendo conexión directa…","success");connectOnlineRoom(activeRoom);return}}
   }
   updatePvpTimer();
   if(elapsed>=45&&pvpActive){pvpActive=false;stopPolling();const row=pvpQueueRow;pvpQueueRow=null;if(row){try{await db.deleteRow({databaseId:DATABASE_ID,tableId:"match_queue",rowId:row.$id})}catch{}}
    $("pvpSearchBtn").disabled=false;$("pvpSearchBtn").textContent="BUSCAR DE NUEVO";$("pvpSearchHint").textContent="Rival no encontrado. Prueba de nuevo cuando haya más jugadores.";pvpCanStartCPU=false;
    status("No se encontró rival. Puedes volver a buscar o crear una sala privada.","error");
   }
  }catch(e){if(pvpActive)status("Buscando rival… "+(e.message||e))}
  finally{pvpPollBusy=false}
 },1000);
}

window.addEventListener("padelum:tournament-result",async event=>{
 const result=event.detail;
 if(!activeTournamentMatch||!result||result.matchId!==activeTournamentMatch.$id||activeTournamentMatch.status==="completed")return;
 const winnerId=result.winnerSide===0?activeTournamentMatch.playerA:activeTournamentMatch.playerB;
 try{
  const saved=await db.updateRow({databaseId:DATABASE_ID,tableId:"tournament_matches",rowId:activeTournamentMatch.$id,data:{winnerId,status:"completed",scoreA:Number(result.score?.[0])||0,scoreB:Number(result.score?.[1])||0}});
  activeTournamentMatch=saved;
  status("Resultado del campeonato guardado.","success");
 }catch(e){console.error("PADELUM tournament result:",e);status("No se pudo guardar el resultado del campeonato: "+(e.message||e),"error")}
});
window.addEventListener("padelum:leave-online",async()=>{
 stopPolling();
 if(pvpActive||pvpQueueRow)await cancelPvpSearch();
 const room=activeRoom;
 if(room&&room.hostId===user?.$id&&db&&["waiting","ready"].includes(room.status)){
  try{await db.updateRow({databaseId:DATABASE_ID,tableId:"game_rooms",rowId:room.$id,data:{status:"closed",updatedAt:new Date().toISOString()}})}catch(e){console.warn("Room cleanup:",e)}
 }
 try{onlineConnection?.close()}catch{}
 try{activePeer?.destroy()}catch{}
 onlineConnection=null;activePeer=null;activeRoom=null;activeTournamentMatch=null;onlineIsHostUser=false;
 if(activeChampionship&&["waiting","in_progress"].includes(activeChampionship.status))startChampionshipPolling();
});
function bindUI() {
  $("onlineCreate").addEventListener("click", async () => {
    if(pvpActive||pvpQueueRow) await cancelPvpSearch();
    $("privateOptions").hidden = false; $("champOptions").hidden = true; $("onlineCodeCard").hidden = true;
    $("pvpSearchPanel").hidden = true; $("tournamentLobby").hidden = true;
    $("privateOptions").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  const runWhenConnected = (action) => () => {
    if (!user || !db) return status("El servidor todavía no está conectado. Revisa el mensaje de conexión de arriba.", "error");
    action();
  };
  $("privateCreateBtn").addEventListener("click", runWhenConnected(createPrivateRoom));
  $("onlineJoin").addEventListener("click", runWhenConnected(joinPrivateRoom));
  $("onlineRandom").addEventListener("click", () => { $("pvpSearchPanel").hidden=false; $("privateOptions").hidden=true; $("champOptions").hidden=true; $("tournamentLobby").hidden=true; $("onlineCodeCard").hidden=true; $("pvpSearchPanel").scrollIntoView({behavior:"smooth",block:"nearest"}); });
  $("pvpSearchBtn").addEventListener("click", runWhenConnected(()=>{pvpCanStartCPU=false;startPvpSearch();}));
  $("pvpCancelBtn").addEventListener("click", cancelPvpSearch);
  $("champOpen").addEventListener("click", async () => {
    if(pvpActive||pvpQueueRow) await cancelPvpSearch();
    $("champOptions").hidden = false; $("privateOptions").hidden = true; $("onlineCodeCard").hidden = true;
    $("pvpSearchPanel").hidden = true; $("tournamentLobby").hidden = true;
    $("champOptions").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  $("champCreate").addEventListener("click", runWhenConnected(createChampionship));
  $("tourneyStart").addEventListener("click", startChampionship);
  $("tourneyPlay").addEventListener("click", runWhenConnected(playTournamentMatch));
  $("tourneyBack").addEventListener("click", () => { stopPolling(); $("tournamentLobby").hidden=true; $("champOptions").hidden=false; });
  $("champJoin").addEventListener("click", runWhenConnected(joinChampionship));
  $("onlineBack").addEventListener("click", () => { window.dispatchEvent(new CustomEvent("padelum:leave-online")); if(pvpActive||pvpQueueRow)cancelPvpSearch(); stopPolling(); clearCode(); $("privateOptions").hidden = true; $("champOptions").hidden = true; $("tournamentLobby").hidden = true; $("pvpSearchPanel").hidden=true; });
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
