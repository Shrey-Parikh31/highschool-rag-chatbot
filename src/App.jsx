// App.jsx — Middletown High academic assistant (frontend only).
//
// The Gemini key lives ONLY on the server, in api/chat.js. Nothing secret is
// imported here, because everything in this file ships to the browser.
//
//   npm install && npm run dev
//
// Requires GEMINI_API_KEY in .env (see .env.example).
import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";

const SUBJECTS = [
  { id: "math",      name: "Maths",        full: "Mathematics",        icon: "📐", color: "#4F46E5" },
  { id: "physics",   name: "Physics",      full: "Physics",            icon: "🔭", color: "#0891B2" },
  { id: "chemistry", name: "Chemistry",    full: "Chemistry",          icon: "⚗️", color: "#059669" },
  { id: "biology",   name: "Biology",      full: "Biology",            icon: "🧬", color: "#16A34A" },
  { id: "english",   name: "English",      full: "English Literature", icon: "📖", color: "#E11D48" },
  { id: "history",   name: "History",      full: "History",            icon: "🏛️", color: "#B45309" },
  { id: "geography", name: "Geography",    full: "Geography",          icon: "🌍", color: "#0D9488" },
  { id: "cs",        name: "Computing",    full: "Computer Science",   icon: "💻", color: "#7C3AED" },
  { id: "economics", name: "Economics",    full: "Economics",          icon: "📊", color: "#EA580C" },
  // Not the 🇫🇷 flag: Windows ships no flag emoji, so it renders as faded "FR" letters.
  { id: "french",    name: "French",       full: "French",             icon: "🥐", color: "#DB2777" },
  { id: "art",       name: "Art",          full: "Visual Arts",        icon: "🎨", color: "#A16207" },
  { id: "pe",        name: "PE",           full: "Physical Education", icon: "⚽", color: "#15803D" },
];

// Tappable openers. A blank text box is the single biggest reason a student
// closes the tab, so every chat starts with something concrete to press.
// Shrey: tune the wording here — these should sound like your actual students.
const STARTERS = {
  math:      ["What's on the mid-term?", "Explain quadratics simply", "I'm stuck on trigonometry"],
  physics:   ["What's due next?", "Explain Newton's laws simply", "Help me revise kinematics"],
  english:   ["What's on the reading list?", "Explain the Macbeth themes", "How do I write a thesis?"],
};
const DEFAULT_STARTERS = ["What's coming up next?", "What should I revise first?", "Explain this like I'm new to it"];

