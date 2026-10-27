import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, NAMA_SEKOLAH } from "./firebase-config.js";

/* ---------- Helper umum ---------- */
const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtDate = (s) => {
  if (!s) return "-";
  return new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};
const fmtBulan = (b) => {
  const [y, m] = b.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};
const fmtTs = (ts) =>
  ts && ts.toDate ? ts.toDate().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";

const currentMonth = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
};

// Username tanpa "@" (NIS / nomor HP) diubah menjadi email internal
const toEmail = (u) => {
  const v = u.trim().toLowerCase().replace(/\s+/g, "");
  return v.includes("@") ? v : `${v}@izin.local`;
};

const STATUS = {
  menunggu_ortu: { label: "Menunggu TTD orang tua", cls: "warn" },
  menunggu_wali: { label: "Menunggu persetujuan sekolah", cls: "info" },
  disetujui: { label: "Disetujui", cls: "ok" },
  ditolak_ortu: { label: "Ditolak orang tua", cls: "bad" },
  ditolak_wali: { label: "Ditolak sekolah", cls: "bad" },
};

let toastTimer;
function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (isError ? " error" : "");
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4000);
}

function errMsg(err) {
  const map = {
    "auth/invalid-credential": "Username atau kata sandi salah.",
    "auth/user-not-found": "Akun tidak ditemukan.",
    "auth/wrong-password": "Kata sandi salah.",
    "auth/email-already-in-use": "Username/NIS ini sudah terdaftar.",
    "auth/weak-password": "Kata sandi minimal 6 karakter.",
    "auth/invalid-email": "Format username tidak valid.",
    "auth/network-request-failed": "Tidak ada koneksi internet.",
    "permission-denied": "Anda tidak punya izin untuk aksi ini.",
  };
  return map[err.code] || map[(err.code || "").replace("firestore/", "")] || err.message || "Terjadi kesalahan.";
}

function openModal(html) {
  closeModal();
  const el = document.createElement("div");
  el.id = "modalRoot";
  el.className = "backdrop";
  el.innerHTML = `<div class="modal">${html}</div>`;
  el.addEventListener("click", (e) => {
    if (e.target === el || e.target.closest("[data-close]")) closeModal();
  });
  document.body.appendChild(el);
  return el.querySelector(".modal");
}
function closeModal() {
  const el = $("#modalRoot");
  if (el) el.remove();
}

/* ---------- Setup Firebase ---------- */
const configured = !String(firebaseConfig.apiKey).startsWith("ISI_");
let auth, db;
if (configured) {
  const fb = initializeApp(firebaseConfig);
  auth = getAuth(fb);
  db = getFirestore(fb);
}

const state = { user: null, profile: null, items: [], unsubs: [], registering: false };

function cleanup() {
  state.unsubs.forEach((u) => u());
  state.unsubs = [];
  state.items = [];
  closeModal();
}
function sub(q, cb) {
  state.unsubs.push(onSnapshot(q, cb, (err) => toast(errMsg(err), true)));
}

const byNewest = (a, b) => (b.bulan || "").localeCompare(a.bulan || "") || (a.nama || "").localeCompare(b.nama || "");
const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest);

/* ---------- Komponen tampilan ---------- */
function timeline(it) {
  const s = it.status;
  const s2 = s === "menunggu_ortu" ? "current" : s === "ditolak_ortu" ? "bad" : "done";
  const s3 = s === "disetujui" ? "done" : s === "ditolak_wali" ? "bad" : s === "menunggu_wali" ? "current" : "";
  return `<ol class="tl">
    <li class="done"><b>Diajukan</b><small>${fmtTs(it.createdAt)}</small></li>
    <li class="${s2}"><b>Orang tua</b><small>${it.ortuAt ? fmtTs(it.ortuAt) : "menunggu"}</small></li>
    <li class="${s3}"><b>Sekolah</b><small>${it.waliAt ? fmtTs(it.waliAt) : "menunggu"}</small></li>
  </ol>`;
}

