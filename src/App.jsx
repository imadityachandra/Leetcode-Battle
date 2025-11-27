import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Loader2, Zap, Trophy, Crown, Calendar, Clock, BarChart, Search, UserPlus, Trash2, Github, Sword, AlertTriangle } from 'lucide-react';

// --- Firebase Imports ---
// FIX 1: Import getApps and getApp to prevent duplicate initialization
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

/**
 * --- CONFIGURATION INSTRUCTIONS ---
 * Paste your firebaseConfig below as you did before.
 */
// Global variables
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// REPLACE THIS SECTION WHEN HOSTING LOCALLY
const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : {
      // Paste your actual Firebase Config keys here if running locally
      apiKey: "AIzaSyBxavKvL3A5jhjoY6hCQpHaxd1ZP26lUII",
      authDomain: "leetcode-battle.firebaseapp.com",
      projectId: "leetcode-battle",
      storageBucket: "leetcode-battle.firebasestorage.app",
      messagingSenderId: "523071405286",
      appId: "1:523071405286:web:7e45767fb5e3fb031fcf27",
      measurementId: "G-B47VPQVG2J"
    };

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- API Configuration ---
const API_BASE_URL = 'https://alfa-leetcode-api.onrender.com';

const App = () => {
  // --- Firebase State ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // --- App State ---
  const [newUsername, setNewUsername] = useState('');
  const [friendUsernames, setFriendUsernames] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appStatus, setAppStatus] = useState("Connecting..."); // Initial status is connecting

  // Time Filter State
  const [timeFilter, setTimeFilter] = useState('all');

  // Path Logic
  const FRIENDS_DOC_PATH = currentUserId
    ? (typeof __app_id !== 'undefined'
        ? `/artifacts/${appId}/users/${currentUserId}/friends/list`
        : `users/${currentUserId}/friends/list`)
    : null;

  // 1. Initialize Firebase (Non-blocking UI load)
  useEffect(() => {
    let timeoutId;

    if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
      try {
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
        const firestore = getFirestore(app);
        const authentication = getAuth(app);
        setDb(firestore);
        setAuth(authentication);
        setAppStatus("Authenticating...");

        // Use a shorter timeout to prompt error if auth is slow, but don't block.
        timeoutId = setTimeout(() => {
             setError(prev => prev || "Authentication is taking longer than expected. Proceeding with limited functionality.");
             setAppStatus("Limited connection");
        }, 5000); // 5 seconds

        const unsubscribe = onAuthStateChanged(authentication, async (user) => {
          clearTimeout(timeoutId);
          try {
            if (user) {
                setCurrentUserId(user.uid);
            } else if (initialAuthToken) {
                await signInWithCustomToken(authentication, initialAuthToken);
            } else {
                await signInAnonymously(authentication);
            }
            // Success
            setAppStatus("Ready to battle");
          } catch (err) {
            console.error("Auth Failure:", err);
            setError(`Authentication Failed: ${err.message}. (Did you enable Anonymous Auth in Firebase Console?)`);
            setAppStatus("Auth Failed");
          }
        });

        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
      } catch (e) {
        console.error("Firebase Init Error:", e);
        setError("Database connection failed. Check your config keys.");
        setAppStatus("Init Failed");
      }
    } else {
        setError("Firebase configuration is missing in the code.");
        setAppStatus("Config Missing");
    }

    return () => {
        if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // 2. Load Friends
  useEffect(() => {
    // Only proceed if db and currentUserId are available
    if (!db || !currentUserId || !FRIENDS_DOC_PATH) return;
    const docRef = doc(db, FRIENDS_DOC_PATH);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            setFriendUsernames(docSnap.data().usernames || []);
        } else {
            setFriendUsernames([]);
        }
    }, (err) => {
        console.error("Firestore Error:", err);
        // Don't block the UI for this, just log it
    });
    return () => unsubscribe();
  }, [db, currentUserId, FRIENDS_DOC_PATH]);

  // 3. Save Friends
  const saveFriendsList = useCallback(async (usernames) => {
    if (!db || !currentUserId) return;
    const docRef = doc(db, FRIENDS_DOC_PATH);
    try {
        await setDoc(docRef, { usernames: usernames });
        setFriendUsernames(usernames);
    } catch (e) {
        setError("Failed to save friend list.");
    }
  }, [db, currentUserId, FRIENDS_DOC_PATH]);

  // --- Logic Helpers ---
  const fetchWithRetry = useCallback(async (url) => {
    let retries = 0;
    while (retries < 3) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (e) {
            retries++;
            if (retries >= 3) throw e;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries - 1)));
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

    const dailySolvedSet = new Set();
    const weeklySolvedSet = new Set();

    submissions.forEach(sub => {
        if (sub.statusDisplay !== 'Accepted') return;
        const timestamp = parseInt(sub.timestamp);
        if (timestamp >= todayStart) dailySolvedSet.add(sub.title);
        if (timestamp >= (now - oneWeekSeconds)) weeklySolvedSet.add(sub.title);
    });

    return { daily: dailySolvedSet.size, weekly: weeklySolvedSet.size };
  };

  // 4. Fetch All User Data
  const fetchAllUsersData = useCallback(async () => {
    // Only fetch if we have a user ID (meaning auth succeeded)
    if (!currentUserId || friendUsernames.length === 0) {
      setLeaderboardData([]);
      if (currentUserId) setAppStatus("Add usernames to start");
      return;
    }

    setLoading(true);
    setAppStatus(`Scouting ${friendUsernames.length} fighters...`);

    const promises = friendUsernames.map(async (user) => {
        try {
            const [profileData, solvedData, submissionData] = await Promise.all([
                fetchWithRetry(`${API_BASE_URL}/${user}`),
                fetchWithRetry(`${API_BASE_URL}/${user}/solved`),
                fetchWithRetry(`${API_BASE_URL}/${user}/submission?limit=50`)
            ]);

            if (profileData.errors || solvedData.errors) return { username: user, error: "User not found" };

            const { daily, weekly } = processRecentSubmissions(submissionData);

            return {
                username: user,
                avatar: profileData.avatar,
                stats: {
                  easy: solvedData.easySolved || 0,
                  medium: solvedData.mediumSolved || 0,
                  hard: solvedData.hardSolved || 0
                },
                counts: {
                    all: solvedData.solvedProblem || 0,
                    weekly: weekly,
                    daily: daily
                }
            };
        } catch (e) {
            return { username: user, error: "Fetch failed" };
        }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter(r => !r.error);

    setLeaderboardData(validResults);
    setLoading(false);
    setAppStatus(`Battle Updated`);
    if (results.some(r => r.error)) setError("Some users were unreachable.");

  }, [friendUsernames, fetchWithRetry, currentUserId]);

  useEffect(() => {
    // Run fetch data when friend list or user ID changes
    if (db && currentUserId) fetchAllUsersData();
  }, [friendUsernames, db, currentUserId, fetchAllUsersData]);

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboardData].sort((a, b) => {
        const countA = a.counts[timeFilter];
        const countB = b.counts[timeFilter];
        if (countB !== countA) return countB - countA;
        return b.counts.all - a.counts.all;
    });
  }, [leaderboardData, timeFilter]);

  // --- Components ---

  const StatBadge = ({ label, count, colorClass }) => (
    // Increased opacity for better contrast on dark theme, now also good on light theme
    <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-md ${colorClass} bg-opacity-20 border border-opacity-50 border-current`}>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
      <span className="text-xs font-bold">{count}</span>
    </div>
  );

  const FilterTab = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setTimeFilter(id)}
      className={`relative flex items-center justify-center space-x-2 px-6 py-2.5 rounded-full font-semibold transition-all duration-300 ${
        timeFilter === id
        ? 'text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] bg-gradient-to-r from-blue-600 to-indigo-600 scale-105'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200' // LIGHT THEME: Changed text and hover background
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {timeFilter === id && (
        <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-blue-500 blur-[2px]"></span> // Adjusted blue-400 to blue-500
      )}
    </button>
  );

  const LeaderboardRow = ({ user, rank }) => {
    const count = user.counts[timeFilter];

    // Rank Styling
    // LIGHT THEME: Changed default background and border colors
    let rankStyles = "border-gray-300/50 bg-white/70";
    let textGlow = "";
    let medal = null;

    if (rank === 1) {
      rankStyles = "border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-white shadow-[0_0_30px_rgba(234,179,8,0.1)]";
      textGlow = "drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]";
      medal = <Crown className="h-6 w-6 text-yellow-400 fill-yellow-400 animate-pulse" />;
    } else if (rank === 2) {
      // Used brighter blue gradient and border for better contrast
      rankStyles = "border-blue-400/50 bg-gradient-to-r from-blue-400/10 to-white";
      medal = <Trophy className="h-5 w-5 text-blue-500" />;
    } else if (rank === 3) {
      // Used emerald gradient and border for better contrast
      rankStyles = "border-emerald-400/50 bg-gradient-to-r from-emerald-400/10 to-white";
      medal = <Trophy className="h-5 w-5 text-emerald-500" />;
    }

    return (
      <div className={`group relative flex items-center p-4 rounded-2xl border backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:bg-gray-200/80 ${rankStyles} mb-4`}>
        {/* Rank Number */}
        <div className="w-12 flex flex-col items-center justify-center mr-4 flex-shrink-0">
          {medal}
          {/* LIGHT THEME: Changed text-slate-500 to text-gray-500 */}
          <span className={`text-2xl font-black ${rank === 1 ? 'text-yellow-600' : 'text-gray-500'} ${textGlow}`}>
            #{rank}
          </span>
        </div>

        {/* User Info */}
        <div className="flex items-center flex-grow min-w-0">
          <div className="relative">
            <img
              // LIGHT THEME: Changed placeholder background to a brighter one
              src={user.avatar || `https://placehold.co/100x100/e0e0e0/000000?text=${user.username.charAt(0)}`}
              alt="avatar"
              className={`w-14 h-14 rounded-full object-cover border-2 shadow-lg ${rank === 1 ? 'border-yellow-500' : 'border-gray-300'}`}
            />
            {rank === 1 && <div className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)]"></div>}
          </div>

          <div className="ml-4 min-w-0">
            {/* LIGHT THEME: Changed text-white to text-gray-900 */}
            <h3 className={`text-lg font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors ${rank === 1 ? 'text-xl' : ''}`}>
                {user.username}
            </h3>
            <div className="flex space-x-2 mt-1.5">
                <StatBadge label="Easy" count={user.stats.easy} colorClass="text-emerald-600 bg-emerald-600 border-emerald-500" />
                <StatBadge label="Med" count={user.stats.medium} colorClass="text-amber-600 bg-amber-600 border-amber-500" />
                <StatBadge label="Hard" count={user.stats.hard} colorClass="text-rose-600 bg-rose-600 border-rose-500" />
            </div>
          </div>
        </div>

        {/* Score Metric */}
        {/* LIGHT THEME: Changed border color */}
        <div className="text-right flex-shrink-0 ml-4 pl-4 border-l border-gray-300/50">
          {/* LIGHT THEME: Changed text-slate-400 to text-gray-500 */}
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-1">
            {timeFilter === 'all' ? 'Total Solved' : 'Solved'}
          </p>
          <p className={`text-4xl font-black tabular-nums tracking-tight ${
              timeFilter === 'daily' ? 'text-emerald-600' :
              timeFilter === 'weekly' ? 'text-blue-600' : 'text-purple-600'
          } ${rank === 1 ? 'drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]' : ''}`}>
            {count}
          </p>
        </div>
      </div>
    );
  };

  return (
    // LIGHT THEME: Changed main background and text colors
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans selection:bg-blue-500 selection:text-white relative overflow-x-hidden">

      {/* Background Ambience (Reduced intensity for light theme) */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div className="relative">
             <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
                    <Sword className="h-8 w-8 text-white transform -rotate-45" />
                </div>
                {/* LIGHT THEME: Changed gradient text to dark gray */}
                <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">
                    LEETCODE <span className="text-blue-600">BATTLE</span>
                </h1>
             </div>
             {/* LIGHT THEME: Changed text-slate-400 to text-gray-600 */}
             <p className="text-gray-600 font-medium flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${loading || appStatus.includes("Connect") || appStatus.includes("Auth") ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                {appStatus}
             </p>
          </div>

          {/* Time Filter Tabs */}
          {/* LIGHT THEME: Changed dark background and border */}
          <div className="bg-gray-200/80 backdrop-blur-md p-1.5 rounded-full border border-gray-300/80 flex shadow-lg">
              <FilterTab id="daily" label="Daily" icon={Clock} />
              <FilterTab id="weekly" label="Weekly" icon={Calendar} />
              <FilterTab id="all" label="All Time" icon={BarChart} />
          </div>
        </header>

        {error && (
            <div className="mb-8 relative z-20 bg-red-500/10 border border-red-500/50 p-4 rounded-xl max-w-full backdrop-blur-md shadow-xl">
                <div className="flex items-center space-x-2 text-red-600">
                   <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                   <p className="text-sm font-medium">{error}</p>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Sidebar: Squad Management */}
          <div className="lg:col-span-4 space-y-6">
              {/* LIGHT THEME: Changed background and border */}
              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-gray-300/80 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[50px] group-hover:bg-blue-500/20 transition-all"></div>

                  {/* LIGHT THEME: Changed text to dark */}
                  <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                      <UserPlus className="h-5 w-5 mr-3 text-blue-600" />
                      Manage Squad
                  </h2>

                  <form onSubmit={(e) => {
                      e.preventDefault();
                      const u = newUsername.trim();
                      if(u && !friendUsernames.includes(u)) {
                          saveFriendsList([...friendUsernames, u]);
                          setNewUsername('');
                      }
                  }} className="relative mb-6">
                      {/* LIGHT THEME: Changed icon color */}
                      <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-500" />
                      <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Enter username..."
                          // LIGHT THEME: Changed background, border, text, and placeholder colors
                          className="w-full pl-12 pr-12 py-3 bg-white/70 border border-gray-400 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-800 placeholder-gray-500 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={!newUsername.trim()}
                        className="absolute right-2 top-2 p-1.5 bg-blue-600 rounded-lg text-white hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                      >
                          <UserPlus className="h-4 w-4" />
                      </button>
                  </form>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {/* LIGHT THEME: Changed text color */}
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                        Tracking {friendUsernames.length} Fighters
                      </div>
                      {friendUsernames.length === 0 ? (
                        // LIGHT THEME: Changed border and text colors
                        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-xl">
                            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            No opponents yet
                        </div>
                      ) : (
                        friendUsernames.map(u => (
                            // LIGHT THEME: Changed background, border, text, and hover classes
                            <div key={u} className="flex justify-between items-center bg-gray-200/80 p-3 px-4 rounded-xl border border-gray-300/50 hover:border-gray-400 hover:bg-gray-200/90 transition-all group/item">
                                <span className="font-medium text-gray-700">{u}</span>
                                {/* LIGHT THEME: Changed icon color */}
                                <button
                                    onClick={() => saveFriendsList(friendUsernames.filter(n => n !== u))}
                                    className="text-gray-500 hover:text-red-600 opacity-0 group-hover/item:opacity-100 transition-all"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))
                      )}
                  </div>
              </div>
          </div>

          {/* Main: Leaderboard */}
          <div className="lg:col-span-8">
              {loading ? (
                  // LIGHT THEME: Changed background and border colors
                  <div className="flex flex-col items-center justify-center h-96 bg-white/60 rounded-3xl border border-gray-300 border-dashed animate-pulse">
                      <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-4" />
                      <span className="text-gray-600 font-medium">Syncing Battle Data...</span>
                  </div>
              ) : (
                  <div className="space-y-1">
                      {sortedLeaderboard.length > 0 ? (
                          sortedLeaderboard.map((user, idx) => (
                              <LeaderboardRow key={user.username} user={user} rank={idx + 1} />
                          ))
                      ) : (
                          // LIGHT THEME: Changed background and border colors
                          <div className="flex flex-col items-center justify-center py-20 bg-white/60 backdrop-blur-sm rounded-3xl border border-gray-300 border-dashed">
                              <div className="p-4 bg-gray-200 rounded-full mb-4">
                                <Trophy className="h-12 w-12 text-gray-400" />
                              </div>
                              <h3 className="text-xl font-bold text-gray-700 mb-1">Leaderboard Empty</h3>
                              <p className="text-gray-500">Add usernames to start the simulation.</p>
                          </div>
                      )}
                  </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;