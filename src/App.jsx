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
  const [isAuthReady, setIsAuthReady] = useState(false);

  // --- App State ---
  const [newUsername, setNewUsername] = useState('');
  const [friendUsernames, setFriendUsernames] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appStatus, setAppStatus] = useState("Ready to battle");

  // Time Filter State
  const [timeFilter, setTimeFilter] = useState('all');

  // Path Logic
  const FRIENDS_DOC_PATH = currentUserId
    ? (typeof __app_id !== 'undefined'
        ? `/artifacts/${appId}/users/${currentUserId}/friends/list`
        : `users/${currentUserId}/friends/list`)
    : null;

  // 1. Initialize Firebase
  useEffect(() => {
    if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
      try {
        // FIX 2: Check if app is already initialized.
        // If length === 0, create it. If not, get the existing one.
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

        const firestore = getFirestore(app);
        const authentication = getAuth(app);
        setDb(firestore);
        setAuth(authentication);

        // Add a timeout to warn if Auth takes too long
        const timeoutId = setTimeout(() => {
             // FIX: Force exit the loading state if timeout fires to prevent user from being stuck
             if (!isAuthReady) {
                 setError("Connection timed out. Please check your internet or Firebase Config. The app will proceed with an empty leaderboard.");
                 setIsAuthReady(true);
             }
        }, 10000);

        const unsubscribe = onAuthStateChanged(authentication, async (user) => {
          clearTimeout(timeoutId); // Clear timeout on response
          try {
            if (user) {
                setCurrentUserId(user.uid);
            } else if (initialAuthToken) {
                await signInWithCustomToken(authentication, initialAuthToken);
            } else {
                // This is where it likely fails if Anonymous auth is off
                await signInAnonymously(authentication);
            }
            setIsAuthReady(true);
          } catch (err) {
            console.error("Auth Failure:", err);
            // This ensures the error is visible on the black screen
            setError(`Authentication Failed: ${err.message}. (Did you enable Anonymous Auth in Firebase Console?)`);
            // Ensure auth is ready even on failure to proceed to main screen
            setIsAuthReady(true);
          }
        });
        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
      } catch (e) {
        console.error("Firebase Init Error:", e);
        setError("Database connection failed. Check your config keys.");
        setIsAuthReady(true); // Ensure exit from loading state on init error
      }
    } else {
        setError("Firebase configuration is missing in the code.");
        setIsAuthReady(true); // Ensure exit from loading state on config error
    }
  }, []);

  // 2. Load Friends
  useEffect(() => {
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
    if (friendUsernames.length === 0) {
      setLeaderboardData([]);
      setAppStatus("Add usernames to start");
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

  }, [friendUsernames, fetchWithRetry]);

  useEffect(() => {
    if (isAuthReady) fetchAllUsersData();
  }, [friendUsernames, isAuthReady, fetchAllUsersData]);

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
    <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-md ${colorClass} bg-opacity-10 border border-opacity-20 border-current`}>
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
        : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {timeFilter === id && (
        <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-blue-400 blur-[2px]"></span>
      )}
    </button>
  );

  const LeaderboardRow = ({ user, rank }) => {
    const count = user.counts[timeFilter];

    // Rank Styling
    let rankStyles = "border-slate-700/50 bg-slate-800/40";
    let textGlow = "";
    let medal = null;

    if (rank === 1) {
      rankStyles = "border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-transparent shadow-[0_0_30px_rgba(234,179,8,0.1)]";
      textGlow = "drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]";
      medal = <Crown className="h-6 w-6 text-yellow-400 fill-yellow-400 animate-pulse" />;
    } else if (rank === 2) {
      rankStyles = "border-slate-300/50 bg-gradient-to-r from-slate-300/10 to-transparent";
      medal = <Trophy className="h-5 w-5 text-slate-300" />;
    } else if (rank === 3) {
      rankStyles = "border-amber-700/50 bg-gradient-to-r from-amber-700/10 to-transparent";
      medal = <Trophy className="h-5 w-5 text-amber-700" />;
    }

    return (
      <div className={`group relative flex items-center p-4 rounded-2xl border backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:bg-slate-800/60 ${rankStyles} mb-4`}>
        {/* Rank Number */}
        <div className="w-12 flex flex-col items-center justify-center mr-4 flex-shrink-0">
          {medal}
          <span className={`text-2xl font-black ${rank === 1 ? 'text-yellow-400' : 'text-slate-500'} ${textGlow}`}>
            #{rank}
          </span>
        </div>

        {/* User Info */}
        <div className="flex items-center flex-grow min-w-0">
          <div className="relative">
            <img
              src={user.avatar || `https://placehold.co/100x100/1e293b/ffffff?text=${user.username.charAt(0)}`}
              alt="avatar"
              className={`w-14 h-14 rounded-full object-cover border-2 shadow-lg ${rank === 1 ? 'border-yellow-500' : 'border-slate-600'}`}
            />
            {rank === 1 && <div className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)]"></div>}
          </div>

          <div className="ml-4 min-w-0">
            <h3 className={`text-lg font-bold text-white truncate group-hover:text-blue-400 transition-colors ${rank === 1 ? 'text-xl' : ''}`}>
                {user.username}
            </h3>
            <div className="flex space-x-2 mt-1.5">
                <StatBadge label="Easy" count={user.stats.easy} colorClass="text-emerald-400 bg-emerald-400 border-emerald-500" />
                <StatBadge label="Med" count={user.stats.medium} colorClass="text-amber-400 bg-amber-400 border-amber-500" />
                <StatBadge label="Hard" count={user.stats.hard} colorClass="text-rose-400 bg-rose-400 border-rose-500" />
            </div>
          </div>
        </div>

        {/* Score Metric */}
        <div className="text-right flex-shrink-0 ml-4 pl-4 border-l border-slate-700/50">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">
            {timeFilter === 'all' ? 'Total Solved' : 'Solved'}
          </p>
          <p className={`text-4xl font-black tabular-nums tracking-tight ${
              timeFilter === 'daily' ? 'text-emerald-400' :
              timeFilter === 'weekly' ? 'text-blue-400' : 'text-purple-400'
          } ${rank === 1 ? 'drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]' : ''}`}>
            {count}
          </p>
        </div>
      </div>
    );
  };

  // Loading View
  if (!isAuthReady) {
    return (
        <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center relative overflow-hidden p-6 text-center">
             {/* Background Glows */}
             <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]"></div>
             <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px]"></div>

            <Loader2 className="animate-spin h-12 w-12 text-blue-500 mb-6 relative z-10" />
            <h2 className="text-2xl font-bold text-white tracking-widest uppercase relative z-10 mb-2">Initializing Battle...</h2>

            {error && (
              <div className="mt-8 relative z-20 bg-red-900/40 border border-red-500/50 p-6 rounded-xl max-w-lg backdrop-blur-md shadow-2xl">
                 <div className="flex items-center justify-center space-x-2 mb-2 text-red-400">
                    <AlertTriangle className="h-6 w-6" />
                    <h3 className="text-lg font-bold">Connection Error</h3>
                 </div>
                 <p className="text-slate-200">{error}</p>
              </div>
            )}
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans selection:bg-blue-500 selection:text-white relative overflow-x-hidden">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div className="relative">
             <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
                    <Sword className="h-8 w-8 text-white transform -rotate-45" />
                </div>
                <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
                    LEETCODE <span className="text-blue-500">BATTLE</span>
                </h1>
             </div>
             <p className="text-slate-400 font-medium flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`}></span>
                {appStatus}
             </p>
          </div>

          {/* Time Filter Tabs */}
          <div className="bg-slate-900/50 backdrop-blur-md p-1.5 rounded-full border border-slate-700/50 flex shadow-xl">
              <FilterTab id="daily" label="Daily" icon={Clock} />
              <FilterTab id="weekly" label="Weekly" icon={Calendar} />
              <FilterTab id="all" label="All Time" icon={BarChart} />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Sidebar: Squad Management */}
          <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[50px] group-hover:bg-blue-500/20 transition-all"></div>

                  <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                      <UserPlus className="h-5 w-5 mr-3 text-blue-400" />
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
                      <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
                      <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Enter username..."
                          className="w-full pl-12 pr-12 py-3 bg-slate-950/50 border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 placeholder-slate-600 transition-all"
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
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
                        Tracking {friendUsernames.length} Fighters
                      </div>
                      {friendUsernames.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            No opponents yet
                        </div>
                      ) : (
                        friendUsernames.map(u => (
                            <div key={u} className="flex justify-between items-center bg-slate-800/40 p-3 px-4 rounded-xl border border-slate-700/30 hover:border-slate-600 hover:bg-slate-800/80 transition-all group/item">
                                <span className="font-medium text-slate-300">{u}</span>
                                <button
                                    onClick={() => saveFriendsList(friendUsernames.filter(n => n !== u))}
                                    className="text-slate-500 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all"
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
                  <div className="flex flex-col items-center justify-center h-96 bg-slate-900/30 rounded-3xl border border-slate-800 border-dashed animate-pulse">
                      <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-4" />
                      <span className="text-slate-400 font-medium">Syncing Battle Data...</span>
                  </div>
              ) : (
                  <div className="space-y-1">
                      {sortedLeaderboard.length > 0 ? (
                          sortedLeaderboard.map((user, idx) => (
                              <LeaderboardRow key={user.username} user={user} rank={idx + 1} />
                          ))
                      ) : (
                          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 backdrop-blur-sm rounded-3xl border border-slate-800 border-dashed">
                              <div className="p-4 bg-slate-800 rounded-full mb-4">
                                <Trophy className="h-12 w-12 text-slate-600" />
                              </div>
                              <h3 className="text-xl font-bold text-slate-300 mb-1">Leaderboard Empty</h3>
                              <p className="text-slate-500">Add usernames to start the simulation.</p>
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