function itemCard(it, actions = "") {
  const st = STATUS[it.status] || { label: it.status, cls: "" };
  return `<article class="item">
    <div class="item-h">
      <div>
        <b>${esc(it.nama)}</b> <small>· ${esc(it.kelas)} · NIS ${esc(it.nis)}</small>
        <div class="muted">${fmtBulan(it.bulan)} · ${fmtDate(it.tglPulang)} s/d ${fmtDate(it.tglKembali)}</div>
      </div>
      <span class="badge ${st.cls}">${st.label}</span>
    </div>
    <p>${esc(it.alasan)}</p>
    ${timeline(it)}
    ${it.catatanOrtu ? `<p class="note">Catatan orang tua: ${esc(it.catatanOrtu)}</p>` : ""}
    ${it.catatanWali ? `<p class="note">Catatan sekolah: ${esc(it.catatanWali)}</p>` : ""}
    <div class="actions">${actions}</div>
  </article>`;
}

function bindList(container, handlers) {
  container.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const it = state.items.find((i) => i.id === b.dataset.id);
    if (it && handlers[b.dataset.act]) handlers[b.dataset.act](it);
  });
}

function detailModal(it) {
  const st = STATUS[it.status] || { label: it.status };
  const m = openModal(`
    <div class="letter">
      <h3>${esc(NAMA_SEKOLAH)}</h3>
      <h4>SURAT IZIN PULANG BULANAN</h4>
      <table>
        <tr><td>Nama siswa</td><td>: ${esc(it.nama)}</td></tr>
        <tr><td>NIS / Kelas</td><td>: ${esc(it.nis)} / ${esc(it.kelas)}</td></tr>
        <tr><td>Periode</td><td>: ${fmtBulan(it.bulan)}</td></tr>
        <tr><td>Tanggal pulang</td><td>: ${fmtDate(it.tglPulang)}</td></tr>
        <tr><td>Tanggal kembali</td><td>: ${fmtDate(it.tglKembali)}</td></tr>
        <tr><td>Keterangan</td><td>: ${esc(it.alasan)}</td></tr>
        <tr><td>Status</td><td>: <b>${st.label}</b></td></tr>
      </table>
      <div class="sigs">
        <div>
          <p>Orang tua/wali</p>
          ${it.ttdOrtu ? `<img src="${esc(it.ttdOrtu)}" alt="Tanda tangan orang tua">` : `<div class="blank"></div>`}
          <p><b>${esc(it.ortuNama || "-")}</b></p>
          <small>${it.ortuAt ? fmtTs(it.ortuAt) : ""}</small>
        </div>
        <div>
          <p>Pihak sekolah</p>
          ${it.status === "disetujui" ? `<div class="stamp">DISETUJUI</div>` : `<div class="blank"></div>`}
          <p><b>${esc(it.waliNama || "-")}</b></p>
          <small>${it.waliAt ? fmtTs(it.waliAt) : ""}</small>
        </div>
      </div>
    </div>
    <div class="actions no-print">
      <button class="btn ghost" data-close>Tutup</button>
      <button class="btn primary" id="btnPrint">Cetak / Simpan PDF</button>
    </div>`);
  $("#btnPrint", m).addEventListener("click", () => window.print());
}

function signaturePad(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#111";
  let drawing = false, dirty = false, last = null;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
  };
  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    last = pos(e);
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
    dirty = true;
  });
  const end = () => (drawing = false);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  return {
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; },
    isEmpty: () => !dirty,
    toDataURL: () => canvas.toDataURL("image/png"),
  };
}

/* ---------- Layar: login & daftar ---------- */
function renderSetupNotice() {
  $("#topbar").hidden = true;
  app.innerHTML = `<section class="card auth">
    <h2>Konfigurasi Firebase belum diisi</h2>
    <p>Buka file <code>firebase-config.js</code> lalu isi dengan konfigurasi dari Firebase Console.
    Langkah lengkap ada di <code>README.md</code>.</p></section>`;
}

