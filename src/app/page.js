"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const NAMA_SEKOLAH = process.env.NEXT_PUBLIC_NAMA_SEKOLAH || "Nama Sekolah";
const STATUS = {
  menunggu_ortu: { label: "Menunggu TTD orang tua", cls: "warn" },
  menunggu_wali: { label: "Menunggu persetujuan sekolah", cls: "info" },
  disetujui: { label: "Disetujui", cls: "ok" },
  ditolak_ortu: { label: "Ditolak orang tua", cls: "bad" },
  ditolak_wali: { label: "Ditolak sekolah", cls: "bad" },
};
const ROLE_LABEL = { siswa: "Siswa", ortu: "Orang tua", wali: "Sekolah" };

/* ===== Helpers ===== */
const fmtDate = (s) => {
  if (!s) return "-";
  return new Date(s + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
};
const fmtBulan = (b) => {
  if (!b) return "-";
  const [y, m] = b.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString("id-ID", {
    month: "long", year: "numeric",
  });
};
const fmtTs = (s) => {
  if (!s) return "-";
  return new Date(s).toLocaleString("id-ID", {
    dateStyle: "medium", timeStyle: "short",
  });
};
const currentMonth = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
};

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
  return data;
}

/* ===== Toast Component ===== */
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className={`toast ${toast.isError ? "error" : ""}`}>
      {toast.message}
    </div>
  );
}

