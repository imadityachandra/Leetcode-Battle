// App.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Sword,
  AlertTriangle,
  SunMoon,
  Share2,
  Settings,
  Volume2,
  Plus,
  DoorOpen,
  Edit,
  X,
  Check,
  User,
  CheckCircle,
  Play,
  Timer,
  Target,
  Award,
  MessageCircle,
  Send,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2 as Volume2Icon,
  VolumeX
} from "lucide-react";

// Firebase (avoid duplicate init)
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot, getDoc, deleteField, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

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
// API Base URL - Using third-party wrapper for LeetCode API
// NOTE: LeetCode's public API is limited to ~20 most recent submissions
// This means if a user has >20 submissions since war started, older ones may not be detected
// Alternative: Use authenticated LeetCode API with session cookies (requires user login)
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
  const [timeFilter, setTimeFilter] = useState("daily");
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("soundOn") === "1");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  // Room state - restore from localStorage if user has joined before
  const [rooms, setRooms] = useState([]);
  const [currentRoomId, setCurrentRoomId] = useState(() => {
    // Check URL parameter first, then localStorage
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get("room");
    if (urlRoomId) return urlRoomId;
    // Check if user has a saved room (only if they have username too)
    const hasUsername = localStorage.getItem("lb_leetcodeUsername");
    if (hasUsername) {
      return localStorage.getItem("lb_currentRoom") || null;
    }
    return null;
  });
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRoomName, setEditingRoomName] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Initial setup state - only show if user hasn't joined before
  const [showInitialSetup, setShowInitialSetup] = useState(() => {
    // Check if user has username and room saved
    const hasUsername = localStorage.getItem("lb_leetcodeUsername");
    const hasRoom = localStorage.getItem("lb_currentRoom");
    // Show setup if no username, or if no room (unless URL has room param)
    const urlRoomId = new URLSearchParams(window.location.search).get("room");

    // If we have a room link but no username, we'll use the Join Modal instead
    if (urlRoomId && !hasUsername) return false;

    return !hasUsername || (!hasRoom && !urlRoomId);
  });
  const [initialLeetCodeUsername, setInitialLeetCodeUsername] = useState(() => {
    return localStorage.getItem("lb_leetcodeUsername") || "";
  });
  const [initialRoomName, setInitialRoomName] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(() => {
    const urlRoomId = new URLSearchParams(window.location.search).get("room");
    const hasUsername = localStorage.getItem("lb_leetcodeUsername");
    // Show join modal if we have a room link but no username
    return !!(urlRoomId && !hasUsername);
  });
  const [joinLeetCodeUsername, setJoinLeetCodeUsername] = useState("");
  const [currentLeetCodeUsername, setCurrentLeetCodeUsername] = useState(() => {
    return localStorage.getItem("lb_leetcodeUsername") || "";
  });

  // Warning modal for duplicate room names
  const [showDuplicateRoomWarning, setShowDuplicateRoomWarning] = useState(false);
  const [duplicateRoomInfo, setDuplicateRoomInfo] = useState(null); // { id, name, usernames }
  const [pendingRoomName, setPendingRoomName] = useState("");
  const [pendingUsername, setPendingUsername] = useState("");

  // War state
  const [warState, setWarState] = useState(null); // { active: bool, problemLink: string, problemSlug: string, startTime: number, duration: number, winner: string, submissions: {} }
  const [warTimer, setWarTimer] = useState(0); // seconds remaining
  const [warSubmissions, setWarSubmissions] = useState({}); // { username: { status: string, time: number } }
  const [warDifficulty, setWarDifficulty] = useState("medium"); // "easy", "medium", "hard", or "any"
  const [usedProblems, setUsedProblems] = useState([]); // Track recently used problems to avoid repeats

  // Chat state
  const [messages, setMessages] = useState([]); // Array of { id, username, text, timestamp }
  const [newMessage, setNewMessage] = useState(""); // Current message input
  const chatMessagesEndRef = useRef(null); // Ref for auto-scrolling to bottom

  // Voice call state
  const [isInCall, setIsInCall] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map()); // Map of username -> MediaStream
  const [callParticipants, setCallParticipants] = useState([]); // Array of usernames in the call
  const peerConnectionsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map()); // Map of username -> Array of candidates
  const localStreamRef = useRef(null);
  const signalingChannelRef = useRef(null);
  const [audioUnlockNeeded, setAudioUnlockNeeded] = useState(false); // State to show unlock button if autoplay fails
  const [debugInfo, setDebugInfo] = useState({}); // Map of username -> { connectionState, signalingState, iceCandidatesCount }
  const audioElementsRef = useRef(new Map()); // Map of username -> HTMLAudioElement

  // Firestore doc paths
  // Shared room path - all users access the same room data
  const SHARED_ROOM_PATH = currentRoomId
    ? (typeof __app_id !== "undefined"
      ? `/artifacts/${appId}/rooms/${currentRoomId}`
      : `rooms/${currentRoomId}`)
    : null;

  // User's local rooms list (for UI)
  const USER_ROOMS_PATH = currentUserId
    ? (typeof __app_id !== "undefined"
      ? `/artifacts/${appId}/users/${currentUserId}/rooms/list`
      : `users/${currentUserId}/rooms/list`)
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
            setCurrentUser(user);
            // Generate a short user identifier
            const shortId = user.uid.substring(0, 8);
            localStorage.setItem("lb_userId", shortId);
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
     Load and save rooms
     --------------------------- */

  // Restore session on mount if user has joined before (only run once)
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    // Wait for Firebase to be initialized and only run once
    if (!db || hasRestoredRef.current) return;

    const savedUsername = localStorage.getItem("lb_leetcodeUsername");
    const savedRoomId = localStorage.getItem("lb_currentRoom");
    const savedRooms = localStorage.getItem("lb_rooms");

    // Only restore if user has username (meaning they've joined before)
    if (savedUsername && savedRoomId) {
      // Restore username
      setCurrentLeetCodeUsername(savedUsername);

      // Restore rooms if available (Firebase will sync and update these later)
      if (savedRooms) {
        try {
          const parsed = JSON.parse(savedRooms);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRooms(parsed);
          }
        } catch (e) {
          console.error("Error parsing saved rooms:", e);
        }
      }

      // Restore current room (already set in useState initializer, but ensure it's set)
      if (savedRoomId && !currentRoomId) {
        setCurrentRoomId(savedRoomId);
      }

      // Hide initial setup since user has joined before
      setShowInitialSetup(false);
    }

    hasRestoredRef.current = true;
  }, [db]); // Only run when Firebase is ready, use ref to prevent re-running

  useEffect(() => {
    if (rooms.length > 0) {
      localStorage.setItem("lb_rooms", JSON.stringify(rooms));
    }
  }, [rooms]);

  useEffect(() => {
    if (currentRoomId) {
      localStorage.setItem("lb_currentRoom", currentRoomId);
    }
  }, [currentRoomId]);

  // Save user's local rooms list to Firebase (for UI)
  const saveUserRooms = useCallback(async (roomsData) => {
    if (!db || !currentUserId || !USER_ROOMS_PATH) {
      setRooms(roomsData);
      return;
    }
    try {
      await setDoc(doc(db, USER_ROOMS_PATH), { rooms: roomsData });
      setRooms(roomsData);
    } catch (e) {
      console.error("saveUserRooms error:", e);
      setRooms(roomsData); // Fallback to local state
    }
  }, [db, currentUserId, USER_ROOMS_PATH]);

  // Save shared room data to Firebase
  const saveSharedRoom = useCallback(async (roomData) => {
    if (!db || !SHARED_ROOM_PATH) {
      return;
    }
    try {
      // If roomData.war is null, we need to remove the war field
      if (roomData.war === null) {
        // Get current data first
        const docRef = doc(db, SHARED_ROOM_PATH);
        const currentDoc = await getDoc(docRef);
        if (currentDoc.exists()) {
          const currentData = currentDoc.data();
          // Remove war field using deleteField()
          await setDoc(docRef, { ...currentData, war: deleteField() }, { merge: true });
        }
      } else {
        // Ensure we have the room ID in the data
        const dataToSave = { ...roomData, id: currentRoomId };
        await setDoc(doc(db, SHARED_ROOM_PATH), dataToSave, { merge: true });
      }
    } catch (e) {
      console.error("saveSharedRoom error:", e);
      setError("Failed to save room data.");
    }
  }, [db, SHARED_ROOM_PATH, currentRoomId]);

  // Normalize room name to ID (lowercase, replace spaces with underscores, remove special chars)
  const normalizeRoomName = useCallback((name) => {
    return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  }, []);

  // Fetch shared room from Firebase
  const fetchSharedRoom = useCallback(async (roomId) => {
    if (!db) return null;
    try {
      const roomPath = typeof __app_id !== "undefined"
        ? `/artifacts/${appId}/rooms/${roomId}`
        : `rooms/${roomId}`;
      const roomDoc = await getDoc(doc(db, roomPath));
      if (roomDoc.exists()) {
        return { id: roomId, ...roomDoc.data() };
      }
      return null;
    } catch (e) {
      console.error("fetchSharedRoom error:", e);
      return null;
    }
  }, [db]);

  // Check if room exists by name in Firebase (checks actual name, not just normalized ID)
  const checkRoomExistsByName = useCallback(async (roomName) => {
    if (!db) return null;

    // First check by normalized ID (for backwards compatibility)
    const normalizedId = normalizeRoomName(roomName);
    const roomById = await fetchSharedRoom(normalizedId);
    if (roomById) {
      // Check if the name matches (case-insensitive)
      if (roomById.name && roomById.name.toLowerCase() === roomName.toLowerCase()) {
        return roomById;
      }
    }

    // Also check all rooms by actual name (case-insensitive)
    try {
      const roomsCollectionPath = typeof __app_id !== "undefined"
        ? `/artifacts/${appId}/rooms`
        : `rooms`;
      const roomsRef = collection(db, roomsCollectionPath);
      const roomsSnapshot = await getDocs(roomsRef);

      for (const roomDoc of roomsSnapshot.docs) {
        const roomData = roomDoc.data();
        if (roomData.name && roomData.name.toLowerCase() === roomName.toLowerCase()) {
          return { id: roomDoc.id, ...roomData };
        }
      }
    } catch (e) {
      console.error("Error checking rooms by name:", e);
    }

    return null;
  }, [db, normalizeRoomName, fetchSharedRoom]);

  // Load user's local rooms list from Firebase (for UI)
  useEffect(() => {
    if (!db || !currentUserId || !USER_ROOMS_PATH) return;
    const docRef = doc(db, USER_ROOMS_PATH);
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.rooms && Array.isArray(data.rooms) && data.rooms.length > 0) {
          // Only update if rooms actually changed to prevent unnecessary re-renders
          setRooms(prevRooms => {
            const newRoomsStr = JSON.stringify(data.rooms);
            const prevRoomsStr = JSON.stringify(prevRooms);
            if (newRoomsStr !== prevRoomsStr) {
              return data.rooms;
            }
            return prevRooms;
          });
          // Ensure current room exists (use functional update to avoid dependency)
          setCurrentRoomId(prevRoomId => {
            const currentExists = data.rooms.find(r => r.id === prevRoomId);
            if (!currentExists && data.rooms.length > 0) {
              return data.rooms[0].id;
            }
            return prevRoomId;
          });
        }
      }
    }, (err) => {
      console.error("Firestore rooms snapshot error", err);
    });
    return () => unsub();
  }, [db, currentUserId, USER_ROOMS_PATH]); // Removed currentRoomId to prevent re-subscription loops

  // Load shared room data from Firebase (room-specific data)
  // Use ref to prevent infinite loops from writing back to Firebase
  const isUpdatingRef = useRef(false);
  const lastUpdateRef = useRef({ usernames: null, timestamp: 0 });
  const lastRoomDataRef = useRef(null); // Track last room data to detect actual changes

  useEffect(() => {
    if (!db || !SHARED_ROOM_PATH || !currentRoomId) return;
    // Don't load room data if user hasn't joined yet (no username)
    if (!currentLeetCodeUsername) {
      setFriendUsernames([]);
      return;
    }

    const docRef = doc(db, SHARED_ROOM_PATH);
    const unsub = onSnapshot(docRef, async (snap) => {
      // Prevent infinite loops - don't process if we're currently updating
      if (isUpdatingRef.current) {
        console.log("[Room Sync] Skipping snapshot - update in progress");
        return;
      }

      // Check if this is just a message update (only messages field changed)
      const currentData = snap.exists() ? snap.data() : null;
      const lastData = lastRoomDataRef.current;

      // If only messages changed, skip processing (messages are handled by separate listener)
      if (lastData && currentData) {
        const lastDataWithoutMessages = { ...lastData };
        delete lastDataWithoutMessages.messages;
        const currentDataWithoutMessages = { ...currentData };
        delete currentDataWithoutMessages.messages;

        const lastDataStr = JSON.stringify(lastDataWithoutMessages);
        const currentDataStr = JSON.stringify(currentDataWithoutMessages);

        // If only messages changed, let the messages listener handle it
        if (lastDataStr === currentDataStr && lastData.messages !== currentData.messages) {
          console.log("[Room Sync] Only messages changed, skipping room data update");
          // Still update the ref for next comparison
          lastRoomDataRef.current = currentData;
          return;
        }
      }

      // Update ref for next comparison
      lastRoomDataRef.current = currentData;

      if (snap.exists()) {
        const data = snap.data();
        const currentUsername = currentLeetCodeUsername;
        let usernames = [...(data?.usernames || [])];

        // Check if usernames actually changed to avoid unnecessary updates
        const usernamesStr = JSON.stringify(usernames.sort());
        const lastUsernamesStr = JSON.stringify((lastUpdateRef.current.usernames || []).sort());
        const timeSinceLastUpdate = Date.now() - lastUpdateRef.current.timestamp;

        // Ensure current user is always in the room (persist on refresh)
        // BUT: Don't auto-add to default room - user must explicitly join
        // Only update if username is missing AND we haven't updated recently (prevent loops)
        if (currentUsername && !usernames.includes(currentUsername) && currentRoomId !== "default" && timeSinceLastUpdate > 5000) {
          usernames.push(currentUsername);
          // Mark that we're updating to prevent snapshot from triggering again
          isUpdatingRef.current = true;

          try {
            await setDoc(docRef, {
              ...data,
              id: currentRoomId,
              name: data.name || (currentRoomId === "default" ? "Default Room" : `Room ${currentRoomId.substring(0, 8)}`),
              usernames: usernames
            }, { merge: true });

            // Update ref to track what we just wrote
            lastUpdateRef.current = { usernames, timestamp: Date.now() };

            // Reset flag after a short delay to allow snapshot to process
            setTimeout(() => {
              isUpdatingRef.current = false;
            }, 1000);
          } catch (e) {
            console.error("Error updating usernames in snapshot:", e);
            isUpdatingRef.current = false;
          }
        } else {
          // Update ref even if we didn't write (to track current state)
          if (usernamesStr !== lastUsernamesStr) {
            lastUpdateRef.current = { usernames, timestamp: Date.now() };
          }
        }

        // Only update friends list if it actually changed
        setFriendUsernames(prevUsernames => {
          const prevStr = JSON.stringify([...prevUsernames].sort());
          const newStr = JSON.stringify([...usernames].sort());
          if (prevStr !== newStr) {
            return usernames;
          }
          return prevUsernames; // Return previous to prevent re-render
        });

        // Update voice call state (room-specific) - sync for all users
        if (data?.voiceCall && data.voiceCall.active) {
          const voiceCall = data.voiceCall;
          const participants = voiceCall.participants || [];
          const isUserInCall = participants.includes(currentLeetCodeUsername);

          // Always update call status and participants for all users
          setIsCallActive(true);
          setCallParticipants(participants);

          // If user is in the call but local state says they're not, sync it
          if (isUserInCall && !isInCall) {
            setIsInCall(true);
            console.log(`[Voice] User ${currentLeetCodeUsername} is in call, syncing state`);
          }

          // If user is not in call but local state says they are, sync it
          if (!isUserInCall && isInCall) {
            // User was removed from call - end their local call
            console.log(`[Voice] User ${currentLeetCodeUsername} was removed from call`);
            // Clean up local resources but keep UI showing call is active
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach(track => track.stop());
              localStreamRef.current = null;
            }
            peerConnectionsRef.current.forEach((pc) => {
              try {
                pc.close();
              } catch (e) {
                console.error("Error closing peer connection:", e);
              }
            });
            peerConnectionsRef.current.clear();
            audioElementsRef.current.forEach((audio) => {
              try {
                audio.pause();
                audio.srcObject = null;
              } catch (e) {
                console.error("Error cleaning up audio:", e);
              }
            });
            audioElementsRef.current.clear();
            setIsInCall(false);
            setIsMuted(false);
          }
        } else {
          // No active call - clear call state
          if (isCallActive || isInCall) {
            setIsCallActive(false);
            setIsInCall(false);
            setCallParticipants([]);
            // Clean up resources
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach(track => track.stop());
              localStreamRef.current = null;
            }
            peerConnectionsRef.current.forEach((pc) => {
              try {
                pc.close();
              } catch (e) {
                console.error("Error closing peer connection:", e);
              }
            });
            peerConnectionsRef.current.clear();
            audioElementsRef.current.forEach((audio) => {
              try {
                audio.pause();
                audio.srcObject = null;
              } catch (e) {
                console.error("Error cleaning up audio:", e);
              }
            });
            audioElementsRef.current.clear();
            setIsMuted(false);
          }
        }

        // Update war state (room-specific) - only if war data changed
        if (data?.war) {
          setWarState(prevWar => {
            // If war is cancelled in Firebase (active: false), always use Firebase data immediately
            // This ensures cancellation syncs across all users
            if (data.war.active === false) {
              // Only update if state actually changed
              if (!prevWar || prevWar.active !== false || prevWar.cancelled !== true) {
                console.log("[War Sync] War cancelled detected from Firebase, updating all users");
                return data.war;
              }
              return prevWar; // No change, return previous
            }

            // If we have a local war state and it's the same war, merge submissions
            if (prevWar && prevWar.problemSlug === data.war.problemSlug && prevWar.startTime === data.war.startTime) {
              // Check if submissions actually changed
              const prevSubmissionsStr = JSON.stringify(prevWar.submissions || {});
              const newSubmissionsStr = JSON.stringify(data.war.submissions || {});

              // Merge: prefer local submissions if they're newer, otherwise use Firebase
              const mergedSubmissions = { ...data.war.submissions };
              if (prevWar.submissions) {
                Object.keys(prevWar.submissions).forEach(username => {
                  const localSub = prevWar.submissions[username];
                  const firebaseSub = data.war.submissions?.[username];
                  // Keep local if it's newer
                  if (!firebaseSub || (localSub.time > firebaseSub.time)) {
                    mergedSubmissions[username] = localSub;
                  }
                });
              }

              const mergedSubmissionsStr = JSON.stringify(mergedSubmissions);
              const prevCountsStr = JSON.stringify(prevWar.submissionCounts || {});
              const newCountsStr = JSON.stringify(data.war.submissionCounts || {});

              // Only update if something actually changed
              if (prevSubmissionsStr !== mergedSubmissionsStr || prevCountsStr !== newCountsStr ||
                prevWar.active !== data.war.active || prevWar.winner !== data.war.winner) {
                return {
                  ...data.war,
                  submissions: mergedSubmissions,
                  submissionCounts: data.war.submissionCounts || prevWar.submissionCounts || {}
                };
              }
              return prevWar; // No change, return previous
            }

            // New war or different war - check if it's actually different
            if (!prevWar || prevWar.problemSlug !== data.war.problemSlug || prevWar.startTime !== data.war.startTime) {
              return data.war;
            }
            return prevWar; // Same war, return previous
          });

          // Update submissions only if changed
          setWarSubmissions(prevSubmissions => {
            const prevStr = JSON.stringify(prevSubmissions);
            const newStr = JSON.stringify(data.war.submissions || {});
            if (prevStr !== newStr) {
              return data.war.submissions || {};
            }
            return prevSubmissions; // Return previous to prevent re-render
          });
        } else {
          // No war data in Firebase - only clear if we had war state
          setWarState(prevWar => {
            if (prevWar) {
              console.log("[War Sync] No war data in Firebase, clearing war state");
              return null;
            }
            return prevWar; // Already null, no change
          });

          setWarSubmissions(prevSubmissions => {
            if (Object.keys(prevSubmissions).length > 0) {
              return {};
            }
            return prevSubmissions; // Already empty, no change
          });
        }

        // Update local rooms state with shared room data - only if changed
        setRooms(prev => {
          const roomIndex = prev.findIndex(r => r.id === currentRoomId);
          if (roomIndex >= 0) {
            const existingRoom = prev[roomIndex];
            // Prioritize Firebase name, then existing local name, then fallback
            const roomName = data.name || existingRoom.name || (currentRoomId === "default" ? "Default Room" : `Room ${currentRoomId.substring(0, 8)}`);

            // Check if anything actually changed
            const nameChanged = existingRoom.name !== roomName;
            const usernamesChanged = JSON.stringify([...existingRoom.usernames || []].sort()) !== JSON.stringify([...usernames].sort());

            if (nameChanged || usernamesChanged) {
              const updated = [...prev];
              updated[roomIndex] = {
                ...updated[roomIndex],
                name: roomName,
                usernames: usernames
              };
              return updated;
            }
            return prev; // No change, return previous
          } else {
            // Room not in local list - add it with data from Firebase
            const newRoom = {
              id: currentRoomId,
              name: data.name || (currentRoomId === "default" ? "Default Room" : `Room ${currentRoomId.substring(0, 8)}`),
              usernames: usernames
            };
            return [...prev, newRoom];
          }
        });
      } else {
        // Room doesn't exist in Firebase yet - initialize it
        // BUT: Don't auto-add username to default room
        const currentUsername = currentLeetCodeUsername;
        const roomData = {
          id: currentRoomId,
          name: currentRoomId === "default" ? "Default Room" : `Room ${currentRoomId.substring(0, 8)}`,
          usernames: (currentUsername && currentRoomId !== "default") ? [currentUsername] : []
        };
        setDoc(docRef, roomData, { merge: true }).catch(e => {
          console.error("Error initializing room:", e);
        });
        setFriendUsernames(roomData.usernames);
      }
    }, (err) => {
      console.error("Firestore shared room snapshot error", err);
    });
    return () => unsub();
  }, [db, SHARED_ROOM_PATH, currentRoomId, currentLeetCodeUsername]); // Re-run when room or username changes

  // Get current room usernames
  const currentRoomUsernames = useMemo(() => {
    const currentRoom = rooms.find(r => r.id === currentRoomId);
    return currentRoom?.usernames || [];
  }, [rooms, currentRoomId]);

  // Friends list is now loaded from shared room (see shared room snapshot above)

  const saveFriendsList = useCallback(async (usernames) => {
    // Update local state immediately
    setFriendUsernames(usernames);
    setRooms(prev => prev.map(r =>
      r.id === currentRoomId ? { ...r, usernames } : r
    ));

    // Save to shared room in Firebase (include name to ensure it's synced)
    if (!db || !SHARED_ROOM_PATH) {
      return;
    }
    try {
      const currentRoom = rooms.find(r => r.id === currentRoomId);
      await saveSharedRoom({
        usernames,
        name: currentRoom?.name || "Default Room"
      });
    } catch (e) {
      console.error("saveFriendsList error:", e);
      setError("Failed to save friend list.");
    }
  }, [db, SHARED_ROOM_PATH, currentRoomId, saveSharedRoom, rooms]);

  /* ---------------------------
     Fetch helpers
     --------------------------- */
  const fetchWithRetry = useCallback(async (url) => {
    let tries = 0;
    while (tries < 2) { // Reduced retries to avoid hitting limits
      try {
        // Add cache-busting parameter to ensure fresh data
        const separator = url.includes('?') ? '&' : '?';
        const cacheBustUrl = `${url}${separator}_t=${Date.now()}`;

        // Add no-cache headers to prevent browser/CDN caching
        const res = await fetch(cacheBustUrl, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          cache: 'no-store' // Force fetch to bypass cache
        });

        if (res.status === 429) {
          // Rate limited - throw immediately without retry
          const errorText = await res.text().catch(() => "");
          console.warn("Rate limited (429), skipping request", errorText);
          throw new Error("Rate limited");
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Log API response for debugging
        if (url.includes('/submission')) {
          console.log(`[API] Fetched ${Array.isArray(data) ? data.length : 'unknown'} submissions from ${url}`);
          if (Array.isArray(data) && data.length > 0) {
            console.log(`[API] Latest submission:`, {
              title: data[0].title,
              titleSlug: data[0].titleSlug,
              status: data[0].statusDisplay || data[0].status || data[0].statusCode,
              timestamp: new Date(parseInt(data[0].timestamp || "0", 10) * 1000).toISOString()
            });
          }
        }

        return data;
      } catch (e) {
        tries++;
        if (tries >= 2 || e.message === "Rate limited") throw e;
        // Longer delay between retries
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, tries)));
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
          fetchWithRetry(`${API_BASE_URL}/${user}/submission?limit=10`)
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

  // Auto-sync leaderboard when usernames are added or removed
  useEffect(() => {
    // Only fetch if we have usernames and a user ID
    if (friendUsernames.length > 0 && currentUserId) {
      fetchAllUsersData();
    } else if (friendUsernames.length === 0) {
      // Clear leaderboard if no usernames
      setLeaderboardData([]);
    }
  }, [friendUsernames, currentUserId, fetchAllUsersData]);

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

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Initialize theme on mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  // Load room from URL parameter - allows others to join rooms via shared link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("room");

    // Only process if we have a room ID, database is ready, and we're not already in a room
    if (roomId && db && !currentRoomId && !showJoinModal) {
      // Check if user already has a username
      const hasUsername = currentLeetCodeUsername || localStorage.getItem("lb_leetcodeUsername");

      if (!hasUsername) {
        // No username - show join modal to get username first
        setFriendUsernames([]);
        setRooms([]);
        setCurrentRoomId(null);
        setShowInitialSetup(false);
        setShowJoinModal(true);
        return;
      }

      // User has username - try to join room automatically
      // Set currentRoomId first so snapshot listener can initialize
      setCurrentRoomId(roomId);

      // Always fetch from Firebase to ensure we have the latest room data
      // This ensures default room and other rooms are properly synced
      fetchSharedRoom(roomId).then(async (sharedRoom) => {
        const currentUsername = currentLeetCodeUsername;

        if (sharedRoom) {
          // Room exists in Firebase - ensure current user is in the room
          let updatedUsernames = [...(sharedRoom.usernames || [])];

          // Add current user to room if they have a username and aren't already in the room
          // BUT: Don't auto-add to default room - user must explicitly join
          if (currentUsername && !updatedUsernames.includes(currentUsername) && roomId !== "default") {
            updatedUsernames.push(currentUsername);
            // Update Firebase with new username directly
            const roomPath = typeof __app_id !== "undefined"
              ? `/artifacts/${appId}/rooms/${roomId}`
              : `rooms/${roomId}`;
            await setDoc(doc(db, roomPath), {
              id: roomId,
              name: sharedRoom.name || (roomId === "default" ? "Default Room" : `Room ${roomId.substring(0, 8)}`),
              usernames: updatedUsernames
            }, { merge: true });
          }

          // Update local state - snapshot listener will handle real-time updates
          setRooms(prev => {
            const exists = prev.some(r => r.id === roomId);
            if (!exists) {
              // Add new room to list
              const newRooms = [...prev, {
                id: sharedRoom.id,
                name: sharedRoom.name || (roomId === "default" ? "Default Room" : `Room ${roomId.substring(0, 8)}`),
                usernames: updatedUsernames
              }];
              saveUserRooms(newRooms);
              return newRooms;
            } else {
              // Update existing room with latest data from Firebase
              // Prioritize Firebase name, then existing local name, then fallback
              const updated = prev.map(r =>
                r.id === roomId
                  ? {
                    ...r,
                    name: sharedRoom.name || r.name || (roomId === "default" ? "Default Room" : `Room ${roomId.substring(0, 8)}`),
                    usernames: updatedUsernames
                  }
                  : r
              );
              saveUserRooms(updated);
              return updated;
            }
          });

          // Snapshot listener will update friendUsernames in real-time
          setAppStatus("Joined room!");
          // Clean URL after joining
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        } else {
          // Room doesn't exist in Firebase - create it
          // BUT: Don't auto-add username to default room
          // Note: currentUsername comes from join modal, not localStorage
          const newRoom = {
            id: roomId,
            name: roomId === "default" ? "Default Room" : `Room ${roomId.substring(0, 8)}`,
            usernames: (currentUsername && roomId !== "default") ? [currentUsername] : []
          };

          // Save to Firebase
          const roomPath = typeof __app_id !== "undefined"
            ? `/artifacts/${appId}/rooms/${roomId}`
            : `rooms/${roomId}`;
          await setDoc(doc(db, roomPath), newRoom, { merge: true });

          // Update local state
          setRooms(prev => {
            const exists = prev.some(r => r.id === roomId);
            if (!exists) {
              const newRooms = [...prev, newRoom];
              saveUserRooms(newRooms);
              return newRooms;
            } else {
              // Update existing room
              const updated = prev.map(r =>
                r.id === roomId ? { ...r, ...newRoom } : r
              );
              saveUserRooms(updated);
              return updated;
            }
          });

          // Snapshot listener will update friendUsernames
          setAppStatus("Created new room");
          // Clean URL after joining
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        }
      }).catch((err) => {
        console.error("Error loading room from URL:", err);
        // If fetch fails, show join modal so user can manually join
        setShowJoinModal(true);
        setCurrentRoomId(null);
      });
    }
  }, [db, currentRoomId, currentLeetCodeUsername, showJoinModal, fetchSharedRoom, saveUserRooms, rooms]); // Added dependencies

  // Close room modal when clicking outside
  useEffect(() => {
    if (!showRoomModal) return;
    const handleClickOutside = (event) => {
      if (!event.target.closest(".room-selector")) {
        setShowRoomModal(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showRoomModal]);

  const cycleTheme = () => {
    const themes = ["light", "dark", "neon"];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
    playBeep();
  };

  /* ---------------------------
     Room management functions
     --------------------------- */
  const createRoom = async (roomName = null, leetcodeUsername = null) => {
    try {
      if (!db) {
        throw new Error("Database not ready. Please wait...");
      }

      const name = (roomName || newRoomName).trim();
      if (!name) {
        setError("Room name is required");
        setTimeout(() => setError(null), 2200);
        return;
      }

      // Use provided username or current LeetCode username
      const username = leetcodeUsername || currentLeetCodeUsername;

      // Normalize room name to create unique ID
      const normalizedId = normalizeRoomName(name);

      // First check local rooms list for duplicate name (case-insensitive)
      const localDuplicate = rooms.find(r =>
        r.id === normalizedId || r.name.toLowerCase() === name.toLowerCase()
      );
      if (localDuplicate) {
        // Switch to existing room instead of creating duplicate
        setCurrentRoomId(localDuplicate.id);
        // Add username if provided and not already in room
        if (username && localDuplicate.usernames && !localDuplicate.usernames.includes(username)) {
          const updatedUsernames = [...localDuplicate.usernames, username];
          // Update Firebase
          const roomPath = typeof __app_id !== "undefined"
            ? `/artifacts/${appId}/rooms/${normalizedId}`
            : `rooms/${normalizedId}`;
          await setDoc(doc(db, roomPath), {
            id: normalizedId,
            name: localDuplicate.name,
            usernames: updatedUsernames
          }, { merge: true });
          // Update local state
          setRooms(prev => prev.map(r =>
            r.id === normalizedId ? { ...r, usernames: updatedUsernames } : r
          ));
          setFriendUsernames(updatedUsernames);
        } else if (username && !localDuplicate.usernames) {
          // Room exists but has no usernames yet
          const updatedUsernames = [username];
          const roomPath = typeof __app_id !== "undefined"
            ? `/artifacts/${appId}/rooms/${normalizedId}`
            : `rooms/${normalizedId}`;
          await setDoc(doc(db, roomPath), {
            id: normalizedId,
            name: localDuplicate.name,
            usernames: updatedUsernames
          }, { merge: true });
          setRooms(prev => prev.map(r =>
            r.id === normalizedId ? { ...r, usernames: updatedUsernames } : r
          ));
          setFriendUsernames(updatedUsernames);
        }
        setNewRoomName("");
        setShowRoomModal(false);
        playBeep();
        return;
      }

      // Check if room already exists in Firebase
      const existingRoom = await checkRoomExistsByName(name);
      if (existingRoom) {
        // Room exists - show warning modal instead of auto-joining
        setDuplicateRoomInfo(existingRoom);
        setPendingRoomName(name);
        setPendingUsername(username);
        setShowDuplicateRoomWarning(true);
        setNewRoomName("");
        setShowRoomModal(false);
        return { duplicate: true }; // Return indicator that duplicate was found
      }

      // Create new room
      const newRoom = {
        id: normalizedId,
        name,
        usernames: username ? [username] : []
      };
      // Save to shared room collection directly (with explicit name and usernames)
      const roomPath = typeof __app_id !== "undefined"
        ? `/artifacts/${appId}/rooms/${normalizedId}`
        : `rooms/${normalizedId}`;
      await setDoc(doc(db, roomPath), {
        id: normalizedId,
        name: name, // Always use the provided name
        usernames: newRoom.usernames
      }, { merge: true });
      // Then add to user's local list
      const updatedRooms = [...rooms, newRoom];
      await saveUserRooms(updatedRooms);
      setCurrentRoomId(newRoom.id);
      if (username) {
        setFriendUsernames([username]);
      }
      setNewRoomName("");
      setShowRoomModal(false);
      playBeep();
    } catch (error) {
      console.error("Error creating room:", error);
      setError(`Failed to create room: ${error.message || "Unknown error"}`);
      setTimeout(() => setError(null), 3000);
      throw error; // Re-throw so caller can handle it
    }
  };

  // Join existing room after user confirms in warning modal
  const joinExistingRoom = async () => {
    try {
      if (!duplicateRoomInfo || !db) return;

      const normalizedId = normalizeRoomName(pendingRoomName);
      const username = pendingUsername || currentLeetCodeUsername;

      // Add room to local list if not already present
      setRooms(prev => {
        const exists = prev.some(r => r.id === duplicateRoomInfo.id || r.id === normalizedId);
        if (!exists) {
          const newRooms = [...prev, {
            id: duplicateRoomInfo.id || normalizedId,
            name: duplicateRoomInfo.name || pendingRoomName,
            usernames: duplicateRoomInfo.usernames || []
          }];
          saveUserRooms(newRooms);
          return newRooms;
        }
        return prev;
      });

      // Switch to the existing room
      setCurrentRoomId(duplicateRoomInfo.id || normalizedId);

      // Add username to room if provided
      if (username) {
        const updatedUsernames = [...(duplicateRoomInfo.usernames || [])];
        if (!updatedUsernames.includes(username)) {
          updatedUsernames.push(username);
          // Save to Firebase directly
          const roomPath = typeof __app_id !== "undefined"
            ? `/artifacts/${appId}/rooms/${duplicateRoomInfo.id || normalizedId}`
            : `rooms/${duplicateRoomInfo.id || normalizedId}`;
          await setDoc(doc(db, roomPath), {
            id: duplicateRoomInfo.id || normalizedId,
            name: duplicateRoomInfo.name || pendingRoomName,
            usernames: updatedUsernames
          }, { merge: true });
          setFriendUsernames(updatedUsernames);
        } else {
          setFriendUsernames(updatedUsernames);
        }
      }

      // Close warning modal
      setShowDuplicateRoomWarning(false);
      setDuplicateRoomInfo(null);
      setPendingRoomName("");
      setPendingUsername("");
      playBeep();
    } catch (error) {
      console.error("Error joining existing room:", error);
      setError(`Failed to join room: ${error.message || "Unknown error"}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  // Cancel joining existing room
  const cancelJoinRoom = () => {
    setShowDuplicateRoomWarning(false);
    setDuplicateRoomInfo(null);
    setPendingRoomName("");
    setPendingUsername("");
  };

  // Exit/Leave a room
  const exitRoom = async (roomId) => {
    try {
      if (!db || !currentLeetCodeUsername) return;

      const room = rooms.find(r => r.id === roomId);
      if (!room) return;

      // Remove username from room's usernames list
      const updatedUsernames = (room.usernames || []).filter(u => u !== currentLeetCodeUsername);

      // Update Firebase
      const roomPath = typeof __app_id !== "undefined"
        ? `/artifacts/${appId}/rooms/${roomId}`
        : `rooms/${roomId}`;

      if (updatedUsernames.length === 0) {
        // If no users left, optionally delete the room or just clear usernames
        await setDoc(doc(db, roomPath), {
          id: roomId,
          name: room.name,
          usernames: []
        }, { merge: true });
      } else {
        await setDoc(doc(db, roomPath), {
          id: roomId,
          name: room.name,
          usernames: updatedUsernames
        }, { merge: true });
      }

      // Remove room from local list
      const updatedRooms = rooms.filter(r => r.id !== roomId);
      await saveUserRooms(updatedRooms);

      // If exiting current room, switch to another room or clear selection
      if (roomId === currentRoomId) {
        if (updatedRooms.length > 0) {
          setCurrentRoomId(updatedRooms[0].id);
        } else {
          setCurrentRoomId(null);
          setFriendUsernames([]);
          setMessages([]); // Clear messages when leaving room
        }
      }

      playBeep();
    } catch (error) {
      console.error("Error exiting room:", error);
      setError(`Failed to exit room: ${error.message || "Unknown error"}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  // Initial setup handler
  const handleInitialSetup = async () => {
    try {
      const username = initialLeetCodeUsername.trim();
      const roomName = initialRoomName.trim();

      if (!username) {
        setError("LeetCode username is required");
        setTimeout(() => setError(null), 2200);
        return;
      }
      if (!roomName) {
        setError("Room name is required");
        setTimeout(() => setError(null), 2200);
        return;
      }

      if (!db) {
        setError("Database not ready. Please wait...");
        setTimeout(() => setError(null), 2200);
        return;
      }

      setLoading(true);
      setAppStatus("Creating room...");

      // Save username to localStorage
      localStorage.setItem("lb_leetcodeUsername", username);
      setCurrentLeetCodeUsername(username);

      // Create or join room - this may show warning modal if room exists
      try {
        const result = await createRoom(roomName, username);
        // Only close setup modal if room was actually created (not showing warning)
        if (!result || !result.duplicate) {
          setShowInitialSetup(false);
          setAppStatus("Ready to battle");
          setLoading(false);
          playBeep();
        } else {
          // Warning modal will be shown, keep loading false but don't close setup yet
          setLoading(false);
          setAppStatus("Room exists");
        }
      } catch (error) {
        // Error already handled in createRoom
        setLoading(false);
      }
    } catch (error) {
      console.error("Error in initial setup:", error);
      setError(`Failed to start: ${error.message || "Unknown error"}`);
      setTimeout(() => setError(null), 3000);
      setLoading(false);
      setAppStatus("Error starting");
    }
  };

  // Join room handler (when joining via link)
  const handleJoinRoom = async () => {
    try {
      const username = joinLeetCodeUsername.trim();

      if (!username) {
        setError("LeetCode username is required");
        setTimeout(() => setError(null), 2200);
        return;
      }

      if (!db) {
        setError("Database not ready. Please wait...");
        setTimeout(() => setError(null), 2200);
        return;
      }

      // Save username to localStorage
      localStorage.setItem("lb_leetcodeUsername", username);
      setCurrentLeetCodeUsername(username);

      // Get room from URL
      const params = new URLSearchParams(window.location.search);
      const roomId = params.get("room");

      if (!roomId) {
        setError("Invalid room link - no room ID found");
        setTimeout(() => setError(null), 2200);
        setShowJoinModal(false);
        return;
      }

      setLoading(true);
      setAppStatus("Joining room...");

      // Fetch room first before setting currentRoomId
      const sharedRoom = await fetchSharedRoom(roomId);

      if (!sharedRoom) {
        setError("Room not found");
        setTimeout(() => setError(null), 3000);
        setShowJoinModal(false);
        setLoading(false);
        setAppStatus("Room not found");
        return;
      }

      // Add username to room if not already present
      const updatedUsernames = [...(sharedRoom.usernames || [])];
      if (!updatedUsernames.includes(username)) {
        updatedUsernames.push(username);
      }

      // Save to Firebase with updated usernames directly
      const roomPath = typeof __app_id !== "undefined"
        ? `/artifacts/${appId}/rooms/${roomId}`
        : `rooms/${roomId}`;

      await setDoc(doc(db, roomPath), {
        id: roomId,
        name: sharedRoom.name || `Room ${roomId.substring(0, 8)}`,
        usernames: updatedUsernames
      }, { merge: true });

      // Update local state - start fresh with just this room (don't keep old rooms from localStorage)
      const newRoom = {
        id: roomId,
        name: sharedRoom.name || `Room ${roomId.substring(0, 8)}`,
        usernames: updatedUsernames
      };

      // Set currentRoomId AFTER we've verified the room exists and saved it
      setCurrentRoomId(roomId);
      setRooms([newRoom]);

      // Save to user's room list (only if we have currentUserId)
      if (currentUserId) {
        try {
          await saveUserRooms([newRoom]);
        } catch (saveError) {
          console.error("Error saving user rooms:", saveError);
          // Don't fail the join if this fails - room is already joined
        }
      }

      // Snapshot listener will update friendUsernames in real-time
      setShowJoinModal(false);
      setAppStatus("Joined room!");
      setLoading(false);

      // Clean URL
      try {
        window.history.replaceState({}, "", window.location.pathname);
      } catch (historyError) {
        console.error("Error updating history:", historyError);
        // Don't fail if history update fails
      }

      playBeep();
    } catch (e) {
      console.error("Error joining room:", e);
      setError(`Failed to join room: ${e.message || "Unknown error"}`);
      setTimeout(() => setError(null), 3000);
      setShowJoinModal(false);
      setCurrentRoomId(null); // Reset on error
      setLoading(false);
      setAppStatus("Error joining room");
    }
  };

  const deleteRoom = (roomId) => {
    if (rooms.length === 1) {
      setError("Cannot delete the last room");
      setTimeout(() => setError(null), 2200);
      return;
    }
    const updatedRooms = rooms.filter(r => r.id !== roomId);
    saveUserRooms(updatedRooms);
    if (currentRoomId === roomId) {
      setCurrentRoomId(updatedRooms[0].id);
    }
    playBeep();
  };

  const switchRoom = (roomId) => {
    // Clear messages immediately when switching rooms
    setMessages([]);
    setCurrentRoomId(roomId);
    playBeep();
  };

  const startEditRoom = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      setEditingRoomId(roomId);
      setEditingRoomName(room.name);
    }
  };

  const saveEditRoom = () => {
    if (!editingRoomId) return;
    const name = editingRoomName.trim();
    if (!name) {
      setError("Room name cannot be empty");
      setTimeout(() => setError(null), 2200);
      return;
    }
    if (rooms.some(r => r.id !== editingRoomId && r.name.toLowerCase() === name.toLowerCase())) {
      setError(`Room "${name}" already exists`);
      setTimeout(() => setError(null), 2200);
      return;
    }
    const updatedRooms = rooms.map(r =>
      r.id === editingRoomId ? { ...r, name } : r
    );
    // Update shared room name in Firebase (also include usernames to keep data in sync)
    const roomToUpdate = rooms.find(r => r.id === editingRoomId);
    if (roomToUpdate && db) {
      const roomPath = typeof __app_id !== "undefined"
        ? `/artifacts/${appId}/rooms/${editingRoomId}`
        : `rooms/${editingRoomId}`;
      setDoc(doc(db, roomPath), {
        name,
        usernames: roomToUpdate.usernames || []
      }, { merge: true });
    }
    saveUserRooms(updatedRooms);
    setEditingRoomId(null);
    setEditingRoomName("");
    playBeep();
  };

  const cancelEditRoom = () => {
    setEditingRoomId(null);
    setEditingRoomName("");
  };

  /* ---------------------------
     War functionality
     --------------------------- */
  // Get random LeetCode problem with difficulty filter
  // Note: LeetCode GraphQL API has CORS restrictions, so we use a curated list
  const getRandomProblem = async () => {
    try {
      // Comprehensive list of popular problems by difficulty
      const problemLists = {
        easy: [
          "two-sum", "reverse-linked-list", "merge-two-sorted-lists", "maximum-subarray",
          "climbing-stairs", "best-time-to-buy-and-sell-stock", "valid-parentheses",
          "palindrome-number", "remove-duplicates-from-sorted-array", "plus-one",
          "sqrtx", "valid-palindrome", "single-number", "contains-duplicate",
          "missing-number", "first-bad-version", "search-insert-position", "squares-of-a-sorted-array",
          "move-zeroes", "reverse-string", "intersection-of-two-arrays", "happy-number",
          "isomorphic-strings", "word-pattern", "power-of-two", "valid-anagram",
          "remove-element", "implement-strstr", "count-and-say", "maximum-depth-of-binary-tree"
        ],
        medium: [
          "add-two-numbers", "longest-substring-without-repeating-characters", "longest-palindromic-substring",
          "container-with-most-water", "3sum", "letter-combinations-of-a-phone-number",
          "remove-nth-node-from-end-of-list", "swap-nodes-in-pairs", "reverse-integer",
          "string-to-integer-atoi", "zigzag-conversion", "integer-to-roman",
          "longest-common-prefix", "group-anagrams", "product-of-array-except-self",
          "find-first-and-last-position-of-element-in-sorted-array", "search-in-rotated-sorted-array",
          "combination-sum", "permutations", "subsets", "word-search",
          "decode-ways", "unique-paths", "house-robber", "coin-change",
          "longest-increasing-subsequence", "course-schedule", "binary-tree-level-order-traversal"
        ],
        hard: [
          "median-of-two-sorted-arrays", "merge-k-sorted-lists", "reverse-nodes-in-k-group",
          "trapping-rain-water", "n-queens", "wildcard-matching", "regular-expression-matching",
          "longest-valid-parentheses", "edit-distance", "minimum-window-substring",
          "word-ladder", "serialize-and-deserialize-binary-tree", "sliding-window-maximum",
          "merge-intervals", "insert-interval", "word-break-ii", "palindrome-partitioning",
          "binary-tree-maximum-path-sum", "best-time-to-buy-and-sell-stock-iii", "candy"
        ],
        any: [
          "two-sum", "add-two-numbers", "longest-substring-without-repeating-characters",
          "median-of-two-sorted-arrays", "reverse-linked-list", "merge-two-sorted-lists",
          "valid-parentheses", "container-with-most-water", "3sum", "climbing-stairs"
        ]
      };

      const difficulty = warDifficulty || "any";
      const difficultyList = problemLists[difficulty] || problemLists.any;

      // Filter out recently used problems
      const recentProblems = usedProblems.slice(-20);
      const availableProblems = difficultyList.filter(slug => !recentProblems.includes(slug));
      const problemsToChooseFrom = availableProblems.length > 0 ? availableProblems : difficultyList;

      // Select random problem from the list
      const randomIndex = Math.floor(Math.random() * problemsToChooseFrom.length);
      const selectedSlug = problemsToChooseFrom[randomIndex];

      // Track this problem as used
      setUsedProblems(prev => [...prev, selectedSlug].slice(-20));

      // Map difficulty for display
      const difficultyMap = {
        easy: "EASY",
        medium: "MEDIUM",
        hard: "HARD",
        any: "MEDIUM"
      };

      console.log(`[Problem Selection] Selected random problem: ${selectedSlug} (${difficulty}) from ${problemsToChooseFrom.length} available problems`);

      return {
        link: `https://leetcode.com/problems/${selectedSlug}/`,
        slug: selectedSlug,
        title: selectedSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        difficulty: difficultyMap[difficulty] || "MEDIUM"
      };
    } catch (e) {
      // This should never happen since we're using a curated list, but just in case
      console.error("Unexpected error in getRandomProblem:", e);
      const fallbackSlug = "two-sum";
      return {
        link: `https://leetcode.com/problems/${fallbackSlug}/`,
        slug: fallbackSlug,
        title: "Two Sum",
        difficulty: "EASY"
      };
    }
  };

  // Start war
  const startWar = async () => {
    try {
      if (friendUsernames.length === 0) {
        setError("Add usernames to start a war!");
        setTimeout(() => setError(null), 2200);
        return;
      }

      // Set loading state to prevent UI issues
      setLoading(true);
      setAppStatus("Starting war...");

      // Set flag to prevent snapshot listener from interfering
      isUpdatingRef.current = true;

      const problem = await getRandomProblem();
      const warDuration = 3600; // 1 hour in seconds
      const startTime = Date.now();

      // Log the problem details for debugging
      console.log(`[War Start] Problem selected:`, {
        slug: problem.slug,
        title: problem.title,
        link: problem.link,
        difficulty: problem.difficulty
      });

      const newWarState = {
        active: true,
        problemLink: problem.link,
        problemSlug: problem.slug, // Store the exact slug from API
        problemTitle: problem.title || "", // Also store title for better matching
        startTime,
        duration: warDuration,
        winner: null,
        participants: friendUsernames,
        submissions: {},
        submissionCounts: {} // Track total submission count per user
      };

      // Update local state first for immediate UI feedback
      setWarState(newWarState);
      setWarTimer(warDuration);
      setWarSubmissions({});

      // Save to shared room (room-specific)
      await saveSharedRoom({ war: newWarState });

      // Update the ref so snapshot listener knows about this change
      if (lastRoomDataRef.current) {
        lastRoomDataRef.current = { ...lastRoomDataRef.current, war: newWarState };
      }

      setAppStatus("War started!");
      playBeep();

      // Reset flag after a delay to allow snapshot to process
      setTimeout(() => {
        isUpdatingRef.current = false;
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error("[War Start] Error starting war:", error);
      setError("Failed to start war. Please try again.");
      setTimeout(() => setError(null), 3000);
      setLoading(false);
      setAppStatus("Error starting war");
      isUpdatingRef.current = false; // Reset flag on error

      // Clear any partial war state
      setWarState(null);
      setWarTimer(0);
      setWarSubmissions({});
    }
  };

  // Stop war
  const stopWar = async () => {
    if (!warState || !warState.active) return;

    const updatedWar = {
      ...warState,
      active: false,
      cancelled: true, // Mark as cancelled for clarity
      cancelledAt: Date.now() // Track when it was cancelled
    };

    // Save to Firebase first to ensure all users see the cancellation
    console.log("[War Cancel] Cancelling war and syncing to Firebase");
    await saveSharedRoom({ war: updatedWar });

    // Update local state - snapshot listener will also update this, but set it immediately for responsiveness
    setWarState(updatedWar);
    setWarSubmissions({}); // Clear submissions when war is cancelled
    playBeep();
  };

  // Clear/dismiss war card
  const clearWar = async () => {
    if (!warState) return;

    // Clear war from Firebase
    console.log("[War Clear] Clearing war state");
    await saveSharedRoom({ war: null });

    // Clear local state
    setWarState(null);
    setWarSubmissions({});
    setWarTimer(0);
    playBeep();
  };

  // Send a chat message
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !currentLeetCodeUsername || !currentRoomId || !db || !SHARED_ROOM_PATH) {
      return;
    }

    const message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      username: currentLeetCodeUsername,
      text: newMessage.trim(),
      timestamp: Date.now()
    };

    try {
      // Set flag to prevent snapshot listener from processing this update
      isUpdatingRef.current = true;

      // Get current room data
      const docRef = doc(db, SHARED_ROOM_PATH);
      const currentDoc = await getDoc(docRef);
      const currentData = currentDoc.exists() ? currentDoc.data() : {};

      // Get existing messages or initialize empty array
      const existingMessages = currentData.messages || [];

      // Add new message (limit to last 100 messages to prevent document size issues)
      const updatedMessages = [...existingMessages, message].slice(-100);

      // Save to Firebase - only update messages field to minimize snapshot triggers
      await setDoc(docRef, { messages: updatedMessages }, { merge: true });

      // Update the ref so snapshot listener knows about this change
      if (lastRoomDataRef.current) {
        lastRoomDataRef.current = { ...lastRoomDataRef.current, messages: updatedMessages };
      }

      // Clear input immediately for better UX
      setNewMessage("");
      playBeep();

      // Reset flag after a short delay to allow snapshot to process if needed
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 500);
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to send message");
      setTimeout(() => setError(null), 3000);
      isUpdatingRef.current = false; // Reset flag on error
    }
  }, [newMessage, currentLeetCodeUsername, currentRoomId, db, SHARED_ROOM_PATH]);

  // Listen to messages for current room
  useEffect(() => {
    if (!db || !SHARED_ROOM_PATH || !currentRoomId) {
      setMessages([]);
      return;
    }

    const docRef = doc(db, SHARED_ROOM_PATH);
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const roomMessages = data.messages || [];
        // Ensure messages are sorted by timestamp
        const sortedMessages = [...roomMessages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        // Only update if messages actually changed to prevent unnecessary re-renders
        setMessages(prevMessages => {
          const prevStr = JSON.stringify(prevMessages.map(m => ({ id: m.id, timestamp: m.timestamp })));
          const newStr = JSON.stringify(sortedMessages.map(m => ({ id: m.id, timestamp: m.timestamp })));
          if (prevStr !== newStr) {
            return sortedMessages;
          }
          return prevMessages; // Return previous to prevent re-render
        });
      } else {
        setMessages(prevMessages => {
          if (prevMessages.length > 0) {
            return [];
          }
          return prevMessages; // Already empty, no change
        });
      }
    }, (err) => {
      console.error("Firestore messages snapshot error", err);
    });

    return () => unsub();
  }, [db, SHARED_ROOM_PATH, currentRoomId]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  /* ---------------------------
     WebRTC Voice Call Functions
     --------------------------- */

  // WebRTC configuration (using public STUN servers)
  // WebRTC configuration (using public STUN servers)
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ],
    iceCandidatePoolSize: 10
  };

  // Get user media (microphone)
  const getUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setError("Failed to access microphone. Please check permissions.");
      setTimeout(() => setError(null), 3000);
      return null;
    }
  };

  // Create peer connection for a user
  const createPeerConnection = (username) => {
    const pc = new RTCPeerConnection(rtcConfig);

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(`[Voice] Received remote stream from ${username}`);
      const [remoteStream] = event.streams;

      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(username, remoteStream);
        return newMap;
      });

      // Create audio element for remote stream
      const audio = new Audio();
      audio.srcObject = remoteStream;
      // audio.autoplay = true; // Removed to avoid conflict with explicit play()
      audio.volume = isSpeakerMuted ? 0 : 1;
      // Explicitly play to handle autoplay policies
      audio.play().catch(e => {
        // Ignore AbortError which happens if cleanup occurs during load
        if (e.name === 'NotAllowedError') {
          console.warn("[Voice] Autoplay blocked, showing manual unlock UI");
          setAudioUnlockNeeded(true);
        } else if (e.name !== 'AbortError') {
          console.error("[Voice] Audio play error:", e);
        }
      });
      audioElementsRef.current.set(username, audio);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && db && SHARED_ROOM_PATH) {
        // Send ICE candidate via Firebase - use a document ID that includes both usernames
        const signalingDocId = `signal_${currentLeetCodeUsername}_${username}_${Date.now()}`;
        const roomDocRef = doc(db, SHARED_ROOM_PATH);
        const signalingDocRef = doc(roomDocRef, 'voiceSignaling', signalingDocId);
        setDoc(signalingDocRef, {
          from: currentLeetCodeUsername,
          to: username,
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(), // Serialize to plain object
          timestamp: Date.now()
        }, { merge: true }).catch(err => console.error("Error sending ICE candidate:", err));
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[Voice] Connection state with ${username}:`, pc.connectionState);
      setDebugInfo(prev => ({
        ...prev,
        [username]: {
          ...(prev[username] || {}),
          connectionState: pc.connectionState,
          signalingState: pc.signalingState
        }
      }));

      if (pc.connectionState === 'failed') {
        // Only clean up on fatal failure, not temporary disconnection
        cleanupPeerConnection(username);
      }
    };

    pc.onsignalingstatechange = () => {
      setDebugInfo(prev => ({
        ...prev,
        [username]: {
          ...(prev[username] || {}),
          signalingState: pc.signalingState
        }
      }));
    };

    peerConnectionsRef.current.set(username, pc);
    return pc;
  };

  // Clean up peer connection
  const cleanupPeerConnection = (username) => {
    const pc = peerConnectionsRef.current.get(username);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(username);
    }

    const audio = audioElementsRef.current.get(username);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audioElementsRef.current.delete(username);
    }

    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(username);
      return newMap;
    });

    if (pendingCandidatesRef.current.has(username)) {
      pendingCandidatesRef.current.delete(username);
    }
  };

  // Start or join voice call
  const startVoiceCall = async () => {
    if (!currentLeetCodeUsername || !currentRoomId || !db) {
      setError("Cannot start call: missing user info");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (friendUsernames.length === 0) {
      setError("Add users to the room to start a voice call");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setLoading(true);

      // Check if there's already an active call
      const roomDoc = await getDoc(doc(db, SHARED_ROOM_PATH));
      const existingCall = roomDoc.exists() ? roomDoc.data()?.voiceCall : null;

      let participants = [];
      let isJoiningExistingCall = false;

      if (existingCall && existingCall.active) {
        // Join existing call
        isJoiningExistingCall = true;
        participants = [...(existingCall.participants || [])];
        if (!participants.includes(currentLeetCodeUsername)) {
          participants.push(currentLeetCodeUsername);
        }
        console.log(`[Voice] Joining existing call with participants: ${participants.join(', ')}`);
      } else {
        // Start new call
        participants = [currentLeetCodeUsername, ...friendUsernames.filter(u => u !== currentLeetCodeUsername)];
        console.log(`[Voice] Starting new call with participants: ${participants.join(', ')}`);
      }

      // Get user media
      const stream = await getUserMedia();
      if (!stream) {
        // setIsInCall(false); // Not needed as we haven't set it true yet
        setLoading(false);
        return;
      }

      setIsInCall(true);
      setIsCallActive(false);

      // Update Firebase with new participant list
      await setDoc(doc(db, SHARED_ROOM_PATH), {
        voiceCall: {
          active: true,
          participants: participants,
          startedBy: existingCall?.startedBy || currentLeetCodeUsername,
          startedAt: existingCall?.startedAt || Date.now(),
          lastUpdated: Date.now()
        }
      }, { merge: true });

      // Signaling will be handled by the useEffect listener below
      signalingChannelRef.current = { active: true };

      // Create peer connections for all other users in the call
      const otherUsers = participants.filter(u => u !== currentLeetCodeUsername);
      setCallParticipants(participants);

      // Create offer for each peer (only for users we don't have connections with)
      for (const username of otherUsers) {
        // Skip if we already have a connection
        if (peerConnectionsRef.current.has(username)) {
          continue;
        }

        // Deterministic Initiator: Only initiate if my username < their username
        // This prevents "glare" (collisions) where both sides try to offer at once.
        if (currentLeetCodeUsername < username) {
          console.log(`[Voice] Initiating connection to ${username} (I am initiator)`);
          const pc = createPeerConnection(username);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const offerDocId = `offer_${currentLeetCodeUsername}_${username}_${Date.now()}`;
          const roomDocRef = doc(db, SHARED_ROOM_PATH);
          const offerDocRef = doc(roomDocRef, 'voiceSignaling', offerDocId);
          await setDoc(offerDocRef, {
            from: currentLeetCodeUsername,
            to: username,
            type: 'offer',
            offer: { type: offer.type, sdp: offer.sdp },
            timestamp: Date.now()
          }, { merge: true });
        } else {
          console.log(`[Voice] Waiting for connection from ${username} (I am passive)`);
        }
      }

      setIsCallActive(true);
      setLoading(false);
      playBeep();
    } catch (error) {
      console.error("[Voice] Error starting/joining call:", error);
      setError("Failed to start/join voice call");
      setTimeout(() => setError(null), 3000);
      // Remove user from call on error
      await leaveVoiceCall();
      setLoading(false);
    }
  };

  // Leave voice call (remove user from call, but keep call active if others are in it)
  const leaveVoiceCall = async () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc, username) => {
      cleanupPeerConnection(username);
    });
    peerConnectionsRef.current.clear();
    audioElementsRef.current.clear();

    // Clear remote streams
    setRemoteStreams(new Map());

    // Clean up signaling
    if (signalingChannelRef.current?.unsub) {
      signalingChannelRef.current.unsub();
      signalingChannelRef.current = null;
    }

    // Update Firebase - remove user from participants, or remove call if no one left
    if (db && SHARED_ROOM_PATH) {
      try {
        const docRef = doc(db, SHARED_ROOM_PATH);
        const currentDoc = await getDoc(docRef);
        if (currentDoc.exists()) {
          const currentData = currentDoc.data();
          const voiceCall = currentData.voiceCall;

          if (voiceCall && voiceCall.active && voiceCall.participants) {
            // Remove current user from participants
            const updatedParticipants = voiceCall.participants.filter(
              (p) => p !== currentLeetCodeUsername
            );

            if (updatedParticipants.length === 0) {
              // No participants left - remove call completely
              await setDoc(docRef, {
                ...currentData,
                voiceCall: deleteField()
              }, { merge: true });
            } else {
              // Update participants list
              await setDoc(docRef, {
                ...currentData,
                voiceCall: {
                  ...voiceCall,
                  participants: updatedParticipants,
                  lastUpdated: Date.now()
                }
              }, { merge: true });
            }
          }
        }
      } catch (err) {
        console.error("Error updating call status:", err);
      }
    }

    setIsInCall(false);
    setIsMuted(false);
    // Don't set isCallActive to false here - let the snapshot listener handle it
    // This way if others are still in the call, we'll see it's still active
    playBeep();
  };

  // End voice call (alias for leaveVoiceCall for backward compatibility)
  const endVoiceCall = leaveVoiceCall;

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.enabled = isMuted; // Toggle: if muted, enable; if not muted, disable
      });
      setIsMuted(!isMuted);
      playBeep();
    }
  };

  // Toggle speaker mute
  const toggleSpeakerMute = () => {
    const newMuted = !isSpeakerMuted;
    setIsSpeakerMuted(newMuted);

    // Update all audio elements
    audioElementsRef.current.forEach((audio) => {
      audio.volume = newMuted ? 0 : 1;
    });
    playBeep();
  };

  // Resume audio manually (for handling autoplay policies)
  const resumeAudio = () => {
    audioElementsRef.current.forEach((audio) => {
      audio.play().catch(e => console.error("Error resuming audio:", e));
    });
    setAudioUnlockNeeded(false);
  };

  // Listen for voice call signaling and handle WebRTC negotiation
  useEffect(() => {
    if (!db || !SHARED_ROOM_PATH || !currentRoomId || !currentLeetCodeUsername || !isInCall) {
      return;
    }

    // Use collection query to listen for all signaling messages directed to current user
    // Create subcollection reference properly using document reference
    const roomDocRef = doc(db, SHARED_ROOM_PATH);
    const signalingCollection = collection(roomDocRef, 'voiceSignaling');
    const q = query(
      signalingCollection,
      where('to', '==', currentLeetCodeUsername),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubSignaling = onSnapshot(q, async (snapshot) => {
      // Sort changes by timestamp ASCENDING to ensure Offers are processed before Candidates
      const changes = snapshot.docChanges();
      changes.sort((a, b) => {
        const da = a.doc.data();
        const db = b.doc.data();
        return (da.timestamp || 0) - (db.timestamp || 0);
      });

      for (const change of changes) {
        if (change.type !== 'added') return; // Only process new messages

        const data = change.doc.data();
        const fromUser = data.from;

        if (!fromUser || fromUser === currentLeetCodeUsername) return;

        // Handle offer
        if (data.type === 'offer' && data.offer) {
          console.log(`[Voice] Received offer from ${fromUser}`);

          // Create peer connection if it doesn't exist
          let pc = peerConnectionsRef.current.get(fromUser);
          if (!pc) {
            pc = createPeerConnection(fromUser);
          }

          try {
            // Set remote description
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

            // Process any pending ICE candidates
            const pendingCandidates = pendingCandidatesRef.current.get(fromUser);
            if (pendingCandidates && pendingCandidates.length > 0) {
              console.log(`[Voice] Processing ${pendingCandidates.length} buffered candidates for ${fromUser}`);
              for (const candidate of pendingCandidates) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                  console.error(`[Voice] Error adding buffered ICE candidate from ${fromUser}:`, err);
                }
              }
              pendingCandidatesRef.current.delete(fromUser);
            }

            // Create and send answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Send answer via Firebase
            const answerDocId = `answer_${currentLeetCodeUsername}_${fromUser}_${Date.now()}`;
            const roomDocRef = doc(db, SHARED_ROOM_PATH);
            const answerDocRef = doc(roomDocRef, 'voiceSignaling', answerDocId);
            await setDoc(answerDocRef, {
              from: currentLeetCodeUsername,
              to: fromUser,
              type: 'answer',
              answer: { type: answer.type, sdp: answer.sdp }, // Serialize to plain object
              timestamp: Date.now()
            }, { merge: true });
          } catch (err) {
            console.error(`[Voice] Error handling offer from ${fromUser}:`, err);
          }
        }

        // Handle answer
        if (data.type === 'answer' && data.answer) {
          console.log(`[Voice] Received answer from ${fromUser}`);

          const pc = peerConnectionsRef.current.get(fromUser);
          if (pc && pc.signalingState !== 'stable') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            } catch (err) {
              console.error(`[Voice] Error handling answer from ${fromUser}:`, err);
            }
          }
        }

        // Handle ICE candidate
        if (data.type === 'ice-candidate' && data.candidate) {
          const pc = peerConnectionsRef.current.get(fromUser);
          if (pc) {
            try {
              // Check signaling state before adding candidate
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } else {
                // Buffer candidate if remote description is not set yet
                console.log(`[Voice] Buffering ICE candidate from ${fromUser} (remote desc not ready)`);
                if (!pendingCandidatesRef.current.has(fromUser)) {
                  pendingCandidatesRef.current.set(fromUser, []);
                }
                pendingCandidatesRef.current.get(fromUser).push(data.candidate);
              }
            } catch (err) {
              console.error(`[Voice] Error adding ICE candidate from ${fromUser}:`, err);
            }
          } else {
            // Buffer candidate if PC doesn't exist yet
            console.log(`[Voice] Buffering ICE candidate from ${fromUser} (PC not ready)`);
            if (!pendingCandidatesRef.current.has(fromUser)) {
              pendingCandidatesRef.current.set(fromUser, []);
            }
            pendingCandidatesRef.current.get(fromUser).push(data.candidate);
          }
        }
      }
    }, (err) => {
      console.error("[Voice] Signaling listener error:", err);
    });




    return () => {
      unsubSignaling();
    };
  }, [db, SHARED_ROOM_PATH, currentRoomId, currentLeetCodeUsername, /* friendUsernames, */ isInCall]); // Removed friendUsernames to avoid re-subscribing unnecessarily

  // Auto-connect to new participants (Mesh networking)
  useEffect(() => {
    if (!isInCall || !db || !currentLeetCodeUsername) return;

    const connectToNewParticipants = async () => {
      for (const username of callParticipants) {
        if (username === currentLeetCodeUsername) continue;

        // If we don't have a connection, and we correspond to the deterministic initiator rule
        if (!peerConnectionsRef.current.has(username) && currentLeetCodeUsername < username) {
          console.log(`[Voice] Auto-connecting to new participant ${username}`);
          const pc = createPeerConnection(username);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const offerDocId = `offer_${currentLeetCodeUsername}_${username}_${Date.now()}`;
            const roomDocRef = doc(db, SHARED_ROOM_PATH);
            const offerDocRef = doc(roomDocRef, 'voiceSignaling', offerDocId);
            await setDoc(offerDocRef, {
              from: currentLeetCodeUsername,
              to: username,
              type: 'offer',
              offer: { type: offer.type, sdp: offer.sdp },
              timestamp: Date.now()
            }, { merge: true });
          } catch (e) {
            console.error("[Voice] Error auto-connecting:", e);
          }
        }
      }
    };

    connectToNewParticipants();
  }, [callParticipants, isInCall, currentLeetCodeUsername, db, SHARED_ROOM_PATH]);

  // Voice call state is now synced via the main room snapshot listener above
  // This listener is no longer needed as voiceCall is part of room data

  // Cleanup on unmount or room change
  useEffect(() => {
    return () => {
      if (isInCall) {
        try {
          // Clean up voice call resources
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
          }
          peerConnectionsRef.current.forEach((pc) => {
            try {
              pc.close();
            } catch (e) {
              console.error("Error closing peer connection:", e);
            }
          });
          peerConnectionsRef.current.clear();
          audioElementsRef.current.forEach((audio) => {
            try {
              audio.pause();
              audio.srcObject = null;
            } catch (e) {
              console.error("Error cleaning up audio:", e);
            }
          });
          audioElementsRef.current.clear();
          setIsInCall(false);
          setIsCallActive(false);
        } catch (error) {
          console.error("Error in voice call cleanup:", error);
        }
      }
    };
  }, [currentRoomId, isInCall]); // Clean up when switching rooms

  // Ref to store checkSubmissions function for manual refresh
  const checkSubmissionsRef = useRef(null);
  const isCheckingRef = useRef(false);

  // Manual refresh function for submissions
  const manualRefreshSubmissions = async () => {
    if (!warState || !warState.active || warState.winner || warState.cancelled || !warState.problemSlug) {
      setError("No active war to refresh");
      setTimeout(() => setError(null), 2200);
      return;
    }

    if (isCheckingRef.current) {
      setError("Already checking submissions, please wait...");
      setTimeout(() => setError(null), 2200);
      return;
    }

    // Call the check function if available
    if (checkSubmissionsRef.current) {
      console.log("[Manual Refresh] Manually triggering submission check");
      isCheckingRef.current = true;
      setAppStatus("Checking submissions...");
      try {
        await checkSubmissionsRef.current();
        setAppStatus("Submissions updated");
        playBeep();
      } catch (error) {
        console.error("[Manual Refresh] Error checking submissions:", error);
        setError(error.message || "Failed to check submissions");
        setTimeout(() => setError(null), 3000);
      } finally {
        // Reset after a delay to allow the check to complete
        setTimeout(() => {
          isCheckingRef.current = false;
        }, 5000);
      }
    } else {
      setError("Submission checker not ready yet");
      setTimeout(() => setError(null), 2200);
    }
  };

  // Setup submission checker for manual refresh only (no automatic polling)
  useEffect(() => {
    // Stop checking if war is not active, has a winner, is cancelled, or missing problem slug
    if (!warState || !warState.active || warState.winner || warState.cancelled || !warState.problemSlug) {
      checkSubmissionsRef.current = null;
      return;
    }

    // No intervals needed - only manual refresh
    let isRateLimited = false;
    let backoffTimeout = null;
    const warStateRef = { current: warState }; // Ref to track latest warState

    // Update ref when warState changes
    const updateRef = () => {
      warStateRef.current = warState;
    };
    updateRef();

    // Track last check time to prevent too frequent manual checks
    let lastCheckTime = 0;
    const MIN_CHECK_INTERVAL = 30 * 1000; // Minimum 30 seconds between manual checks

    const checkSubmissions = async () => {
      // Skip if rate limited - wait for backoff period
      if (isRateLimited) {
        console.log("[War Check] Skipping check - rate limited, waiting...");
        return;
      }

      // Prevent checks too close together (additional safety)
      const now = Date.now();
      if (now - lastCheckTime < MIN_CHECK_INTERVAL) {
        console.log(`[War Check] Skipping check - too soon since last check (${Math.round((now - lastCheckTime) / 1000)}s ago)`);
        return;
      }
      lastCheckTime = now;

      // Get latest warState from ref to avoid stale closure
      const currentWar = warStateRef.current;
      // Stop checking if war is not active, has winner, is cancelled, or missing problem slug
      if (!currentWar || !currentWar.active || currentWar.winner || currentWar.cancelled || !currentWar.problemSlug) {
        console.log("[War Check] Stopping checks - war cancelled or inactive");
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        return;
      }

      console.log(`[War Check] Checking submissions for problem: ${currentWar.problemSlug}, started at: ${new Date(currentWar.startTime).toISOString()}`);

      try {
        // Start with existing submissions from warState
        const updatedSubmissions = { ...(currentWar.submissions || {}) };
        const updatedCounts = { ...(currentWar.submissionCounts || {}) };
        let winner = null;
        let hasUpdates = false;

        // Check each participant's recent submissions for the specific problem
        // Process sequentially with longer delays to avoid rate limits
        for (let index = 0; index < currentWar.participants.length; index++) {
          const username = currentWar.participants[index];

          // Longer delay between requests to avoid rate limits (5 seconds per user)
          if (index > 0) {
            await new Promise(r => setTimeout(r, 5000)); // 5 second delay between each user to reduce rate limiting
          }

          try {
            // Fetch more submissions to ensure we get all submissions since war started
            // Note: LeetCode's public API is limited to ~20 most recent submissions
            // The third-party API wrapper may have similar limitations
            // Calculate how many submissions we might need (war duration in minutes / average submission time)
            // For safety, fetch at least 50 submissions, but API may only return 20
            const warDurationMinutes = (Date.now() - currentWar.startTime) / (1000 * 60);
            const estimatedLimit = Math.max(50, Math.min(200, Math.ceil(warDurationMinutes * 2))); // Assume max 2 submissions per minute

            console.log(`[War Check] Fetching submissions for ${username} with limit=${estimatedLimit} (war started ${Math.round(warDurationMinutes)} minutes ago)`);
            const submission = await fetchWithRetry(`${API_BASE_URL}/${username}/submission?limit=${estimatedLimit}`);

            if (submission && Array.isArray(submission) && submission.length > 0) {
              console.log(`[War Check] Fetched ${submission.length} submissions for ${username} (requested ${estimatedLimit})`);

              // Warn if we got fewer submissions than requested (API limitation)
              if (submission.length < estimatedLimit && submission.length < 50) {
                console.warn(`[War Check] ⚠️ API only returned ${submission.length} submissions (requested ${estimatedLimit}). This may be an API limitation.`);
              }

              // Check if the oldest submission is still within war time
              // If not, we might be missing submissions due to API limit
              const oldestSubmission = submission[submission.length - 1];
              if (oldestSubmission) {
                const oldestTime = parseInt(oldestSubmission.timestamp || "0", 10) * 1000;
                if (oldestTime > currentWar.startTime && submission.length >= 20) {
                  console.warn(`[War Check] ⚠️ Oldest submission (${new Date(oldestTime).toISOString()}) is still within war time, but we got ${submission.length} submissions. API may be limiting results.`);
                }
              }

              // Find all submissions for this specific problem during the war
              let submissionCount = 0;
              let latestSubmission = null;
              let latestTime = 0;

              for (const sub of submission) {
                const submissionTime = parseInt(sub.timestamp || "0", 10) * 1000;

                // Debug: Log submission details
                if (submissionTime >= currentWar.startTime) {
                  console.log(`[War Check] ${username} submission at ${new Date(submissionTime).toISOString()}: ${sub.title || sub.titleSlug || "Unknown"} - Status: ${sub.statusDisplay || sub.status || sub.statusCode}`);
                }

                // Only count submissions made during the war
                if (submissionTime < currentWar.startTime) {
                  continue; // Skip submissions before war started
                }

                // Normalize both problem slug and submission slug for comparison
                // Remove all special characters and normalize spaces/hyphens
                const normalizeSlug = (slug) => {
                  if (!slug) return "";
                  return slug.toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9-]/g, "-")  // Replace special chars with hyphens
                    .replace(/-+/g, "-")          // Replace multiple hyphens with single
                    .replace(/^-|-$/g, "");        // Remove leading/trailing hyphens
                };

                const problemSlug = normalizeSlug(currentWar.problemSlug);
                const warProblemTitle = normalizeSlug((currentWar.problemTitle || "").replace(/\s+/g, "-"));
                const titleSlug = normalizeSlug(sub.titleSlug);
                const submissionTitle = normalizeSlug((sub.title || "").replace(/\s+/g, "-"));

                // Try multiple ways to match the problem
                const slugMatch =
                  // Exact matches (most reliable) - check slug to slug
                  titleSlug === problemSlug ||
                  // Check if submission title matches war problem title (if we have it)
                  (warProblemTitle && submissionTitle && (warProblemTitle === submissionTitle || warProblemTitle.includes(submissionTitle) || submissionTitle.includes(warProblemTitle))) ||
                  // Title slug contains problem slug or vice versa
                  (titleSlug && problemSlug && (titleSlug.includes(problemSlug) || problemSlug.includes(titleSlug))) ||
                  // Submission title matches problem slug
                  (submissionTitle && problemSlug && (submissionTitle.includes(problemSlug) || problemSlug.includes(submissionTitle))) ||
                  // Check if they share significant words (at least 2 words match)
                  (() => {
                    const slugWords = problemSlug.split("-").filter(w => w.length > 2);
                    const titleWords = titleSlug.split("-").filter(w => w.length > 2);
                    if (slugWords.length === 0 || titleWords.length === 0) return false;
                    const matchingWords = slugWords.filter(word => titleWords.includes(word));
                    return matchingWords.length >= Math.min(2, Math.min(slugWords.length, titleWords.length));
                  })();

                // Log all submissions during war for debugging
                if (submissionTime >= currentWar.startTime) {
                  console.log(`[War Check] 🔍 Checking match for ${username}:`, {
                    originalProblemSlug: currentWar.problemSlug,
                    normalizedProblemSlug: problemSlug,
                    warProblemTitle: currentWar.problemTitle,
                    normalizedWarTitle: warProblemTitle,
                    submissionTitleSlug: sub.titleSlug,
                    normalizedTitleSlug: titleSlug,
                    submissionTitle: sub.title,
                    normalizedSubmissionTitle: submissionTitle,
                    slugMatch: slugMatch,
                    status: sub.statusDisplay || sub.status || sub.statusCode,
                    statusCode: sub.statusCode,
                    timestamp: new Date(submissionTime).toISOString()
                  });
                }

                if (slugMatch) {
                  submissionCount++;
                  console.log(`[War Check] ✓✓✓ MATCH FOUND for ${username}: ${sub.title || sub.titleSlug} - Status: ${sub.statusDisplay || sub.status || sub.statusCode} - Time: ${new Date(submissionTime).toISOString()}`);

                  // Track the latest submission
                  if (submissionTime > latestTime) {
                    latestTime = submissionTime;
                    latestSubmission = sub;
                    console.log(`[War Check] Updated latest submission for ${username} at ${new Date(latestTime).toISOString()}`);
                  }
                }
              }

              // Update submission count
              if (submissionCount > 0) {
                updatedCounts[username] = submissionCount;
                hasUpdates = true;
                console.log(`[War Check] ${username} has ${submissionCount} submission(s) during war`);
              }

              // Update latest submission status
              if (latestSubmission) {
                // Try multiple ways to get the status - LeetCode API can return it in different fields
                const status = latestSubmission.statusDisplay ||
                  latestSubmission.status ||
                  latestSubmission.statusCode ||
                  latestSubmission.status_code ||
                  (latestSubmission.statusDisplay === undefined && latestSubmission.status === undefined ?
                    (latestSubmission.statusCode === 10 ? "Accepted" :
                      latestSubmission.statusCode === 11 ? "Wrong Answer" :
                        latestSubmission.statusCode === 12 ? "Memory Limit Exceeded" :
                          latestSubmission.statusCode === 13 ? "Output Limit Exceeded" :
                            latestSubmission.statusCode === 14 ? "Time Limit Exceeded" :
                              latestSubmission.statusCode === 15 ? "Runtime Error" :
                                latestSubmission.statusCode === 16 ? "Internal Error" :
                                  latestSubmission.statusCode === 20 ? "Compile Error" :
                                    "Unknown") : "Unknown");

                const existingSubmission = updatedSubmissions[username];

                // Always update if we don't have a submission, or if this is newer (even by 1ms)
                if (!existingSubmission || latestTime >= existingSubmission.time) {
                  console.log(`[War Check] Updating ${username} status: ${status} (time: ${new Date(latestTime).toISOString()})`);
                  console.log(`[War Check] Submission details:`, {
                    statusDisplay: latestSubmission.statusDisplay,
                    status: latestSubmission.status,
                    statusCode: latestSubmission.statusCode,
                    status_code: latestSubmission.status_code,
                    title: latestSubmission.title,
                    titleSlug: latestSubmission.titleSlug
                  });

                  updatedSubmissions[username] = {
                    status: status,
                    time: latestTime,
                    runtime: latestSubmission.runtime || latestSubmission.runtimeDisplay || "N/A",
                    memory: latestSubmission.memory || latestSubmission.memoryDisplay || "N/A"
                  };
                  hasUpdates = true;

                  // Check if this is the first accepted submission
                  const isAccepted = status === "Accepted" ||
                    String(status).toLowerCase().includes("accepted") ||
                    String(status) === "10" || // LeetCode sometimes uses status codes
                    String(latestSubmission.statusCode) === "10" ||
                    latestSubmission.statusCode === 10 ||
                    latestSubmission.status_code === 10;
                  if (isAccepted && !winner) {
                    console.log(`[War Check] 🏆 Winner found: ${username} with Accepted submission!`);
                    winner = username;
                  }
                } else {
                  console.log(`[War Check] ${username} submission not newer (existing: ${new Date(existingSubmission.time).toISOString()}, new: ${new Date(latestTime).toISOString()})`);
                }
              } else if (submissionCount === 0 && currentWar.problemSlug) {
                // No matching submissions found - log for debugging
                console.log(`[War Check] ⚠️ No match found for ${username} with problem slug: ${currentWar.problemSlug} during war (started at ${new Date(currentWar.startTime).toISOString()})`);
                console.log(`[War Check] Available submissions (first 3):`, submission.slice(0, 3).map(s => ({
                  title: s.title,
                  titleSlug: s.titleSlug,
                  time: new Date(parseInt(s.timestamp || "0", 10) * 1000).toISOString(),
                  status: s.statusDisplay || s.status || s.statusCode
                })));
              }
            }
          } catch (e) {
            // Handle rate limit errors with backoff
            if (e.message === "Rate limited" || e.message?.includes("429")) {
              console.warn("Rate limited detected, pausing checks for 10 minutes");
              isRateLimited = true;
              // Clear current interval
              if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
              }
              // Clear any existing backoff timeout
              if (backoffTimeout) clearTimeout(backoffTimeout);
              // Set backoff period (15 minutes) - longer backoff to avoid repeated rate limits
              backoffTimeout = setTimeout(() => {
                isRateLimited = false;
                backoffTimeout = null;
                // Restart checking with much longer interval (15 minutes after rate limit)
                checkInterval = setInterval(checkSubmissions, 15 * 60 * 1000);
              }, 15 * 60 * 1000); // 15 minutes backoff (increased from 10 minutes)
              break; // Stop checking other users
            } else {
              console.error(`Error checking ${username}:`, e);
            }
          }
        }

        // Always update submissions state (even if no new ones found, sync existing ones)
        // This ensures UI stays in sync with Firebase
        const submissionsChanged = JSON.stringify(updatedSubmissions) !== JSON.stringify(currentWar.submissions || {});
        const countsChanged = JSON.stringify(updatedCounts) !== JSON.stringify(currentWar.submissionCounts || {});

        console.log(`[War Check] ===== SUMMARY =====`);
        console.log(`[War Check] hasUpdates: ${hasUpdates}, submissionsChanged: ${submissionsChanged}, countsChanged: ${countsChanged}`);
        console.log(`[War Check] Winner: ${winner || "None yet"}`);
        console.log(`[War Check] Updated submissions:`, JSON.stringify(updatedSubmissions, null, 2));
        console.log(`[War Check] Updated counts:`, JSON.stringify(updatedCounts, null, 2));
        console.log(`[War Check] ===================`);

        // Always update to ensure UI is in sync, even if no changes detected
        // Force update by always setting state (React will handle deduplication)
        setWarSubmissions(updatedSubmissions);

        // Use functional update to merge with latest state
        // Always save to Firebase when there are changes to ensure sync
        setWarState(prevWar => {
          if (!prevWar || prevWar.problemSlug !== currentWar.problemSlug) {
            return prevWar; // Don't update if war changed
          }

          // Always create a new object to force React to detect the update
          const updatedWar = {
            ...prevWar,
            submissions: updatedSubmissions,
            submissionCounts: updatedCounts
          };

          if (winner) {
            console.log(`[War Check] 🎉🎉🎉 WAR ENDED! Winner: ${winner} 🎉🎉🎉`);
            updatedWar.active = false;
            updatedWar.winner = winner;
            // Save to Firebase and update state (only when winner is found)
            saveSharedRoom({ war: updatedWar }).then(() => {
              console.log(`[War Check] Winner saved to Firebase: ${winner}`);
              setWarState(updatedWar);
              if (checkInterval) clearInterval(checkInterval);
              playBeep();
              burstMicro(document.getElementById("burst-root"), 20);
            });
            return updatedWar;
          } else {
            // Save to Firebase if submissions or counts changed (or if we have updates)
            // This ensures status updates are synced across all users
            if (submissionsChanged || countsChanged || hasUpdates) {
              console.log(`[War Check] Saving updates to Firebase...`);
              saveSharedRoom({ war: updatedWar }).then(() => {
                console.log(`[War Check] ✓ War state saved to Firebase`);
              }).catch(err => {
                console.error(`[War Check] ✗ Error saving to Firebase:`, err);
              });
            }
            // Update ref immediately
            warStateRef.current = updatedWar;
            return updatedWar;
          }
        });
      } catch (e) {
        console.error("Error checking for winner:", e);
      }
    };

    // NO AUTOMATIC POLLING - only manual refresh via button to avoid rate limiting
    // Store check function in ref for manual refresh only
    checkSubmissionsRef.current = checkSubmissions;

    // User must click "Refresh" button to check submissions - no automatic intervals

    // Update ref when warState changes (no interval needed)
    const updateRefOnChange = () => {
      warStateRef.current = warState;
    };
    updateRefOnChange();

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (backoffTimeout) clearTimeout(backoffTimeout);
      checkSubmissionsRef.current = null; // Clear ref on cleanup
    };
  }, [warState?.active, warState?.startTime, warState?.participants, warState?.problemSlug, warState?.winner, saveSharedRoom, fetchWithRetry, warState]);

  // Timer effect
  useEffect(() => {
    // Stop timer if war is not active, has winner, or is cancelled
    if (!warState || !warState.active || warState.winner || warState.cancelled) {
      setWarTimer(0);
      return;
    }

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - warState.startTime) / 1000);
      const remaining = Math.max(0, warState.duration - elapsed);
      setWarTimer(remaining);

      if (remaining === 0 && warState.active) {
        // War ended without winner - only save once
        const updatedWar = { ...warState, active: false };
        // Use a flag to prevent multiple saves
        if (!warState.ended) {
          saveSharedRoom({ war: { ...updatedWar, ended: true } });
          setWarState({ ...updatedWar, ended: true });
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [warState, saveSharedRoom]);


  /* ---------------------------
     Share room link functionality
     --------------------------- */
  const copyRoomLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setLinkCopied(true);
      playBeep();
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      setError("Failed to copy link");
      setTimeout(() => setError(null), 2000);
    });
  };

  // Get short user ID for display
  const shortUserId = useMemo(() => {
    if (currentUser?.uid) {
      return currentUser.uid.substring(0, 8);
    }
    return localStorage.getItem("lb_userId") || "guest";
  }, [currentUser]);

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
  // Don't block rendering on errors - let error toast handle it
  // Only show error screen for critical initialization failures
  if (error && error.includes("Firebase initialization error") && !db) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "20px",
        fontFamily: "Inter, sans-serif",
        background: "#f9fafb",
        color: "#111827"
      }}>
        <h1 style={{ fontSize: "24px", marginBottom: "16px" }}>⚠️ Initialization Error</h1>
        <p style={{ fontSize: "16px", color: "#6b7280", textAlign: "center", maxWidth: "500px" }}>
          {error}
        </p>
        <p style={{ fontSize: "14px", color: "#9ca3af", marginTop: "16px" }}>
          Please check the browser console for more details.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "20px",
            padding: "12px 24px",
            borderRadius: "8px",
            border: "0",
            background: "linear-gradient(90deg,#06b6d4,#7c3aed)",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px"
          }}
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <div className="app-root">
      {/* scoped styles */}
      <style>{`
        :root{
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
        }

        /* Light Theme (default) */
        :root, [data-theme="light"] {
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
          --text: #111827;
          --radius: 14px;
          --radius-sm: 10px;
        }

        /* Dark Theme */
        [data-theme="dark"] {
          --bg: #0f172a;
          --muted: #94a3b8;
          --card: #1e293b;
          --border: #334155;
          --sky-50: #0c4a6e;
          --sky-600: #38bdf8;
          --emerald-50: #064e3b;
          --amber-50: #78350f;
          --rose-50: #7f1d1d;
          --shadow: 0 8px 20px rgba(0,0,0,0.3);
          --text: #f1f5f9;
        }

        /* Neon Theme */
        [data-theme="neon"] {
          --bg: #0a0a0f;
          --muted: #a78bfa;
          --card: #1a1a2e;
          --border: #6d28d9;
          --sky-50: #1e1b4b;
          --sky-600: #3b82f6;
          --emerald-50: #064e3b;
          --amber-50: #78350f;
          --rose-50: #7f1d1d;
          --shadow: 0 8px 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(139, 92, 246, 0.1);
          --text: #e0e7ff;
        }

        * { box-sizing: border-box; }
        body, html, #root { height: 100%; margin: 0; background: var(--bg); color: var(--text); transition: background-color 0.3s ease, color 0.3s ease; }

        .app-root { min-height: 100vh; padding: 28px; background: var(--bg); transition: background-color 0.3s ease; }

        .container { max-width: 1080px; margin: 0 auto; }

        /* header */
        .header { display:flex; flex-wrap:wrap; justify-content:space-between; gap:16px; align-items:center; margin-bottom: 22px; }
        .brand { display:flex; gap:12px; align-items:center; }
        .brand-badge { width:56px; height:56px; border-radius:12px; background: linear-gradient(180deg, #f0f9ff, #e6f6ff); display:flex; align-items:center; justify-content:center; box-shadow: var(--shadow); border:1px solid var(--border); transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease; }
        [data-theme="dark"] .brand-badge { background: linear-gradient(180deg, #1e3a8a, #312e81); }
        [data-theme="neon"] .brand-badge { background: linear-gradient(180deg, #3b82f6, #8b5cf6); box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4), 0 0 30px rgba(139, 92, 246, 0.2); border-color: #a78bfa; }
        .title { font-size:28px; font-weight:800; line-height:1; }
        .title .accent { color: var(--sky-600); }

        .status { color: var(--muted); font-size:14px; margin-top:4px; }

        /* controls */
        .controls { display:flex; gap:8px; align-items:center; }

        .segmented { display:flex; gap:8px; background:var(--card); padding:4px; border-radius:999px; border:1px solid var(--border); box-shadow: 0 4px 14px rgba(14,20,30,0.03); transition: background-color 0.3s ease, border-color 0.3s ease; }
        .segmented button { border:0; background:transparent; padding:10px 14px; border-radius:999px; cursor:pointer; font-weight:600; color:var(--text); display:flex; gap:8px; align-items:center; transition: color 0.3s ease; }
        .segmented button.active { background: linear-gradient(90deg,#f0f9ff,#f3f0ff); box-shadow: 0 4px 10px rgba(16,24,40,0.04); color: #062f4f; }
        [data-theme="dark"] .segmented button.active { background: linear-gradient(90deg,#1e3a8a,#312e81); color: #bfdbfe; }
        [data-theme="neon"] .segmented button.active { background: linear-gradient(90deg,#3b82f6,#8b5cf6); box-shadow: 0 4px 10px rgba(139, 92, 246, 0.4); color: #e0e7ff; }

        .icon-btn { border:0; background:var(--card); padding:8px; border-radius:10px; box-shadow: var(--shadow); border:1px solid var(--border); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; color:var(--text); transition: background-color 0.3s ease, border-color 0.3s ease, transform 0.1s ease; }
        .icon-btn:active { transform: translateY(1px); }
        .icon-btn:hover { opacity: 0.8; }

        /* grid */
        .grid { display:grid; grid-template-columns: 1fr; gap:20px; }
        @media(min-width: 980px){ .grid { grid-template-columns: 360px 1fr; } }

        /* left panel */
        .card { background: var(--card); border:1px solid var(--border); border-radius: var(--radius); padding:18px; box-shadow: var(--shadow); transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease; }
        .card h3 { margin:0 0 6px 0; font-size:18px; }
        .muted { color: var(--muted); font-size:13px; }

        .add-form { position:relative; margin-top:12px; }
        .add-form input { width:100%; padding:12px 110px 12px 44px; border-radius:12px; border:1px solid var(--border); background:var(--card); color:var(--text); font-size:14px; transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease; }
        .input-icon { position:absolute; left:12px; top: 12px; color: var(--muted); }
        .add-btn { position:absolute; right:8px; top:8px; height:40px; padding:0 12px; border-radius:10px; border:0; background: linear-gradient(90deg,#06b6d4,#7c3aed); color:white; font-weight:700; cursor:pointer; box-shadow: 0 8px 20px rgba(124,58,237,0.12); transition: box-shadow 0.3s ease; }
        [data-theme="neon"] .add-btn { background: linear-gradient(90deg,#3b82f6,#8b5cf6); box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4), 0 0 30px rgba(139, 92, 246, 0.3); }

        .friend-list { margin-top:14px; display:flex; flex-direction:column; gap:10px; max-height: 52vh; overflow:auto; padding-right:6px; }
        .friend-item { display:flex; justify-content:space-between; align-items:center; padding:10px; border-radius:12px; border:1px solid var(--border); background: var(--card); transition: background-color 0.3s ease, border-color 0.3s ease; }
        .friend-left { display:flex; gap:12px; align-items:center; }
        .avatar-small { width:40px; height:40px; border-radius:10px; background:#ecfeff; color:#0369a1; display:flex; align-items:center; justify-content:center; font-weight:700; transition: background 0.3s ease, color 0.3s ease; }
        [data-theme="dark"] .avatar-small { background: #1e3a8a; color: #bfdbfe; }
        [data-theme="neon"] .avatar-small { background: linear-gradient(180deg,#3b82f6,#8b5cf6); color: #e0e7ff; box-shadow: 0 0 10px rgba(139, 92, 246, 0.4); }
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
        .leader-row { display:flex; gap:16px; align-items:center; padding:14px; border-radius:12px; background:var(--card); border:1px solid var(--border); box-shadow: 0 6px 18px rgba(17,24,39,0.04); transition: transform .16s ease, box-shadow .16s ease, background-color 0.3s ease, border-color 0.3s ease; }
        .leader-row:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(17,24,39,0.06); }
        [data-theme="neon"] .leader-row:hover { box-shadow: 0 16px 40px rgba(139, 92, 246, 0.4), 0 0 60px rgba(139, 92, 246, 0.2); }

        .leader-left { display:flex; gap:12px; align-items:center; width:320px; min-width:220px; }
        .avatar { width:56px; height:56px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:white; font-weight:800; font-size:20px; transition: background 0.3s ease, box-shadow 0.3s ease; }
        .avatar-default { background: linear-gradient(180deg,#60a5fa,#7c3aed); }
        .avatar-top { background: linear-gradient(180deg,#f59e0b,#fb923c); }
        [data-theme="neon"] .avatar-default { background: linear-gradient(180deg,#3b82f6,#8b5cf6); box-shadow: 0 0 20px rgba(139, 92, 246, 0.5); }
        [data-theme="neon"] .avatar-top { background: linear-gradient(180deg,#f59e0b,#fb923c); box-shadow: 0 0 20px rgba(245, 158, 11, 0.5); }

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
        .progress-track { height:10px; background:#f3f4f6; border-radius:999px; overflow:hidden; transition: background-color 0.3s ease; }
        [data-theme="dark"] .progress-track { background: #334155; }
        [data-theme="neon"] .progress-track { background: #312e81; }
        .progress-fill { height:100%; background: linear-gradient(90deg,#60a5fa,#7c3aed); transition: width .7s ease; }
        [data-theme="neon"] .progress-fill { background: linear-gradient(90deg,#3b82f6,#8b5cf6); box-shadow: 0 0 10px rgba(139, 92, 246, 0.5); }

        .leader-right { width:120px; display:flex; flex-direction:column; align-items:flex-end; gap:10px; }
        .solved-label { font-size:11px; color:var(--muted); text-transform:uppercase; }
        .solved-number { font-weight:900; font-size:26px; }

        .leader-actions { display:flex; gap:8px; margin-top:6px; }
        .btn-outline { border:1px solid var(--border); background:var(--card); color:var(--text); padding:8px 10px; border-radius:8px; cursor:pointer; display:inline-flex; gap:8px; align-items:center; transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease; }
        .btn-danger { border:0; background: transparent; color:#ef4444; padding:8px; border-radius:8px; cursor:pointer; transition: opacity 0.3s ease; }

        .icon { width:16px; height:16px; }

        /* loading placeholder */
        .placeholder { background:var(--card); border-radius:12px; height:86px; border:1px solid var(--border); transition: background-color 0.3s ease, border-color 0.3s ease; }

        /* footer actions */
        .footer { display:flex; flex-direction:column; gap:16px; margin-top:24px; padding-top:20px; border-top:1px solid var(--border); }
        .footer-top { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
        .footer-bottom { display:flex; justify-content:center; align-items:center; gap:6px; color:var(--muted); font-size:14px; padding:8px 0; }
        .footer-love { display:flex; align-items:center; gap:6px; }
        .footer-love-heart { color:#ef4444; animation: heartbeat 1.5s ease-in-out infinite; }
        @keyframes heartbeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }

        /* current user display */
        .current-user { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px; background:var(--card); border:1px solid var(--border); box-shadow: var(--shadow); }
        .current-user-avatar { width:32px; height:32px; border-radius:8px; background:linear-gradient(180deg,#60a5fa,#7c3aed); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:12px; }
        [data-theme="neon"] .current-user-avatar { background:linear-gradient(180deg,#3b82f6,#8b5cf6); box-shadow: 0 0 10px rgba(139, 92, 246, 0.4); }
        .current-user-info { display:flex; flex-direction:column; gap:2px; }
        .current-user-label { font-size:11px; color:var(--muted); text-transform:uppercase; }
        .current-user-id { font-size:13px; font-weight:700; color:var(--text); }

        /* share button */
        .share-btn-wrapper { position:relative; }
        .share-btn-copied { position:absolute; top:-40px; left:50%; transform:translateX(-50%); background:var(--card); border:1px solid var(--border); padding:6px 12px; border-radius:8px; box-shadow:var(--shadow); white-space:nowrap; font-size:12px; color:var(--text); display:flex; align-items:center; gap:6px; z-index:10; }
        .share-btn-copied::after { content:""; position:absolute; bottom:-4px; left:50%; transform:translateX(-50%); width:8px; height:8px; background:var(--card); border-right:1px solid var(--border); border-bottom:1px solid var(--border); transform:translateX(-50%) rotate(45deg); }

        /* war UI */
        .war-card { background:var(--card); border:2px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:20px; box-shadow:var(--shadow); }
        .war-card.active { border-color:#ef4444; box-shadow: 0 0 20px rgba(239,68,68,0.3); }
        [data-theme="neon"] .war-card.active { border-color:#8b5cf6; box-shadow: 0 0 30px rgba(139,92,246,0.5); }
        .war-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
        .war-title { font-size:20px; font-weight:800; display:flex; align-items:center; gap:8px; }
        .war-timer { font-size:32px; font-weight:900; color:#ef4444; font-variant-numeric:tabular-nums; }
        [data-theme="neon"] .war-timer { color:#8b5cf6; text-shadow: 0 0 10px rgba(139,92,246,0.5); }
        .war-problem-link { display:inline-flex; align-items:center; gap:8px; padding:10px 16px; background:linear-gradient(90deg,#06b6d4,#7c3aed); color:white; border-radius:10px; text-decoration:none; font-weight:700; margin-top:12px; transition: transform 0.2s ease; }
        .war-problem-link:hover { transform: translateY(-2px); }
        [data-theme="neon"] .war-problem-link { background:linear-gradient(90deg,#3b82f6,#8b5cf6); box-shadow: 0 4px 15px rgba(139,92,246,0.4); }
        .war-winner { display:flex; align-items:center; gap:12px; padding:16px; background:linear-gradient(90deg,#fef3c7,#fde68a); border-radius:12px; margin-top:16px; }
        [data-theme="dark"] .war-winner { background:linear-gradient(90deg,#78350f,#92400e); }
        [data-theme="neon"] .war-winner { background:linear-gradient(90deg,#3b82f6,#8b5cf6); box-shadow: 0 0 20px rgba(139,92,246,0.4); }
        .war-winner-name { font-size:18px; font-weight:900; }
        .start-war-btn { padding:12px 24px; border-radius:12px; border:0; background:linear-gradient(90deg,#ef4444,#dc2626); color:white; font-weight:800; font-size:16px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow: 0 8px 20px rgba(239,68,68,0.3); transition: transform 0.2s ease; }
        .start-war-btn:hover { transform: translateY(-2px); }
        .start-war-btn:active { transform: translateY(0); }
        [data-theme="neon"] .start-war-btn { background:linear-gradient(90deg,#8b5cf6,#7c3aed); box-shadow: 0 8px 20px rgba(139,92,246,0.4); }
        .stop-war-btn { padding:8px 16px; border-radius:8px; border:1px solid var(--border); background:var(--card); color:var(--text); font-weight:700; font-size:14px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; margin-top:12px; transition: all 0.2s ease; }
        .stop-war-btn:hover { background:var(--border); }
        .war-status { font-size:14px; color:var(--muted); margin-top:8px; }
        .war-submissions { margin-top:16px; display:flex; flex-direction:column; gap:8px; }
        .war-submission-item { display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--card); border:1px solid var(--border); border-radius:8px; }
        .war-submission-user { font-weight:700; }
        .war-submission-status { padding:4px 10px; border-radius:6px; font-size:12px; font-weight:700; }
        .war-submission-status.accepted { background:#d1fae5; color:#065f46; }
        .war-submission-status.wrong { background:#fee2e2; color:#991b1b; }
        .war-submission-status.tle { background:#fef3c7; color:#92400e; }
        .war-submission-status.runtime { background:#dbeafe; color:#1e40af; }
        .war-submission-status.other { background:#f3f4f6; color:#374151; }

        /* error toast */
        .toast { position:fixed; right:20px; bottom:20px; background: var(--card); color:#b91c1c; border:1px solid #fee2e2; padding:10px 14px; border-radius:12px; box-shadow: 0 8px 30px rgba(17,24,39,0.06); transition: background-color 0.3s ease; }
        [data-theme="dark"] .toast { background: #7f1d1d; border-color: #991b1b; }
        [data-theme="neon"] .toast { background: #7f1d1d; border-color: #ef4444; box-shadow: 0 8px 30px rgba(239, 68, 68, 0.3); }

        /* micro burst */
        .micro-burst { position:absolute; font-size:16px; transform: translateY(0); animation: micro-fall .9s linear forwards; opacity:0.95; }
        @keyframes micro-fall { 0% { transform: translateY(-6px) rotate(0deg); opacity:1 } 100% { transform: translateY(40px) rotate(14deg); opacity:0 } }

        /* room management */
        .room-selector { position:relative; }
        .room-dropdown { position:absolute; top:100%; left:0; margin-top:8px; min-width:280px; background:var(--card); border:1px solid var(--border); border-radius:12px; box-shadow: 0 8px 30px rgba(17,24,39,0.1); z-index:100; max-height:400px; overflow-y:auto; }
        .room-item { display:flex; align-items:center; justify-content:space-between; padding:12px; border-bottom:1px solid var(--border); cursor:pointer; transition: background-color 0.2s ease; }
        .room-item:last-child { border-bottom:0; }
        .room-item:hover { background:var(--sky-50); }
        [data-theme="dark"] .room-item:hover { background: #1e3a8a; }
        [data-theme="neon"] .room-item:hover { background: #312e81; }
        .room-item.active { background:var(--sky-50); font-weight:700; }
        [data-theme="dark"] .room-item.active { background: #1e3a8a; }
        [data-theme="neon"] .room-item.active { background: #312e81; }
        .room-item-left { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
        .room-item-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .room-item-actions { display:flex; gap:4px; opacity:0; transition: opacity 0.2s ease; }
        .room-item:hover .room-item-actions { opacity:1; }
        .room-btn-small { border:0; background:transparent; padding:4px; border-radius:6px; cursor:pointer; color:var(--muted); display:inline-flex; align-items:center; justify-content:center; }
        .room-btn-small:hover { background:var(--border); color:var(--text); }
        .room-create-form { padding:12px; border-top:1px solid var(--border); }
        .room-create-input { width:100%; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--card); color:var(--text); font-size:14px; margin-bottom:8px; }
        .room-create-actions { display:flex; gap:8px; }
        .room-btn-primary { flex:1; padding:8px 12px; border-radius:8px; border:0; background: linear-gradient(90deg,#06b6d4,#7c3aed); color:white; font-weight:700; cursor:pointer; }
        .room-btn-secondary { flex:1; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--card); color:var(--text); cursor:pointer; }
        .room-edit-input { padding:4px 8px; border-radius:6px; border:1px solid var(--border); background:var(--card); color:var(--text); font-size:14px; width:100%; }
        .room-header-btn { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px; border:1px solid var(--border); background:var(--card); color:var(--text); cursor:pointer; font-weight:600; font-size:14px; transition: all 0.2s ease; }
        .room-header-btn:hover { opacity:0.8; transform: translateY(-1px); }

        /* modals */
        .modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000; }
        .modal-content { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:24px; max-width:400px; width:90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .modal-title { font-size:20px; font-weight:800; margin-bottom:16px; }
        .modal-input { width:100%; padding:12px; border-radius:8px; border:1px solid var(--border); background:var(--card); color:var(--text); font-size:14px; margin-bottom:12px; }
        .modal-actions { display:flex; gap:12px; margin-top:20px; }
        .modal-btn { flex:1; padding:12px; border-radius:8px; border:0; font-weight:700; cursor:pointer; }
        .modal-btn-primary { background:linear-gradient(90deg,#06b6d4,#7c3aed); color:white; }
        .modal-btn-secondary { background:var(--card); color:var(--text); border:1px solid var(--border); }

        /* chat styles - modern and vibrant */
        .chat-card { 
          display: flex; 
          flex-direction: column; 
          background: linear-gradient(135deg, var(--card) 0%, rgba(255,255,255,0.95) 100%);
          border: 2px solid var(--border);
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          position: relative;
          overflow: hidden;
        }
        .chat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #06b6d4, #7c3aed, #ec4899);
          opacity: 0.8;
        }
        [data-theme="dark"] .chat-card {
          background: linear-gradient(135deg, var(--card) 0%, rgba(30,41,59,0.95) 100%);
        }
        [data-theme="neon"] .chat-card {
          background: linear-gradient(135deg, var(--card) 0%, rgba(26,26,46,0.95) 100%);
          border-color: #8b5cf6;
          box-shadow: 0 4px 20px rgba(139,92,246,0.3);
        }
        .chat-messages { 
          scrollbar-width: thin; 
          scrollbar-color: var(--border) transparent;
          background: linear-gradient(to bottom, rgba(236,254,255,0.3), transparent);
          position: relative;
        }
        [data-theme="dark"] .chat-messages {
          background: linear-gradient(to bottom, rgba(30,58,138,0.2), transparent);
        }
        [data-theme="neon"] .chat-messages {
          background: linear-gradient(to bottom, rgba(49,46,129,0.3), transparent);
        }
        .chat-messages::-webkit-scrollbar { width: 8px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb { 
          background: linear-gradient(180deg, #06b6d4, #7c3aed); 
          border-radius: 4px; 
        }
        .chat-messages::-webkit-scrollbar-thumb:hover { 
          background: linear-gradient(180deg, #0891b2, #6d28d9); 
        }
        .chat-message { 
          transition: all 0.2s ease;
          animation: messageSlideIn 0.2s ease-out;
          position: relative;
        }
        @keyframes messageSlideIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .chat-message:hover { 
          transform: translateY(-1px); 
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .chat-message-own { 
          background: linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%) !important;
          color: white !important;
          box-shadow: 0 1px 3px rgba(6, 182, 212, 0.15) !important;
        }
        .chat-message:not(.chat-message-own) {
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
          border: 1px solid rgba(6, 182, 212, 0.1);
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        [data-theme="dark"] .chat-message-own { 
          background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%) !important;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4) !important;
        }
        [data-theme="dark"] .chat-message:not(.chat-message-own) {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%) !important;
          border-color: rgba(59, 130, 246, 0.3);
        }
        [data-theme="neon"] .chat-message-own { 
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.2) !important;
        }
        [data-theme="neon"] .chat-message:not(.chat-message-own) {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%) !important;
          border-color: rgba(139, 92, 246, 0.4);
          box-shadow: 0 2px 10px rgba(139, 92, 246, 0.2);
        }
        .chat-input-form { 
          display: flex; 
          gap: 8px;
          padding: 6px;
          background: linear-gradient(135deg, rgba(236,254,255,0.3), rgba(255,255,255,0.6));
          border-radius: 8px;
          border: 1px solid rgba(6, 182, 212, 0.15);
        }
        [data-theme="dark"] .chat-input-form {
          background: linear-gradient(135deg, rgba(30,58,138,0.3), rgba(30,41,59,0.8));
          border-color: rgba(59, 130, 246, 0.3);
        }
        [data-theme="neon"] .chat-input-form {
          background: linear-gradient(135deg, rgba(49,46,129,0.4), rgba(26,26,46,0.8));
          border-color: rgba(139, 92, 246, 0.4);
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.1);
        }
        .chat-input { 
          flex: 1; 
          padding: 8px 12px; 
          border-radius: 8px; 
          border: 1px solid transparent;
          background: rgba(255,255,255,0.9);
          color: var(--text); 
          font-size: 13px; 
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }
        .chat-input:focus { 
          outline: none; 
          border-color: #06b6d4;
          background: rgba(255,255,255,1);
          box-shadow: 0 2px 6px rgba(6, 182, 212, 0.15);
        }
        [data-theme="dark"] .chat-input {
          background: rgba(30,41,59,0.9);
        }
        [data-theme="dark"] .chat-input:focus {
          background: rgba(30,41,59,1);
          border-color: #3b82f6;
        }
        [data-theme="neon"] .chat-input {
          background: rgba(26,26,46,0.9);
        }
        [data-theme="neon"] .chat-input:focus {
          background: rgba(26,26,46,1);
          border-color: #8b5cf6;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
        }
        .chat-send-btn { 
          padding: 8px 14px; 
          border-radius: 8px; 
          border: 0; 
          background: linear-gradient(135deg,#06b6d4,#7c3aed); 
          color: white; 
          cursor: pointer; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          transition: all 0.2s ease;
          box-shadow: 0 2px 6px rgba(6, 182, 212, 0.25);
          font-weight: 500;
          position: relative;
          overflow: hidden;
        }
        .chat-send-btn::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        .chat-send-btn:hover:not(:disabled) { 
          transform: translateY(-1px); 
          box-shadow: 0 3px 8px rgba(6, 182, 212, 0.35);
        }
        .chat-send-btn:hover:not(:disabled)::before {
          width: 300px;
          height: 300px;
        }
        .chat-send-btn:active:not(:disabled) { 
          transform: translateY(0) scale(0.98); 
        }
        .chat-send-btn:disabled { 
          opacity: 0.5; 
          cursor: not-allowed;
          transform: none;
        }
        [data-theme="neon"] .chat-send-btn { 
          background: linear-gradient(135deg,#3b82f6,#8b5cf6); 
          box-shadow: 0 4px 15px rgba(139,92,246,0.5), 0 0 20px rgba(139,92,246,0.2); 
        }
        [data-theme="neon"] .chat-send-btn:hover:not(:disabled) { 
          box-shadow: 0 6px 25px rgba(139,92,246,0.7), 0 0 30px rgba(139,92,246,0.3); 
        }

        /* voice call styles */
        .voice-call-btn { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .voice-call-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(6, 182, 212, 0.4); }
        .voice-call-btn-end { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .voice-call-btn-end:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); }
        .voice-call-controls { transition: all 0.3s ease; }
        .voice-control-btn { transition: all 0.2s ease; }
        .voice-control-btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        [data-theme="dark"] .voice-call-controls { background: linear-gradient(135deg, #1e3a8a, #1e40af) !important; }
        [data-theme="neon"] .voice-call-controls { background: linear-gradient(135deg, #312e81, #4c1d95) !important; box-shadow: 0 0 15px rgba(139, 92, 246, 0.3); }

        /* responsive tweaks */
        @media(max-width: 640px) {
          .header { flex-direction:column; align-items:flex-start; gap:10px; }
          .leader-left { width:100%; min-width:100px; }
          .leader-right { width:86px; }
          .add-form input { padding-right:96px; }
          .room-dropdown { min-width:240px; }
          .current-user { order: -1; width: 100%; }
          .footer-top { flex-direction: column; align-items: stretch; }
          .footer-top button { width: 100%; justify-content: center; }
          .chat-messages { max-height: 200px; }
        }
      `}</style>

      {/* Initial Setup Modal */}
      {showInitialSetup && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title">Welcome to LeetCode Battle!</div>
            <p style={{ marginBottom: "16px", color: "var(--muted)" }}>
              Enter your LeetCode username and create or join a room to get started.
            </p>
            <input
              type="text"
              className="modal-input"
              placeholder="Your LeetCode Username"
              value={initialLeetCodeUsername}
              onChange={(e) => setInitialLeetCodeUsername(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleInitialSetup()}
            />
            <input
              type="text"
              className="modal-input"
              placeholder="Room Name"
              value={initialRoomName}
              onChange={(e) => setInitialRoomName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleInitialSetup()}
            />
            <div className="modal-actions">
              <button className="modal-btn modal-btn-primary" onClick={handleInitialSetup}>
                Start Battle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Room Warning Modal */}
      {showDuplicateRoomWarning && duplicateRoomInfo && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertTriangle style={{ color: "#f59e0b", width: 24, height: 24 }} />
              Room Already Exists
            </div>
            <p style={{ marginBottom: "16px", color: "var(--muted)", lineHeight: "1.6" }}>
              A room with the name <strong style={{ color: "var(--text)" }}>"{duplicateRoomInfo.name || pendingRoomName}"</strong> already exists.
            </p>
            <p style={{ marginBottom: "20px", color: "var(--muted)", fontSize: "14px", lineHeight: "1.6" }}>
              You will be added to this existing room. If you want to create a new room, please use a different name.
            </p>
            {duplicateRoomInfo.usernames && duplicateRoomInfo.usernames.length > 0 && (
              <div style={{
                marginBottom: "20px",
                padding: "12px",
                background: "var(--sky-50)",
                borderRadius: "8px",
                border: "1px solid var(--border)"
              }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "var(--text)" }}>
                  Current members ({duplicateRoomInfo.usernames.length}):
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {duplicateRoomInfo.usernames.map((u, idx) => (
                    <span key={idx} style={{
                      padding: "4px 8px",
                      background: "var(--card)",
                      borderRadius: "6px",
                      border: "1px solid var(--border)"
                    }}>
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button className="modal-btn modal-btn-primary" onClick={joinExistingRoom}>
                Join Existing Room
              </button>
              <button className="modal-btn modal-btn-secondary" onClick={cancelJoinRoom}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title">Join Room</div>
            <p style={{ marginBottom: "16px", color: "var(--muted)" }}>
              Enter your LeetCode username to join this room.
            </p>
            <input
              type="text"
              className="modal-input"
              placeholder="Your LeetCode Username"
              value={joinLeetCodeUsername}
              onChange={(e) => setJoinLeetCodeUsername(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
            />
            <div className="modal-actions">
              <button className="modal-btn modal-btn-primary" onClick={handleJoinRoom}>
                Join
              </button>
              <button className="modal-btn modal-btn-secondary" onClick={() => setShowJoinModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

          {currentUser && (
            <div className="current-user">
              <div className="current-user-avatar">
                <User className="icon" style={{ width: 16, height: 16 }} />
              </div>
              <div className="current-user-info">
                <div className="current-user-label">You</div>
                <div className="current-user-id">{currentLeetCodeUsername || shortUserId}</div>
              </div>
            </div>
          )}

          <div className="controls">
            <div className="room-selector">
              <button className="room-header-btn" onClick={() => setShowRoomModal(!showRoomModal)}>
                <DoorOpen className="icon" />
                <span>{rooms.find(r => r.id === currentRoomId)?.name || "Select Room"}</span>
                <span style={{ fontSize: "12px", opacity: 0.7 }}>({rooms.length})</span>
              </button>
              {showRoomModal && (
                <div className="room-dropdown">
                  {rooms.map(room => (
                    <div
                      key={room.id}
                      className={`room-item ${room.id === currentRoomId ? "active" : ""}`}
                      onClick={() => { switchRoom(room.id); setShowRoomModal(false); }}
                    >
                      <div className="room-item-left">
                        {editingRoomId === room.id ? (
                          <input
                            className="room-edit-input"
                            value={editingRoomName}
                            onChange={(e) => setEditingRoomName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.stopPropagation(); saveEditRoom(); }
                              if (e.key === "Escape") { e.stopPropagation(); cancelEditRoom(); }
                            }}
                            autoFocus
                          />
                        ) : (
                          <div className="room-item-name">{room.name}</div>
                        )}
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {room.usernames?.length || 0} users
                        </div>
                      </div>
                      <div className="room-item-actions" onClick={(e) => e.stopPropagation()}>
                        {editingRoomId === room.id ? (
                          <>
                            <button className="room-btn-small" onClick={saveEditRoom} title="Save">
                              <Check className="icon" style={{ width: 14, height: 14 }} />
                            </button>
                            <button className="room-btn-small" onClick={cancelEditRoom} title="Cancel">
                              <X className="icon" style={{ width: 14, height: 14 }} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="room-btn-small" onClick={() => startEditRoom(room.id)} title="Rename">
                              <Edit className="icon" style={{ width: 14, height: 14 }} />
                            </button>
                            <button
                              className="room-btn-small"
                              onClick={(e) => { e.stopPropagation(); exitRoom(room.id); }}
                              title="Exit Room"
                              style={{ color: "var(--error, #ef4444)" }}
                            >
                              <DoorOpen className="icon" style={{ width: 14, height: 14 }} />
                            </button>
                            {rooms.length > 1 && (
                              <button className="room-btn-small" onClick={() => deleteRoom(room.id)} title="Delete">
                                <Trash2 className="icon" style={{ width: 14, height: 14 }} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="room-create-form">
                    <input
                      className="room-create-input"
                      placeholder="New room name"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createRoom();
                      }}
                    />
                    <div className="room-create-actions">
                      <button className="room-btn-primary" onClick={createRoom}>
                        <Plus className="icon" style={{ width: 14, height: 14 }} /> Create Room
                      </button>
                      <button className="room-btn-secondary" onClick={() => { setShowRoomModal(false); setNewRoomName(""); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="segmented" role="tablist" aria-label="time filter">
              <button className={timeFilter === "daily" ? "active" : ""} onClick={() => { setTimeFilter("daily"); playBeep(); }} title="Daily"><Clock className="icon" /> Daily</button>
              <button className={timeFilter === "weekly" ? "active" : ""} onClick={() => { setTimeFilter("weekly"); playBeep(); }} title="Weekly"><Calendar className="icon" /> Weekly</button>
              <button className={timeFilter === "all" ? "active" : ""} onClick={() => { setTimeFilter("all"); playBeep(); }} title="All"><BarChart className="icon" /> All</button>
            </div>

            <button className="icon-btn" onClick={handleRefresh} title="Refresh"><Loader2 className="icon" /></button>
            <button className="icon-btn" onClick={() => { setSoundOn(s => !s); playBeep(); }} title="Toggle sound"><Volume2 className="icon" /></button>
            <button className="icon-btn" onClick={cycleTheme} title={`Theme: ${theme} (click to cycle)`}>
              <SunMoon className="icon" />
            </button>
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
                  <div className="muted">
                    {rooms.find(r => r.id === currentRoomId)?.name || "Default Room"}
                  </div>
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
                      <div className="muted" style={{ marginTop: 4 }}>Add usernames to begin</div>
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

              <div className="stats" style={{ marginTop: 16 }}>
                <div>
                  <div className="stats-left">Auto-sync</div>
                </div>
                <div>
                  <div className="stats-num">{leaderboardData.reduce((a, b) => a + (b.counts?.all || 0), 0)} total solves</div>
                </div>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="muted">Quick Actions</div>
                  <div style={{ marginTop: 6 }}>
                    <button className="btn-outline" onClick={() => { fetchAllUsersData(); playBeep(); }}>Sync Now</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ height: 12 }} />

            {/* Chat Component */}
            <div className="card chat-card">
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "2px solid rgba(6,182,212,0.1)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #06b6d4, #7c3aed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(6,182,212,0.3)"
                  }}>
                    <MessageCircle className="icon" style={{ width: 20, height: 20, color: "white" }} />
                  </div>
                  <div>
                    <h3 style={{
                      margin: 0,
                      fontSize: "18px",
                      fontWeight: 700,
                      background: "linear-gradient(135deg, #06b6d4, #7c3aed)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text"
                    }}>
                      Room Chat
                    </h3>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                      {messages.length} {messages.length === 1 ? "message" : "messages"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!isInCall ? (
                    <button
                      className="voice-call-btn"
                      onClick={startVoiceCall}
                      disabled={friendUsernames.length === 0 || loading}
                      title="Start voice call"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "0",
                        background: "linear-gradient(90deg,#06b6d4,#7c3aed)",
                        color: "white",
                        cursor: friendUsernames.length === 0 || loading ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        opacity: friendUsernames.length === 0 || loading ? 0.5 : 1
                      }}
                    >
                      <Phone className="icon" style={{ width: 14, height: 14 }} />
                      Call
                    </button>
                  ) : (
                    <button
                      className="voice-call-btn-end"
                      onClick={endVoiceCall}
                      title="End call"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "0",
                        background: "#ef4444",
                        color: "white",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        fontWeight: 600
                      }}
                    >
                      <PhoneOff className="icon" style={{ width: 14, height: 14 }} />
                      End
                    </button>
                  )}
                </div>
              </div>

              {/* Voice Call Controls - Show for all users when call is active */}
              {(isInCall || isCallActive) && (
                <div className="voice-call-controls" style={{
                  padding: "12px",
                  marginBottom: "12px",
                  borderRadius: "8px",
                  background: isCallActive ? "linear-gradient(135deg, #dbeafe, #e0f2fe)" : "var(--card)",
                  border: `1px solid ${isCallActive ? "#3b82f6" : "var(--border)"}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
                      {isCallActive ? (
                        <>
                          <Phone className="icon" style={{ width: 14, height: 14, color: "#3b82f6" }} />
                          Call Active
                        </>
                      ) : (
                        <>
                          <Phone className="icon" style={{ width: 14, height: 14 }} />
                          Connecting...
                        </>
                      )}
                      {!isInCall && isCallActive && (
                        <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>
                          (Started by {callParticipants[0] || "someone"})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {callParticipants.length} {callParticipants.length === 1 ? "participant" : "participants"}
                    </div>
                  </div>

                  {audioUnlockNeeded && (
                    <button
                      onClick={resumeAudio}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: "#fbbf24",
                        color: "black",
                        border: "none",
                        fontSize: "10px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        marginBottom: "8px",
                        width: "100%"
                      }}
                    >
                      Tap to Hear Others
                    </button>
                  )}

                  {isCallActive && isInCall && (
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                      <button
                        className="voice-control-btn"
                        onClick={toggleMute}
                        title={isMuted ? "Unmute" : "Mute"}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: isMuted ? "#ef4444" : "var(--card)",
                          color: isMuted ? "white" : "var(--text)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          transition: "all 0.2s ease"
                        }}
                      >
                        {isMuted ? (
                          <MicOff className="icon" style={{ width: 14, height: 14 }} />
                        ) : (
                          <Mic className="icon" style={{ width: 14, height: 14 }} />
                        )}
                        {isMuted ? "Unmute" : "Mute"}
                      </button>

                      <button
                        className="voice-control-btn"
                        onClick={toggleSpeakerMute}
                        title={isSpeakerMuted ? "Unmute speaker" : "Mute speaker"}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: isSpeakerMuted ? "#f59e0b" : "var(--card)",
                          color: isSpeakerMuted ? "white" : "var(--text)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          transition: "all 0.2s ease"
                        }}
                      >
                        {isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}
                      </button>
                    </div>
                  )}

                  {/* Debug Panel */}
                  {isInCall && (
                    <div style={{ marginTop: "16px", padding: "10px", background: "#1f2937", borderRadius: "8px", fontSize: "10px", color: "#9ca3af" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Voice Debug Info:</div>
                      <div>My Username: {currentLeetCodeUsername}</div>
                      <div>Participants: {callParticipants.join(", ")}</div>
                      <div style={{ marginTop: "4px" }}>
                        {Object.entries(debugInfo).map(([user, info]) => (
                          <div key={user} style={{ marginBottom: "2px" }}>
                            <span style={{ color: "#d1d5db" }}>{user}:</span> {info.connectionState || "unknown"} / {info.signalingState || "unknown"}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}


                  {callParticipants.length > 0 && (
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                      Participants: {callParticipants.join(", ")}
                    </div>
                  )}

                  {!isInCall && isCallActive && (
                    <div style={{
                      marginTop: "8px",
                      padding: "8px",
                      borderRadius: "6px",
                      background: "var(--sky-50)",
                      border: "1px solid var(--sky-200)",
                      fontSize: "12px",
                      color: "var(--text)",
                      textAlign: "center"
                    }}>
                      💡 Someone else is in a call. Click "Call" to join them.
                    </div>
                  )}
                </div>
              )}

              {/* Messages List */}
              <div className="chat-messages" style={{
                maxHeight: "300px",
                overflowY: "auto",
                marginBottom: 12,
                padding: "10px 8px",
                borderRadius: "8px",
                minHeight: "150px"
              }}>
                {messages.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "30px 20px",
                    color: "var(--muted)",
                    fontSize: "12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <div style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, rgba(6,182,212,0.1), rgba(124,58,237,0.1))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "4px"
                    }}>
                      <MessageCircle style={{ width: 20, height: 20, opacity: 0.5 }} />
                    </div>
                    <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "13px" }}>No messages yet</div>
                    <div style={{ fontSize: "11px" }}>Start the conversation!</div>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isCurrentUser = msg.username === currentLeetCodeUsername;
                    const messageDate = new Date(msg.timestamp);
                    const timeStr = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const showAvatar = !isCurrentUser && (index === 0 || messages[index - 1].username !== msg.username);

                    return (
                      <div
                        key={msg.id}
                        className={`chat-message ${isCurrentUser ? "chat-message-own" : ""}`}
                        style={{
                          marginBottom: "8px",
                          padding: "6px 10px",
                          borderRadius: isCurrentUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                          maxWidth: "70%",
                          marginLeft: isCurrentUser ? "auto" : "0",
                          marginRight: isCurrentUser ? "0" : "auto",
                          display: "flex",
                          flexDirection: isCurrentUser ? "column" : "row",
                          gap: "6px",
                          alignItems: isCurrentUser ? "flex-end" : "flex-start"
                        }}
                      >
                        {!isCurrentUser && showAvatar && (
                          <div style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #06b6d4, #7c3aed)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: 700,
                            fontSize: "10px",
                            flexShrink: 0,
                            boxShadow: "0 1px 4px rgba(6,182,212,0.2)"
                          }}>
                            {msg.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {!isCurrentUser && !showAvatar && (
                          <div style={{ width: "24px", flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {!isCurrentUser && showAvatar && (
                            <div style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--text)",
                              marginBottom: "3px"
                            }}>
                              {msg.username}
                            </div>
                          )}
                          <div style={{
                            fontSize: "13px",
                            color: isCurrentUser ? "white" : "var(--text)",
                            wordBreak: "break-word",
                            lineHeight: "1.4",
                            fontWeight: isCurrentUser ? 500 : 400
                          }}>
                            {msg.text}
                          </div>
                          <div style={{
                            fontSize: "9px",
                            color: isCurrentUser ? "rgba(255,255,255,0.6)" : "var(--muted)",
                            marginTop: "3px",
                            textAlign: isCurrentUser ? "right" : "left",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px"
                          }}>
                            {timeStr}
                            {isCurrentUser && (
                              <CheckCircle style={{ width: 10, height: 10, opacity: 0.6 }} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatMessagesEndRef} />
              </div>

              {/* Message Input */}
              <form
                className="chat-input-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
              >
                <input
                  type="text"
                  className="chat-input"
                  placeholder="💬 Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={!newMessage.trim()}
                >
                  <Send className="icon" style={{ width: 18, height: 18, position: "relative", zIndex: 1 }} />
                </button>
              </form>
            </div>
          </div>

          {/* main leaderboard */}
          <div>
            {/* War Card */}
            {warState && warState.active ? (
              <div className="war-card active">
                <div className="war-header" style={{ justifyContent: "space-between" }}>
                  <div className="war-title">
                    <Sword className="icon" style={{ width: 24, height: 24 }} />
                    War Active!
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      className="stop-war-btn"
                      onClick={manualRefreshSubmissions}
                      title="Refresh submissions"
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <Loader2 className="icon" style={{ width: 12, height: 12 }} />
                      Refresh
                    </button>
                    <button className="stop-war-btn" onClick={stopWar}>
                      <X className="icon" style={{ width: 14, height: 14 }} />
                      Stop
                    </button>
                  </div>
                </div>
                <div className="war-timer">
                  {Math.floor(warTimer / 60)}:{(warTimer % 60).toString().padStart(2, '0')}
                </div>
                <div className="war-status">Time remaining</div>
                <a href={warState.problemLink} target="_blank" rel="noopener noreferrer" className="war-problem-link">
                  <Target className="icon" style={{ width: 18, height: 18 }} />
                  Solve Problem
                </a>

                {/* Submission Status */}
                {warState.participants && warState.participants.length > 0 && (
                  <div className="war-submissions">
                    <div className="war-status" style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Submission Status:</div>
                    {warState.participants.map(username => {
                      // Check both warSubmissions state and warState.submissions (prioritize warState.submissions as it's synced from Firebase)
                      const submission = warState.submissions?.[username] || warSubmissions[username];
                      const submissionCount = warState.submissionCounts?.[username] || 0;
                      const getStatusClass = (status) => {
                        if (!status || status === "Unknown") return "other";
                        const s = String(status).toLowerCase();
                        if (s.includes("accepted") || s === "10") return "accepted";
                        if (s.includes("wrong") || s.includes("error") || s.includes("wrong answer") || s === "11") return "wrong";
                        if (s.includes("time limit") || s.includes("tle") || s.includes("time limit exceeded") || s === "12") return "tle";
                        if (s.includes("runtime") || s.includes("runtime error") || s === "13") return "runtime";
                        if (s.includes("compilation") || s.includes("compile") || s === "14") return "other";
                        return "other";
                      };
                      const displayStatus = submission?.status || "Not submitted";
                      const statusClass = getStatusClass(submission?.status);
                      return (
                        <div key={username} className="war-submission-item">
                          <div className="war-submission-user">
                            {username}
                            {submissionCount > 0 && (
                              <span style={{ fontSize: "11px", color: "var(--muted)", marginLeft: "8px", fontWeight: 500 }}>
                                ({submissionCount} {submissionCount === 1 ? "attempt" : "attempts"})
                              </span>
                            )}
                          </div>
                          <div className={`war-submission-status ${statusClass}`}>
                            {displayStatus === "Not submitted" ? displayStatus : (displayStatus === "Accepted" ? "✓ Accepted" : displayStatus)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : warState && (warState.winner || warState.cancelled || !warState.active) ? (
              <div className="war-card">
                <div className="war-header" style={{ justifyContent: "space-between" }}>
                  <div className="war-title">
                    {warState.winner ? (
                      <>
                        <Award className="icon" style={{ width: 24, height: 24 }} />
                        War Ended
                      </>
                    ) : (
                      <>
                        <Sword className="icon" style={{ width: 24, height: 24 }} />
                        War Cancelled
                      </>
                    )}
                  </div>
                  <button
                    className="stop-war-btn"
                    onClick={clearWar}
                    title="Close war card"
                    style={{ cursor: "pointer" }}
                  >
                    <X className="icon" style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                {warState.winner && (
                  <div className="war-winner">
                    <Crown className="icon" style={{ width: 32, height: 32, color: "#d97706" }} />
                    <div>
                      <div className="war-status">Winner</div>
                      <div className="war-winner-name">{warState.winner}</div>
                    </div>
                  </div>
                )}
                {warState.problemLink && (
                  <a href={warState.problemLink} target="_blank" rel="noopener noreferrer" className="war-problem-link" style={{ marginTop: 16 }}>
                    <Target className="icon" style={{ width: 18, height: 18 }} />
                    View Problem
                  </a>
                )}
              </div>
            ) : (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <Sword className="icon" style={{ width: 20, height: 20 }} />
                      Start War
                    </h3>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Compete to solve a problem first!
                    </div>
                  </div>
                  <button className="start-war-btn" onClick={startWar}>
                    <Play className="icon" style={{ width: 18, height: 18 }} />
                    Start War
                  </button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>
                    Problem Difficulty:
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["easy", "medium", "hard", "any"].map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setWarDifficulty(diff)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: `2px solid ${warDifficulty === diff ? "#ef4444" : "var(--border)"}`,
                          background: warDifficulty === diff ? "rgba(239, 68, 68, 0.1)" : "var(--card)",
                          color: "var(--text)",
                          fontWeight: warDifficulty === diff ? 700 : 500,
                          fontSize: 13,
                          cursor: "pointer",
                          textTransform: "capitalize",
                          transition: "all 0.2s ease"
                        }}
                        onMouseEnter={(e) => {
                          if (warDifficulty !== diff) {
                            e.currentTarget.style.background = "var(--hover)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (warDifficulty !== diff) {
                            e.currentTarget.style.background = "var(--card)";
                          }
                        }}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Trophy className="icon" style={{ color: "#b45309" }} />
                  <div>
                    <div className="muted">Leaderboard</div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>Combat Rankings</div>
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>Filter: <strong style={{ marginLeft: 8, textTransform: "uppercase" }}>{timeFilter}</strong></div>
              </div>

              <div className="leaderboard">
                {loading ? (
                  [1, 2, 3, 4].map(i => <div className="placeholder" key={i} />)
                ) : (sortedLeaderboard.length > 0 ? (
                  sortedLeaderboard.map((u, i) => <LeaderboardRow key={u.username} user={u} rank={i + 1} />)
                ) : (
                  <div style={{ textAlign: "center", padding: 28 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 80, height: 80, borderRadius: 20, background: "#f8fafc", margin: "0 auto 12px" }}>
                      <Trophy className="icon" style={{ color: "#b45309" }} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>Leaderboard Empty</div>
                    <div className="muted" style={{ marginTop: 8 }}>Add friends to populate the leaderboard.</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="footer">
              <div className="footer-top">
                <div className="share-btn-wrapper">
                  {linkCopied && (
                    <div className="share-btn-copied">
                      <CheckCircle className="icon" style={{ width: 14, height: 14 }} />
                      Link copied!
                    </div>
                  )}
                  <button className="btn-outline" onClick={copyRoomLink}>
                    <Share2 className="icon" /> Share Room Link
                  </button>
                </div>
                <button className="btn-outline" onClick={() => alert("Settings coming soon")}>
                  <Settings className="icon" />
                </button>
              </div>
              <div className="footer-bottom">
                <div className="footer-love">
                  <span>Made with</span>
                  <span className="footer-love-heart">❤️</span>
                  <span>in Panathur, Bangalore</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div >

      <div id="burst-root" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      {
        error && (
          <div className="toast">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <AlertTriangle className="icon" />
              <div>{error}</div>
              <button onClick={() => setError(null)} style={{ marginLeft: 8, border: 0, background: "transparent", color: "#6b7280", cursor: "pointer" }}>Dismiss</button>
            </div>
          </div>
        )
      }
    </div >
  );
}
