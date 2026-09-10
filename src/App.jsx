// App.jsx — Middletown High academic assistant (frontend only).
//
// The Gemini key lives ONLY on the server, in api/chat.js. Nothing secret is
// imported here, because everything in this file ships to the browser.
//
//   npm install && npm run dev
//
// Requires GEMINI_API_KEY in .env (see .env.example).
import { useState, useRef, useEffect } from "react";

const SUBJECTS = [
  { id: "math",      name: "Mathematics",        icon: "📐", color: "#2563EB" },
  { id: "physics",   name: "Physics",            icon: "🔭", color: "#0891B2" },
  { id: "chemistry", name: "Chemistry",          icon: "⚗️", color: "#059669" },
  { id: "biology",   name: "Biology",            icon: "🧬", color: "#16A34A" },
  { id: "english",   name: "English Literature", icon: "📖", color: "#DC2626" },
  { id: "history",   name: "History",            icon: "🏛️", color: "#B45309" },
  { id: "geography", name: "Geography",          icon: "🌍", color: "#0D9488" },
  { id: "cs",        name: "Computer Science",   icon: "💻", color: "#7C3AED" },
  { id: "economics", name: "Economics",          icon: "📊", color: "#C2410C" },
  { id: "french",    name: "French",             icon: "🇫🇷", color: "#BE185D" },
  { id: "art",       name: "Visual Arts",        icon: "🎨", color: "#92400E" },
  { id: "pe",        name: "Physical Education", icon: "⚽", color: "#166534" },
];

