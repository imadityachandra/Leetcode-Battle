// App.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Zap,
  Trophy,
  Crown,
  Calendar,
  Clock,
  BarChart,
  Search,
  UserPlus,
  Trash2,
  Github,
  Sword,
  AlertTriangle,
  SunMoon,
  Share2,
  Settings,
  Volume2
} from "lucide-react";

// Firebase (avoid duplicate init)
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

/**
 * ========== CONFIGURATION ==========
 * Replace firebaseConfig below if running locally.
 */
const firebaseConfig = typeof __firebase_config !== "undefined"
  ? JSON.parse(__firebase_config)
  : {
      apiKey: "AIzaSyBxavKvL3A5jhjoY6hCQpHaxd1ZP26lUII",
      authDomain: "leetcode-battle.firebaseapp.com",
      projectId: "leetcode-battle",
      storageBucket: "leetcode-battle.firebasestorage.app",
      messagingSenderId: "523071405286",
      appId: "1:523071405286:web:7e45767fb5e3fb031fcf27",
      measurementId: "G-B47VPQVG2J"
    };

const initialAuthToken = typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;
const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";
const API_BASE_URL = "https://alfa-leetcode-api.onrender.com";

/* ---------------------------
   Small visual helper: micro burst
   (dependency-free)
   --------------------------- */
const burstMicro = (container, count = 8) => {
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "micro-burst";
    el.style.left = `${20 + Math.random() * 60}%`;
    el.style.top = `${10 + Math.random() * 20}%`;
    el.textContent = ["✨", "✓", "🏆"][Math.floor(Math.random() * 3)];
    container.appendChild(el);
    setTimeout(() => el.remove(), 900 + Math.random() * 800);
  }
};

/* ---------------------------
   App Component
   --------------------------- */