/* ===== Signature Pad ===== */
function SignaturePad({ padRef }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ drawing: false, dirty: false, last: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: ((clientX - r.left) * canvas.width) / r.width,
        y: ((clientY - r.top) * canvas.height) / r.height,
      };
    };

    const down = (e) => {
      stateRef.current.drawing = true;
      stateRef.current.last = pos(e);
      if (e.pointerId !== undefined) canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const move = (e) => {
      if (!stateRef.current.drawing) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(stateRef.current.last.x, stateRef.current.last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      stateRef.current.last = p;
      stateRef.current.dirty = true;
    };
    const up = () => { stateRef.current.drawing = false; };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  useEffect(() => {
    padRef.current = {
      clear() {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        stateRef.current.dirty = false;
      },
      isEmpty: () => !stateRef.current.dirty,
      toDataURL: () => canvasRef.current.toDataURL("image/png"),
    };
  }, [padRef]);

  return <canvas ref={canvasRef} width={600} height={220} className="pad" />;
}

/* ===== Item Card ===== */
function ItemCard({ item, actions }) {
  const st = STATUS[item.status] || { label: item.status, cls: "" };
  const s2 = item.status === "menunggu_ortu" ? "current" : item.status === "ditolak_ortu" ? "bad" : "done";
  const s3 = item.status === "disetujui" ? "done" : item.status === "ditolak_wali" ? "bad" : item.status === "menunggu_wali" ? "current" : "";

  return (
    <article className="item">
      <div className="item-h">
        <div>
          <b>{item.nama}</b>{" "}
          <small>· {item.kelas} · NIS {item.nis}</small>
          <div className="muted">
            {fmtBulan(item.bulan)} · {fmtDate(item.tgl_pulang)} s/d{" "}
            {fmtDate(item.tgl_kembali)}
          </div>
        </div>
        <span className={`badge ${st.cls}`}>{st.label}</span>
      </div>
      <p>{item.alasan}</p>
      <ol className="tl">
        <li className="done"><b>Diajukan</b><small>{fmtTs(item.created_at)}</small></li>
        <li className={s2}><b>Orang tua</b><small>{item.ortu_at ? fmtTs(item.ortu_at) : "menunggu"}</small></li>
        <li className={s3}><b>Sekolah</b><small>{item.wali_at ? fmtTs(item.wali_at) : "menunggu"}</small></li>
      </ol>
      {item.catatan_ortu && <p className="note">Catatan orang tua: {item.catatan_ortu}</p>}
      {item.catatan_wali && <p className="note">Catatan sekolah: {item.catatan_wali}</p>}
      <div className="actions">{actions}</div>
    </article>
  );
}

/* ===== Detail Modal ===== */
function DetailModal({ item, onClose }) {
  const st = STATUS[item.status] || { label: item.status };
  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="letter">
          <h3>{NAMA_SEKOLAH}</h3>
          <h4>SURAT IZIN PULANG BULANAN</h4>
          <table>
            <tbody>
              <tr><td>Nama siswa</td><td>: {item.nama}</td></tr>
              <tr><td>NIS / Kelas</td><td>: {item.nis} / {item.kelas}</td></tr>
              <tr><td>Periode</td><td>: {fmtBulan(item.bulan)}</td></tr>
              <tr><td>Tanggal pulang</td><td>: {fmtDate(item.tgl_pulang)}</td></tr>
              <tr><td>Tanggal kembali</td><td>: {fmtDate(item.tgl_kembali)}</td></tr>
              <tr><td>Keterangan</td><td>: {item.alasan}</td></tr>
              <tr><td>Status</td><td>: <b>{st.label}</b></td></tr>
            </tbody>
          </table>
          <div className="sigs">
            <div>
              <p>Orang tua/wali</p>
              {item.ttd_ortu ? (
                <img src={item.ttd_ortu} alt="Tanda tangan orang tua" />
              ) : (
                <div className="blank" />
              )}
              <p><b>{item.ortu_nama || "-"}</b></p>
              <small>{item.ortu_at ? fmtTs(item.ortu_at) : ""}</small>
            </div>
            <div>
              <p>Pihak sekolah</p>
              {item.status === "disetujui" ? (
                <div className="stamp">DISETUJUI</div>
              ) : (
                <div className="blank" />
              )}
              <p><b>{item.wali_nama || "-"}</b></p>
              <small>{item.wali_at ? fmtTs(item.wali_at) : ""}</small>
            </div>
          </div>
        </div>
        <div className="actions no-print">
          <button className="btn ghost" onClick={onClose}>Tutup</button>
          <button className="btn primary" onClick={() => window.print()}>Cetak / Simpan PDF</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Sign Modal (Orang tua) ===== */
function SignModal({ item, user, onClose, onDone, showToast }) {
  const padRef = useRef(null);
  const [ortuNama, setOrtuNama] = useState(user.nama);
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (approve) => {
    if (!ortuNama.trim()) return showToast("Isi nama orang tua/wali.", true);
    if (approve && padRef.current?.isEmpty()) return showToast("Tanda tangan dulu di kotak yang tersedia.", true);
    setLoading(true);
    try {
      await api(`/api/izin/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          approve,
          ortuNama: ortuNama.trim(),
          catatanOrtu: catatan.trim(),
          ttdOrtu: approve ? padRef.current?.toDataURL() : null,
        }),
      });
      showToast(approve ? "Tanda tangan terkirim ke sekolah." : "Izin ditolak.");
      onDone();
      onClose();
    } catch (err) {
      showToast(err.message, true);
      setLoading(false);
    }
  };

  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Tanda tangan izin pulang</h3>
        <p><b>{item.nama}</b> ({item.kelas}) · {fmtBulan(item.bulan)}</p>
        <p className="muted">Pulang {fmtDate(item.tgl_pulang)}, kembali {fmtDate(item.tgl_kembali)}</p>
        <p>{item.alasan}</p>
        <div className="form">
          <label>
            Nama orang tua/wali
            <input value={ortuNama} onChange={(e) => setOrtuNama(e.target.value)} />
          </label>
          <label>Tanda tangan di kotak ini</label>
          <SignaturePad padRef={padRef} />
          <label>
            Catatan (opsional)
            <input value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </label>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => padRef.current?.clear()} disabled={loading}>
            Hapus TTD
          </button>
          <button className="btn bad" onClick={() => submit(false)} disabled={loading}>Tolak</button>
          <button className="btn primary" onClick={() => submit(true)} disabled={loading}>
            Setujui &amp; kirim
          </button>
        </div>
        <div className="actions">
          <button className="btn ghost small" onClick={onClose} disabled={loading}>Batal</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Decide Modal (Wali/Sekolah) ===== */
function DecideModal({ item, approve, onClose, onDone, showToast }) {
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!approve && !catatan.trim()) return showToast("Isi alasan penolakan.", true);
    setLoading(true);
    try {
      await api(`/api/izin/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ approve, catatanWali: catatan.trim() }),
      });
      showToast(approve ? "Izin disetujui." : "Izin ditolak.");
      onDone();
      onClose();
    } catch (err) {
      showToast(err.message, true);
      setLoading(false);
    }
  };

  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{approve ? "Setujui" : "Tolak"} izin pulang</h3>
        <p><b>{item.nama}</b> ({item.kelas}) · {fmtBulan(item.bulan)}</p>
        <p className="muted">
          {fmtDate(item.tgl_pulang)} s/d {fmtDate(item.tgl_kembali)} · TTD:{" "}
          {item.ortu_nama || "-"}
        </p>
        {item.ttd_ortu && (
          <img
            src={item.ttd_ortu} alt="TTD orang tua"
            style={{ maxWidth: 240, border: "1px solid var(--line)", borderRadius: 8, marginTop: 8 }}
          />
        )}
        <div className="form">
          <label>
            Catatan {approve ? "(opsional)" : "(alasan penolakan)"}
            <input value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </label>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={onClose} disabled={loading}>Batal</button>
          <button
            className={`btn ${approve ? "primary" : "bad"}`}
            onClick={submit} disabled={loading}
          >
            {approve ? "Setujui" : "Tolak"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Auth Form ===== */
function AuthForm({ onAuth, showToast }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("siswa");
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    setLoading(true);
    try {
      if (isLogin) {
        const res = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username: data.username,
            password: data.password,
          }),
        });
        onAuth(res.user);
      } else {
        const username = role === "siswa" ? data.nis : data.username;
        const res = await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            username,
            password: data.password,
            nama: data.nama,
            role,
            nis: data.nis,
            kelas: data.kelas,
            childNis: data.childNis,
          }),
        });
        onAuth(res.user);
      }
    } catch (err) {
      showToast(err.message, true);
      setLoading(false);
    }
  };

  return (
    <section className="auth-card">
      <h2 style={{ textAlign: "center", marginBottom: 4 }}>
        {isLogin ? "Masuk" : "Daftar akun"}
      </h2>
      <p className="muted" style={{ textAlign: "center", marginBottom: 16 }}>
        Izin pulang bulanan siswa dengan tanda tangan digital.
      </p>
      <form className="form" onSubmit={handleSubmit}>
        {isLogin ? (
          <label>
            Username
            <input
              name="username" required autoComplete="username"
              placeholder="NIS (siswa) / email atau No. HP (orang tua)"
            />
          </label>
        ) : (
          <>
            <label>
              Daftar sebagai
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="siswa">Siswa</option>
                <option value="ortu">Orang tua / wali</option>
              </select>
            </label>
            <label>
              Nama lengkap
              <input name="nama" required />
            </label>
            {role === "siswa" ? (
              <div className="row2">
                <label>NIS<input name="nis" required placeholder="dipakai untuk masuk" /></label>
                <label>Kelas<input name="kelas" required placeholder="mis. X-A" /></label>
              </div>
            ) : (
              <>
                <label>
                  Username (email atau No. HP)
                  <input name="username" required placeholder="mis. 0812xxxx" />
                </label>
                <label>
                  NIS anak
                  <input name="childNis" required placeholder="NIS putra/putri Anda" />
                </label>
              </>
            )}
          </>
        )}
        <label>
          Kata sandi
          <input
            name="password" type="password" required minLength={6}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
        </label>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Memproses..." : isLogin ? "Masuk" : "Daftar"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16, textAlign: "center" }}>
        {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
        <button className="link-btn" onClick={() => { setMode(isLogin ? "register" : "login"); setLoading(false); }}>
          {isLogin ? "Daftar" : "Masuk"}
        </button>
      </p>
    </section>
  );
}