const ANNOUNCEMENTS = [
  { tag: "Reminder", text: "Mid-term exams begin March 5th. Check individual subject pages for exact dates.",            bg: "#EFF6FF", border: "#BFDBFE", tagColor: "#2563EB" },
  { tag: "New",      text: "Year 12 study packs have been uploaded to the resource library for all core subjects.",      bg: "#F0FDF4", border: "#BBF7D0", tagColor: "#16A34A" },
  { tag: "Event",    text: "Parent-teacher conferences on April 3rd. Booking opens next Monday.",                        bg: "#FFFBEB", border: "#FDE68A", tagColor: "#D97706" },
];

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
  }, [messages]);

  const handleSubjectClick = (s) => {
    setSubject(s);
    setMessages([{ from: "bot", text: `Hi! I'm your ${s.name} assistant. Ask me about any chapter, topic, or upcoming deadline.` }]);
    setStep("chat");
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    const updated = [...messages, { from: "user", text: userText }];
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
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  const openChat  = () => { setChatOpen(true); setShowDot(false); };
  const closeChat = () => setChatOpen(false);
  const goBack    = () => { setStep("pick"); setSubject(null); setMessages([]); };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Nunito:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <style>{`
        /* ── Reset & base ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body, #root {
          width: 100%;
          min-height: 100vh;
          font-family: 'Nunito', sans-serif;
          background: #F8F7F4;
          color: #1C1C1E;
        }

        /* ── Centered page wrapper ── */
        .page-wrapper {
          width: 100%;
          min-height: 100vh;
        }

        /* ── Nav ── */
        .top-nav {
          width: 100%;
          background: #fff;
          border-bottom: 1px solid #E5E7EB;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        /* ── Main content container — this is what centers everything ── */
        .content-container {
          width: 100%;
          max-width: 1200px;       /* wider so grid fills the space */
          margin: 0 auto;          /* auto left+right = centered */
          padding: 36px 32px 140px;
        }

        /* ── Subject grid — responsive columns ── */
        .subject-grid {
          display: grid;
          gap: 12px;
          /* 
            auto-fill + minmax means:
            - squeezes to 1 column on phones
            - 2 columns on tablets
            - 3-4 columns on laptops
            - 6 columns on wide screens
            all without any media queries
          */
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        }

        /* ── Announcement list ── */
        .announcements { display: flex; flex-direction: column; gap: 8px; }

        /* ── Card hover ── */
        .subject-card {
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 18px 16px;
          cursor: pointer;
          transition: background .15s, border-color .15s, transform .15s;
        }
        .subject-card:hover {
          background: #F1F5F9;
          border-color: #CBD5E1;
          transform: translateY(-1px);
        }

        .subject-pick-btn {
          background: #FAFAFA;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          padding: 11px 10px;
          cursor: pointer;
          text-align: left;
          font-family: 'Nunito', sans-serif;
          transition: background .15s, border-color .15s;
          width: 100%;
        }
        .subject-pick-btn:hover { background: #EFF6FF; border-color: #93C5FD; }

        .role-pill {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 14px; border-radius: 20px;
          font-size: 13px; font-weight: 700; cursor: pointer;
          font-family: 'Nunito', sans-serif;
          transition: border-color .15s, background .15s;
        }

        /* ── FAB ── */
        .fab {
          position: fixed; bottom: 24px; right: 24px;
          width: 54px; height: 54px; border-radius: 50%;
          background: #2563EB; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 20px rgba(37,99,235,.38);
          z-index: 100;
          transition: transform .15s, box-shadow .15s;
        }
        .fab:hover { transform: scale(1.06); box-shadow: 0 6px 28px rgba(37,99,235,.5); }

        /* ── Chat widget ── */
        .chat-widget {
          position: fixed; bottom: 20px; right: 20px;
          width: 370px;
          /* on very small screens, go full width */
          max-width: calc(100vw - 24px);
          height: 540px;
          background: #fff; border-radius: 18px;
          box-shadow: 0 8px 40px rgba(0,0,0,.13), 0 2px 8px rgba(0,0,0,.06);
          display: flex; flex-direction: column;
          overflow: hidden; z-index: 100;
          border: 1px solid #E5E7EB;
          animation: slideUp .2s ease;
        }

        .send-btn {
          background: #2563EB; border: none; border-radius: 10px;
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0;
          transition: background .15s;
        }
        .send-btn:hover:not(:disabled) { background: #1D4ED8; }
        .send-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .back-btn, .close-btn {
          background: none; border: none; cursor: pointer;
          color: #9CA3AF; font-size: 16px; padding: 2px 4px;
          line-height: 1; transition: color .1s;
        }
        .back-btn:hover, .close-btn:hover { color: #374151; }
        .close-btn { font-size: 20px; }

        .chat-message { animation: fadeIn .15s ease; }

        textarea:focus, input:focus { outline: none; }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 4px; }

        /* ── Animations ── */
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingDot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.75); }
          40%            { opacity: 1;    transform: scale(1); }
        }

        /* ── Responsive tweaks ── */
        @media (max-width: 640px) {
          .content-container { padding: 24px 16px 120px; }
          .top-nav { padding: 0 16px; }
          .nav-label { display: none; }   /* hide "Academic Portal" text on mobile */
        }

        @media (min-width: 1400px) {
          .subject-grid {
            grid-template-columns: repeat(6, 1fr); /* lock to 6 cols on very wide screens */
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════
          PAGE
      ═══════════════════════════════════════════ */}
      <div className="page-wrapper">

        {/* NAV */}
        <nav className="top-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🎓</span>
            <span style={{ fontFamily: "'Lora', serif", fontSize: 17, fontWeight: 700, color: "#111827" }}>
              Middletown High
            </span>
            <span className="nav-label" style={{ color: "#E5E7EB", margin: "0 2px" }}>|</span>
            <span className="nav-label" style={{ fontSize: 13, color: "#9CA3AF" }}>Academic Portal</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                style={{ display: "flex", gap: 4, alignItems: "center" }}
              >
                <input
                  name="code"
                  type="password"
                  autoFocus
                  placeholder="Staff passcode"
                  aria-label="Staff passcode"
                  onKeyDown={(e) => { if (e.key === "Escape") setAskCode(false); }}
                  style={{
                    width: 130, padding: "5px 10px", borderRadius: 20, fontSize: 12,
                    fontFamily: "'Nunito', sans-serif", border: "1.5px solid #3B82F6",
                    background: "#fff", color: "#1C1C1E",
                  }}
                />
                <button type="submit" className="role-pill" style={{ border: "1.5px solid #3B82F6", background: "#2563EB", color: "#fff" }}>
                  Unlock
                </button>
              </form>
            )}
            <span style={{ fontSize: 12, color: "#9CA3AF", marginRight: 4 }}>Sign in as:</span>
            {[["student", "👩‍🎓"], ["teacher", "👩‍🏫"]].map(([r, emoji]) => (
              <button
                key={r}
                className="role-pill"
                onClick={() => {
                  if (r === "student") { setPasscode(""); setRole("student"); setAskCode(false); return; }
                  // The pill is a claim, not a grant — api/chat.js verifies the
                  // passcode on every request and downgrades silently if it's wrong.
                  setAskCode(true);
                }}
                style={{
                  border: `1.5px solid ${role === r ? "#3B82F6" : "#E5E7EB"}`,
                  background: role === r ? "#EFF6FF" : "#fff",
                  color: role === r ? "#2563EB" : "#6B7280",
                }}
              >
                {emoji} {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </nav>

        {/* CENTERED CONTENT */}
        <div className="content-container">

          {/* Greeting */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              Good morning 👋
            </h1>
            <p style={{ fontSize: 14, color: "#6B7280" }}>Year 12 · Spring Semester 2026</p>
          </div>

          {/* Announcements */}
          <section style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>
              Announcements
            </div>
            <div className="announcements">
              {ANNOUNCEMENTS.map((a, i) => (
                <div key={i} style={{ background: a.bg, border: `1px solid ${a.border}`, borderRadius: 10, padding: "11px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ background: a.tagColor, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 8px", whiteSpace: "nowrap", marginTop: 2 }}>
                    {a.tag}
                  </span>
                  <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>{a.text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Subjects */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>
              Your Subjects
            </div>
            <div className="subject-grid">
              {SUBJECTS.map(s => (
                <div
                  key={s.id}
                  className="subject-card"
                  onClick={() => { openChat(); handleSubjectClick(s); }}
                >
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{s.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1C1C1E", marginBottom: 4 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>Ask assistant →</div>
                </div>
              ))}
            </div>
          </section>

          {/* Teacher banner */}
          {role === "teacher" && (
            <div style={{ marginTop: 28, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "13px 18px" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#D97706" }}>Teacher mode — </span>
              <span style={{ fontSize: 13, color: "#92400E" }}>
                The assistant will include class analytics, grade data, and teacher notes in subject chats.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          FLOATING BUTTON
      ═══════════════════════════════════════════ */}
      {!chatOpen && (
        <button className="fab" onClick={openChat}>
          {showDot && (
            <span style={{ position: "absolute", top: 9, right: 9, width: 10, height: 10, background: "#F97316", borderRadius: "50%", border: "2px solid #fff" }} />
          )}
          <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </button>
      )}

      {/* ═══════════════════════════════════════════
          CHAT WIDGET
      ═══════════════════════════════════════════ */}
      {chatOpen && (
        <div className="chat-widget">

          {/* Header */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 8, background: "#fff" }}>
            {step === "chat" && <button className="back-btn" onClick={goBack}>←</button>}
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: subject ? "#EFF6FF" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
              {subject ? subject.icon : "🎓"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {step === "chat" && subject ? subject.name : "School Assistant"}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                {step === "chat" ? `Viewing as ${role}` : "Select a subject"}
              </div>
            </div>
            <button className="close-btn" onClick={closeChat}>×</button>
          </div>

          {/* Subject picker */}
          {step === "pick" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
              <p style={{ fontSize: 12.5, color: "#6B7280", padding: "2px 4px 10px" }}>
                Which subject do you need help with?
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {SUBJECTS.map(s => (
                  <button key={s.id} className="subject-pick-btn" onClick={() => handleSubjectClick(s)}>
                    <div style={{ fontSize: 17, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", lineHeight: 1.3 }}>{s.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {step === "chat" && (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.map((m, i) => (
                  <div key={i} className="chat-message" style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "82%", padding: "9px 13px",
                      borderRadius: m.from === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                      background: m.from === "user" ? "#2563EB" : m.isError ? "#FEF2F2" : "#F3F4F6",
                      color: m.from === "user" ? "#fff" : m.isError ? "#B91C1C" : "#1C1C1E",
                      border: m.isError ? "1px solid #FECACA" : "none",
                      fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap",
                    }}>
                      {m.text}
                    </div>
                  </div>
                ))}

                {/* Typing dots */}
                {loading && (
                  <div style={{ display: "flex" }}>
                    <div style={{ background: "#F3F4F6", borderRadius: "14px 14px 14px 3px", padding: "11px 14px", display: "flex", gap: 4, alignItems: "center" }}>
                      {[0, 0.18, 0.36].map((delay, i) => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#9CA3AF", display: "inline-block", animation: `typingDot 1.1s ${delay}s infinite` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "8px 10px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 7, alignItems: "flex-end" }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ask about a topic, chapter..."
                  rows={1}
                  style={{ flex: 1, background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "9px 11px", fontSize: 13, color: "#1C1C1E", resize: "none", fontFamily: "'Nunito', sans-serif", lineHeight: 1.5, maxHeight: 100, transition: "border-color .15s" }}
                  onFocus={e => (e.target.style.borderColor = "#93C5FD")}
                  onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                />
                <button className="send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
                  <svg width="15" height="15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
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