export default function App() {
  // Firebase state
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // App state
  const [newUsername, setNewUsername] = useState("");
  const [friendUsernames, setFriendUsernames] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appStatus, setAppStatus] = useState("Connecting...");
  const [timeFilter, setTimeFilter] = useState("all");
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("soundOn") === "1");

  // Firestore doc path (keeps compatibility)
  const FRIENDS_DOC_PATH = currentUserId
    ? (typeof __app_id !== "undefined"
        ? `/artifacts/${appId}/users/${currentUserId}/friends/list`
        : `users/${currentUserId}/friends/list`)
    : null;

  /* ---------------------------
     Firebase Initialization
     --------------------------- */
  useEffect(() => {
    try {
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      const firestore = getFirestore(app);
      const authentication = getAuth(app);
      setDb(firestore);
      setAuth(authentication);
      setAppStatus("Authenticating...");
      const timeout = setTimeout(() => {
        setError(prev => prev || "Authentication is taking longer than expected. Proceeding with limited features.");
        setAppStatus("Limited connection");
      }, 4500);
      const unsub = onAuthStateChanged(authentication, async (user) => {
        clearTimeout(timeout);
        try {
          if (user) {
            setCurrentUserId(user.uid);
          } else if (initialAuthToken) {
            await signInWithCustomToken(authentication, initialAuthToken);
          } else {
            await signInAnonymously(authentication);
          }
          setAppStatus("Ready to battle");
        } catch (e) {
          console.error("Auth failure", e);
          setError("Authentication failed. Check Firebase config / console (anonymous auth).");
          setAppStatus("Auth Failed");
        }
      });
      return () => unsub();
    } catch (e) {
      console.error("Firebase init error", e);
      setError("Firebase initialization error. Check config.");
      setAppStatus("Init Failed");
    }
  }, []);

  /* ---------------------------
     Load and save friends list
     --------------------------- */
  useEffect(() => {
    if (!db || !currentUserId || !FRIENDS_DOC_PATH) return;
    const docRef = doc(db, FRIENDS_DOC_PATH);
    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) {
        setFriendUsernames([]);
        return;
      }
      const data = snap.data();
      setFriendUsernames(data?.usernames || []);
    }, (err) => {
      console.error("Firestore snapshot error", err);
    });
    return () => unsub();
  }, [db, currentUserId, FRIENDS_DOC_PATH]);

  const saveFriendsList = useCallback(async (usernames) => {
    if (!db || !currentUserId || !FRIENDS_DOC_PATH) {
      // fallback to localStorage for offline/dev
      localStorage.setItem("lb_friends", JSON.stringify(usernames));
      setFriendUsernames(usernames);
      return;
    }
    try {
      await setDoc(doc(db, FRIENDS_DOC_PATH), { usernames });
      setFriendUsernames(usernames);
    } catch (e) {
      console.error("saveFriendsList error:", e);
      setError("Failed to save friend list.");
    }
  }, [db, currentUserId, FRIENDS_DOC_PATH]);

  /* ---------------------------
     Fetch helpers
     --------------------------- */
  const fetchWithRetry = useCallback(async (url) => {
    let tries = 0;
    while (tries < 3) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        tries++;
        if (tries >= 3) throw e;
        await new Promise(r => setTimeout(r, 400 * Math.pow(2, tries)));
      }
    }
  }, []);

  const processRecentSubmissions = (submissionResponse) => {
    const submissions = Array.isArray(submissionResponse)
      ? submissionResponse
      : (submissionResponse?.submission || []);
    const now = Math.floor(Date.now() / 1000);
    const oneDaySeconds = 86400;
    const oneWeekSeconds = oneDaySeconds * 7;
    const todayStart = now - (now % oneDaySeconds);
    const dailySet = new Set();
    const weeklySet = new Set();
    submissions.forEach(sub => {
      if (sub.statusDisplay !== "Accepted") return;
      const ts = parseInt(sub.timestamp || "0", 10);
      if (ts >= todayStart) dailySet.add(sub.title);
      if (ts >= now - oneWeekSeconds) weeklySet.add(sub.title);
    });
    return { daily: dailySet.size, weekly: weeklySet.size };
  };

  /* ---------------------------
     Fetch leaderboard data
     --------------------------- */
  const fetchAllUsersData = useCallback(async () => {
    if (!currentUserId) {
      setLeaderboardData([]);
      if (friendUsernames.length === 0) setAppStatus("Add usernames to start");
      return;
    }
    if (friendUsernames.length === 0) {
      setLeaderboardData([]);
      setAppStatus("No fighters");
      return;
    }
    setLoading(true);
    setAppStatus(`Scanning ${friendUsernames.length} fighters...`);

    const promises = friendUsernames.map(async (user) => {
      try {
        const [profile, solved, submission] = await Promise.all([
          fetchWithRetry(`${API_BASE_URL}/${user}`),
          fetchWithRetry(`${API_BASE_URL}/${user}/solved`),
          fetchWithRetry(`${API_BASE_URL}/${user}/submission?limit=50`)
        ]);
        if (profile?.errors || solved?.errors) return { username: user, error: true };
        const { daily, weekly } = processRecentSubmissions(submission);
        return {
          username: user,
          avatar: profile.avatar,
          stats: {
            easy: solved.easySolved || 0,
            medium: solved.mediumSolved || 0,
            hard: solved.hardSolved || 0
          },
          counts: {
            all: solved.solvedProblem || 0,
            weekly,
            daily
          }
        };
      } catch (e) {
        console.error("User fetch failed:", user, e);
        return { username: user, error: true };
      }
    });

    try {
      const results = await Promise.all(promises);
      const valid = results.filter(r => !r.error);
      setLeaderboardData(valid);
      setError(results.some(r => r.error) ? "Some users unreachable" : null);
      setAppStatus("Battle updated");
    } catch (e) {
      console.error("fetchAllUsersData error:", e);
      setError("Failed to update leaderboard");
    } finally {
      setLoading(false);
    }
  }, [friendUsernames, currentUserId, fetchWithRetry]);

  useEffect(() => {
    if (db && currentUserId) fetchAllUsersData();
  }, [friendUsernames, db, currentUserId, fetchAllUsersData]);

  /* ---------------------------
     Sorting
     --------------------------- */
  const sortedLeaderboard = useMemo(() => {
    return [...leaderboardData].sort((a, b) => {
      const x = (b.counts?.[timeFilter] || 0) - (a.counts?.[timeFilter] || 0);
      if (x !== 0) return x;
      return (b.counts?.all || 0) - (a.counts?.all || 0);
    });
  }, [leaderboardData, timeFilter]);

  /* ---------------------------
     Tiny sound helper
     --------------------------- */
  const playBeep = useCallback(() => {
    if (!soundOn) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.01;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 80);
    } catch (e) { /* ignore */ }
  }, [soundOn]);

  /* ---------------------------
     Add / remove friends
     --------------------------- */
  const handleAddFriend = (e) => {
    e?.preventDefault();
    const u = newUsername.trim();
    if (!u) return;
    if (friendUsernames.includes(u)) {
      setError(`${u} is already in your squad.`);
      setTimeout(() => setError(null), 2200);
      return;
    }
    const next = [...friendUsernames, u];
    saveFriendsList(next);
    setNewUsername("");
    playBeep();
    const container = document.getElementById("burst-root");
    burstMicro(container, 10);
  };

  const removeFriend = (u) => {
    saveFriendsList(friendUsernames.filter(x => x !== u));
    playBeep();
  };

  useEffect(() => {
    localStorage.setItem("soundOn", soundOn ? "1" : "0");
  }, [soundOn]);

  /* ---------------------------
     UI small components
     --------------------------- */
  const StatPill = ({ label, value, colorClass }) => (
    <div className={`stat-pill ${colorClass || "pill-sky"}`}>
      <span className="pill-label">{label}</span>
      <span className="pill-value">{value}</span>
    </div>
  );

  const LeaderboardRow = ({ user, rank }) => {
    const count = user?.counts?.[timeFilter] || 0;
    const total = user?.counts?.all || 0;
    const topTotal = Math.max(1, (sortedLeaderboard[0]?.counts?.all || 1));
    const pct = Math.round((total / topTotal) * 100);

    return (
      <div className="leader-row">
        <div className="leader-left">
          <div className={`avatar ${rank === 1 ? "avatar-top" : "avatar-default"}`}>
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="leader-meta">
            <div className="leader-name">
              <span className="username">{user.username}</span>
              {rank === 1 && <Crown className="crown-icon" />}
            </div>
            <div className="lead-sub">Total solved: <strong>{total}</strong></div>
            <div className="lead-pills">
              <StatPill label="Easy" value={user.stats.easy} colorClass="pill-green" />
              <StatPill label="Med" value={user.stats.medium} colorClass="pill-amber" />
              <StatPill label="Hard" value={user.stats.hard} colorClass="pill-rose" />
            </div>
          </div>
        </div>

        <div className="leader-progress">
          <div className="progress-track" aria-hidden>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="leader-right">
          <div className="solved-label">Solved</div>
          <div className="solved-number">{count}</div>

          <div className="leader-actions">
            <button
              className="btn-outline"
              onClick={() => { navigator.clipboard?.writeText(`${window.location.href}?watch=${user.username}`); playBeep(); }}
            >
              <Share2 className="icon" /> Share
            </button>
            <button className="btn-danger" onClick={() => removeFriend(user.username)} title="Remove friend">
              <Trash2 className="icon" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleRefresh = () => {
    fetchAllUsersData();
    playBeep();
  };

  /* ---------------------------
     Render
     --------------------------- */
  return (
    <div className="app-root">
      {/* scoped styles */}
      <style>{`
        :root{
          --bg: #ffffff;
          --muted: #6b7280;
          --card: #ffffff;
          --border: #e6e7eb;
          --sky-50: #ecfeff;
          --sky-600: #0284c7;
          --emerald-50: #ecfdf5;
          --amber-50: #fff7ed;
          --rose-50: #fff1f2;
          --shadow: 0 8px 20px rgba(16,24,40,0.06);
          --radius: 14px;
          --radius-sm: 10px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
        }

        * { box-sizing: border-box; }
        body, html, #root { height: 100%; margin: 0; background: var(--bg); color: #111827; }

        .app-root { min-height: 100vh; padding: 28px; background: var(--bg); }

        .container { max-width: 1080px; margin: 0 auto; }

        /* header */
        .header { display:flex; flex-wrap:wrap; justify-content:space-between; gap:16px; align-items:center; margin-bottom: 22px; }
        .brand { display:flex; gap:12px; align-items:center; }
        .brand-badge { width:56px; height:56px; border-radius:12px; background: linear-gradient(180deg, #f0f9ff, #e6f6ff); display:flex; align-items:center; justify-content:center; box-shadow: var(--shadow); border:1px solid var(--border); }
        .title { font-size:28px; font-weight:800; line-height:1; }
        .title .accent { color: var(--sky-600); }

        .status { color: var(--muted); font-size:14px; margin-top:4px; }

        /* controls */
        .controls { display:flex; gap:8px; align-items:center; }

        .segmented { display:flex; gap:8px; background:#fff; padding:4px; border-radius:999px; border:1px solid var(--border); box-shadow: 0 4px 14px rgba(14,20,30,0.03); }
        .segmented button { border:0; background:transparent; padding:10px 14px; border-radius:999px; cursor:pointer; font-weight:600; color:#374151; display:flex; gap:8px; align-items:center; }
        .segmented button.active { background: linear-gradient(90deg,#f0f9ff,#f3f0ff); box-shadow: 0 4px 10px rgba(16,24,40,0.04); color: #062f4f; }

        .icon-btn { border:0; background:#fff; padding:8px; border-radius:10px; box-shadow: var(--shadow); border:1px solid var(--border); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
        .icon-btn:active { transform: translateY(1px); }

        /* grid */
        .grid { display:grid; grid-template-columns: 1fr; gap:20px; }
        @media(min-width: 980px){ .grid { grid-template-columns: 360px 1fr; } }

        /* left panel */
        .card { background: var(--card); border:1px solid var(--border); border-radius: var(--radius); padding:18px; box-shadow: var(--shadow); }
        .card h3 { margin:0 0 6px 0; font-size:18px; }
        .muted { color: var(--muted); font-size:13px; }

        .add-form { position:relative; margin-top:12px; }
        .add-form input { width:100%; padding:12px 110px 12px 44px; border-radius:12px; border:1px solid var(--border); background:#fbfdff; font-size:14px; }
        .input-icon { position:absolute; left:12px; top: 12px; color: var(--muted); }
        .add-btn { position:absolute; right:8px; top:8px; height:40px; padding:0 12px; border-radius:10px; border:0; background: linear-gradient(90deg,#06b6d4,#7c3aed); color:white; font-weight:700; cursor:pointer; box-shadow: 0 8px 20px rgba(124,58,237,0.12); }

        .friend-list { margin-top:14px; display:flex; flex-direction:column; gap:10px; max-height: 52vh; overflow:auto; padding-right:6px; }
        .friend-item { display:flex; justify-content:space-between; align-items:center; padding:10px; border-radius:12px; border:1px solid var(--border); background: #fff; }
        .friend-left { display:flex; gap:12px; align-items:center; }
        .avatar-small { width:40px; height:40px; border-radius:10px; background:#ecfeff; color:#0369a1; display:flex; align-items:center; justify-content:center; font-weight:700; }
        .friend-name { font-weight:700; }
        .friend-sub { font-size:12px; color:var(--muted); }

        .small-actions { display:flex; gap:8px; }

        .mini { font-size:12px; color:var(--muted); }

        /* stats card */
        .stats { display:flex; gap:10px; align-items:center; justify-content:space-between; margin-top:12px; }
        .stats-left { font-size:13px; color:var(--muted); }
        .stats-num { font-weight:800; font-size:18px; }

        /* leaderboard */
        .leaderboard { display:flex; flex-direction:column; gap:12px; }
        .leader-row { display:flex; gap:16px; align-items:center; padding:14px; border-radius:12px; background:#fff; border:1px solid var(--border); box-shadow: 0 6px 18px rgba(17,24,39,0.04); transition: transform .16s ease, box-shadow .16s ease; }
        .leader-row:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(17,24,39,0.06); }

        .leader-left { display:flex; gap:12px; align-items:center; width:320px; min-width:220px; }
        .avatar { width:56px; height:56px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:white; font-weight:800; font-size:20px; }
        .avatar-default { background: linear-gradient(180deg,#60a5fa,#7c3aed); }
        .avatar-top { background: linear-gradient(180deg,#f59e0b,#fb923c); }

        .leader-meta { min-width:0; }
        .leader-name { display:flex; align-items:center; gap:8px; }
        .username { font-weight:800; font-size:16px; }
        .crown-icon { color:#d97706; }

        .lead-sub { font-size:13px; color:var(--muted); margin-top:4px; }
        .lead-pills { margin-top:8px; display:flex; gap:8px; }

        .stat-pill { display:inline-flex; gap:8px; align-items:center; padding:6px 10px; border-radius:999px; font-weight:700; font-size:12px; }
        .pill-sky { background: var(--sky-50); color:#0369a1; }
        .pill-green { background: var(--emerald-50); color:#065f46; }
        .pill-amber { background: var(--amber-50); color:#92400e; }
        .pill-rose { background: var(--rose-50); color:#9f1239; }
        .pill-label { text-transform:uppercase; opacity:0.8; font-size:11px; }
        .pill-value { font-weight:900; }

        .leader-progress { flex:1; margin-left:8px; margin-right:8px; }
        .progress-track { height:10px; background:#f3f4f6; border-radius:999px; overflow:hidden; }
        .progress-fill { height:100%; background: linear-gradient(90deg,#60a5fa,#7c3aed); transition: width .7s ease; }

        .leader-right { width:120px; display:flex; flex-direction:column; align-items:flex-end; gap:10px; }
        .solved-label { font-size:11px; color:var(--muted); text-transform:uppercase; }
        .solved-number { font-weight:900; font-size:26px; }

        .leader-actions { display:flex; gap:8px; margin-top:6px; }
        .btn-outline { border:1px solid var(--border); background:#fff; padding:8px 10px; border-radius:8px; cursor:pointer; display:inline-flex; gap:8px; align-items:center; }
        .btn-danger { border:0; background: transparent; color:#ef4444; padding:8px; border-radius:8px; cursor:pointer; }

        .icon { width:16px; height:16px; }

        /* loading placeholder */
        .placeholder { background:#f8fafc; border-radius:12px; height:86px; border:1px solid var(--border); }

        /* footer actions */
        .footer { display:flex; justify-content:space-between; align-items:center; margin-top:16px; color:var(--muted); }

        /* error toast */
        .toast { position:fixed; right:20px; bottom:20px; background: #fff9f9; color:#b91c1c; border:1px solid #fee2e2; padding:10px 14px; border-radius:12px; box-shadow: 0 8px 30px rgba(17,24,39,0.06); }

        /* micro burst */
        .micro-burst { position:absolute; font-size:16px; transform: translateY(0); animation: micro-fall .9s linear forwards; opacity:0.95; }
        @keyframes micro-fall { 0% { transform: translateY(-6px) rotate(0deg); opacity:1 } 100% { transform: translateY(40px) rotate(14deg); opacity:0 } }

        /* responsive tweaks */
        @media(max-width: 640px) {
          .header { flex-direction:column; align-items:flex-start; gap:10px; }
          .leader-left { width:100%; min-width:100px; }
          .leader-right { width:86px; }
          .add-form input { padding-right:96px; }
        }
      `}</style>

      <div className="container">
        {/* header */}
        <div className="header">
          <div className="brand">
            <div className="brand-badge"><Sword className="icon" /></div>
            <div>
              <div className="title">LeetCode <span className="accent">Battle</span></div>
              <div className="status">{appStatus}</div>
            </div>
          </div>

          <div className="controls">
            <div className="segmented" role="tablist" aria-label="time filter">
              <button className={timeFilter === "daily" ? "active" : ""} onClick={() => { setTimeFilter("daily"); playBeep(); }} title="Daily"><Clock className="icon" /> Daily</button>
              <button className={timeFilter === "weekly" ? "active" : ""} onClick={() => { setTimeFilter("weekly"); playBeep(); }} title="Weekly"><Calendar className="icon" /> Weekly</button>
              <button className={timeFilter === "all" ? "active" : ""} onClick={() => { setTimeFilter("all"); playBeep(); }} title="All"><BarChart className="icon" /> All</button>
            </div>

            <button className="icon-btn" onClick={handleRefresh} title="Refresh"><Loader2 className="icon" /></button>
            <button className="icon-btn" onClick={() => { setSoundOn(s => !s); playBeep(); }} title="Toggle sound"><Volume2 className="icon" /></button>
            <button className="icon-btn" onClick={() => alert("Settings coming soon")} title="Settings"><Settings className="icon" /></button>
          </div>
        </div>

        {/* layout grid */}
        <div className="grid">
          {/* left panel */}
          <div>
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3>Manage Squad</h3>
                  <div className="muted">Add friends to track</div>
                </div>
                <div className="mini" aria-hidden><Zap className="icon" /> {friendUsernames.length}</div>
              </div>

              <form className="add-form" onSubmit={handleAddFriend}>
                <Search className="input-icon" />
                <input
                  placeholder="Enter Leet username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
                <button type="submit" className="add-btn"><UserPlus className="icon" /></button>
              </form>

              <div className="friend-list" role="list">
                {friendUsernames.length === 0 ? (
                  <div className="friend-item" style={{ justifyContent: "center", textAlign: "center", borderStyle: "dashed" }}>
                    <div>
                      <Zap className="icon" />
                      <div style={{ marginTop: 8, fontWeight: 700 }}>No opponents yet</div>
                      <div className="muted" style={{ marginTop:4 }}>Add usernames to begin</div>
                    </div>
                  </div>
                ) : friendUsernames.map(u => (
                  <div className="friend-item" key={u}>
                    <div className="friend-left">
                      <div className="avatar-small">{u.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="friend-name">{u}</div>
                        <div className="friend-sub">Tap to remove</div>
                      </div>
                    </div>
                    <div className="small-actions">
                      <button className="icon-btn" onClick={() => { navigator.clipboard?.writeText(`${window.location.href}?watch=${u}`); playBeep(); }} title="Share">
                        <Share2 className="icon" />
                      </button>
                      <button className="icon-btn" onClick={() => removeFriend(u)} title="Remove">
                        <Trash2 className="icon" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="stats" style={{ marginTop:16 }}>
                <div>
                  <div className="stats-left">Auto-sync</div>
                </div>
                <div>
                  <div className="stats-num">{leaderboardData.reduce((a,b) => a + (b.counts?.all || 0), 0)} total solves</div>
                </div>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div className="muted">Quick Actions</div>
                  <div style={{ marginTop:6 }}>
                    <button className="btn-outline" onClick={() => { fetchAllUsersData(); playBeep(); }}>Sync Now</button>
                  </div>
                </div>
                <div>
                  <a className="icon-btn" href="https://github.com" target="_blank" rel="noreferrer"><Github className="icon" /></a>
                </div>
              </div>
            </div>
          </div>

          {/* main leaderboard */}
          <div>
            <div className="card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <Trophy className="icon" style={{ color:"#b45309" }} />
                  <div>
                    <div className="muted">Leaderboard</div>
                    <div style={{ fontWeight:800, fontSize:18 }}>Combat Rankings</div>
                  </div>
                </div>
                <div className="muted" style={{ fontSize:13 }}>Filter: <strong style={{ marginLeft:8, textTransform:"uppercase" }}>{timeFilter}</strong></div>
              </div>

              <div className="leaderboard">
                {loading ? (
                  [1,2,3,4].map(i => <div className="placeholder" key={i} />)
                ) : (sortedLeaderboard.length > 0 ? (
                  sortedLeaderboard.map((u, i) => <LeaderboardRow key={u.username} user={u} rank={i+1} />)
                ) : (
                  <div style={{ textAlign:"center", padding:28 }}>
                    <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:80, height:80, borderRadius:20, background:"#f8fafc", margin:"0 auto 12px" }}>
                      <Trophy className="icon" style={{ color:"#b45309" }} />
                    </div>
                    <div style={{ fontWeight:800, fontSize:16 }}>Leaderboard Empty</div>
                    <div className="muted" style={{ marginTop:8 }}>Add friends to populate the leaderboard.</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="footer">
              <div className="muted">Made with care • soft card UI</div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn-outline" onClick={() => { navigator.clipboard?.writeText(window.location.href); playBeep(); }}>Share Room</button>
                <a className="btn-outline" href="https://github.com" target="_blank" rel="noreferrer"><Github className="icon" /> Repo</a>
                <button className="btn-outline" onClick={() => alert("Settings coming soon")}><Settings className="icon" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="burst-root" style={{ position:"absolute", inset:0, pointerEvents:"none" }} />

      {error && (
        <div className="toast">
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <AlertTriangle className="icon" />
            <div>{error}</div>
            <button onClick={() => setError(null)} style={{ marginLeft:8, border:0, background:"transparent", color:"#6b7280", cursor:"pointer" }}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}
