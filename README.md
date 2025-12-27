# Ello Kanban

A lightweight Trello-style Kanban board built with **Angular (standalone components)** on the web, and **Fastify + Prisma + PostgreSQL** on the API.  
Supports drag & drop with rank-based ordering, inline list & card editing, labels (create/assign/unassign), quick filters, and seeded demo data.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Monorepo Layout](#monorepo-layout)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Common Commands](#common-commands)
  - [Install / Build / Dev](#install--build--dev)
  - [Add / Remove Packages](#add--remove-packages)
  - [Database (Prisma)](#database-prisma)
  - [Seeds](#seeds)
  - [Rebuild / Reset](#rebuild--reset)
- [Project Scripts (reference)](#project-scripts-reference)
- [Project Features](#project-features)
- [API Overview](#api-overview)
  - [Boards](#boards)
  - [Lists](#lists)
  - [Cards](#cards)
  - [Labels](#labels)
  - [Service Desk Webhook](#service-desk-webhook)
- [Data Model (Prisma)](#data-model-prisma)
- [Rank Ordering](#rank-ordering)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

---

## Tech Stack

- **Web (apps/web)**
  - Angular (standalone components, signals)
  - Angular CDK Drag & Drop
  - Tailwind-style utility classes (plain CSS utility classes in templates)
- **API (apps/api)**
  - Fastify
  - Prisma ORM
  - PostgreSQL
  - TypeScript, `tsx`, `dotenv`
- **Monorepo**
  - pnpm workspaces

---

## Monorepo Layout

```
.
├─ apps/
│  ├─ api/                     # Fastify + Prisma API
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma      # DB schema
│  │  │  └─ migrations/        # Prisma migrations
│  │  ├─ src/
│  │  │  ├─ server.ts          # Fastify bootstrap
│  │  │  ├─ routes/
│  │  │  │  ├─ boards.ts
│  │  │  │  ├─ lists.ts
│  │  │  │  ├─ cards.ts
│  │  │  │  └─ labels.ts
│  │  │  ├─ seed.ts            # Seed script (demo workspace/board/lists/labels)
│  │  │  └─ utils/rank.ts
│  │  └─ .env                  # DATABASE_URL etc
│  └─ web/                     # Angular app
│     └─ src/app/
│        ├─ data/              # Api services (boards, lists, cards, labels)
│        ├─ store/             # BoardStore (signals)
│        ├─ ui/                # board-view, list-column, trello-card, directives
│        └─ app.component.ts   # Shell
├─ package.json
├─ pnpm-workspace.yaml
└─ README.md
```

---

## Getting Started

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Prepare database**
   - Ensure PostgreSQL is running and `DATABASE_URL` is set in `apps/api/.env`.
   - Apply migrations and seed:
     ```bash
     pnpm -F api prisma migrate reset   # confirm 'yes'
     pnpm -F api run seed
     ```

3. **Run API**
   ```bash
   pnpm -F api dev
   ```
   Default (often) at `http://localhost:3000` unless overridden.

4. **Run Web**
   ```bash
   pnpm -F web dev
   ```
   Default (often) at `http://localhost:4200`.

> If your scripts use different names (e.g. `start`, `serve`), see [Project Scripts (reference)](#project-scripts-reference).

---

## Environment Variables

Create `apps/api/.env`:

```env
# Example for local Postgres
DATABASE_URL="postgresql://user:password@localhost:5432/kanban?schema=public"

# Optional: Fastify host/port if you changed defaults
PORT=3000
HOST=0.0.0.0
```

If the web app proxies API calls, ensure the Angular dev proxy or the app’s base URL points to the API host/port you run.

---

## Common Commands

### Install / Build / Dev

```bash
# Install all workspaces
pnpm install

# Build everything (if build scripts exist)
pnpm -r build

# Dev API only
pnpm -F api dev

# Dev Web only
pnpm -F web dev
```

### Add / Remove Packages

**To the root workspace** (tooling shared):
```bash
pnpm add -w <pkg>
pnpm remove -w <pkg>
```

**To a specific app**:
```bash
# Add runtime dependency to API
pnpm -F api add <pkg>

# Add devDependency to API
pnpm -F api add -D <pkg>

# Remove from API
pnpm -F api remove <pkg)

# Same for Web
pnpm -F web add <pkg>
pnpm -F web remove <pkg>
```

### Database (Prisma)

```bash
# Create a new migration (edit schema.prisma first)
pnpm -F api prisma migrate dev --name <migration_name>

# Introspect DB (if needed)
pnpm -F api prisma db pull

# Generate Prisma client
pnpm -F api prisma generate

# Reset DB (drops and re-applies all migrations)
pnpm -F api prisma migrate reset
```

### Seeds

```bash
# Seed demo workspace/board/lists/labels
pnpm -F api run seed
```

> Seed script lives at `apps/api/src/seed.ts` and inserts:
> - Workspace “Demo Workspace”
> - Board “Demo Board”
> - Lists: Backlog, To Do, In Progress, Review, Done
> - Default labels (e.g., green, yellow, orange, red, purple, blue) per board

### Rebuild / Reset

```bash
# Clean install and rebuild
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm -r build

# Reset DB and reseed
pnpm -F api prisma migrate reset
pnpm -F api run seed
```

---

## Project Scripts (reference)

> Adjust to match your `package.json` scripts. These are commonly used patterns in this repo.

**apps/api/package.json**
```json
{
  "scripts": {
    "dev": "tsx -r dotenv/config src/server.ts",
    "seed": "tsx -r dotenv/config src/seed.ts",
    "prisma": "prisma"
  }
}
```

**apps/web/package.json**
```json
{
  "scripts": {
    "dev": "ng serve",
    "build": "ng build"
  }
}
```

---

## Project Features

- **Boards & Lists**
  - Multiple lists per board
  - Inline list rename
  - Add list, add card
- **Cards**
  - Inline title edit / delete
  - Drag & drop within list and across lists
  - Move top / up / down / bottom (rank recomputation)
- **Labels**
  - Board-scoped labels (name + color)
  - Quick assign/unassign on each card
  - Header filter by label
  - Seeded default label set per board
- **Filtering**
  - Quick text filter by card title
  - Optional label filter (single-select v1)
- **Optimistic UI**
  - Store (signals) updates lists/cards immediately
  - Server persists order/assignments

---

## API Overview

Base URL (dev): typically `http://localhost:3000`

### Boards

- `GET /api/boards`
  - Returns boards (id, name, etc.)
- `GET /api/boards/:boardId/labels`
  - List labels for a board (sorted by name)
- `POST /api/boards/:boardId/labels`
  - Body: `{ "name": string, "color": string }`
  - Creates a label

### Lists

- `GET /api/boards/:boardId/lists`
  - Returns lists with their cards ordered by rank
- `POST /api/boards/:boardId/lists`
  - Body: `{ "name": string }`
- `PATCH /api/lists/:id`
  - Body: `{ "name"?: string }` (rename)
- (optional) `DELETE /api/lists/:id`

### Cards

- `GET /api/lists/:listId/cards`
  - Returns cards in that list ordered by rank
- `POST /api/lists/:listId/cards`
  - Body: `{ "title": string, "description"?: string }`
  - Appends card with a new rank
- `PATCH /api/cards/:id`
  - Body: `{ "title"?: string, "description"?: string }`
- `POST /api/cards/:id/move`
  - Body: `{ "toListId": string, "beforeId"?: string|null, "afterId"?: string|null }`
  - Recomputes rank and updates list & rank
- `DELETE /api/cards/:id`

### Labels

- `PATCH /api/labels/:id`
  - Body: `{ "name"?: string, "color"?: string }`
- `DELETE /api/labels/:id`
- **Assign/Unassign**
  - `POST /api/cards/:cardId/labels`  
    Body: `{ "labelId": string }` (shorthand assign)
  - `POST /api/cards/:cardId/labels/:labelId`  
    Upsert junction; returns `{ ok: true }`
  - `DELETE /api/cards/:cardId/labels/:labelId`  
    Removes junction; returns `{ ok: true }`

> The web app uses the shorthand `POST /api/cards/:cardId/labels` + `DELETE /api/cards/:cardId/labels/:labelId` via `LabelsService`.  

### Service Desk Webhook

Generate a secret webhook URL from the Service Desk module:
1) Open `Service Desk → Integrations`
2) Click “Generate secret URL”
3) Copy the URL

Example payload:

```json
{
  "customerName": "Jane Doe",
  "customerPhone": "+1 555 0100",
  "address": "123 Main St",
  "serviceType": "AC repair",
  "notes": "Unit is not cooling",
  "scheduledAt": "2025-01-25T10:30:00Z"
}
```

Optional fields:
- `boardId` (string) — target a specific Service Desk board. If omitted, the first board with an `Inbox` list in the workspace is used.

Example curl:

```bash
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Jane Doe","customerPhone":"+1 555 0100","serviceType":"AC repair","notes":"Unit is not cooling"}'
```
> When moving cards (`/api/cards/:id/move`), the backend typically returns the card without label joins. The UI reloads labels for the active board after moves to keep pills in sync.

---

## Data Model (Prisma)

Key entities (simplified):

- **Workspace** ↔ **Board**
- **Board**
  - `labels` (`Label[]`)
  - `lists` (`List[]`)
- **List**
  - `rank: string` (lexo-like ordering key)
  - `cards` (`Card[]`)
- **Card**
  - `rank: string`
  - Many-to-many with **Label** via **CardLabel**
- **Label**
  - `name: string`, `color: string`
  - Unique per board by `(boardId, name, color)`
  - `rank`, `isArchived` (for future ordering/visibility)
- **CardLabel**
  - Composite PK `(cardId, labelId)`

---

## Rank Ordering

We use a **string rank** to achieve O(1) reorder without reshuffling entire lists.

- New items: `between(prev.rank, next.rank)` from `utils/rank.ts`
- Move within list: compute `beforeId` / `afterId` → new `rank`
- Move across lists: same algorithm, plus update `listId`

This enables stable drag & drop and “move to top/bottom” without renumbering.

---

## Troubleshooting

**Labels disappear after move**
- After calling `POST /api/cards/:id/move`, the returned card may not include label relations.  
  The web layer handles this by:
  1. Updating the local list order optimistically.
  2. Refreshing lists from `/api/boards/:boardId/lists` (which include `cards`).
  3. Reloading labels via `LabelsService.loadLabels(boardId)` (especially if card label pills look stale).

**404 on `/api/cards/:cardId/labels`**
- Ensure the **label routes** are registered. In `apps/api/src/server.ts`, you must call `registerLabelRoutes(app, prisma)` **after** creating Fastify/Prisma instances.
- Confirm the Angular app proxies `/api` to the API host:port in dev.

**`Cannot read properties of undefined (reading '_lists')`**
- Ensure `BoardStore` is instantiated (providedIn root) and you call `BoardsService.loadBoards()` early (e.g., `AppComponent.ngOnInit`).
- Use `this.store.addLabelToCardLocally` / `removeLabelFromCardLocally` only after lists are loaded.

**Unique constraints mismatch after schema change**
- Run:
  ```bash
  pnpm -F api prisma migrate reset
  pnpm -F api run seed
  ```
- If you renamed a unique index (e.g., `@@unique([boardId, name, color], name: "board_name_color")`), regenerate client:
  ```bash
  pnpm -F api prisma generate
  ```

**Empty list is not droppable**
- We style the drop zone to be always active. Make sure the list template uses:
  ```html
  <div cdkDropList class="dropzone space-y-2" [class.empty]="cards().length === 0">
    <div *ngIf="cards().length === 0" class="empty-placeholder">Drop cards here</div>
    ...
  </div>
  ```
  and CSS ensures sufficient height/padding for the empty area.

---

## Real-Time Notifications System

Ello includes a complete real-time notification system using Socket.IO for instant updates. Users receive notifications for mentions, assignments, comments, card moves, and board invites.

### Architecture

- **Backend**: Socket.IO server with JWT authentication
- **Database**: Notification persistence with Prisma
- **Frontend**: Socket.IO client with Signal-based state management
- **UI**: Notification bell in header with dropdown list

### Backend Setup

The notification system is already integrated. Key components:

**Socket.IO Server** (`apps/api/src/socket.ts`):
- JWT-based authentication
- User-specific rooms: `user:{userId}`
- Board subscription rooms: `board:{boardId}`

**Notification Service** (`apps/api/src/services/notification-service.ts`):
- `notifyMention(params)` - @mentions in comments
- `notifyCardAssignment(params)` - user assigned to card
- `notifyCardComment(params)` - comments on watched cards
- `notifyCardMove(params)` - card moved between lists
- `notifyBoardInvite(params)` - added to board

**API Routes** (`/api/notifications/*`):
- `GET /api/notifications` - Fetch notifications (paginated)
- `GET /api/notifications/unread/count` - Get unread count
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Frontend Integration

**Services**:
- `SocketService` - WebSocket connection management
- `NotificationsService` - HTTP API calls
- `NotificationsStore` - Signal-based state with real-time updates

**Authentication Integration**:
Socket.IO automatically connects when user logs in and disconnects on logout. Check `apps/web/src/app/auth/auth.service.ts`:
```typescript
async login(payload) {
  // ... login logic
  this.socketService.connect(accessToken);
  await this.notificationsStore.loadNotifications();
}
```

**User Header Component**:
The notification bell appears in the user header with:
- Unread badge count
- Dropdown list of recent notifications
- Mark as read / delete actions
- Click to navigate to related card/board

### Notification Types

```typescript
type NotificationType =
  | 'MENTIONED'           // @mentioned in a comment
  | 'ASSIGNED_TO_CARD'    // assigned to a card
  | 'CARD_COMMENT'        // comment on assigned/watched card
  | 'CARD_DUE_SOON'       // due date approaching
  | 'CARD_MOVED'          // card moved to different list
  | 'ADDED_TO_BOARD'      // invited to board
  | 'ADDED_TO_WORKSPACE'; // invited to workspace
```

### Triggering Notifications

Notifications are automatically triggered when:

**Card Assignment**:
```typescript
// In apps/api/src/routes/cards.ts
await notificationService.notifyCardAssignment({
  assigneeId: userId,
  actorId: currentUser.id,
  cardId: card.id
});
```

**Card Comments**:
```typescript
await notificationService.notifyCardComment({
  cardId: card.id,
  actorId: currentUser.id,
  commentId: comment.id,
  commentText: text
});
```

**Custom Notifications**:
To add notifications for new features, inject `NotificationService` and call the appropriate method:
```typescript
const notificationService = new NotificationService(prisma);
await notificationService.notifyMention({
  mentionedUserId: userId,
  actorId: currentUser.id,
  cardId,
  commentId
});
```

### Database Schema

**Notification Model**:
```prisma
model Notification {
  id        String           @id @default(cuid())
  type      NotificationType
  title     String
  message   String?
  isRead    Boolean          @default(false)
  userId    String
  actorId   String?
  cardId    String?
  boardId   String?
  metadata  Json?
  createdAt DateTime         @default(now())
  
  user   User   @relation("UserNotifications", fields: [userId], references: [id])
  actor  User?  @relation("ActorNotifications", fields: [actorId], references: [id])
  card   Card?  @relation(fields: [cardId], references: [id])
  board  Board? @relation(fields: [boardId], references: [id])
  
  @@index([userId, isRead])
  @@index([userId, createdAt])
}
```

**Watched Items**:
```prisma
model WatchedCard {
  userId String
  cardId String
  user   User @relation(fields: [userId], references: [id])
  card   Card @relation(fields: [cardId], references: [id])
  @@id([userId, cardId])
}

model WatchedBoard {
  userId  String
  boardId String
  user    User  @relation(fields: [userId], references: [id])
  board   Board @relation(fields: [boardId], references: [id])
  @@id([userId, boardId])
}
```

### Testing Notifications

1. **Login** with two different user accounts in separate browsers
2. **Assign User A** to a card while logged in as User B
3. **Check User A's browser** - notification bell shows unread badge
4. **Click the bell** - see notification in dropdown
5. **Add a comment** on an assigned card - watchers get notified
6. **Mark as read** - badge count decreases
7. **Navigate to card** by clicking notification

### Browser Notifications (Optional)

To enable native browser notifications, users can grant permission:
```typescript
notificationsStore.requestBrowserNotificationPermission();
```

The system automatically shows browser notifications when:
- User is not on the active tab
- Permission is granted
- New notification arrives via Socket.IO

### Environment Configuration

Ensure `apps/web/src/environments/environment.ts` includes:
```typescript
export const environment = {
  production: false,
  apiOrigin: 'http://localhost:3000',
  apiUrl: 'http://localhost:3000',  // Required for Socket.IO
  publicPrefix: '/uploads'
};
```

### Troubleshooting

**Socket.IO not connecting**:
- Check browser console for "Socket.IO connected" message
- Verify JWT token is valid in localStorage
- Ensure API server is running with Socket.IO setup

**Notifications not appearing**:
- Check that notification triggers are called in API routes
- Verify user is authenticated and Socket.IO is connected
- Check database for notification records: `SELECT * FROM "Notification" WHERE "userId" = 'user-id'`

**Real-time not working**:
- Ensure `@fastify/websocket` is installed in API
- Verify Socket.IO server is initialized in `main.ts`
- Check for CORS issues between frontend and backend

---

## Roadmap

- Multi-label filter (AND/OR)
- Label edit modal (rename, recolor) and archive
- Board background/theme persistence
- Card details modal (description, checklist, attachments, comments)
- Realtime (WebSocket) sync
- Permissions (workspace/board roles)

---

## License

MIT © Ello Kanban contributors
