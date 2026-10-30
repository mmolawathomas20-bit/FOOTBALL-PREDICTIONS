const $ = (s) => document.querySelector(s);
let adminToken = "";

$("#year").textContent = new Date().getFullYear();

$("#menuButton").addEventListener("click", () => $("#nav").classList.toggle("open"));
$("#nav").querySelectorAll("a").forEach(a => a.addEventListener("click", () => $("#nav").classList.remove("open")));

$("#themeButton").addEventListener("click", () => {
  document.body.classList.toggle("light");
  try { localStorage.setItem("fpbs-theme", document.body.classList.contains("light") ? "light" : "dark"); } catch {}
});
try { if (localStorage.getItem("fpbs-theme") === "light") document.body.classList.add("light"); } catch {}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function dateLabel(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Kickoff not set" : d.toLocaleString("en-ZA", {dateStyle:"medium", timeStyle:"short", timeZone:"Africa/Johannesburg"});
}
function predictionCard(p, demo=false) {
  const status = p.status === "settled" ? `SETTLED: ${p.actual_result}` : demo ? "DEMO" : "PENDING";
  return `<article class="match">
    <div class="match-top"><span>${safe(p.league)}</span><span class="tag">${safe(status)}</span></div>
    <div class="teams"><div><span class="team-ball">⚽</span><b>${safe(p.home_team)}</b></div><div><span class="team-ball">⚽</span><b>${safe(p.away_team)}</b></div></div>
    <p class="muted small">${safe(dateLabel(p.kickoff))} · SAST</p>
    <div class="details"><div class="detail"><small>Prediction</small><b>${safe(p.prediction)}</b></div><div class="detail"><small>Predicted score</small><b>${safe(p.predicted_score || "Not supplied")}</b></div></div>
    <div class="bar" aria-label="Illustrative confidence"><span style="width:${Math.max(1,Math.min(100,Number(p.confidence)||1))}%"></span></div>
    <p class="muted small" style="margin-top:8px">Confidence estimate: ${Math.max(1,Math.min(100,Number(p.confidence)||1))}%</p>
    ${p.notes ? `<p class="muted small">${safe(p.notes)}</p>` : ""}
  </article>`;
}
let publicPredictions = [];
function renderPredictions() {
  const term = $("#search").value.trim().toLowerCase();
  const league = $("#league").value;
  const list = publicPredictions.filter(p =>
    `${p.home_team} ${p.away_team} ${p.league}`.toLowerCase().includes(term) &&
    (!league || p.league === league)
  );
  $("#predictionList").innerHTML = list.length ? list.map(p => predictionCard(p)).join("") : '<div class="empty">No predictions match your filters.</div>';
  $("#predictionCount").textContent = publicPredictions.length;
  const options = [...new Set(publicPredictions.map(p => p.league))].sort();
  const old = $("#league").value;
  $("#league").innerHTML = '<option value="">All leagues</option>' + options.map(l => `<option value="${safe(l)}">${safe(l)}</option>`).join("");
  $("#league").value = options.includes(old) ? old : "";
}
async function loadPredictions() {
  $("#predictionList").innerHTML = '<div class="empty">Loading predictions…</div>';
  try {
    const r = await fetch("/api/predictions");
    if (!r.ok) throw new Error("Could not load predictions.");
    publicPredictions = await r.json();
    renderPredictions();
  } catch {
    $("#predictionList").innerHTML = '<div class="empty">Could not load predictions. Check that the server is running.</div>';
  }
}
async function loadStats() {
  try {
    const r = await fetch("/api/stats");
    const s = await r.json();
    $("#settledCount").textContent = s.settled;
    $("#correctCount").textContent = s.correct;
    $("#accuracyBig").textContent = s.accuracy === null ? "—" : `${s.accuracy}%`;
    $("#accuracy").textContent = s.accuracy === null ? "—" : `${s.accuracy}%`;
  } catch {}
}
$("#search").addEventListener("input", renderPredictions);
$("#league").addEventListener("change", renderPredictions);
$("#refreshPredictions").addEventListener("click", loadPredictions);

$("#loadFixtures").addEventListener("click", async () => {
  const target = $("#fixtureList");
  target.innerHTML = '<div class="empty">Loading fixtures…</div>';
  try {
    const r = await fetch("/api/fixtures");
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Could not load fixtures.");
    target.innerHTML = data.length ? data.map(f => `<article class="match"><div class="match-top"><span>${safe(f.league || "Football")}</span><span class="tag">${safe(f.status || "Scheduled")}</span></div><div class="teams"><div><span class="team-ball">⚽</span><b>${safe(f.home || "Home")}</b></div><div><span class="team-ball">⚽</span><b>${safe(f.away || "Away")}</b></div></div><p class="muted small">${safe(dateLabel(f.kickoff))} · SAST</p>${f.homeGoals !== null && f.homeGoals !== undefined ? `<p><b>Score: ${safe(f.homeGoals)} - ${safe(f.awayGoals)}</b></p>` : ""}</article>`).join("") : '<div class="empty">No fixtures returned for the next seven days.</div>';
  } catch (e) {
    target.innerHTML = `<div class="empty">${safe(e.message)} Add your provider API key on the server to activate this feature.</div>`;
  }
});