/* ===== Siswa View ===== */
function SiswaView({ user, items, onRefresh, showToast }) {
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    if (data.tglKembali < data.tglPulang) {
      return showToast("Tanggal kembali tidak boleh sebelum tanggal pulang.", true);
    }
    setSubmitting(true);
    try {
      const res = await api("/api/izin", {
        method: "POST",
        body: JSON.stringify(data),
      });
      showToast(res.message);
      e.target.reset();
      onRefresh();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="card">
        <h2>Ajukan izin pulang</h2>
        <p className="muted">
          {user.nama} · NIS {user.nis} · Kelas {user.kelas}
        </p>
        <form className="form" onSubmit={handleSubmit}>
          <label>Bulan<input type="month" name="bulan" defaultValue={currentMonth()} required /></label>
          <div className="row2">
            <label>Tanggal pulang<input type="date" name="tglPulang" required /></label>
            <label>Tanggal kembali<input type="date" name="tglKembali" required /></label>
          </div>
          <label>
            Alasan / keterangan
            <textarea name="alasan" rows={3} required placeholder="Contoh: pulang bulanan" />
          </label>
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? "Mengirim..." : "Kirim ke orang tua"}
          </button>
        </form>
      </section>
      <section>
        <h2>Izin saya</h2>
        <div className="list">
          {items.length === 0 ? (
            <div className="empty">Belum ada pengajuan izin.</div>
          ) : (
            items.map((it) => (
              <ItemCard key={it.id} item={it} actions={
                <button className="btn small" onClick={() => setModal({ type: "detail", item: it })}>
                  {it.status === "disetujui" ? "Lihat / cetak surat" : "Detail"}
                </button>
              } />
            ))
          )}
        </div>
      </section>
      {modal?.type === "detail" && (
        <DetailModal item={modal.item} onClose={() => setModal(null)} />
      )}
    </>
  );
}

