// App.jsx, Middletown High academic assistant (frontend only).
//
// The Gemini key lives ONLY on the server, in api/chat.js. Nothing secret is
// imported here, because everything in this file ships to the browser.
//
//   npm install && npm run dev
//
// Requires GEMINI_API_KEY in .env (see .env.example).
import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import { useAuth, SignInPage, AccountChip } from "./auth.jsx";

const SUBJECTS = [
  { id: "math",      name: "Math",         full: "Mathematics",        icon: "📐", color: "#4F46E5" },
  { id: "physics",   name: "Physics",      full: "Physics",            icon: "🔭", color: "#0891B2" },
  { id: "chemistry", name: "Chemistry",    full: "Chemistry",          icon: "⚗️", color: "#059669" },
  { id: "biology",   name: "Biology",      full: "Biology",            icon: "🧬", color: "#16A34A" },
  { id: "english",   name: "English",      full: "English Literature", icon: "📖", color: "#E11D48" },
  { id: "history",   name: "History",      full: "History",            icon: "🏛️", color: "#B45309" },
  { id: "geography", name: "Geography",    full: "Geography",          icon: "🌍", color: "#0D9488" },
  { id: "cs",        name: "Comp Sci",     full: "Computer Science",   icon: "💻", color: "#7C3AED" },
  { id: "economics", name: "Economics",    full: "Economics",          icon: "📊", color: "#EA580C" },
  // Not the 🇫🇷 flag: Windows ships no flag emoji, so it renders as faded "FR" letters.
  { id: "french",    name: "French",       full: "French",             icon: "🥐", color: "#DB2777" },
  { id: "art",       name: "Art",          full: "Visual Arts",        icon: "🎨", color: "#A16207" },
  { id: "pe",        name: "PE",           full: "Physical Education", icon: "⚽", color: "#15803D" },
];

// Tappable openers. A blank text box is the single biggest reason a student
// closes the tab, so every chat starts with something concrete to press.
// Shrey: tune the wording here, these should sound like your actual students.
const STARTERS = {
  math:      ["What's on the mid-term?", "Explain quadratics simply", "I'm stuck on trigonometry"],
  physics:   ["What's due next?", "Explain Newton's laws simply", "Help me study kinematics"],
  english:   ["What's on the reading list?", "Explain the Macbeth themes", "How do I write a thesis?"],
  chemistry: ["When's the mid-term?", "Help me with moles", "What do I need for labs?"],
  biology:   ["What's due next?", "Mitosis vs meiosis?", "Explain Punnett squares"],
  history:   ["What caused World War I?", "When's the mid-term?", "When's the research project due?"],
  geography: ["What's on the mid-term?", "Explain plate boundaries", "How do rivers make meanders?"],
  cs:        ["When's the final project due?", "Explain binary search", "Stacks vs queues?"],
  economics: ["Explain supply and demand", "What's due next?", "Fiscal vs monetary policy?"],
  french:    ["Passé composé or imparfait?", "When's the oral presentation?", "Phrases for directions"],
  art:       ["What's due next?", "Explain complementary colors", "What was Cubism?"],
  pe:        ["What do I need for PE?", "When's the fitness plan due?", "What's in the theory test?"],
};
const DEFAULT_STARTERS = ["What's coming up next?", "What should I study first?", "Explain this like I'm new to it"];

const ANNOUNCEMENTS = [
  { tag: "Heads up", emoji: "📌", text: "Mid-term exams begin October 19th. Check each subject for exact dates.",   bg: "var(--primary-soft)", border: "var(--info-border)", tagColor: "#4F46E5" },
  { tag: "New",      emoji: "✨", text: "Grade 12 study packs are up in the resource library for all subjects.",  bg: "var(--ok-bg)", border: "var(--ok-border)", tagColor: "#059669" },
  { tag: "Event",    emoji: "📅", text: "Parent-teacher conferences on November 6th. Booking opens Monday.",        bg: "var(--event-bg)", border: "var(--event-border)", tagColor: "#EA580C" },
];

// Subject colours were chosen against a white page. On dark they read as mud,
// so they are lifted towards white rather than maintained as a second palette.
const lift = (hex, amount) =>
  "#" + (hex.match(/\w\w/g) || []).map((h) => {
    const v = parseInt(h, 16);
    return Math.round(v + (255 - v) * amount).toString(16).padStart(2, "0");
  }).join("");

// Three choices, two themes. "system" is resolved here and written to
// <html data-theme>, so the stylesheet only ever has to know light from dark.
// index.html applies the stored choice before first paint, so there is no
// white flash on the way into a dark room.
const THEMES = [["light", "☀️", "Light"], ["dark", "🌙", "Dark"], ["system", "💻", "System"]];

function useTheme() {
  const [choice, setChoice] = useState(() => {
    try { return localStorage.getItem("theme") || "system"; } catch { return "system"; }
  });
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    // Re-runs on OS changes too, which only move anything while on "system".
    const apply = () => {
      const isDark = choice === "dark" || (choice === "system" && mq.matches);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      setDark(isDark);
    };
    apply();
    try { localStorage.setItem("theme", choice); } catch { /* private mode */ }
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [choice]);

  return [choice, setChoice, dark];
}

function ThemeToggle({ choice, onChange }) {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Color theme">
      {THEMES.map(([id, icon, label]) => (
        <button
          key={id}
          role="radio"
          aria-checked={choice === id}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          className={`theme-opt${choice === id ? " on" : ""}`}
          onClick={() => onChange(id)}
        >
          <span aria-hidden="true">{icon}</span>
        </button>
      ))}
    </div>
  );
}

// What the orb says when nobody has asked it anything yet. Short, concrete,
// and about this site rather than about AI.
const TIPS = [
  "Tap any subject and ask me about it. I read that class's syllabus.",
  "Try \"when is the mid-term?\" or \"what's due next week?\"",
  "Every answer names the file it came from, so you can check me.",
  "Light, dark or system: the theme switch is up in the top bar.",
];

