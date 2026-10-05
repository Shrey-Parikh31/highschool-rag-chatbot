// Sign-in for Middletown High Study Hub.
//
// WHAT THIS IS NOT: authorisation. Staff access is still decided on the server
// by the passcode check in api/_http.js, and retrieval still never puts a staff
// store in a student's scope. Signing in only says who is at the keyboard: it
// personalises the page and gives the demo a real name and face. That is why
// the identity is kept in the browser and never sent to /api/chat, and why
// nothing here can widen what a request is allowed to read.
//
// Google and Microsoft are real sign-ins. Both need a (public) client id from
// their console; without one the button says so instead of pretending. Email
// is deliberately a demo stub: a real email login needs a mail sender to post
// the magic link, which is a paid service this project does not have.
//
//   VITE_GOOGLE_CLIENT_ID   https://console.cloud.google.com/apis/credentials
//   VITE_MS_CLIENT_ID       https://portal.azure.com  (App registrations)
//
// Both are public values by design, which is why they carry the VITE_ prefix
// and the Gemini key never may.
import { useState, useEffect, useRef, useCallback } from "react";

// useAuth lives beside the components it serves: splitting a 40-line hook into
// its own module to satisfy a hot-reload rule is not worth the extra file.
/* eslint-disable react-refresh/only-export-components */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const MS_CLIENT_ID     = import.meta.env.VITE_MS_CLIENT_ID || "";
const STORE_KEY = "user";

/** Read a JWT's payload. Signature is NOT checked: see the note at the top,
 *  nothing is authorised on the strength of this, so there is nothing to forge
 *  your way into. Decoded as UTF-8 so accented names survive. */
function decodeJwt(token) {
  const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

const profile = (claims, via) => ({
  name: claims.name || claims.email || "Student",
  email: claims.email || claims.preferred_username || "",
  picture: claims.picture || "",
  via,
});

// sessionStorage, not localStorage, for the same reason the chat transcript
// uses it: school machines are shared, and closing the tab should sign you out.
function load() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Microsoft returns the token in the URL fragment. Consume it on first paint,
 *  then scrub the address bar so a shared screenshot does not leak the token. */
function consumeMicrosoftRedirect() {
  if (!window.location.hash.includes("id_token=")) return null;
  const frag = new URLSearchParams(window.location.hash.slice(1));
  const token = frag.get("id_token");
  const expected = sessionStorage.getItem("ms_nonce");
  history.replaceState(null, "", window.location.pathname + window.location.search);
  sessionStorage.removeItem("ms_nonce");
  try {
    const claims = decodeJwt(token);
    // The nonce proves this token answers the request we just made, rather
    // than one pasted in by someone else.
    if (!expected || claims.nonce !== expected) return null;
    return profile(claims, "Microsoft");
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState(() => consumeMicrosoftRedirect() || load());

  useEffect(() => {
    try {
      if (user) sessionStorage.setItem(STORE_KEY, JSON.stringify(user));
      else sessionStorage.removeItem(STORE_KEY);
    } catch { /* private mode: sign-in just does not survive a refresh */ }
  }, [user]);

  const signOut = useCallback(() => {
    setUser(null);
    // Nothing of this session should survive for the next person at the desk.
    try { sessionStorage.clear(); } catch { /* ignore */ }
  }, []);

  return { user, signIn: setUser, signOut };
}

/** Google's own script, fetched at most once however often this mounts. */
let gsi;
const loadGsi = () => (gsi ||= new Promise((resolve, reject) => {
  const el = document.createElement("script");
  el.src = "https://accounts.google.com/gsi/client";
  el.async = true;
  el.onload = resolve;
  el.onerror = reject;
  document.head.appendChild(el);
}));

function GoogleButton({ onSignIn, dark }) {
  const box = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let gone = false;
    loadGsi().then(() => {
      if (gone || !box.current || !window.google) return;
      // Google renders its own button: it is the compliant one, and it already
      // handles the popup, the branding rules and every locale.
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: ({ credential }) => onSignIn(profile(decodeJwt(credential), "Google")),
      });
      window.google.accounts.id.renderButton(box.current, {
        theme: dark ? "filled_black" : "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "pill",
      });
    }).catch(() => { /* offline or blocked: the other options still work */ });
    return () => { gone = true; };
  }, [dark, onSignIn]);

  if (!GOOGLE_CLIENT_ID) return <Unconfigured label="Continue with Google" env="VITE_GOOGLE_CLIENT_ID" />;
  return <div ref={box} style={{ minHeight: 44, display: "flex", justifyContent: "center" }} />;
}

