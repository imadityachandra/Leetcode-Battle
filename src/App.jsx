import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Loader2, Zap, Heart, Star, Send, UserPlus, Trash2, Trophy, Crown, Calendar, Clock, BarChart } from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

// Global variables
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = {
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
  const [appStatus, setAppStatus] = useState("Ready to start battle!");

  // New State for Time Filter
  const [timeFilter, setTimeFilter] = useState('all'); // 'all', 'weekly', 'daily'
// Old line
// const FRIENDS_DOC_PATH = currentUserId ? `/artifacts/${appId}/users/${currentUserId}/friends/list` : null;

// New line (Cleaner for personal hosting)
const FRIENDS_DOC_PATH = currentUserId ? `users/${currentUserId}/friends/list` : null;

  // 1. Initialize Firebase
  useEffect(() => {
    if (firebaseConfig) {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authentication = getAuth(app);
      setDb(firestore);
      setAuth(authentication);
      const unsubscribe = onAuthStateChanged(authentication, async (user) => {
        if (user) {
          setCurrentUserId(user.uid);
        } else if (initialAuthToken) {
          await signInWithCustomToken(authentication, initialAuthToken);
        } else {
          await signInAnonymously(authentication);
        }
        setIsAuthReady(true);
      });
      return () => unsubscribe();
    }
  }, []);

  // 2. Load Friends
  useEffect(() => {
    if (!db || !currentUserId) return;
    const docRef = doc(db, FRIENDS_DOC_PATH);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            setFriendUsernames(docSnap.data().usernames || []);
        } else {
            setFriendUsernames([]);
        }
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

  // Helper to process submissions for Daily/Weekly Solved Counts
  const processRecentSubmissions = (submissionResponse) => {
    // API might return { count: 20, submission: [...] } or just the array depending on version
    const submissions = Array.isArray(submissionResponse)
        ? submissionResponse
        : (submissionResponse?.submission || []);

    const now = Math.floor(Date.now() / 1000);
    const oneDaySeconds = 86400;
    const oneWeekSeconds = oneDaySeconds * 7;

    // Get start of today (UTC) - LeetCode resets at 00:00 UTC
    const todayStart = now - (now % oneDaySeconds);

    const dailySolvedSet = new Set();
    const weeklySolvedSet = new Set();

    submissions.forEach(sub => {
        // Only count Accepted solutions
        if (sub.statusDisplay !== 'Accepted') return;

        const timestamp = parseInt(sub.timestamp);

        // Daily: timestamps falling within the current UTC day
        if (timestamp >= todayStart) {
            dailySolvedSet.add(sub.title);
        }
        // Weekly: timestamps within last 7 days
        if (timestamp >= (now - oneWeekSeconds)) {
            weeklySolvedSet.add(sub.title);
        }
    });

    return {
        daily: dailySolvedSet.size,
        weekly: weeklySolvedSet.size
    };
  };

  // 4. Fetch All User Data
  const fetchAllUsersData = useCallback(async () => {
    if (friendUsernames.length === 0) {
      setLeaderboardData([]);
      setAppStatus("Add usernames to start the battle!");
      return;
    }

    setLoading(true);
    setAppStatus(`Fetching data for ${friendUsernames.length} coders...`);

    const promises = friendUsernames.map(async (user) => {
        try {
            // Fetch Profile, All-Time Solved Stats, and Recent Submissions
            // We request limit=50 to get a good buffer for weekly stats
            const [profileData, solvedData, submissionData] = await Promise.all([
                fetchWithRetry(`${API_BASE_URL}/${user}`),
                fetchWithRetry(`${API_BASE_URL}/${user}/solved`),
                fetchWithRetry(`${API_BASE_URL}/${user}/submission?limit=50`)
            ]);

            if (profileData.errors || solvedData.errors) {
                 return { username: user, error: "User not found" };
            }

            const easy = solvedData.easySolved || 0;
            const medium = solvedData.mediumSolved || 0;
            const hard = solvedData.hardSolved || 0;
            const totalAllTime = solvedData.solvedProblem || 0;

            // Calculate time-based unique solved counts
            const { daily, weekly } = processRecentSubmissions(submissionData);

            return {
                username: user,
                avatar: profileData.avatar,
                stats: { easy, medium, hard },
                counts: {
                    all: totalAllTime,
                    weekly: weekly,
                    daily: daily
                }
            };

        } catch (e) {
            console.error(`Error fetching ${user}:`, e);
            return { username: user, error: "Fetch failed" };
        }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter(r => !r.error);

    setLeaderboardData(validResults);
    setLoading(false);
    setAppStatus(`Leaderboard updated!`);

    if (results.some(r => r.error)) setError("Some users could not be fetched.");

  }, [friendUsernames, fetchWithRetry]);

  // Refetch when friends change or auth ready
  useEffect(() => {
    if (isAuthReady) fetchAllUsersData();
  }, [friendUsernames, isAuthReady, fetchAllUsersData]);

  // Sort Data based on selected TimeFilter
  const sortedLeaderboard = useMemo(() => {
    return [...leaderboardData].sort((a, b) => {
        const countA = a.counts[timeFilter];
        const countB = b.counts[timeFilter];

        // Sort by count descending
        if (countB !== countA) return countB - countA;

        // Tie-breaker: All time solved
        return b.counts.all - a.counts.all;
    });
  }, [leaderboardData, timeFilter]);

  // --- Components ---

  const StatPill = ({ difficulty, count, color }) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold bg-${color}-900 text-${color}-300`}>
      {difficulty}: {count}
    </span>
  );

  const FilterTab = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setTimeFilter(id)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
        timeFilter === id
        ? 'bg-blue-600 text-white shadow-lg scale-105'
        : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );

  const LeaderboardRow = ({ user, rank }) => {
    const count = user.counts[timeFilter];

    // Dynamic styling for rank
    const rankColor = rank === 1 ? 'text-yellow-400' :
                      rank === 2 ? 'text-gray-400' :
                      rank === 3 ? 'text-amber-700' : 'text-gray-400';

    const rankBg = rank === 1 ? 'bg-gradient-to-r from-yellow-900/40 to-gray-800 border-l-4 border-yellow-500' :
                   rank === 2 ? 'bg-gray-800 border-l-4 border-gray-400' :
                   rank === 3 ? 'bg-gray-800 border-l-4 border-amber-700' :
                   'bg-gray-800 hover:bg-gray-750';

    return (
      <div className={`flex items-center p-4 rounded-xl shadow-md transition duration-300 ${rankBg} mb-3`}>

        {/* Rank */}
        <div className="flex flex-col items-center justify-center w-12 flex-shrink-0 mr-2">
          {rank <= 3 ? <Trophy className={`h-6 w-6 ${rankColor} mb-1`} /> : <span className="h-6 block"></span>}
          <span className={`text-xl font-extrabold ${rankColor}`}>#{rank}</span>
        </div>

        {/* User */}
        <div className="flex items-center flex-grow min-w-0">
          <img
            src={user.avatar || `https://placehold.co/50x50/374151/ffffff?text=${user.username.charAt(0)}`}
            alt="avatar"
            className="w-12 h-12 rounded-full object-cover border-2 border-gray-600 shadow-sm mr-4 flex-shrink-0"
          />
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white truncate flex items-center">
                {user.username}
                {rank === 1 && <Crown className="h-4 w-4 ml-2 text-yellow-400 animate-pulse" />}
            </h3>
            {/* Show difficulty breakdown only on 'all' view or as secondary info */}
            <div className="flex space-x-2 mt-1">
                <StatPill difficulty="E" count={user.stats.easy} color="green" />
                <StatPill difficulty="M" count={user.stats.medium} color="orange" />
                <StatPill difficulty="H" count={user.stats.hard} color="red" />
            </div>
          </div>
        </div>

        {/* Count Metric */}
        <div className="text-right flex-shrink-0 ml-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
            {timeFilter === 'all' ? 'All Time' : 'Solved'}
          </p>
          <p className={`text-3xl font-black ${
              timeFilter === 'daily' ? 'text-green-400' :
              timeFilter === 'weekly' ? 'text-blue-400' : 'text-purple-400'
          }`}>
            {count}
          </p>
        </div>
      </div>
    );
  };

  const FriendListItem = ({ username }) => (
    <div className="flex justify-between items-center bg-gray-700/50 p-2 px-3 rounded-md hover:bg-gray-700 transition">
        <span className="font-medium text-gray-300 text-sm">{username}</span>
        <button onClick={() => {
            const newUsers = friendUsernames.filter(u => u !== username);
            saveFriendsList(newUsers);
        }} className="text-gray-500 hover:text-red-400">
            <Trash2 className="h-4 w-4" />
        </button>
    </div>
  );

  // Loading Screen
  if (!isAuthReady) {
    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
            <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-4" />
            <p className="text-gray-400">Syncing Battle Data...</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
        <div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            LeetCode Battle
            </h1>
            <p className="text-gray-400 mt-1 text-sm">{appStatus}</p>
        </div>

        {/* Time Filters */}
        <div className="flex bg-gray-900 p-1.5 rounded-xl mt-4 md:mt-0 shadow-inner">
            <FilterTab id="daily" label="Daily" icon={Clock} />
            <FilterTab id="weekly" label="Weekly" icon={Calendar} />
            <FilterTab id="all" label="All Time" icon={BarChart} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Sidebar: Manage Users */}
        <div className="lg:col-span-1 space-y-4">
            <div className="bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                    <UserPlus className="h-5 w-5 mr-2 text-blue-400" />
                    Add Contenders
                </h2>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const u = newUsername.trim();
                    if(u && !friendUsernames.includes(u)) {
                        saveFriendsList([...friendUsernames, u]);
                        setNewUsername('');
                    }
                }} className="relative mb-4">
                    <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Username..."
                        className="w-full pl-4 pr-10 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                    />
                    <button type="submit" className="absolute right-2 top-2 p-1.5 bg-blue-600 rounded-md text-white hover:bg-blue-500 transition">
                        <Send className="h-4 w-4" />
                    </button>
                </form>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {friendUsernames.map(u => <FriendListItem key={u} username={u} />)}
                    {friendUsernames.length === 0 && <p className="text-xs text-gray-500 text-center py-4">No friends added yet.</p>}
                </div>
            </div>
        </div>

        {/* Main: Leaderboard */}
        <div className="lg:col-span-3">
            <div className="bg-gray-800/50 p-1 rounded-xl">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-2" />
                        <span className="text-gray-400 text-sm">Refreshing Stats...</span>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {sortedLeaderboard.length > 0 ? (
                            sortedLeaderboard.map((user, idx) => (
                                <LeaderboardRow key={user.username} user={user} rank={idx + 1} />
                            ))
                        ) : (
                            <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700 border-dashed">
                                <Trophy className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400">Add users to generate the leaderboard.</p>
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