const ANNOUNCEMENTS = [
  { tag: "Heads up", emoji: "📌", text: "Mid-term exams begin March 5th. Check each subject for exact dates.",   bg: "#EEF2FF", border: "#C7D2FE", tagColor: "#4F46E5" },
  { tag: "New",      emoji: "✨", text: "Year 12 study packs are up in the resource library for all subjects.",  bg: "#ECFDF5", border: "#A7F3D0", tagColor: "#059669" },
  { tag: "Event",    emoji: "📅", text: "Parent-teacher conferences on April 3rd. Booking opens Monday.",        bg: "#FFF7ED", border: "#FED7AA", tagColor: "#EA580C" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

async function sendToAI(messages, subjectId, teacherPasscode) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subjectId, messages, teacherPasscode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

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

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubjectClick = (s) => {
    setSubject(s);
    setMessages([{ from: "bot", text: `Hey! I'm your ${s.full} helper. Ask me about any chapter, topic or deadline — or tap one of these to start.` }]);
    setStep("chat");
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
      const reply = await sendToAI(updated, subject.id, passcode);
      // The server reports the role it actually granted; trust that, not the pill.
      if (reply.role !== role) setRole(reply.role);
      setMessages([...updated, { from: "bot", text: reply.text }]);
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
          background: #FBF9FF;
          color: #16161D;
          -webkit-font-smoothing: antialiased;
        }

        body {
          background-image:
            radial-gradient(60rem 40rem at 110% -10%, #EDE9FE 0%, transparent 60%),
            radial-gradient(50rem 34rem at -10% 0%, #DBEAFE 0%, transparent 55%);
          background-attachment: fixed;
        }

        .display { font-family: 'Fredoka', 'Nunito', sans-serif; letter-spacing: -0.01em; }

        /* Visible keyboard focus everywhere — students tab through this. */
        :focus-visible { outline: 3px solid #6366F1; outline-offset: 2px; border-radius: 8px; }

        /* ── Nav ── */
        .top-nav {
          width: 100%;
          background: rgba(255,255,255,.82);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #E9E5F5;
          min-height: 72px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          padding: 10px 28px;
          position: sticky; top: 0; z-index: 10;
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
          box-shadow: 0 12px 28px -8px rgba(30,20,80,.22);
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
          font-size: 13px; font-weight: 800; color: #7C7A94;
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

        /* ── FAB ── */
        .fab {
          position: fixed; bottom: 26px; right: 26px;
          width: 64px; height: 64px; border-radius: 50%;
          background: linear-gradient(140deg, #6366F1, #8B5CF6);
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 10px 26px rgba(99,102,241,.45);
          z-index: 100;
          transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s;
        }
        .fab:hover { transform: scale(1.08) rotate(4deg); box-shadow: 0 14px 34px rgba(99,102,241,.55); }

        /* ── Chat widget ── */
        .chat-widget {
          position: fixed; bottom: 22px; right: 22px;
          width: 430px;
          max-width: calc(100vw - 24px);
          /* Was a fixed 540px, which overflowed short laptop windows and hid
             the input box. Now it always fits the viewport. */
          height: min(680px, calc(100vh - 44px));
          background: #fff; border-radius: 26px;
          box-shadow: 0 18px 60px rgba(30,20,80,.20), 0 3px 10px rgba(0,0,0,.05);
          display: flex; flex-direction: column;
          overflow: hidden; z-index: 100;
          border: 1px solid #E9E5F5;
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
          color: #9A97B0; padding: 4px 8px; line-height: 1;
          border-radius: 8px;
          transition: color .12s, background .12s;
        }
        .icon-btn:hover { color: #16161D; background: #F3F0FB; }

        /* ── Starter chips ── */
        .starter-chip {
          background: #fff;
          border: 2px solid #E4DEF8;
          border-radius: 999px;
          padding: 9px 15px;
          font-size: 14.5px; font-weight: 700;
          font-family: inherit; color: #4C4A63;
          cursor: pointer; text-align: left;
          transition: border-color .15s, background .15s, transform .12s;
        }
        .starter-chip:hover { border-color: #A5B4FC; background: #F5F3FF; color: #4338CA; }
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
        .md a { color: #4F46E5; }

        textarea:focus, input:focus { outline: none; }
        textarea::placeholder { color: #A5A2B8; }

        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #DDD6F3; border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: #C4B5FD; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(18px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
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
            <span className="display" style={{ fontSize: 22, fontWeight: 700, color: "#16161D" }}>
              Middletown High
            </span>
            <span className="nav-label" style={{ color: "#DDD6F3" }}>|</span>
            <span className="nav-label" style={{ fontSize: 15, color: "#8A87A0", fontWeight: 600 }}>Study Hub</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {askCode && (
              // A real <form>: Enter-to-submit comes free from the platform, and
              // the button makes it discoverable instead of Enter-only.
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const code = new FormData(e.target).get("code").trim();
                  if (!code) return;
                  setPasscode(code);
                  setRole("teacher");   // provisional — the server has the final say
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
                  onKeyDown={(e) => { if (e.key === "Escape") setAskCode(false); }}
                  style={{
                    width: 150, padding: "8px 14px", borderRadius: 999, fontSize: 15,
                    fontFamily: "inherit", border: "2px solid #6366F1",
                    background: "#fff", color: "#16161D", fontWeight: 600,
                  }}
                />
                <button type="submit" className="role-pill" style={{ border: "2px solid #4F46E5", background: "#4F46E5", color: "#fff" }}>
                  Unlock
                </button>
              </form>
            )}
            <span style={{ fontSize: 14, color: "#8A87A0", fontWeight: 600 }}>I'm a</span>
            {[["student", "🎒", "Student"], ["teacher", "🍎", "Teacher"]].map(([r, emoji, label]) => (
              <button
                key={r}
                className="role-pill"
                aria-pressed={role === r}
                onClick={() => {
                  if (r === "student") { setPasscode(""); setRole("student"); setAskCode(false); return; }
                  // The pill is a claim, not a grant — api/chat.js verifies the
                  // passcode on every request and downgrades silently if it's wrong.
                  setAskCode(true);
                }}
                style={{
                  border: `2px solid ${role === r ? "#6366F1" : "#E4DEF8"}`,
                  background: role === r ? "#EEF2FF" : "#fff",
                  color: role === r ? "#4338CA" : "#6B6885",
                }}
              >
                {emoji} {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="content-container">

          {/* Greeting */}
          <div style={{ marginBottom: 38 }}>
            <h1 className="display" style={{ fontSize: 38, fontWeight: 700, color: "#16161D", marginBottom: 6, lineHeight: 1.15 }}>
              {greeting()} <span style={{ display: "inline-block" }}>👋</span>
            </h1>
            <p style={{ fontSize: 17.5, color: "#6B6885", fontWeight: 600 }}>
              Year 12 · Spring Semester 2026 — pick a subject and ask me anything.
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
                  <span style={{ fontSize: 16, color: "#3D3B54", fontWeight: 600 }}>{a.text}</span>
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
                  style={{ background: `${s.color}14`, borderColor: `${s.color}2E` }}
                >
                  <span className="subject-emoji">{s.icon}</span>
                  <div style={{ fontSize: 19, fontWeight: 800, color: "#16161D", marginBottom: 3 }}>{s.name}</div>
                  <div style={{ fontSize: 14.5, color: s.color, fontWeight: 700 }}>Ask me →</div>
                </button>
              ))}
            </div>
          </section>

          {role === "teacher" && (
            <div style={{ marginTop: 32, background: "#FFFBEB", border: "2px solid #FDE68A", borderRadius: 16, padding: "16px 20px" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#B45309" }}>🍎 Teacher mode — </span>
              <span style={{ fontSize: 16, color: "#92400E", fontWeight: 600 }}>
                subject chats now include class analytics, grade data and teacher notes.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════ FLOATING BUTTON ═══════════════ */}
      {!chatOpen && (
        <button className="fab" onClick={openChat} aria-label="Open the study assistant">
          {showDot && (
            <span style={{ position: "absolute", top: 10, right: 10, width: 13, height: 13, background: "#FB923C", borderRadius: "50%", border: "3px solid #fff" }} />
          )}
          <svg width="27" height="27" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      )}

      {/* ═══════════════ CHAT WIDGET ═══════════════ */}
      {chatOpen && (
        <div className="chat-widget" role="dialog" aria-label="Study assistant">

          {/* Header */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #F0EDFA", display: "flex", alignItems: "center", gap: 10, background: "#fff" }}>
            {step === "chat" && <button className="icon-btn" onClick={goBack} aria-label="Back to subjects" style={{ fontSize: 20 }}>←</button>}
            <div style={{ width: 42, height: 42, borderRadius: 14, background: subject ? `${subject.color}1A` : "#F3F0FB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
              {subject ? subject.icon : "🎓"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="display" style={{ fontWeight: 600, fontSize: 17, color: "#16161D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {step === "chat" && subject ? subject.full : "Study Assistant"}
              </div>
              <div style={{ fontSize: 13.5, color: "#8A87A0", fontWeight: 600 }}>
                {step === "chat" ? (role === "teacher" ? "🍎 Teacher view" : "🎒 Student view") : "Pick a subject"}
              </div>
            </div>
            <button className="icon-btn" onClick={closeChat} aria-label="Close" style={{ fontSize: 24 }}>×</button>
          </div>

          {/* Subject picker */}
          {step === "pick" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
              <p style={{ fontSize: 16, color: "#6B6885", padding: "0 4px 14px", fontWeight: 600 }}>
                What do you need help with?
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    className="subject-card"
                    onClick={() => handleSubjectClick(s)}
                    style={{ background: `${s.color}14`, borderColor: `${s.color}2E`, padding: "16px 14px", borderRadius: 18 }}
                  >
                    <span style={{ fontSize: 26, display: "block", marginBottom: 8 }}>{s.icon}</span>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: "#16161D", lineHeight: 1.25 }}>{s.name}</div>
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
                      background: m.from === "user" ? "linear-gradient(140deg, #6366F1, #8B5CF6)" : m.isError ? "#FEF2F2" : "#F5F3FF",
                      color: m.from === "user" ? "#fff" : m.isError ? "#B91C1C" : "#2A2840",
                      border: m.isError ? "2px solid #FECACA" : "none",
                      /* 13px -> 16px. This is the text students actually read. */
                      fontSize: 16, lineHeight: 1.6, fontWeight: m.from === "user" ? 600 : 500,
                    }}>
                      {m.from === "bot" && !m.isError
                        // Model output is markdown. react-markdown renders it without
                        // raw HTML, so a prompt-injected <script> stays inert text.
                        ? <div className="md"><Markdown>{m.text}</Markdown></div>
                        : m.text}
                    </div>
                  </div>
                ))}

                {/* Starter chips — only before the student has asked anything */}
                {showStarters && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 2 }}>
                    {starters.map((q) => (
                      <button key={q} className="starter-chip" onClick={() => send(q)}>{q}</button>
                    ))}
                  </div>
                )}

                {loading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ background: "#F5F3FF", borderRadius: "20px 20px 20px 6px", padding: "14px 18px", display: "flex", gap: 5, alignItems: "center" }}>
                      {[0, 0.18, 0.36].map((delay, i) => (
                        <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#A5B4FC", display: "inline-block", animation: `typingDot 1.1s ${delay}s infinite` }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 14, color: "#8A87A0", fontWeight: 600 }}>thinking…</span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "12px 14px 14px", borderTop: "1px solid #F0EDFA", display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder="Ask me anything…"
                  aria-label="Your question"
                  rows={1}
                  style={{
                    flex: 1, background: "#F9F7FE", border: "2px solid #E4DEF8", borderRadius: 16,
                    padding: "12px 15px", fontSize: 16, color: "#16161D", resize: "none",
                    fontFamily: "inherit", fontWeight: 600, lineHeight: 1.5, maxHeight: 120,
                    transition: "border-color .15s, background .15s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#A5B4FC"; e.target.style.background = "#fff"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#E4DEF8"; e.target.style.background = "#F9F7FE"; }}
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