function MicrosoftButton() {
  const start = () => {
    // Random nonce, checked when the redirect comes back.
    const nonce = crypto.randomUUID();
    sessionStorage.setItem("ms_nonce", nonce);
    const params = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      response_type: "id_token",
      redirect_uri: window.location.origin + window.location.pathname,
      scope: "openid profile email",
      response_mode: "fragment",
      nonce,
    });
    window.location.assign(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
  };

  if (!MS_CLIENT_ID) return <Unconfigured label="Continue with Microsoft" env="VITE_MS_CLIENT_ID" />;
  return (
    <button className="auth-btn" onClick={start}>
      <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
        <path fill="#F25022" d="M1 1h10v10H1z" /><path fill="#7FBA00" d="M12 1h10v10H12z" />
        <path fill="#00A4EF" d="M1 12h10v10H1z" /><path fill="#FFB900" d="M12 12h10v10H12z" />
      </svg>
      Continue with Microsoft
    </button>
  );
}

/** Shown in place of a provider button when its client id is missing, so the
 *  gap is visible in the UI instead of failing silently at click time. */
function Unconfigured({ label, env }) {
  return (
    <button className="auth-btn" disabled title={`Set ${env} in .env to turn this on`}>
      {label}
      <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--muted-2)" }}>needs {env}</span>
    </button>
  );
}

export function SignInPage({ onSignIn, dark }) {
  const [email, setEmail] = useState("");

  const demoEmail = (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!value.includes("@")) return;
    const name = value.split("@")[0].replace(/[._]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    onSignIn({ name, email: value, picture: "", via: "Email (demo)" });
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div style={{ fontSize: 44, lineHeight: 1 }}>🎓</div>
        <h1 className="display" style={{ fontSize: 30, fontWeight: 700, color: "var(--text)", marginTop: 10 }}>
          Sign in to Study Hub
        </h1>
        <p style={{ fontSize: 16.5, color: "var(--muted)", fontWeight: 600, margin: "6px 0 24px" }}>
          Grade 12 · Fall Semester 2026. Use your school account to pick up where you left off.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 11, alignItems: "stretch" }}>
          <GoogleButton onSignIn={onSignIn} dark={dark} />
          <MicrosoftButton />
        </div>

        <div className="auth-rule"><span>or</span></div>

        <form onSubmit={demoEmail} style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@middletown.edu"
            aria-label="School email"
            className="auth-input"
          />
          <button type="submit" className="auth-go">Continue</button>
        </form>
        <p style={{ fontSize: 13, color: "var(--muted-2)", fontWeight: 700, marginTop: 8, textAlign: "left" }}>
          Demo sign-in: no email is sent and nothing is verified.
        </p>

        <button
          className="auth-guest"
          onClick={() => onSignIn({ name: "Guest", email: "", picture: "", via: "Guest" })}
        >
          Look around as a guest
        </button>
      </div>
    </div>
  );
}

export function AccountChip({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  // Click-away and Escape, both of which people expect from a menu.
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const initial = (user.name || "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <button className="role-pill account-pill" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        {user.picture
          ? <img src={user.picture} alt="" width="26" height="26" style={{ borderRadius: "50%" }} referrerPolicy="no-referrer" />
          : <span className="avatar">{initial}</span>}
        <span className="nav-label">{user.name.split(" ")[0]}</span>
      </button>

      {open && (
        <div className="account-menu" role="menu">
          <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--text)" }}>{user.name}</div>
          {user.email && <div style={{ fontSize: 13.5, color: "var(--muted-2)", fontWeight: 600, wordBreak: "break-all" }}>{user.email}</div>}
          <div style={{ fontSize: 12.5, color: "var(--muted-2)", fontWeight: 700, marginTop: 2 }}>via {user.via}</div>
          <button className="account-signout" onClick={onSignOut} role="menuitem">Log out</button>
        </div>
      )}
    </div>
  );
}
