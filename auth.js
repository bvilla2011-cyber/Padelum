import { Client, Account, ID } from "https://cdn.jsdelivr.net/npm/appwrite@28.0.0/+esm";

const PROJECT_ID = "padelum-online";
const ENDPOINT = "https://fra.cloud.appwrite.io/v1";
const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
const account = new Account(client);
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
function openAccount() {
  if (!currentUser) return;
  $("authGate").hidden = false;
  $("authFormView").hidden = true;
  $("authCodeView").hidden = true;
  $("authAccountView").hidden = false;
  $("authLoginTab").hidden = true;
  $("authSignupTab").hidden = true;
  $("authAccountEmail").textContent = "Sesión iniciada como " + currentUser.email + ". Este dispositivo recordará tu sesión.";
  message("");
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
  $("authBackMenu").addEventListener("click", () => { $("authGate").hidden = true; });
  $("authLogout").addEventListener("click", logout);
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
