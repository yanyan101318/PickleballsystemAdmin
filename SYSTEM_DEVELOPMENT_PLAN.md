# Pickleball Tournament Management System
## System Development Plan Report

**Project Name:** Tournament Bracket System  
**Version:** 0.1.0  
**Date:** April 1, 2026  
**Status:** In Development

---

## 1. PURPOSE

The Pickleball Tournament Management System is a comprehensive web-based platform designed to facilitate the organization, execution, and administration of pickleball tournaments. The system enables tournament organizers to manage tournament brackets, courts, bookings, and payments while providing real-time match scoring and allowing spectators to view live tournament progress.

### Primary Objectives
- **Streamline Tournament Management:** Simplify the setup and administration of pickleball tournaments
- **Real-Time Match Tracking:** Enable accurate scoring and bracket progression with live updates
- **Multi-Role Access Control:** Support different user roles (Admin, Scorer, Viewer) with appropriate permissions
- **Automated Bracket Generation:** Generate tournament brackets automatically based on player count and format
- **Court & Booking Management:** Manage court availability, player bookings, and payment processing
- **Analytics & Reporting:** Provide tournament organizers with insights into tournament performance and analytics

---

## 2. FEATURES

### 2.1 Core Tournament Management Features

#### Tournament Formats & Structures (NEW - MULTI-FORMAT SUPPORT)
✅ **Single-Elimination Tournament**
- Each team loses once and is eliminated
- Fastest tournament format
- Ideal for limited time/space constraints
- Generates bracket with minimum rounds

✅ **Double-Elimination Tournament** (NEW)
- Teams get a second chance after first loss
- Winners bracket and losers bracket
- Final is determined by winners bracket champion
- Better for skill-based competition fairness
- Complex advancement logic for both brackets

✅ **Round-Robin Tournament** (NEW)
- Each team plays every other team once
- All teams play equal number of matches
- Final standings based on win-loss record
- Best for skill assessment and balanced competition
- Automatic round optimization to minimize tournament days

#### Tournament Setup & Administration
- Create and configure tournament brackets with customizable formats
- Support for all three tournament structure types (Single, Double, Round-Robin)
- Automatic bracket generation based on player count and format selection
- Real-time tournament information management (name, format, champion tracking)
- Multiple tournament creation and management capabilities
- Format-specific advancement rules automatically applied

#### Match Scoring System
- **Official Pickleball Scoring Rules Implementation:**
  - Play to 11 points with win-by-2 requirement
  - Support for both singles and doubles play
  - Proper serving sequence management with side alternation
  - Fault handling and serve-out tracking
  - Automatic game state tracking

- **Match Management:**
  - Live score recording interface (Scorer Page)
  - Match result updates with real-time bracket progression
  - Undo functionality for scoring corrections
  - Format-aware advancement of winning teams (singles path, losers path, standings)
  - Automatic loser advancement in double-elimination
  - Standings tracking in round-robin tournaments
  - Champion determination and tracking

### 2.2 User Role-Based Features

#### Admin Panel (`/admin`)
- **Dashboard:** View key statistics (active tournaments, upcoming matches, payments, bookings)
- **Court Manager:** Create and manage court information and availability
- **Booking Manager:** Handle player bookings and court assignments
- **Payment Review:** Track and review tournament payments
- **Tournament Management:** Create, edit, and manage tournament brackets
- **Analytics:** View tournament statistics and performance metrics
- **Announcement Manager:** Broadcast announcements to tournament participants

#### Scorer Role
- **Dedicated Scoring Interface:** Optimized page for real-time match scoring
- **Match-Specific Scoring:** Input game results and manage serving rotations
- **Real-Time Sync:** Automatic synchronization with tournament data

#### Viewer Role
- **Live Bracket View:** Real-time tournament bracket visualization
- **Match Details:** View match results and upcoming matchups
- **Tournament Progress:** Track overall tournament progression
- **Shareable Links:** Share tournament view via unique tournament IDs

#### Authentication System
- User registration and login functionality
- Role-based access control (Admin, Scorer, Viewer)
- Protected routes with authentication enforcement
- Session management

### 2.3 Reference & Information Features
- **Pickleball Rules Reference:** Complete documentation of official pickleball scoring and serving rules
- **Share Functionality:** Share tournament bracket views via URL
- **Clipboard Support:** Copy tournament data to clipboard for easy sharing

### 2.4 Technical Features
- **Real-Time Data Synchronization:** Firebase Firestore for live updates across all users
- **Responsive Design:** Tailwind CSS for mobile and desktop compatibility
- **Background Components:** Customizable background elements for visual appeal
- **Dark Theme UI:** Modern dark-mode interface with cyan accent colors

---

## 3. TECH STACK

