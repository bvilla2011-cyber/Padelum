import { Client, Account, TablesDB, ID, Query, Permission, Role } from "https://cdn.jsdelivr.net/npm/appwrite@28.0.0/+esm";

const PROJECT_ID = "padelum-online";
const ENDPOINT = "https://fra.cloud.appwrite.io/v1";
const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
const account = new Account(client);
const tables = new TablesDB(client);
const PROFILE_TABLE = "player_profiles";
const $ = (id) => document.getElementById(id);
let mode = "login";
let pendingUserId = "";
let pendingEmail = "";
let currentUser = null;

function message(text, kind = "") {
  const el = $("authMessage");
  el.textContent = text;
  el.className = "authMessage" + (kind ? " " + kind : "");
}
function setMode(next) {
  mode = next;
  $("authLoginTab").classList.toggle("active", mode === "login");
  $("authSignupTab").classList.toggle("active", mode === "signup");
  $("authTitle").textContent = mode === "login" ? "BIENVENIDO DE NUEVO" : "ÚNETE A PADELUM";
  $("authDescription").textContent = mode === "login"
    ? "Inicia sesión para entrar a PADELUM."
    : "Crea tu cuenta con tu correo y una contraseña. Te enviaremos un código de seis cifras.";
  $("authSubmit").textContent = mode === "login" ? "ENTRAR A PADELUM →" : "CREAR CUENTA →";
  $("authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("authFormView").hidden = false;
  $("authCodeView").hidden = true;
  $("authAccountView").hidden = true;
  $("authLoginTab").hidden = false;
  $("authSignupTab").hidden = false;
  message("");
}
function showCode(userId, email) {
  pendingUserId = userId;
  pendingEmail = email;
  $("authFormView").hidden = true;
  $("authCodeView").hidden = false;
  $("authAccountView").hidden = true;
  $("authLoginTab").hidden = true;
  $("authSignupTab").hidden = true;
  $("authCode").value = "";
  $("authCode").focus();
  message("Código enviado a " + email + ". Revisa también la carpeta de spam.", "success");
}
async function sendCode(userId, email) {
  await account.createEmailVerificationOTP();
  showCode(userId, email);
}
async function enterGame(user) {
  currentUser = user;
  $("authGate").hidden = true;
}
async function openAccount() {
  if (!currentUser) return;
  $("authGate").hidden = false;
  $("authFormView").hidden = true;
  $("authCodeView").hidden = true;
  $("authAccountView").hidden = false;
  $("authLoginTab").hidden = true;
  $("authSignupTab").hidden = true;
  $("authAccountEmail").textContent = "Sesión iniciada como " + currentUser.email + ". Tu perfil se guarda en tu cuenta.";
  $("profileMessage").textContent = "Cargando tu perfil…";
  $("profileNickname").value = currentUser.name || "";
  message("");
  try {
    const found = await tables.listRows({ databaseId: "padelum_online_db", tableId: PROFILE_TABLE, queries: [Query.equal("playerId", currentUser.$id), Query.limit(1)] });
    if (found.rows[0]) $("profileNickname").value = found.rows[0].displayName || currentUser.name || "";
    $("profileMessage").textContent = "Tu nombre será público en partidas y campeonatos. Debe ser único.";
  } catch (e) {
    $("profileMessage").textContent = "No se pudo cargar el perfil: " + (e.message || "error de conexión");
  }
}
async function saveProfile() {
  if (!currentUser) return;
  const displayName = $("profileNickname").value.trim().replace(/\s+/g, " ");
  const nickname = displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (displayName.length < 3 || displayName.length > 24) {
    $("profileMessage").textContent = "El nombre debe tener entre 3 y 24 caracteres.";
    return;
  }
  if (!/^[\p{L}\p{N} _-]+$/u.test(displayName)) {
    $("profileMessage").textContent = "Usa solo letras, números, espacios, guion o guion bajo.";
    return;
  }
  const button = $("profileSave");
  button.disabled = true;
  button.textContent = "GUARDANDO…";
  $("profileMessage").textContent = "Comprobando disponibilidad del nombre…";
  try {
    const duplicates = await tables.listRows({ databaseId: "padelum_online_db", tableId: PROFILE_TABLE, queries: [Query.equal("nickname", nickname), Query.limit(5)] });
    if (duplicates.rows.some(row => row.playerId !== currentUser.$id)) {
      $("profileMessage").textContent = "Ese nombre ya está en uso. Prueba con otro.";
      return;
    }
    const own = await tables.listRows({ databaseId: "padelum_online_db", tableId: PROFILE_TABLE, queries: [Query.equal("playerId", currentUser.$id), Query.limit(1)] });
    await account.updateName(displayName);
    const data = { playerId: currentUser.$id, nickname, displayName, updatedAt: new Date().toISOString() };
    if (own.rows[0]) {
      await tables.updateRow({ databaseId: "padelum_online_db", tableId: PROFILE_TABLE, rowId: own.rows[0].$id, data });
    } else {
      await tables.createRow({
        databaseId: "padelum_online_db", tableId: PROFILE_TABLE, rowId: currentUser.$id, data,
        permissions: [Permission.read(Role.any()), Permission.update(Role.user(currentUser.$id)), Permission.delete(Role.user(currentUser.$id))]
      });
    }
    currentUser = await account.get();
    localStorage.setItem("padelum-player-name", displayName);
    const onlineName = $("onlineName");
    if (onlineName) onlineName.value = displayName;
    $("profileMessage").textContent = "¡Nombre guardado! Se mantendrá en tu cuenta cuando vuelvas a entrar.";
  } catch (e) {
    const msg = e?.message || "No se pudo guardar el nombre.";
    $("profileMessage").textContent = /unique|duplicate|already exists|409/i.test(msg)
      ? "Ese nombre acaba de ser reservado por otro jugador. Elige uno distinto."
      : "Error al guardar: " + msg;
  } finally {
    button.disabled = false;
    button.textContent = "GUARDAR NOMBRE";
  }
}
async function verifyCode() {
  const secret = $("authCode").value.trim();
  if (!/^\d{6}$/.test(secret)) return message("Introduce el código de seis cifras.", "error");
  $("authVerify").disabled = true;
  try {
    await account.updateEmailVerificationOTP({ userId: pendingUserId, secret });
    const user = await account.get();
    pendingUserId = ""; pendingEmail = "";
    await enterGame(user);
  } catch (e) {
    message(e?.message || "El código no es válido o ha caducado. Solicita uno nuevo.", "error");
  } finally { $("authVerify").disabled = false; }
}
async function submitAuth() {
  const email = $("authEmail").value.trim().toLowerCase();
  const password = $("authPassword").value;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return message("Escribe un correo electrónico válido.", "error");
  if (password.length < 8) return message("La contraseña debe tener al menos 8 caracteres.", "error");
  $("authSubmit").disabled = true;
  $("authSubmit").textContent = "CONECTANDO…";
  try {
    if (mode === "signup") {
      const user = await account.create({ userId: ID.unique(), email, password });
      await account.createEmailPasswordSession({ email, password });
      await sendCode(user.$id, email);
    } else {
      const session = await account.createEmailPasswordSession({ email, password });
      const user = await account.get();
      if (user.emailVerification !== true) {
        await sendCode(user.$id, email);
        message("Para terminar de activar tu cuenta, confirma el código que acabamos de enviarte.", "success");
      } else {
        await enterGame(user);
      }
    }
  } catch (e) {
    message(e?.message || "No se ha podido completar la operación. Comprueba tus datos.", "error");
  } finally {
    $("authSubmit").disabled = false;
    $("authSubmit").textContent = mode === "login" ? "ENTRAR A PADELUM →" : "CREAR CUENTA →";
  }
}
async function logout() {
  try { await account.deleteSession({ sessionId: "current" }); } catch {}
  currentUser = null;
  $("authGate").hidden = false;
  setMode("login");
  $("authEmail").value = "";
  $("authPassword").value = "";
  $("accountOpen").textContent = "CUENTA";
}
async function boot() {
  $("authLoginTab").addEventListener("click", () => setMode("login"));
  $("authSignupTab").addEventListener("click", () => setMode("signup"));
  $("authSubmit").addEventListener("click", submitAuth);
  $("authVerify").addEventListener("click", verifyCode);
  $("authResend").addEventListener("click", async () => {
    if (!pendingUserId || !pendingEmail) return message("Vuelve a iniciar el proceso para solicitar otro código.", "error");
    $("authResend").disabled = true;
    try { await sendCode(pendingUserId, pendingEmail); }
    catch (e) { message(e?.message || "No se pudo reenviar el código.", "error"); }
    finally { $("authResend").disabled = false; }
  });
  $("authCode").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });
  $("authCode").addEventListener("keydown", e => { if (e.key === "Enter") verifyCode(); });
  $("authPassword").addEventListener("keydown", e => { if (e.key === "Enter") submitAuth(); });
  $("authEmail").addEventListener("keydown", e => { if (e.key === "Enter") $("authPassword").focus(); });
  $("profileNickname").addEventListener("keydown", e => { if (e.key === "Enter") saveProfile(); });
  $("authBackMenu").addEventListener("click", () => { $("authGate").hidden = true; });
  $("authLogout").addEventListener("click", logout);
  $("profileSave").addEventListener("click", saveProfile);
  $("accountOpen").addEventListener("click", openAccount);
  setMode("login");
  try {
    const user = await account.get();
    if (user.email && user.emailVerification === true) {
      await enterGame(user);
    } else {
      try { await account.deleteSession({ sessionId: "current" }); } catch {}
      $("authGate").hidden = false;
    }
  } catch {
    $("authGate").hidden = false;
  }
}
boot();