/**
 * The floating helper. It greets a first-time visitor on its own, because a
 * silent circle gets ignored, and a tour nobody opens is worse than one
 * sentence that arrives by itself.
 */
function HelperOrb({ onOpen, busy, showDot }) {
  const [tip, setTip] = useState(-1);          // -1 = bubble hidden
  const [pinned, setPinned] = useState(false); // shown by us, not by a hover
  const [greeted, setGreeted] = useState(() => {
    try { return localStorage.getItem("orbGreeted") === "1"; } catch { return true; }
  });

  useEffect(() => {
    if (greeted) return;
    const t = setTimeout(() => { setTip(0); setPinned(true); }, 2000);
    return () => clearTimeout(t);
  }, [greeted]);

  const dismiss = () => {
    setTip(-1);
    setPinned(false);
    setGreeted(true);
    try { localStorage.setItem("orbGreeted", "1"); } catch { /* ignore */ }
  };

  return (
    <>
      {tip >= 0 && (
        <div className="orb-bubble" role="status">
          <p>{TIPS[tip]}</p>
          <div className="orb-bubble-row">
            <button onClick={() => setTip((i) => (i + 1) % TIPS.length)}>Another tip</button>
            <button onClick={dismiss}>Got it</button>
          </div>
        </div>
      )}
      <button
        className={`orb${busy ? " busy" : ""}`}
        onClick={onOpen}
        onMouseEnter={() => { if (tip < 0) setTip(0); }}
        onMouseLeave={() => { if (!pinned) setTip(-1); }}
        aria-label="Open the study assistant"
      >
        <span className="orb-ring" aria-hidden="true" />
        {showDot && <span className="orb-badge" />}
        <span className="orb-dots" aria-hidden="true"><i /><i /><i /></span>
      </button>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Ask the assistant and receive the answer as it is written.
 *
 * The server replies with newline-delimited JSON: many {"t":"delta"} lines,
 * then one {"t":"done"} carrying role, sources and model. Errors found before
 * streaming starts (bad subject, rate limit, quota) come back as an ordinary
 * JSON body with an error status instead, so both shapes are handled.
 */
async function streamFromAI(messages, subjectId, teacherPasscode, onDelta) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subjectId, messages, teacherPasscode }),
  });
  if (!res.ok || !(res.headers.get("content-type") || "").includes("ndjson")) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = null;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const evt = JSON.parse(line);
      if (evt.t === "delta") onDelta(evt.text);
      else if (evt.t === "error") throw new Error(evt.error);
      else if (evt.t === "done") done = evt;
    }
  }
  if (!done) throw new Error("The answer was cut off. Please try again.");
  return done;
}

/**
 * Staff-only document upload.
 *
 * The file goes up as the raw request body with metadata in the query string,
 * so the server needs no multipart parser. The passcode rides in a header and
 * is re-verified server-side, this panel being on screen grants nothing.
 */