### Frontend Architecture
```
React 19.2.4
├── React Router DOM 7.13.2 (Navigation & Routing)
├── React DOM 19.2.4 (Rendering)
└── React Scripts 5.0.1 (Build tooling)
```

### Styling & UI
```
Tailwind CSS 3.4.19 (Utility-first CSS framework)
├── PostCSS 8.5.8
├── Autoprefixer 10.4.27
└── Custom CSS (App.css, auth.css, admin.css)
```

### Backend & Database
```
Firebase 12.11.0
├── Firestore (Real-time NoSQL Database)
├── Firebase Auth (Authentication)
└── Realtime Syncing (onSnapshot listeners)
```

### Development & Testing
```
Testing Libraries:
├── @testing-library/react 16.3.2
├── @testing-library/jest-dom 6.9.1
├── @testing-library/dom 10.4.1
└── @testing-library/user-event 13.5.0

Performance Monitoring:
└── web-vitals 2.1.4
```

### Build & Deployment
```
npm (Node Package Manager)
├── Development: npm start (React development server)
├── Production: npm run build (Optimized build)
└── Testing: npm test (Jest test runner)
```

### Project Configuration
```
Environment:
├── Node.js / npm
├── Babel (JavaScript transpilation)
├── Webpack (Module bundling via React Scripts)
└── ESLint (Code quality)
```

---

## 4. PROCESS FLOW

### 4.1 Tournament Creation & Setup Flow

```
┌─────────────────────────────────┐
│ Admin Accesses Admin Dashboard  │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Admin Creates Tournament        │
│ - Name, Format, Player Count    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Bracket Generator               │
│ - generateBracket()             │
│ - Auto-generate matches         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Firestore Storage               │
│ - Save tournament info          │
│ - Save all matches              │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Tournament Ready                │
│ Share URL with participants     │
└─────────────────────────────────┘
```

### 4.2 Real-Time Match Scoring Flow

```
┌──────────────────────────────────┐
│ Scorer Accesses Scorer Page      │
│ /score/:tournamentId/:matchId    │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Initialize Match State           │
│ - subscribeToMatch()             │
│ - Real-time Firestore listener   │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Display Score Modal              │
│ - Current scores (Team A vs B)   │
│ - Serving information            │
│ - Game history                   │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Record Score Input               │
│ - Point awarded to Team A or B   │
│ - Update serving rotation        │
│ - Process faults/serving errors  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Validate Score                   │
│ - Check game win conditions      │
│ - Verify pickleball rules        │
│ - getGameWinner()                │
└────────────┬─────────────────────┘
             │
├─ NO (Not Won) ─→ Return to input
│
└─ YES (Game Won) ──┐
             │
             ▼
┌──────────────────────────────────┐
│ Record Set Win                   │
│ - recordSetWin()                 │
│ - Update match data              │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Update Firebase Match            │
│ - updateMatch()                  │
│ - updateNextMatch()              │
│ - Firestore batch write          │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Notify Next Match Participants   │
│ - subscribeToMatches() triggers  │
│ - Real-time UI updates           │
│ - Score sync across sessions     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Check Tournament Status          │
│ - All matches complete?          │
│ - Champion determined?           │
└────────────┬─────────────────────┘
             │
├─ NO ──→ Continue to next match
│
└─ YES ──→ setChampion() & End Tournament
```

### 4.3 Tournament Viewing Flow (Spectators)

```
┌──────────────────────────────────┐
│ User Accesses Tournament Link    │
│ /bracket/:tournamentId           │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Load Tournament Data             │
│ - subscribeToTournamentInfo()    │
│ - subscribeToMatches()           │
│ - Real-time Firestore listeners  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Display BracketView Component    │
│ - Visual bracket structure       │
│ - Match cards with scores        │
│ - Tournament name & details      │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Real-Time Updates                │
│ - Listen for match results       │
│ - Update bracket as scores come  │
│ - Refresh champion when crowned  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Display Tournament Results       │
│ - Final bracket state            │
│ - Champion highlighted           │
└──────────────────────────────────┘
```

### 4.4 Authentication & Authorization Flow

```
┌──────────────────────────────────┐
│ User Visits App                  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ AuthProvider Initialization      │
│ - Check Firebase auth state      │
│ - Load user context              │
└────────────┬─────────────────────┘
             │
        ┌────┴─────┐
        │           │
   Authenticated  Unauthenticated
        │           │
        ▼           ▼
   ┌────────┐   ┌──────────┐
   │ Authed │   │ Login/   │
   │ User   │   │ Register │
   │ Pages  │   └──────────┘
   └────┬───┘
        │
        ▼
┌──────────────────────────────────┐
│ ProtectedRoute Enforcement       │
│ - Check user role                │
│ - Verify admin access            │
│ - Redirect if unauthorized       │
└────────────┬─────────────────────┘
        │
    ┌───┴─────────┬──────────────┐
    │             │              │
  Admin       Scorer/Viewer    Redirect
    │             │
    ▼             ▼
┌────────┐   ┌──────────┐
│ Admin  │   │ Public   │
│ Panel  │   │ Views    │
└────────┘   └──────────┘
```