function renderAuth(mode = "login") {
  $("#topbar").hidden = true;
  const isLogin = mode === "login";
  app.innerHTML = `<section class="card auth">
    <h2>${isLogin ? "Masuk" : "Daftar akun"}</h2>
    <p class="muted">Izin pulang bulanan siswa dengan tanda tangan orang tua digital.</p>
    <form id="fAuth" class="form">
      ${isLogin ? `
        <label>Username<input name="username" required autocomplete="username" placeholder="NIS (siswa) / email atau No. HP (orang tua)"></label>
      ` : `
        <label>Daftar sebagai
          <select name="role" id="selRole">
            <option value="siswa">Siswa</option>
            <option value="ortu">Orang tua / wali</option>
          </select>
        </label>
        <label>Nama lengkap<input name="nama" required></label>
        <div id="extraFields"></div>
      `}
      <label>Kata sandi<input name="password" type="password" required minlength="6" autocomplete="${isLogin ? "current-password" : "new-password"}"></label>
      <button class="btn primary" type="submit">${isLogin ? "Masuk" : "Daftar"}</button>
    </form>
    <p class="muted" style="margin-top:12px">
      ${isLogin ? `Belum punya akun? <button class="link" id="swap">Daftar</button>` : `Sudah punya akun? <button class="link" id="swap">Masuk</button>`}
    </p>
  </section>`;

  $("#swap").addEventListener("click", () => renderAuth(isLogin ? "register" : "login"));

  if (!isLogin) {
    const extra = $("#extraFields");
    const drawExtra = () => {
      extra.innerHTML = $("#selRole").value === "siswa"
        ? `<div class="form">
             <div class="row2">
               <label>NIS<input name="nis" required placeholder="dipakai untuk masuk"></label>
               <label>Kelas<input name="kelas" required placeholder="mis. X-A"></label>
             </div>
           </div>`
        : `<div class="form">
             <label>Username (email atau No. HP)<input name="username" required placeholder="mis. 0812xxxx"></label>
             <label>NIS anak<input name="childNis" required placeholder="NIS putra/putri Anda"></label>
           </div>`;
    };
    $("#selRole").addEventListener("change", drawExtra);
    drawExtra();
  }

  $("#fAuth").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, toEmail(f.username), f.password);
      } else {
        const username = f.role === "siswa" ? f.nis : f.username;
        state.registering = true;
        const cred = await createUserWithEmailAndPassword(auth, toEmail(username), f.password);
        const profile = {
          role: f.role,
          nama: f.nama.trim(),
          username: username.trim(),
          createdAt: serverTimestamp(),
          ...(f.role === "siswa"
            ? { nis: f.nis.trim(), kelas: f.kelas.trim() }
            : { childNis: f.childNis.trim() }),
        };
        await setDoc(doc(db, "users", cred.user.uid), profile);
        state.registering = false;
        state.user = cred.user;
        state.profile = profile;
        start();
      }
    } catch (err) {
      state.registering = false;
      toast(errMsg(err), true);
      btn.disabled = false;
    }
  });
}

function renderNoProfile() {
  $("#topbar").hidden = false;
  $("#whoName").textContent = state.user.email;
  $("#whoRole").textContent = "";
  app.innerHTML = `<section class="card">
    <h2>Profil akun belum ada</h2>
    <p>Akun ini belum memiliki peran. Jika Anda wali kelas/pihak sekolah, minta admin menambahkan
    dokumen profil di Firestore (lihat README). Jika Anda siswa atau orang tua, keluar lalu daftar ulang.</p>
  </section>`;
}