/* ===== Ortu View ===== */
function OrtuView({ user, items, onRefresh, showToast }) {
  const [modal, setModal] = useState(null);

  return (
    <>
      <section className="card">
        <h2>Izin pulang anak</h2>
        <p className="muted">
          Menampilkan pengajuan untuk NIS {user.childNis}. Pengajuan baru muncul otomatis.
        </p>
      </section>
      <section>
        <div className="list">
          {items.length === 0 ? (
            <div className="empty">Belum ada pengajuan dari anak Anda.</div>
          ) : (
            items.map((it) => (
              <ItemCard key={it.id} item={it} actions={
                <>
                  {it.status === "menunggu_ortu" && (
                    <button
                      className="btn primary small"
                      onClick={() => setModal({ type: "sign", item: it })}
                    >
                      Tinjau &amp; tanda tangan
                    </button>
                  )}
                  <button className="btn small" onClick={() => setModal({ type: "detail", item: it })}>
                    Detail
                  </button>
                </>
              } />
            ))
          )}
        </div>
      </section>
      {modal?.type === "detail" && (
        <DetailModal item={modal.item} onClose={() => setModal(null)} />
      )}
      {modal?.type === "sign" && (
        <SignModal
          item={modal.item} user={user}
          onClose={() => setModal(null)}
          onDone={onRefresh} showToast={showToast}
        />
      )}
    </>
  );
}

