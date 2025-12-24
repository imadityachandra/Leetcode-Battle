# Reddit Post - LeetCode Battle Platform

## 📝 Post Title Options

### Option 1 (Casual & Engaging)
```
I built a real-time LeetCode battle platform where you can 1v1 your friends - with voice chat! 🎮
```

### Option 2 (Feature-focused)
```
LeetCode Battle: Race your friends to solve problems with live leaderboards, auto winner detection & voice chat
```

### Option 3 (Problem-solving)
```
Made grinding LeetCode fun again - built a competitive platform with real-time battles and voice chat
```

---

## 📄 Post Content

### Full Version (For r/webdev, r/reactjs, r/programming)

```markdown
# 🎮 I built LeetCode Battle - Make grinding LeetCode competitive and fun!

**TL;DR**: Real-time competitive coding platform where you race friends to solve LeetCode problems. First to submit an accepted solution wins! Includes voice chat, live leaderboards, and automatic winner detection.

**Live Demo**: [Your URL Here]

---

## 🤔 The Problem

Let's be honest - grinding LeetCode alone is boring. I wanted to make interview prep more engaging by adding competition and social elements.

## ✨ What I Built

**LeetCode Battle** is a real-time platform where you can:
- 🏆 Start coding wars with friends on random LeetCode problems
- 📊 Track everyone's progress with live leaderboards (daily/weekly/all-time)
- 🎯 Automatic winner detection - first accepted solution wins!
- 🎙️ Built-in voice chat (WebRTC) for coordination
- 💬 Live chat during battles
- 🎨 3 themes (Light, Dark, Neon)

---

## 🛠️ Tech Stack

- **Frontend**: React + Lucide Icons
- **Backend**: Firebase (Firestore + Auth)
- **Voice**: WebRTC (peer-to-peer)
- **API**: alfa-leetcode-api wrapper
- **Performance**: Custom caching layer (83% API call reduction!)

---

## 🎯 Key Features

### Battle System
- Random problem selection with difficulty filters
- 1-hour time limit
- Automatic submission detection (~30s delay)
- War history tracking

### Real-time Everything
- Live leaderboard updates
- Instant chat messages
- Automatic winner announcement
- Synchronized across all users

### Performance & Security
- API caching with TTL
- Rate limiting with exponential backoff
- Input sanitization (XSS prevention)
- Username validation

---

## 🚀 How It Works

1. **Set your LeetCode username** - Stats auto-fetch
2. **Add friends** - Build your squad
3. **Create a room** - Or join via shared link
4. **Start a war!** - Get a random problem
5. **Race to solve it** - First accepted solution wins
6. **Voice chat** - Optional coordination

Minimum 2 participants, maximum 10 (API rate limiting).

---

## 💡 Cool Technical Challenges

### 1. API Rate Limiting
LeetCode's public API has strict rate limits. I built a caching layer with:
- TTL-based caching (60s for profiles, 30s for submissions)
- Request deduplication
- Exponential backoff
- Result: **83% reduction in API calls**

### 2. WebRTC Signaling Collisions
When two users join simultaneously, WebRTC can fail. I implemented the **Perfect Negotiation pattern**:
- Polite/impolite peer roles
- Automatic collision resolution
- Graceful fallbacks

### 3. Real-time Winner Detection
Polling submissions every 2 minutes with:
- Smart slug matching (handles LeetCode's inconsistent naming)
- Timestamp validation
- Duplicate submission handling

### 4. Firebase Optimization
- Snapshot listener deduplication
- Optimistic updates
- Minimal document writes

---

## 🎨 UI/UX Highlights

- **Modern chat interface** - WhatsApp-style bubbles
- **Smooth animations** - Micro-interactions everywhere
- **Confetti on wins** - Celebrate victories!
- **Sound effects** - Audio feedback for actions
- **Responsive design** - Works on mobile

---

## 🔒 Security

- Input sanitization (XSS prevention)
- Username validation (verifies LeetCode accounts exist)
- War state validation (min 2 participants, no duplicates)
- Anonymous auth (no personal data required)

---

## 📊 Stats

- **Lines of Code**: ~4,700
- **Development Time**: Built iteratively over [X weeks/months]
- **Files**: 8 core files + 3 utility modules
- **Documentation**: 7 comprehensive docs

---

## 🙏 Built With

**[VibeCoded](https://vibecoded.com)** - An AI-powered development assistant that helped me:
- Implement complex WebRTC logic
- Optimize API caching strategies
- Debug Firebase real-time issues
- Add comprehensive security validations

Seriously, VibeCoded was a game-changer for this project. Highly recommend checking it out!

---

## 🚀 Try It Out

**Live Demo**: [Your URL Here]

**GitHub**: [Your Repo Link]

---

## 🤔 What's Next?

Considering adding:
- [ ] Tournament mode
- [ ] Team battles (2v2, 3v3)
- [ ] Custom problem sets
- [ ] ELO rating system
- [ ] Mobile app
- [ ] Discord bot integration

---

## 💬 Feedback Welcome!

This is my first major React + Firebase project. Would love to hear:
- What features would you add?
- Any bugs you find?
- Performance issues?
- UI/UX improvements?

**Star the repo if you like it!** ⭐

---

**Built with ❤️ using [VibeCoded](https://vibecoded.com)**
```