### 4.5 Data Synchronization Architecture

```
┌─────────────────────────────────┐
│     Firebase Firestore          │
│   (Single Source of Truth)      │
└────────────┬────────────────────┘
             │
        ┌────┴────┬────────┐
        │         │        │
        ▼         ▼        ▼
    Tournaments Matches  Users
    Collection Collection Collection
        │         │        │
        │         ▼        │
        │    Game States   │
        │    (subscribed)  │
        │         │        │
   ┌────┴─────────┴────────┴──────┐
   │      React Components UI      │
   │   (onSnapshot listeners)      │
   └──────────────────────────────┘
        │         │        │
    Admin    Scorer   Viewer
    Pages    Pages    Pages
```

### 4.6 Admin Panel Operations Flow

```
Admin Dashboard
├── Statistics Overview
│   ├── Active Tournaments
│   ├── Upcoming Matches
│   ├── Payment Status
│   └── Booking Count
│
├── Court Management
│   ├── Create Courts
│   ├── Set Availability
│   ├── View Court Status
│   └── Manage Schedules
│
├── Booking Management
│   ├── View All Bookings
│   ├── Approve/Deny Bookings
│   ├── Manage Court Assignments
│   └── Track Player Assignments
│
├── Payment Processing
│   ├── Review Payments
│   ├── Process Refunds
│   ├── Generate Reports
│   └── Track Revenue
│
├── Tournament Management
│   ├── Create Tournaments
│   ├── Edit Brackets
│   ├── Manage Participants
│   └── Monitor Progress
│
├── Analytics & Reporting
│   ├── Tournament Statistics
│   ├── Player Performance
│   ├── Revenue Analysis
│   └── Capacity Planning
│
└── Announcements
    ├── Create Announcements
    ├── Target Audiences
    ├── Schedule Messages
    └── Track Engagement
```

---

## 5. DATA MODEL

### 5.1 Firestore Collections Structure

```
/tournaments/{tournamentId}
├── name: string
├── format: string (e.g., "doubles")
├── tournamentFormat: string (e.g., "single-elimination")
├── createdAt: timestamp
├── champion: string (team/player name)
└── /matches/{matchId}
    ├── matchId: string
    ├── round: number
    ├── teamA: {name: string, ...}
    ├── teamB: {name: string, ...}
    ├── scoreA: number
    ├── scoreB: number
    ├── currentGame: {
    │   ├── servingTeam: "A" | "B"
    │   ├── firstServer: boolean
    │   ├── servingSide: "left" | "right"
    │   └── pointsServed: number
    ├── winner: string
    └── completed: boolean
```

---

## 6. KEY COMPONENTS & RESPONSIBILITIES

| Component | Purpose |
|-----------|---------|
| **App.jsx** | Main routing and authentication provider wrapper |
| **AuthContext.jsx** | Global authentication state management |
| **BracketView.jsx** | Tournament bracket visualization |
| **ScoreModal.jsx** | Score input interface for matches |
| **SetupForm.jsx** | Tournament creation form |
| **AdminDashboard.jsx** | Admin statistics and overview |
| **tournamentService.js** | Firebase Firestore operations |
| **bracketGenerator.js** | Bracket generation and scoring logic |
| **pickleballRules.js** | Official pickleball rules reference |

---

## 7. INTEGRATION POINTS

- **Firebase Integration:** All data persists to Firestore with real-time synchronization
- **React Router:** Navigation between public, scorer, and admin pages
- **Context API:** Global authentication state
- **Firestore Listeners:** Real-time updates across all user sessions

---

## 8. DEPLOYMENT & INFRASTRUCTURE

- **Frontend Hosting:** Suitable for Vercel, Netlify, or Firebase Hosting
- **Database:** Firebase Firestore (managed NoSQL)
- **Authentication:** Firebase Authentication
- **Build Process:** React Scripts (create-react-app)
- **Environment:** Node.js with npm package management

---

## 9. FUTURE ENHANCEMENTS

- [x] Multi-format tournament support (round-robin, double-elimination) ✅ COMPLETED
- [ ] Advanced loser's bracket rules (full double-elimination implementation)
- [ ] Player ratings and leaderboards
- [ ] Advanced analytics dashboards with format-specific metrics
- [ ] Mobile app (React Native)
- [ ] API documentation and webhooks
- [ ] Integration with payment processors
- [ ] Email notifications
- [ ] Tournament history and archiving
- [ ] Custom bracket visualization for each format

---

**End of System Development Plan Report**