/* ---------- Layar: siswa ---------- */
function viewSiswa() {
  const p = state.profile;
  app.innerHTML = `
    <section class="card">
      <h2>Ajukan izin pulang</h2>
      <p class="muted">${esc(p.nama)} · NIS ${esc(p.nis)} · Kelas ${esc(p.kelas)}</p>
      <form id="fIzin" class="form">
        <label>Bulan<input type="month" name="bulan" value="${currentMonth()}" required></label>
        <div class="row2">
          <label>Tanggal pulang<input type="date" name="tglPulang" required></label>
          <label>Tanggal kembali<input type="date" name="tglKembali" required></label>
        </div>
        <label>Alasan / keterangan<textarea name="alasan" rows="3" required placeholder="Contoh: pulang bulanan"></textarea></label>
        <button class="btn primary" type="submit">Kirim ke orang tua</button>
      </form>
    </section>
    <section><h2>Izin saya</h2><div id="list" class="list"></div></section>`;

  const list = $("#list");
  const renderList = () => {
    list.innerHTML = state.items.length
      ? state.items.map((it) => itemCard(it, `<button class="btn small" data-act="detail" data-id="${it.id}">${it.status === "disetujui" ? "Lihat / cetak surat" : "Detail"}</button>`)).join("")
      : `<div class="empty">Belum ada pengajuan izin.</div>`;
  };
  bindList(list, { detail: detailModal });

  let first = true;
  sub(query(collection(db, "izin"), where("siswaUid", "==", state.user.uid)), (snap) => {
    state.items = mapDocs(snap);
    if (!first) {
      snap.docChanges().forEach((c) => {
        if (c.type === "modified" && !c.doc.metadata.hasPendingWrites) {
          const d = c.doc.data();
          toast(`Izin ${fmtBulan(d.bulan)}: ${STATUS[d.status].label}`);
        }
      });
    }
    first = false;
    renderList();
  });

  $("#fIzin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.tglKembali < f.tglPulang) return toast("Tanggal kembali tidak boleh sebelum tanggal pulang.", true);
    const id = `${state.user.uid}_${f.bulan}`;
    const existing = state.items.find((i) => i.id === id);
    if (existing && !existing.status.startsWith("ditolak")) {
      return toast("Izin untuk bulan ini sudah diajukan.", true);
    }
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      if (existing) await deleteDoc(doc(db, "izin", id));
      await setDoc(doc(db, "izin", id), {
        siswaUid: state.user.uid,
        nis: p.nis, nama: p.nama, kelas: p.kelas,
        bulan: f.bulan, tglPulang: f.tglPulang, tglKembali: f.tglKembali,
        alasan: f.alasan.trim(),
        status: "menunggu_ortu",
        createdAt: serverTimestamp(),
      });
      e.target.reset();
      toast("Izin terkirim. Menunggu tanda tangan orang tua.");
    } catch (err) {
      toast(errMsg(err), true);
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------- Layar: orang tua ---------- */
function viewOrtu() {
  const p = state.profile;
  app.innerHTML = `
    <section class="card">
      <h2>Izin pulang anak</h2>
      <p class="muted">Menampilkan pengajuan untuk NIS ${esc(p.childNis)}. Pengajuan baru muncul otomatis.</p>
    </section>
    <section><div id="list" class="list"></div></section>`;

  const list = $("#list");
  const renderList = () => {
    list.innerHTML = state.items.length
      ? state.items.map((it) => {
          const sign = it.status === "menunggu_ortu"
            ? `<button class="btn primary small" data-act="sign" data-id="${it.id}">Tinjau & tanda tangan</button>` : "";
          return itemCard(it, `${sign}<button class="btn small" data-act="detail" data-id="${it.id}">Detail</button>`);
        }).join("")
      : `<div class="empty">Belum ada pengajuan dari anak Anda.</div>`;
  };
  bindList(list, { detail: detailModal, sign: signModal });

  let first = true;
  sub(query(collection(db, "izin"), where("nis", "==", p.childNis)), (snap) => {
    state.items = mapDocs(snap);
    if (!first) {
      snap.docChanges().forEach((c) => {
        if (c.type === "added" && !c.doc.metadata.hasPendingWrites) {
          toast(`Pengajuan izin baru dari ${c.doc.data().nama}. Mohon ditinjau.`);
        }
      });
    }
    first = false;
    renderList();
  });
}

function signModal(it) {
  const m = openModal(`
    <h3>Tanda tangan izin pulang</h3>
    <p><b>${esc(it.nama)}</b> (${esc(it.kelas)}) · ${fmtBulan(it.bulan)}</p>
    <p class="muted">Pulang ${fmtDate(it.tglPulang)}, kembali ${fmtDate(it.tglKembali)}</p>
    <p>${esc(it.alasan)}</p>
    <div class="form">
      <label>Nama orang tua/wali<input id="ortuNama" value="${esc(state.profile.nama)}"></label>
      <label>Tanda tangan di kotak ini</label>
      <canvas id="pad" width="600" height="220" class="pad"></canvas>
      <label>Catatan (opsional)<input id="catOrtu"></label>
    </div>
    <div class="actions">
      <button class="btn ghost" id="clr">Hapus TTD</button>
      <button class="btn bad" id="tolak">Tolak</button>
      <button class="btn primary" id="setuju">Setujui & kirim</button>
    </div>
    <div class="actions"><button class="btn ghost small" data-close>Batal</button></div>`);

  const pad = signaturePad($("#pad", m));
  $("#clr", m).addEventListener("click", () => pad.clear());

  const submit = async (approve) => {
    const ortuNama = $("#ortuNama", m).value.trim();
    if (!ortuNama) return toast("Isi nama orang tua/wali.", true);
    if (approve && pad.isEmpty()) return toast("Tanda tangan dulu di kotak yang tersedia.", true);
    const data = {
      status: approve ? "menunggu_wali" : "ditolak_ortu",
      ortuNama,
      ortuUid: state.user.uid,
      ortuAt: serverTimestamp(),
      catatanOrtu: $("#catOrtu", m).value.trim(),
    };
    if (approve) data.ttdOrtu = pad.toDataURL();
    m.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await updateDoc(doc(db, "izin", it.id), data);
      closeModal();
      toast(approve ? "Tanda tangan terkirim ke sekolah." : "Izin ditolak.");
    } catch (err) {
      toast(errMsg(err), true);
      m.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  };
  $("#setuju", m).addEventListener("click", () => submit(true));
  $("#tolak", m).addEventListener("click", () => submit(false));
}

/* ---------- Layar: wali kelas / sekolah ---------- */
function viewWali() {
  app.innerHTML = `
    <section class="card">
      <h2>Dashboard izin pulang</h2>
      <div class="filters">
        <label>Bulan<input type="month" id="fBulan" value="${currentMonth()}"></label>
        <label>Status
          <select id="fStatus">
            <option value="">Semua</option>
            ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}
          </select>
        </label>
        <label>Cari<input id="fCari" placeholder="Nama / NIS / kelas"></label>
      </div>
      <div id="stats" class="stats"></div>
      <div class="actions"><button class="btn small" id="btnCsv">Ekspor CSV</button></div>
    </section>
    <section><div id="list" class="list"></div></section>`;

  const list = $("#list");
  let filtered = [];

  const render = () => {
    const b = $("#fBulan").value, s = $("#fStatus").value, q = $("#fCari").value.trim().toLowerCase();
    const inMonth = state.items.filter((i) => !b || i.bulan === b);
    const count = (st) => inMonth.filter((i) => i.status === st).length;
    $("#stats").innerHTML = [
      ["Total", inMonth.length],
      ["Menunggu ortu", count("menunggu_ortu")],
      ["Perlu diproses", count("menunggu_wali")],
      ["Disetujui", count("disetujui")],
      ["Ditolak", count("ditolak_ortu") + count("ditolak_wali")],
    ].map(([l, n]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");

    filtered = inMonth.filter((i) =>
      (!s || i.status === s) &&
      (!q || `${i.nama} ${i.nis} ${i.kelas}`.toLowerCase().includes(q)));

    list.innerHTML = filtered.length
      ? filtered.map((it) => {
          const act = it.status === "menunggu_wali"
            ? `<button class="btn primary small" data-act="approve" data-id="${it.id}">Setujui</button>
               <button class="btn bad small" data-act="reject" data-id="${it.id}">Tolak</button>` : "";
          return itemCard(it, `${act}<button class="btn small" data-act="detail" data-id="${it.id}">Detail</button>`);
        }).join("")
      : `<div class="empty">Tidak ada data.</div>`;
  };

  ["fBulan", "fStatus", "fCari"].forEach((id) => $("#" + id).addEventListener("input", render));
  bindList(list, {
    detail: detailModal,
    approve: (it) => decideModal(it, true),
    reject: (it) => decideModal(it, false),
  });

  $("#btnCsv").addEventListener("click", () => {
    const rows = [["Bulan", "NIS", "Nama", "Kelas", "Tgl pulang", "Tgl kembali", "Alasan", "Status", "Orang tua", "Diproses oleh"]]
      .concat(filtered.map((i) => [i.bulan, i.nis, i.nama, i.kelas, i.tglPulang, i.tglKembali, i.alasan,
        (STATUS[i.status] || {}).label, i.ortuNama || "", i.waliNama || ""]));
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `izin-pulang-${$("#fBulan").value || "semua"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  let first = true;
  sub(collection(db, "izin"), (snap) => {
    state.items = mapDocs(snap);
    if (!first) {
      snap.docChanges().forEach((c) => {
        if (!c.doc.metadata.hasPendingWrites && c.type !== "removed" && c.doc.data().status === "menunggu_wali") {
          toast(`Izin ${c.doc.data().nama} sudah ditandatangani orang tua dan siap diproses.`);
        }
      });
    }
    first = false;
    render();
  });
}

function decideModal(it, approve) {
  const m = openModal(`
    <h3>${approve ? "Setujui" : "Tolak"} izin pulang</h3>
    <p><b>${esc(it.nama)}</b> (${esc(it.kelas)}) · ${fmtBulan(it.bulan)}</p>
    <p class="muted">${fmtDate(it.tglPulang)} s/d ${fmtDate(it.tglKembali)} · TTD: ${esc(it.ortuNama || "-")}</p>
    ${it.ttdOrtu ? `<img src="${esc(it.ttdOrtu)}" alt="TTD orang tua" style="max-width:240px;border:1px solid var(--line);border-radius:8px">` : ""}
    <div class="form">
      <label>Catatan ${approve ? "(opsional)" : "(alasan penolakan)"}<input id="catWali"></label>
    </div>
    <div class="actions">
      <button class="btn ghost" data-close>Batal</button>
      <button class="btn ${approve ? "primary" : "bad"}" id="ok">${approve ? "Setujui" : "Tolak"}</button>
    </div>`);
  $("#ok", m).addEventListener("click", async () => {
    const catatanWali = $("#catWali", m).value.trim();
    if (!approve && !catatanWali) return toast("Isi alasan penolakan.", true);
    m.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await updateDoc(doc(db, "izin", it.id), {
        status: approve ? "disetujui" : "ditolak_wali",
        waliNama: state.profile.nama,
        waliUid: state.user.uid,
        waliAt: serverTimestamp(),
        catatanWali,
      });
      closeModal();
      toast(approve ? "Izin disetujui." : "Izin ditolak.");
    } catch (err) {
      toast(errMsg(err), true);
      m.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  });
}

/* ---------- Mulai & sesi ---------- */
const ROLE_LABEL = { siswa: "Siswa", ortu: "Orang tua", wali: "Sekolah" };

function start() {
  cleanup();
  const p = state.profile;
  $("#topbar").hidden = false;
  $("#whoName").textContent = p.nama;
  $("#whoRole").textContent = ROLE_LABEL[p.role] || p.role;
  if (p.role === "siswa") viewSiswa();
  else if (p.role === "ortu") viewOrtu();
  else if (p.role === "wali") viewWali();
  else renderNoProfile();
}

if (!configured) {
  renderSetupNotice();
} else {
  $("#btnLogout").addEventListener("click", () => signOut(auth));
  onAuthStateChanged(auth, async (user) => {
    if (state.registering) return;
    cleanup();
    if (!user) {
      state.user = null;
      state.profile = null;
      renderAuth();
      return;
    }
    state.user = user;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) return renderNoProfile();
      state.profile = snap.data();
      start();
    } catch (err) {
      toast(errMsg(err), true);
    }
  });
}