---

### Medium Version (For r/leetcode, r/cscareerquestions)

```markdown
# 🎮 I made LeetCode competitive - battle your friends in real-time!

Tired of grinding LeetCode alone? I built **LeetCode Battle** - a platform where you can race friends to solve problems.

**Features**:
- 🏆 Real-time coding wars
- 📊 Live leaderboards
- 🎯 Auto winner detection
- 🎙️ Voice chat built-in
- 💬 Live messaging

**How it works**:
1. Add your LeetCode username
2. Invite friends
3. Start a war (random problem)
4. First to submit accepted solution wins!

**Tech**: React + Firebase + WebRTC

**Try it**: [Your URL Here]

Built with help from [VibeCoded](https://vibecoded.com) - an AI dev assistant that made the complex parts (WebRTC, API optimization) way easier.

Feedback welcome! What features would you add?
```

---

### Short Version (For r/SideProject, r/InternetIsBeautiful)

```markdown
# LeetCode Battle - Make interview prep competitive 🎮

Race your friends to solve LeetCode problems in real-time. First accepted solution wins!

✨ Features: Live leaderboards, voice chat, auto winner detection, 3 themes

🛠️ Built with: React, Firebase, WebRTC

🚀 Try it: [Your URL Here]

Built using [VibeCoded](https://vibecoded.com) - AI-powered dev assistant

Feedback appreciated! ⭐
```

---

## 🎯 Recommended Subreddits

### High Engagement (Post Full Version)
1. **r/webdev** - Web developers love React + Firebase projects
2. **r/reactjs** - React community will appreciate the architecture
3. **r/programming** - General programming audience
4. **r/SideProject** - Perfect for showcasing side projects

### Medium Engagement (Post Medium Version)
5. **r/leetcode** - Your target audience!
6. **r/cscareerquestions** - Interview prep is relevant
7. **r/learnprogramming** - Helpful for learners

### Niche Communities (Post Short Version)
8. **r/InternetIsBeautiful** - Cool web apps
9. **r/coolgithubprojects** - GitHub showcases
10. **r/Firebase** - Firebase-specific community

---

## 📸 Post Tips

### Before Posting
1. **Deploy your app** - Get a live URL (Vercel, Netlify, Firebase Hosting)
2. **Take screenshots** - Dashboard, active war, leaderboard, chat
3. **Create a demo room** - Pre-populate with sample data
4. **Test on mobile** - Ensure it works on different devices
5. **Prepare for traffic** - Check Firebase quotas

### When Posting
1. **Post at peak times** - 9-11 AM EST on weekdays
2. **Engage with comments** - Reply to everyone in first hour
3. **Be humble** - "First React project, feedback welcome!"
4. **Share learnings** - What you struggled with
5. **Credit VibeCoded** - Mention how it helped

### After Posting
1. **Monitor comments** - Reply quickly
2. **Fix reported bugs** - Show responsiveness
3. **Update post** - Add "Edit: Thanks for the feedback!"
4. **Cross-post** - Share to other relevant subreddits (wait 24h)

---

## 🔗 Links to Include

Replace these placeholders:

- **Live Demo**: `https://your-app.vercel.app` or `https://your-app.web.app`
- **GitHub**: `https://github.com/yourusername/Leetcode-Battle`
- **Demo Room**: `https://your-app.vercel.app?room=demo`
- **VibeCoded**: `https://vibecoded.com`
- **Your Twitter**: `https://twitter.com/yourhandle` (optional)

---

## 📊 Expected Response

### Likely Questions
1. "How do you handle LeetCode API rate limits?" → Explain caching
2. "Is this against LeetCode TOS?" → It uses public API, read-only
3. "Can I self-host?" → Yes, just need Firebase account
4. "How does voice chat work?" → WebRTC peer-to-peer
5. "What about cheating?" → Honor system, submissions are public

### Common Feedback
- "Add X feature" → Thank them, add to roadmap
- "Bug report" → Thank them, fix ASAP
- "This is cool!" → Thank them, ask for star
- "Code review" → Be open to criticism

---

## 🎉 Good Luck!

Remember to:
- ✅ Be authentic and humble
- ✅ Engage with every comment
- ✅ Credit VibeCoded prominently
- ✅ Share your learning journey
- ✅ Ask for feedback, not just praise

**You got this!** 🚀