/* ===== Wali View ===== */
function WaliView({ items, onRefresh, showToast }) {
  const [modal, setModal] = useState(null);
  const [bulan, setBulan] = useState(currentMonth());
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const filtered = items.filter((i) => {
    if (bulan && i.bulan !== bulan) return false;
    if (status && i.status !== status) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${i.nama} ${i.nis} ${i.kelas}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const inMonth = items.filter((i) => !bulan || i.bulan === bulan);
  const count = (s) => inMonth.filter((i) => i.status === s).length;

  const exportCsv = () => {
    const rows = [
      ["Bulan", "NIS", "Nama", "Kelas", "Tgl pulang", "Tgl kembali", "Alasan", "Status", "Orang tua", "Diproses oleh"],
      ...filtered.map((i) => [
        i.bulan, i.nis, i.nama, i.kelas, i.tgl_pulang, i.tgl_kembali,
        i.alasan, (STATUS[i.status] || {}).label, i.ortu_nama || "", i.wali_nama || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `izin-pulang-${bulan || "semua"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <section className="card">
        <h2>Dashboard izin pulang</h2>
        <div className="filters">
          <label>Bulan<input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} /></label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </label>
          <label>Cari<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama / NIS / kelas" /></label>
        </div>
        <div className="stats">
          {[
            ["Total", inMonth.length],
            ["Menunggu ortu", count("menunggu_ortu")],
            ["Perlu diproses", count("menunggu_wali")],
            ["Disetujui", count("disetujui")],
            ["Ditolak", count("ditolak_ortu") + count("ditolak_wali")],
          ].map(([l, n]) => (
            <div key={l} className="stat"><b>{n}</b><span>{l}</span></div>
          ))}
        </div>
        <div className="actions">
          <button className="btn small" onClick={exportCsv}>Ekspor CSV</button>
        </div>
      </section>
      <section>
        <div className="list">
          {filtered.length === 0 ? (
            <div className="empty">Tidak ada data.</div>
          ) : (
            filtered.map((it) => (
              <ItemCard key={it.id} item={it} actions={
                <>
                  {it.status === "menunggu_wali" && (
                    <>
                      <button className="btn primary small" onClick={() => setModal({ type: "decide", item: it, approve: true })}>
                        Setujui
                      </button>
                      <button className="btn bad small" onClick={() => setModal({ type: "decide", item: it, approve: false })}>
                        Tolak
                      </button>
                    </>
                  )}
                  <button className="btn small" onClick={() => setModal({ type: "detail", item: it })}>
                    Detail
                  </button>
                </>
              } />
            ))
          )}
        </div>
      </section>
      {modal?.type === "detail" && (
        <DetailModal item={modal.item} onClose={() => setModal(null)} />
      )}
      {modal?.type === "decide" && (
        <DecideModal
          item={modal.item} approve={modal.approve}
          onClose={() => setModal(null)}
          onDone={onRefresh} showToast={showToast}
        />
      )}
    </>
  );
}

/* ===== Main App ===== */
export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
  }, []);

  // Check auth on mount
  useEffect(() => {
    api("/api/auth/me")
      .then((d) => { setUser(d.user || false); setLoading(false); })
      .catch(() => { setUser(false); setLoading(false); });
  }, []);

  // Fetch items
  const fetchItems = useCallback(async () => {
    if (!user) return;
    try {
      const d = await api("/api/izin");
      setItems(d.items || []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 8000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(false);
    setItems([]);
  };

  if (loading) {
    return (
      <main>
        <div className="loader"><div className="spinner" /></div>
      </main>
    );
  }

  if (!user) {
    return (
      <>
        <main>
          <AuthForm onAuth={(u) => setUser(u)} showToast={showToast} />
        </main>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">Izin Pulang</div>
        <div className="who">
          <span>{user.nama}</span>
          <span className="role-badge">{ROLE_LABEL[user.role] || user.role}</span>
          <button className="btn ghost small" onClick={handleLogout}>Keluar</button>
        </div>
      </header>
      <main>
        {user.role === "siswa" && (
          <SiswaView user={user} items={items} onRefresh={fetchItems} showToast={showToast} />
        )}
        {user.role === "ortu" && (
          <OrtuView user={user} items={items} onRefresh={fetchItems} showToast={showToast} />
        )}
        {user.role === "wali" && (
          <WaliView items={items} onRefresh={fetchItems} showToast={showToast} />
        )}
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