function TeacherUpload({ passcode }) {
  const [subjectId, setSubjectId] = useState(SUBJECTS[0].id);
  const [scope, setScope]         = useState("shared");
  const [busy, setBusy]           = useState(false);
  const [result, setResult]       = useState(null);
  const [docs, setDocs]           = useState(null);   // null = loading
  const [docsError, setDocsError] = useState(null);
  const fileRef = useRef(null);

  const loadDocs = async (id = subjectId) => {
    setDocs(null);
    setDocsError(null);
    try {
      const res = await fetch(`/api/documents?subjectId=${encodeURIComponent(id)}`, {
        headers: { "x-teacher-passcode": passcode },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Could not load documents (${res.status})`);
      setDocs(data.documents);
    } catch (err) {
      setDocs([]);
      setDocsError(err.message);
    }
  };

  // Reload whenever the teacher picks a different subject.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDocs(subjectId); }, [subjectId]);

  const remove = async (doc) => {
    if (!window.confirm(`Remove "${doc.displayName}"? Students will stop getting answers from it straight away.`)) return;
    const qs = new URLSearchParams({ subjectId, scope: doc.scope, name: doc.name });
    const res = await fetch(`/api/documents?${qs}`, { method: "DELETE", headers: { "x-teacher-passcode": passcode } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setDocsError(data.error || `Delete failed (${res.status})`); return; }
    loadDocs();
  };

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const qs = new URLSearchParams({ subjectId, scope, filename: file.name });
      const res = await fetch(`/api/upload?${qs}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", "x-teacher-passcode": passcode },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      setResult({ ok: true, text: `“${data.filename}” added to ${data.subject}, visible to ${data.visibleTo}.` });
      if (fileRef.current) fileRef.current.value = "";
      loadDocs();
    } catch (err) {
      setResult({ ok: false, text: err.message });
    }
    setBusy(false);
  };

  const selectStyle = {
    padding: "10px 12px", borderRadius: 12, border: "2px solid var(--border)",
    fontSize: 15.5, fontFamily: "inherit", fontWeight: 700, background: "var(--surface)", color: "var(--text)",
  };

  return (
    <section style={{ marginTop: 36, background: "var(--surface)", border: "2px solid var(--border)", borderRadius: 20, padding: "22px 24px" }}>
      <div className="display" style={{ fontSize: 21, fontWeight: 600, marginBottom: 4 }}>📁 Upload course materials</div>
      <p style={{ fontSize: 15.5, color: "var(--muted)", fontWeight: 600, marginBottom: 18 }}>
        PDF, DOCX, TXT, MD or HTML, up to 4MB. The assistant answers only from what is uploaded here.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13.5, fontWeight: 800, color: "var(--label)" }}>
          SUBJECT
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={selectStyle}>
            {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.full}</option>)}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13.5, fontWeight: 800, color: "var(--label)" }}>
          WHO CAN SEE IT
          <select value={scope} onChange={(e) => setScope(e.target.value)} style={selectStyle}>
            <option value="shared">🎒 All students</option>
            <option value="staff">🔒 Staff only</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13.5, fontWeight: 800, color: "var(--label)" }}>
          FILE
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.html" style={{ ...selectStyle, fontWeight: 600, maxWidth: 280 }} />
        </label>

        <button
          onClick={upload}
          disabled={busy}
          className="role-pill"
          style={{
            border: "2px solid var(--primary-strong)", background: busy ? "var(--primary-weak)" : "var(--primary-strong)",
            color: "#fff", padding: "11px 22px", fontSize: 16, alignSelf: "flex-end",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Processing…" : "Upload"}
        </button>
      </div>

      {busy && (
        <p style={{ marginTop: 14, fontSize: 15, color: "var(--muted)", fontWeight: 600 }}>
          Reading and indexing the document. A large PDF can take up to a minute.
        </p>
      )}
      {result && (
        <p style={{
          marginTop: 14, fontSize: 15.5, fontWeight: 700,
          color: result.ok ? "var(--ok)" : "var(--danger)",
          background: result.ok ? "var(--ok-bg)" : "var(--danger-bg)",
          border: `2px solid ${result.ok ? "var(--ok-border)" : "var(--danger-border)"}`,
          borderRadius: 12, padding: "11px 15px",
        }}>
          {result.ok ? "✅ " : "⚠️ "}{result.text}
        </p>
      )}

      {scope === "staff" && (
        <p style={{ marginTop: 12, fontSize: 14.5, color: "var(--warn-2)", fontWeight: 700 }}>
          🔒 Staff-only files are stored separately and are never searched when a student asks a question.
        </p>
      )}

      <div style={{ marginTop: 22, borderTop: "2px solid var(--divider)", paddingTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--label)", marginBottom: 10 }}>
          ALREADY UPLOADED FOR {SUBJECTS.find((s) => s.id === subjectId)?.full.toUpperCase()}
        </div>
        {docs === null && <p style={{ fontSize: 15, color: "var(--muted-2)", fontWeight: 600 }}>Loading…</p>}
        {docsError && <p style={{ fontSize: 15, color: "var(--danger)", fontWeight: 700 }}>⚠️ {docsError}</p>}
        {docs?.length === 0 && !docsError && (
          <p style={{ fontSize: 15, color: "var(--muted-2)", fontWeight: 600 }}>
            Nothing yet. Students asking about this subject are told materials haven&apos;t been uploaded.
          </p>
        )}
        {docs?.length > 0 && (
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {docs.map((d) => (
              <li key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: "10px 14px" }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.displayName}</span>
                  <span style={{ fontSize: 13, color: "var(--muted-2)", fontWeight: 600 }}>
                    {d.scope === "staff" ? "🔒 Staff only" : "🎒 All students"} · {d.sizeBytes < 1024 ? `${d.sizeBytes} B` : `${(d.sizeBytes / 1024).toFixed(1)} KB`}
                    {d.createTime ? ` · ${new Date(d.createTime).toLocaleDateString()}` : ""}
                  </span>
                </span>
                <button
                  onClick={() => remove(d)}
                  aria-label={`Remove ${d.displayName}`}
                  style={{ border: "2px solid var(--danger-border)", background: "var(--surface)", color: "var(--danger)", borderRadius: 999, padding: "6px 14px", fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// Chat history survives a refresh and switching subjects, per tab.
//
// sessionStorage, not localStorage: school computers are shared, and a session
// store is wiped when the tab closes. Conversations containing any staff answer
// are never written at all, grades and teacher notes must not be left behind
// for the next person at the keyboard.
const chatKey = (subjectId) => `chat:${subjectId}`;

function loadChat(subjectId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(chatKey(subjectId)) || "null");
    return Array.isArray(saved) && saved.length ? saved : null;
  } catch {
    return null; // storage blocked or corrupt: just start fresh
  }
}

function saveChat(subjectId, messages) {
  try {
    if (messages.some((m) => m.role === "teacher")) {
      sessionStorage.removeItem(chatKey(subjectId));
      return;
    }
    sessionStorage.setItem(chatKey(subjectId), JSON.stringify(messages.filter((m) => !m.isError)));
  } catch {
    /* storage full or blocked, persistence is a convenience, not a requirement */
  }
}

function clearChat(subjectId) {
  try { sessionStorage.removeItem(chatKey(subjectId)); } catch { /* ignore */ }
}

const welcome = (s) => ({
  from: "bot",
  text: `Hey! I'm your ${s.full} helper. Ask me about any chapter, topic or deadline, or tap one of these to start.`,
});

export default function App() {
  const [role, setRole]         = useState("student");
  const [chatOpen, setChatOpen] = useState(false);
  const [step, setStep]         = useState("pick");
  const [subject, setSubject]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showDot, setShowDot]   = useState(true);
  const [passcode, setPasscode] = useState("");
  // Inline instead of window.prompt(): native prompts are blocked in sandboxed
  // frames and look like a browser error in a live demo.
  const [askCode, setAskCode]   = useState(false);
  // A refused passcode shakes the box and turns it red. No sentence: the
  // gesture says "no" faster than a line of text, and the words still reach a
  // screen reader through the .sr-only live region below.
  const [wrong, setWrong]       = useState(false);
  const [shake, setShake]       = useState(false);
  const [checking, setChecking] = useState(false);

  const [theme, setTheme, dark] = useTheme();
  const { user, signIn, signOut } = useAuth();

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Persist after every change to the open conversation.
  useEffect(() => {
    if (subject && messages.length > 1 && !messages[messages.length - 1]?.streaming) saveChat(subject.id, messages);
  }, [subject, messages]);

  const handleSubjectClick = (s) => {
    setSubject(s);
    setMessages(loadChat(s.id) || [welcome(s)]);
    setStep("chat");
  };

  const startOver = () => {
    if (!subject) return;
    clearChat(subject.id);
    setMessages([welcome(subject)]);
  };

  // Shared by the input box and the starter chips, so a tapped chip behaves
  // exactly like a typed question.
  const send = async (text) => {
    if (!text.trim() || loading) return;
    const updated = [...messages, { from: "user", text: text.trim() }];
    setMessages(updated);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    try {
      // The server builds the prompt and picks the data. This sends only the
      // transcript, the subject, and the passcode it was given.
      let written = "";
      const reply = await streamFromAI(updated, subject.id, passcode, (delta) => {
        written += delta;
        setMessages([...updated, { from: "bot", text: written, streaming: true }]);
      });
      // The server reports the role it actually granted; trust that, not the pill.
      if (reply.role !== role) setRole(reply.role);
      setMessages([...updated, { from: "bot", text: written, sources: reply.sources, role: reply.role }]);
    } catch (err) {
      console.error(err);
      setMessages([...updated, { from: "bot", text: err.message, isError: true }]);
    }
    setLoading(false);
  };

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // Signing out must leave nothing behind for the next person at the desk:
  // auth.jsx clears session storage, and this clears what React still holds.
  const handleSignOut = () => {
    signOut();
    setRole("student"); setPasscode(""); setAskCode(false);
    setChatOpen(false); setStep("pick"); setSubject(null); setMessages([]);
  };

  const firstName = user && user.name !== "Guest" ? user.name.split(" ")[0] : "";

  const openChat  = () => { setChatOpen(true); setShowDot(false); };
  const closeChat = () => setChatOpen(false);
  const goBack    = () => { setStep("pick"); setSubject(null); setMessages([]); };

  // Starters show only while the conversation hasn't really begun.
  const starters = subject ? (STARTERS[subject.id] || DEFAULT_STARTERS) : [];
  const showStarters = step === "chat" && messages.length === 1 && !loading;

  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`

        /* ── Theme tokens ──
           Every colour in this file goes through a token, so light and dark are
           one source of truth instead of two copies of the stylesheet drifting
           apart. index.html sets data-theme on <html> before first paint;
           "system" is resolved to light or dark in JS, so the CSS only ever has
           to know about two concrete themes. */
        :root {
          color-scheme: light;
          --bg: #FBF9FF; --blob-a: #EDE9FE; --blob-b: #DBEAFE;
          --surface: #ffffff; --surface-2: #F9F7FE; --surface-3: #F5F3FF;
          --nav-bg: rgba(255,255,255,.82);
          --text: #16161D; --text-2: #3D3B54;
          --muted: #6B6885; --muted-2: #8A87A0; --label: #7C7A94;
          --border: #E4DEF8; --border-soft: #E9E5F5; --divider: #F0EDFA; --scroll: #DDD6F3;
          --primary: #6366F1; --primary-strong: #4F46E5; --primary-weak: #A5B4FC;
          --primary-soft: #EEF2FF; --primary-ink: #4338CA;
          --danger: #B91C1C; --danger-bg: #FEF2F2; --danger-border: #FECACA;
          --ok: #047857; --ok-bg: #ECFDF5; --ok-border: #A7F3D0;
          --warn: #B45309; --warn-2: #92400E; --warn-bg: #FFFBEB; --warn-border: #FDE68A;
          --event-bg: #FFF7ED; --event-border: #FED7AA;
          --info-border: #C7D2FE; --danger-ring: #DC2626;
          --shadow: rgba(30,20,80,.20);
        }

        :root[data-theme="dark"] {
          color-scheme: dark;
          --bg: #0F0E15; --blob-a: #241E4D; --blob-b: #13263D;
          --surface: #1A1824; --surface-2: #221F2E; --surface-3: #272338;
          --nav-bg: rgba(26,24,36,.86);
          --text: #F3F1FA; --text-2: #D8D4E8;
          --muted: #AEA9C4; --muted-2: #9A95B0; --label: #9A95B0;
          --border: #38344C; --border-soft: #302C42; --divider: #292538; --scroll: #413C5A;
          --primary: #8B8CF8; --primary-strong: #A5A4FF; --primary-weak: #6366F1;
          --primary-soft: #262252; --primary-ink: #C7C6FF;
          --danger: #FCA5A5; --danger-bg: #3A1D20; --danger-border: #6B2F34;
          --ok: #6EE7B7; --ok-bg: #11312A; --ok-border: #1F5647;
          --warn: #FCD34D; --warn-2: #FBBF24; --warn-bg: #332814; --warn-border: #5C4718;
          --event-bg: #35250F; --event-border: #5E3F17;
          --info-border: #3A3570; --danger-ring: #F87171;
          --shadow: rgba(0,0,0,.55);
        }

        /* ── Reset & base ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body, #root {
          width: 100%;
          min-height: 100vh;
          font-family: 'Nunito', system-ui, sans-serif;
          /* Base bumped 14px -> 16.5px: this app is read by teenagers on
             laptops and phones, and the old scale was uncomfortably small. */
          font-size: 16.5px;
          line-height: 1.55;
          background: var(--bg);
          color: var(--text);
          transition: background-color .2s ease, color .2s ease;
          -webkit-font-smoothing: antialiased;
        }

        body {
          background-image:
            radial-gradient(60rem 40rem at 110% -10%, var(--blob-a) 0%, transparent 60%),
            radial-gradient(50rem 34rem at -10% 0%, var(--blob-b) 0%, transparent 55%);
          background-attachment: fixed;
        }

        .display { font-family: 'Fredoka', 'Nunito', sans-serif; letter-spacing: -0.01em; }

        /* Visible keyboard focus everywhere, students tab through this. */
        :focus-visible { outline: 3px solid var(--primary); outline-offset: 2px; border-radius: 8px; }

        /* ── Nav ── */
        .top-nav {
          width: 100%;
          background: var(--nav-bg);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-soft);
          min-height: 72px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          padding: 10px 28px;
          /* Above the chat widget (z-index 100): the nav is sticky, so it makes
             a stacking context, and the account menu cannot escape it. */
          position: sticky; top: 0; z-index: 110;
          flex-wrap: wrap;
        }

        .content-container {
          width: 100%; max-width: 1240px;
          margin: 0 auto;
          padding: 40px 32px 160px;
        }

        /* ── Subject grid ── */
        .subject-grid {
          display: grid; gap: 16px;
          grid-template-columns: repeat(auto-fill, minmax(186px, 1fr));
        }

        .subject-card {
          position: relative;
          border-radius: 22px;
          padding: 22px 20px 20px;
          cursor: pointer;
          border: 2px solid transparent;
          text-align: left; width: 100%;
          font-family: inherit;
          transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s, border-color .18s;
        }
        .subject-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 28px -8px var(--shadow);
        }
        .subject-card:active { transform: translateY(-1px); }

        .subject-emoji {
          font-size: 34px; line-height: 1;
          display: block; margin-bottom: 14px;
          transition: transform .18s cubic-bezier(.34,1.56,.64,1);
        }
        .subject-card:hover .subject-emoji { transform: scale(1.14) rotate(-6deg); }

        .announcements { display: flex; flex-direction: column; gap: 10px; }

        .section-label {
          font-size: 13px; font-weight: 800; color: var(--label);
          letter-spacing: .1em; text-transform: uppercase; margin-bottom: 14px;
        }

        .role-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 999px;
          font-size: 15px; font-weight: 700; cursor: pointer;
          font-family: inherit;
          transition: border-color .15s, background .15s, transform .12s;
        }
        .role-pill:active { transform: scale(.96); }

        /* ── Theme switch ── */
        .theme-toggle {
          display: flex; gap: 2px; padding: 3px;
          border-radius: 999px; border: 2px solid var(--border); background: var(--surface);
        }
        .theme-opt {
          border: none; background: none; cursor: pointer; font-family: inherit;
          font-size: 15px; line-height: 1; padding: 5px 9px; border-radius: 999px;
          transition: background .15s;
        }
        .theme-opt:hover { background: var(--surface-3); }
        .theme-opt.on { background: var(--primary-soft); }

        /* ── Helper orb ──
           The old FAB was a static speech-bubble icon that read as decoration.
           Three breathing dots read as someone waiting to be asked, and they
           speed up while an answer is being written. */
        .orb {
          position: fixed; bottom: 26px; right: 26px;
          width: 64px; height: 64px; border-radius: 50%;
          background: linear-gradient(140deg, #6366F1, #8B5CF6);
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 10px 26px rgba(99,102,241,.45);
          z-index: 100;
          transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s;
        }
        .orb:hover { transform: scale(1.08); box-shadow: 0 14px 34px rgba(99,102,241,.55); }
        .orb:active { transform: scale(.96); }
        .orb-ring {
          position: absolute; inset: -2px; border-radius: 50%;
          border: 2px solid #8B5CF6; pointer-events: none;
          animation: orbPulse 2.8s ease-out infinite;
        }
        .orb-dots { display: flex; gap: 5px; }
        .orb-dots i {
          width: 7px; height: 7px; border-radius: 50%; background: #fff; display: block;
          animation: orbBounce 1.5s ease-in-out infinite;
        }
        .orb-dots i:nth-child(2) { animation-delay: .18s; }
        .orb-dots i:nth-child(3) { animation-delay: .36s; }
        .orb.busy .orb-dots i { animation-duration: .6s; }
        .orb-badge {
          position: absolute; top: 9px; right: 9px; width: 13px; height: 13px;
          background: #FB923C; border-radius: 50%; border: 3px solid var(--surface);
        }

        .orb-bubble {
          position: fixed; right: 26px; bottom: 104px; z-index: 100; width: 252px;
          background: var(--surface); border: 2px solid var(--border); border-radius: 18px;
          padding: 14px 16px; box-shadow: 0 14px 40px var(--shadow);
          animation: slideUp .2s cubic-bezier(.34,1.3,.64,1);
        }
        .orb-bubble::after {
          content: ""; position: absolute; right: 28px; bottom: -9px;
          width: 14px; height: 14px; background: var(--surface);
          border-right: 2px solid var(--border); border-bottom: 2px solid var(--border);
          transform: rotate(45deg);
        }
        .orb-bubble p { font-size: 15px; font-weight: 600; color: var(--text-2); }
        .orb-bubble-row { display: flex; gap: 8px; margin-top: 11px; }
        .orb-bubble-row button {
          flex: 1; border-radius: 999px; padding: 7px 10px;
          font-size: 13.5px; font-weight: 800; font-family: inherit; cursor: pointer;
          border: 2px solid var(--border); background: var(--surface); color: var(--muted);
        }
        .orb-bubble-row button:last-child {
          background: var(--primary-strong); border-color: var(--primary-strong); color: #fff;
        }

        /* ── Sign-in ── */
        .auth-wrap { display: flex; justify-content: center; padding: 26px 0 60px; }
        .auth-card {
          width: 100%; max-width: 430px; text-align: center;
          background: var(--surface); border: 2px solid var(--border);
          border-radius: 26px; padding: 34px 30px; box-shadow: 0 18px 50px var(--shadow);
        }
        .auth-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 12px 16px; border-radius: 999px;
          border: 2px solid var(--border); background: var(--surface); color: var(--text);
          font-size: 15.5px; font-weight: 800; font-family: inherit; cursor: pointer;
          transition: border-color .15s, background .15s;
        }
        .auth-btn:hover:not(:disabled) { border-color: var(--primary-weak); background: var(--surface-3); }
        .auth-btn:disabled { cursor: not-allowed; flex-direction: column; gap: 1px; color: var(--muted); }
        .auth-rule {
          display: flex; align-items: center; gap: 12px; margin: 20px 0 16px;
          color: var(--muted-2); font-size: 13px; font-weight: 800;
        }
        .auth-rule::before, .auth-rule::after { content: ""; flex: 1; height: 2px; background: var(--divider); }
        .auth-input {
          flex: 1; min-width: 0; padding: 11px 15px; border-radius: 14px;
          border: 2px solid var(--border); background: var(--surface-2); color: var(--text);
          font-size: 15.5px; font-weight: 600; font-family: inherit;
        }
        .auth-go {
          padding: 11px 18px; border-radius: 14px;
          border: 2px solid var(--primary-strong); background: var(--primary-strong); color: #fff;
          font-size: 15.5px; font-weight: 800; font-family: inherit; cursor: pointer;
        }
        .auth-guest {
          margin-top: 18px; background: none; border: none; color: var(--muted);
          font-size: 14.5px; font-weight: 800; font-family: inherit; cursor: pointer; text-decoration: underline;
        }

        .account-pill { border: 2px solid var(--border); background: var(--surface); color: var(--text); }
        .avatar {
          width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(140deg, #6366F1, #8B5CF6); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 13.5px; font-weight: 800;
        }
        .account-menu {
          position: absolute; right: 0; top: calc(100% + 10px); width: 232px; text-align: left;
          background: var(--surface); border: 2px solid var(--border); border-radius: 18px;
          padding: 14px 16px; box-shadow: 0 16px 44px var(--shadow); z-index: 20;
          animation: slideUp .16s ease;
        }
        .account-signout {
          margin-top: 12px; width: 100%; padding: 9px 12px; border-radius: 12px;
          border: 2px solid var(--danger-border); background: var(--surface); color: var(--danger);
          font-size: 14.5px; font-weight: 800; font-family: inherit; cursor: pointer;
        }

        /* Screen-reader-only: the passcode refusal is a shake for sighted users,
           which a screen reader cannot convey, so the words still exist here. */
        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
        }

        /* ── Chat widget ── */
        .chat-widget {
          position: fixed; bottom: 22px; right: 22px;
          width: 430px;
          max-width: calc(100vw - 24px);
          /* Was a fixed 540px, which overflowed short laptop windows and hid
             the input box. Now it always fits the viewport. */
          height: min(680px, calc(100vh - 44px));
          background: var(--surface); border-radius: 26px;
          box-shadow: 0 18px 60px var(--shadow), 0 3px 10px rgba(0,0,0,.05);
          display: flex; flex-direction: column;
          overflow: hidden; z-index: 100;
          border: 1px solid var(--border-soft);
          animation: slideUp .24s cubic-bezier(.34,1.3,.64,1);
        }

        .send-btn {
          background: linear-gradient(140deg, #6366F1, #8B5CF6); border: none;
          border-radius: 14px;
          width: 46px; height: 46px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0;
          transition: filter .15s, transform .12s;
        }
        .send-btn:hover:not(:disabled) { filter: brightness(1.08); }
        .send-btn:active:not(:disabled) { transform: scale(.94); }
        .send-btn:disabled { opacity: .4; cursor: not-allowed; }

        .icon-btn {
          background: none; border: none; cursor: pointer;
          color: var(--muted-2); padding: 4px 8px; line-height: 1;
          border-radius: 8px;
          transition: color .12s, background .12s;
        }
        .icon-btn:hover { color: var(--text); background: var(--surface-3); }

        /* ── Starter chips ── */
        .starter-chip {
          background: var(--surface);
          border: 2px solid var(--border);
          border-radius: 999px;
          padding: 9px 15px;
          font-size: 14.5px; font-weight: 700;
          font-family: inherit; color: var(--text-2);
          cursor: pointer; text-align: left;
          transition: border-color .15s, background .15s, transform .12s;
        }
        .starter-chip:hover { border-color: var(--primary-weak); background: var(--surface-3); color: var(--primary-ink); }
        .starter-chip:active { transform: scale(.97); }

        .chat-message { animation: fadeIn .18s ease; }

        /* ── Markdown inside a bubble ── */
        .md > *:first-child { margin-top: 0; }
        .md > *:last-child  { margin-bottom: 0; }
        .md p { margin: 0 0 .6em; }
        .md ul, .md ol { margin: .4em 0 .6em; padding-left: 1.25em; }
        .md li { margin: .22em 0; }
        .md strong { font-weight: 800; }
        .md code {
          background: rgba(99,102,241,.12); padding: .1em .38em;
          border-radius: 6px; font-size: .9em;
        }
        .md pre {
          background: #1E1B33; color: #EDE9FE; padding: 12px 14px;
          border-radius: 12px; overflow-x: auto; margin: .5em 0;
        }
        .md pre code { background: none; padding: 0; color: inherit; }
        .md h1, .md h2, .md h3 { font-size: 1.05em; font-weight: 800; margin: .7em 0 .35em; }
        .md a { color: var(--primary-strong); }

        textarea:focus, input:focus { outline: none; }
        textarea::placeholder { color: var(--muted-2); }

        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--scroll); border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--primary-weak); }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(18px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbPulse {
          0%   { transform: scale(1);    opacity: .5; }
          70%  { transform: scale(1.65); opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes orbBounce {
          0%, 100% { transform: translateY(0);    opacity: .6; }
          35%      { transform: translateY(-6px); opacity: 1; }
        }
        /* A refusal you feel rather than read. */
        @keyframes shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(3px); }
          30%, 50%, 70% { transform: translateX(-7px); }
          40%, 60% { transform: translateX(7px); }
        }
        .shake { animation: shake .5s cubic-bezier(.36,.07,.19,.97); }

        @keyframes typingDot {
          0%, 80%, 100% { opacity: .25; transform: scale(.7); }
          40%           { opacity: 1;   transform: scale(1); }
        }

        @media (max-width: 640px) {
          html, body, #root { font-size: 16px; }
          .content-container { padding: 26px 16px 130px; }
          .top-nav { padding: 10px 16px; }
          .nav-label { display: none; }
          .subject-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
          .chat-widget { right: 12px; bottom: 12px; height: calc(100vh - 24px); border-radius: 22px; }
          .auth-card { padding: 26px 20px; }
          .orb-bubble { right: 16px; width: calc(100vw - 32px); max-width: 252px; }
        }

        /* Respect users who ask the OS for less motion. */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>

      {/* ═══════════════ PAGE ═══════════════ */}
      <div className="page-wrapper">

        <nav className="top-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>🎓</span>
            <span className="display" style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
              Middletown High
            </span>
            <span className="nav-label" style={{ color: "var(--border)" }}>|</span>
            <span className="nav-label" style={{ fontSize: 15, color: "var(--muted-2)", fontWeight: 600 }}>Study Hub</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {askCode && (
              // A real <form>: Enter-to-submit comes free from the platform, and
              // the button makes it discoverable instead of Enter-only.
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const code = new FormData(e.target).get("code").trim();
                  if (!code || checking) return;
                  setChecking(true);
                  setWrong(false);
                  // Ask the server before flipping the UI, otherwise any string
                  // looks accepted until the first answer comes back downgraded.
                  // /api/documents is staff-only and spends no model tokens, so
                  // it doubles as the passcode check. Only an explicit 403 is a
                  // rejection: on any other failure the per-request check in
                  // api/chat.js is still the real boundary.
                  const res = await fetch(`/api/documents?subjectId=${SUBJECTS[0].id}`, {
                    headers: { "x-teacher-passcode": code },
                  }).catch(() => null);
                  setChecking(false);
                  if (res?.status === 403) {
                    setWrong(true);
                    // Off then on again, so a second wrong try shakes again
                    // instead of sitting on a finished animation.
                    setShake(false);
                    requestAnimationFrame(() => setShake(true));
                    setTimeout(() => setShake(false), 520);
                    return;
                  }
                  setPasscode(code);
                  setRole("teacher");
                  setAskCode(false);
                }}
                style={{ display: "flex", gap: 6, alignItems: "center" }}
              >
                <input
                  name="code"
                  type="password"
                  autoFocus
                  placeholder="Staff passcode"
                  aria-label="Staff passcode"
                  className={shake ? "shake" : undefined}
                  onKeyDown={(e) => { if (e.key === "Escape") { setAskCode(false); setWrong(false); } }}
                  onChange={() => wrong && setWrong(false)}
                  aria-invalid={wrong}
                  style={{
                    width: 150, padding: "8px 14px", borderRadius: 999, fontSize: 15,
                    fontFamily: "inherit", border: `2px solid ${wrong ? "var(--danger-ring)" : "var(--primary)"}`,
                    background: "var(--surface)", color: "var(--text)", fontWeight: 600,
                  }}
                />
                <button type="submit" disabled={checking} className="role-pill" style={{ border: "2px solid var(--primary-strong)", background: checking ? "var(--primary-weak)" : "var(--primary-strong)", color: "#fff", cursor: checking ? "wait" : "pointer" }}>
                  {checking ? "Checking…" : "Unlock"}
                </button>
                <button type="button" className="role-pill" onClick={() => { setAskCode(false); setWrong(false); }} style={{ border: "2px solid var(--border)", background: "var(--surface)", color: "var(--muted)" }}>
                  Cancel
                </button>
                <span className="sr-only" role="alert">{wrong ? "That passcode is not right." : ""}</span>
              </form>
            )}
            {!askCode && <ThemeToggle choice={theme} onChange={setTheme} />}
            {/* While authenticating, the pills are noise and overflow the nav. */}
            {!askCode && user && <span className="nav-label" style={{ fontSize: 14, color: "var(--muted-2)", fontWeight: 600 }}>I&apos;m a</span>}
            {!askCode && user && [["student", "🎒", "Student"], ["teacher", "🍎", "Teacher"]].map(([r, emoji, label]) => (
              <button
                key={r}
                className="role-pill"
                aria-pressed={role === r}
                onClick={() => {
                  if (r === "student") {
                    // Don't leave staff answers on screen for the next person.
                    if (role === "teacher") goBack();
                    setPasscode(""); setRole("student"); setAskCode(false);
                    return;
                  }
                  setWrong(false);
                  setAskCode(true);
                }}
                style={{
                  border: `2px solid ${role === r ? "var(--primary)" : "var(--border)"}`,
                  background: role === r ? "var(--primary-soft)" : "var(--surface)",
                  color: role === r ? "var(--primary-ink)" : "var(--muted)",
                }}
              >
                {emoji} {label}
              </button>
            ))}
            {!askCode && user && <AccountChip user={user} onSignOut={handleSignOut} />}
          </div>
        </nav>

        <div className="content-container">

          {!user && <SignInPage onSignIn={signIn} dark={dark} />}
          {user && (<>

          {/* Greeting */}
          <div style={{ marginBottom: 38 }}>
            <h1 className="display" style={{ fontSize: 38, fontWeight: 700, color: "var(--text)", marginBottom: 6, lineHeight: 1.15 }}>
              {greeting()}{firstName && `, ${firstName}`} <span style={{ display: "inline-block" }}>👋</span>
            </h1>
            <p style={{ fontSize: 17.5, color: "var(--muted)", fontWeight: 600 }}>
              Grade 12 · Fall Semester 2026. Pick a subject and ask me anything.
            </p>
          </div>

          {/* Announcements */}
          <section style={{ marginBottom: 42 }}>
            <div className="section-label">What&apos;s happening</div>
            <div className="announcements">
              {ANNOUNCEMENTS.map((a, i) => (
                <div key={i} style={{ background: a.bg, border: `2px solid ${a.border}`, borderRadius: 16, padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 22, lineHeight: 1.3, flexShrink: 0 }}>{a.emoji}</span>
                  <span style={{ background: a.tagColor, color: "#fff", fontSize: 12, fontWeight: 800, borderRadius: 999, padding: "4px 11px", whiteSpace: "nowrap", letterSpacing: ".02em", flexShrink: 0, marginTop: 1 }}>
                    {a.tag}
                  </span>
                  <span style={{ fontSize: 16, color: "var(--text-2)", fontWeight: 600 }}>{a.text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Subjects */}
          <section>
            <div className="section-label">Your subjects</div>
            <div className="subject-grid">
              {SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  className="subject-card"
                  aria-label={`Ask the ${s.full} assistant`}
                  onClick={() => { openChat(); handleSubjectClick(s); }}
                  style={{ background: `${s.color}${dark ? "26" : "14"}`, borderColor: `${s.color}${dark ? "4D" : "2E"}` }}
                >
                  <span className="subject-emoji">{s.icon}</span>
                  <div style={{ fontSize: 19, fontWeight: 800, color: "var(--text)", marginBottom: 3 }}>{s.name}</div>
                  <div style={{ fontSize: 14.5, color: dark ? lift(s.color, 0.45) : s.color, fontWeight: 700 }}>Ask me →</div>
                </button>
              ))}
            </div>
          </section>

          {role === "teacher" && (
            <div style={{ marginTop: 32, background: "var(--warn-bg)", border: "2px solid var(--warn-border)", borderRadius: 16, padding: "16px 20px" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "var(--warn)" }}>🍎 Teacher mode: </span>
              <span style={{ fontSize: 16, color: "var(--warn-2)", fontWeight: 600 }}>
                subject chats now include class analytics, grade data and teacher notes.
              </span>
            </div>
          )}

          {role === "teacher" && <TeacherUpload passcode={passcode} />}
          </>)}
        </div>
      </div>

      {/* ═══════════════ HELPER ORB ═══════════════ */}
      {user && !chatOpen && <HelperOrb onOpen={openChat} busy={loading} showDot={showDot} />}

      {/* ═══════════════ CHAT WIDGET ═══════════════ */}
      {user && chatOpen && (
        <div className="chat-widget" role="dialog" aria-label="Study assistant">

          {/* Header */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", gap: 10, background: "var(--surface)" }}>
            {step === "chat" && <button className="icon-btn" onClick={goBack} aria-label="Back to subjects" style={{ fontSize: 20 }}>←</button>}
            <div style={{ width: 42, height: 42, borderRadius: 14, background: subject ? `${subject.color}1A` : "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
              {subject ? subject.icon : "🎓"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="display" style={{ fontWeight: 600, fontSize: 17, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {step === "chat" && subject ? subject.full : "Study Assistant"}
              </div>
              <div style={{ fontSize: 13.5, color: "var(--muted-2)", fontWeight: 600 }}>
                {step === "chat" ? (role === "teacher" ? "🍎 Teacher view" : "🎒 Student view") : "Pick a subject"}
              </div>
            </div>
            {step === "chat" && messages.length > 1 && (
              <button className="icon-btn" onClick={startOver} aria-label="Start a new conversation" title="Start over" style={{ fontSize: 14, fontWeight: 800 }}>
                ↺ New
              </button>
            )}
            <button className="icon-btn" onClick={closeChat} aria-label="Close" style={{ fontSize: 24 }}>×</button>
          </div>

          {/* Subject picker */}
          {step === "pick" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
              <p style={{ fontSize: 16, color: "var(--muted)", padding: "0 4px 14px", fontWeight: 600 }}>
                What do you need help with?
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    className="subject-card"
                    onClick={() => handleSubjectClick(s)}
                    style={{ background: `${s.color}${dark ? "26" : "14"}`, borderColor: `${s.color}${dark ? "4D" : "2E"}`, padding: "16px 14px", borderRadius: 18 }}
                  >
                    <span style={{ fontSize: 26, display: "block", marginBottom: 8 }}>{s.icon}</span>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--text)", lineHeight: 1.25 }}>{s.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat */}
          {step === "chat" && (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
                {messages.map((m, i) => (
                  <div key={i} className="chat-message" style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "86%", padding: "12px 16px",
                      borderRadius: m.from === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                      background: m.from === "user" ? "linear-gradient(140deg, #6366F1, #8B5CF6)" : m.isError ? "var(--danger-bg)" : "var(--surface-3)",
                      color: m.from === "user" ? "#fff" : m.isError ? "var(--danger)" : "var(--text-2)",
                      border: m.isError ? "2px solid var(--danger-border)" : "none",
                      /* 13px -> 16px. This is the text students actually read. */
                      fontSize: 16, lineHeight: 1.6, fontWeight: m.from === "user" ? 600 : 500,
                    }}>
                      {m.from === "bot" && !m.isError
                        // Model output is markdown. react-markdown renders it without
                        // raw HTML, so a prompt-injected <script> stays inert text.
                        ? <div className="md"><Markdown>{m.text}</Markdown></div>
                        : m.text}

                      {/* Where the answer came from. This is the difference between
                          "trust me" and "here is the document I read it in". */}
                      {m.sources?.length > 0 && (
                        <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid var(--border)", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 12.5, color: "var(--label)", fontWeight: 800 }}>SOURCE</span>
                          {m.sources.map((src) => (
                            <span key={src} style={{ fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999, padding: "3px 10px", fontWeight: 700, color: "var(--text-2)" }}>
                              📄 {src}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Starter chips, only before the student has asked anything */}
                {showStarters && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 2 }}>
                    {starters.map((q) => (
                      <button key={q} className="starter-chip" onClick={() => send(q)}>{q}</button>
                    ))}
                  </div>
                )}

                {loading && !messages[messages.length - 1]?.streaming && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ background: "var(--surface-3)", borderRadius: "20px 20px 20px 6px", padding: "14px 18px", display: "flex", gap: 5, alignItems: "center" }}>
                      {[0, 0.18, 0.36].map((delay, i) => (
                        <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary-weak)", display: "inline-block", animation: `typingDot 1.1s ${delay}s infinite` }} />
                      ))}
                    </div>
                    {/* Most of the wait is document search before the first word
                        (measured ~8s of an 8.1s answer), so say that honestly. */}
                    <span style={{ fontSize: 14, color: "var(--muted-2)", fontWeight: 600 }}>📚 checking your course notes…</span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "12px 14px 14px", borderTop: "1px solid var(--divider)", display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder="Ask me anything…"
                  aria-label="Your question"
                  rows={1}
                  style={{
                    flex: 1, background: "var(--surface-2)", border: "2px solid var(--border)", borderRadius: 16,
                    padding: "12px 15px", fontSize: 16, color: "var(--text)", resize: "none",
                    fontFamily: "inherit", fontWeight: 600, lineHeight: 1.5, maxHeight: 120,
                    transition: "border-color .15s, background .15s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--primary-weak)"; e.target.style.background = "var(--surface)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.background = "var(--surface-2)"; }}
                />
                <button className="send-btn" onClick={() => send(input)} disabled={loading || !input.trim()} aria-label="Send">
                  <svg width="19" height="19" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