$("#contactForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#contactName").value.trim(), email = $("#contactEmail").value.trim(), message = $("#contactMessage").value.trim();
  const subject = encodeURIComponent("FPBS website enquiry");
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
  $("#contactStatus").textContent = "Opening your email application. If it does not open, email paparemo22@gmail.com directly.";
  window.location.href = `mailto:paparemo22@gmail.com?subject=${subject}&body=${body}`;
});

$("#premiumButton").addEventListener("click", async () => {
  if (!adminToken) {
    $("#admin").scrollIntoView({behavior:"smooth"});
    $("#adminStatus").textContent = "Member access requires a real member login and verified payment setup. This starter currently includes admin sign-in only.";
    return;
  }
  try {
    const r = await fetch("/api/premium", {headers:{Authorization:`Bearer ${adminToken}`}});
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Access denied.");
    $("#premiumList").innerHTML = data.length ? data.map(p => predictionCard(p)).join("") : '<div class="empty">No premium predictions have been published.</div>';
  } catch (e) { $("#adminStatus").textContent = e.message; }
});

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("#adminStatus").textContent = "Signing in…";
  try {
    const r = await fetch("/api/admin/login", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("#adminEmail").value,password:$("#adminPassword").value})});
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Sign-in failed.");
    adminToken = data.token;
    $("#adminStatus").textContent = `Signed in as ${data.email}. Token stays in this page session only.`;
    $("#adminTools").hidden = false;
    await loadAdminPredictions(); await loadPaymentRequests();
  } catch (e) { $("#adminStatus").textContent = e.message; }
});

$("#predictionForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const payload = Object.fromEntries(form.entries());
  payload.confidence = Number(payload.confidence);
  payload.premium = form.has("premium");
  payload.kickoff = new Date(payload.kickoff).toISOString();
  try {
    const r = await fetch("/api/admin/predictions", {method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${adminToken}`},body:JSON.stringify(payload)});
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Could not save prediction.");
    $("#adminStatus").textContent = "Prediction published.";
    e.currentTarget.reset();
    await loadAdminPredictions(); await loadPredictions();
  } catch (err) { $("#adminStatus").textContent = err.message; }
});

async function adminRequest(url, options={}) {
  const r = await fetch(url, {...options, headers:{...(options.headers||{}), Authorization:`Bearer ${adminToken}`}});
  const data = r.status === 204 ? {} : await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || "Request failed.");
  return data;
}
async function loadAdminPredictions() {
  const list = $("#adminPredictionList");
  list.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const rows = await adminRequest("/api/admin/predictions");
    list.innerHTML = rows.length ? rows.map(p => `<div class="admin-row"><div><b>${safe(p.home_team)} vs ${safe(p.away_team)}</b><div class="muted small">${safe(p.league)} · ${safe(p.status)}${p.premium ? " · PREMIUM" : ""}</div></div><div><button class="outline" data-result="${p.id}" data-status="correct">Correct</button><button class="outline" data-result="${p.id}" data-status="incorrect">Incorrect</button><button class="outline" data-result="${p.id}" data-status="void">Void</button><button class="outline" data-delete="${p.id}">Delete</button></div></div>`).join("") : '<p class="muted">No predictions yet.</p>';
  } catch (e) { list.textContent = e.message; }
}
$("#adminPredictionList").addEventListener("click", async e => {
  const resultButton = e.target.closest("[data-result]");
  const deleteButton = e.target.closest("[data-delete]");
  try {
    if (resultButton) {
      const id = resultButton.dataset.result, result = resultButton.dataset.status;
      await adminRequest(`/api/admin/predictions/${id}/result`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"settled",actual_result:result})});
    } else if (deleteButton) {
      if (!confirm("Delete this prediction? This cannot be undone.")) return;
      await adminRequest(`/api/admin/predictions/${deleteButton.dataset.delete}`, {method:"DELETE"});
    } else return;
    await loadAdminPredictions(); await loadPaymentRequests(); await loadPredictions(); await loadStats();
  } catch (err) { $("#adminStatus").textContent = err.message; }
});

loadPredictions();
loadStats();


let customerToken = "";
function customerHeaders(json=true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  if (customerToken) h.Authorization = `Bearer ${customerToken}`;
  return h;
}
async function customerRequest(url, options={}) {
  const r = await fetch(url, {...options, headers:{...customerHeaders(options.body !== undefined), ...(options.headers||{})}});
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || "Request failed.");
  return data;
}
async function refreshCustomerPanel() {
  if (!customerToken) return;
  try {
    const me = await customerRequest("/api/customer/me", {headers: customerHeaders(false)});
    $("#customerPanel").hidden = false;
    const expiry = me.membership?.expires_at ? dateLabel(me.membership.expires_at) : "Not active";
    $("#memberSummary").textContent = me.active ? `Premium active until ${expiry}.` : `Premium membership inactive. Status: ${me.latestPayment?.status || "no payment submitted"}.`;
    $("#customerStatus").textContent = `Signed in as ${me.email}.`;
    if (me.latestPayment) {
      $("#customerStatus").textContent += ` Latest EFT reference: ${me.latestPayment.payment_reference} (${me.latestPayment.status}).`;
    }
  } catch (e) {
    customerToken = "";
    $("#customerStatus").textContent = e.message;
    $("#customerPanel").hidden = true;
  }
}
$("#registerForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  $("#customerStatus").textContent = "Creating account…";
  try {
    const data = await customerRequest("/api/customer/register", {method:"POST", body:JSON.stringify({
      name:$("#registerName").value.trim(), email:$("#registerEmail").value.trim(), password:$("#registerPassword").value
    })});
    $("#customerStatus").textContent = data.message;
    e.currentTarget.reset();
  } catch (err) { $("#customerStatus").textContent = err.message; }
});
$("#customerLoginForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  $("#customerStatus").textContent = "Signing in…";
  try {
    const data = await customerRequest("/api/customer/login", {method:"POST", body:JSON.stringify({
      email:$("#customerEmail").value.trim(), password:$("#customerPassword").value
    })});
    customerToken = data.token;
    await refreshCustomerPanel();
  } catch (err) { $("#customerStatus").textContent = err.message; }
});
$("#customerLogout")?.addEventListener("click", () => {
  customerToken = "";
  $("#customerPanel").hidden = true;
  $("#customerStatus").textContent = "Signed out.";
  $("#memberPremiumList").innerHTML = "";
});
$("#paymentReferenceForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const data = await customerRequest("/api/customer/payment-requests", {method:"POST",body:JSON.stringify({payment_reference:$("#paymentReference").value.trim()})});
    $("#customerStatus").textContent = data.message;
    $("#paymentReference").value = "";
    await refreshCustomerPanel();
  } catch (err) { $("#customerStatus").textContent = err.message; }
});
$("#loadMemberPremium")?.addEventListener("click", async () => {
  try {
    const rows = await customerRequest("/api/customer/premium", {headers:customerHeaders(false)});
    $("#memberPremiumList").innerHTML = rows.length ? rows.map(p=>predictionCard(p)).join("") : '<div class="empty">No premium predictions are published yet.</div>';
  } catch (err) { $("#memberPremiumList").innerHTML = `<div class="empty">${safe(err.message)}</div>`; }
});
async function loadPaymentRequests() {
  const list = $("#adminPaymentList");
  if (!list || !adminToken) return;
  list.innerHTML = '<p class="muted">Loading payment requests…</p>';
  try {
    const rows = await adminRequest("/api/admin/payment-requests");
    list.innerHTML = rows.length ? rows.map(p=>`<div class="admin-row"><div><b>${safe(p.customer_name)} (${safe(p.customer_email)})</b><div class="muted small">R${(p.amount_cents/100).toFixed(2)} · Ref: ${safe(p.payment_reference)} · ${safe(p.status)} · ${safe(p.submitted_at)}</div></div><div>${p.status==="pending"?`<button class="outline" data-payment-approve="${p.id}">Approve (funds verified)</button><button class="outline" data-payment-reject="${p.id}">Reject</button>`:""}</div></div>`).join("") : '<p class="muted">No payment requests yet.</p>';
  } catch (e) { list.textContent = e.message; }
}
$("#adminPaymentList")?.addEventListener("click", async e => {
  const approve = e.target.closest("[data-payment-approve]");
  const reject = e.target.closest("[data-payment-reject]");
  if (!approve && !reject) return;
  const id = (approve || reject).dataset.paymentApprove || (approve || reject).dataset.paymentReject;
  if (approve && !confirm("Confirm you have verified that the R200 funds arrived in the bank account?")) return;
  try {
    await adminRequest(`/api/admin/payment-requests/${id}/review`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision:approve?"approve":"reject"})});
    await loadPaymentRequests();
    $("#adminStatus").textContent = approve ? "Payment approved; membership activated for 30 days." : "Payment request rejected.";
  } catch (err) { $("#adminStatus").textContent = err.message; }
});
