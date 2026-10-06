# ⚡ TaskFlow — Node.js & Express.js Task Manager

A web application built using **Node.js**, **Express.js**, and the native **File System (`fs`)** module. Each task is persisted directly to the filesystem as an individual `.txt` file, rendered into responsive interactive cards, and viewable in full detail via a dedicated "Read More" route.

---

## 🚀 Features

- **File System Storage (`fs.writeFile`)**: Tasks are saved as `.txt` files directly inside the `./tasks/` directory.
- **Card-based Dashboard (`fs.readdir`)**: All saved tasks are dynamically retrieved from disk and displayed as sleek glassmorphic cards.
- **"Read More" Route (`req.params` & `fs.readFile`)**: Clicking "Read More" on any card opens the complete task view showing full content, word count, character count, and file metadata.
- **Form Data Processing (`req.body`)**: Creates new tasks with user-provided `title` and `description` using standard URL-encoded form submissions.
- **Real-Time Client-side Search**: Instant live filtering of cards by title, text, or filename.
- **Quick Template Chips**: One-click fill templates for Feature, Bug Fix, Meeting, and Documentation.
- **File Management Actions**:
  - Edit task titles and descriptions (`fs.rename` and `fs.writeFile`)
  - Delete task files with confirmation modal (`fs.unlink`)
  - Download raw `.txt` file (`res.download`)
  - Copy content to clipboard

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js (v18+) |
| **Framework** | Express.js |
| **View Engine** | EJS (Embedded JavaScript) |
| **Storage** | Native Node.js `fs` module (Zero Database required) |
| **Styling** | Modern Vanilla CSS (Dark obsidian palette, Glassmorphism, Responsive Grid) |

---

## 📂 Project Structure

```text
today/
├── tasks/                       # Storage folder holding all .txt task files
│   ├── Project Overview.txt
│   └── Setup Express Routes.txt
├── views/                       # EJS View templates
│   ├── index.ejs                # Dashboard with creation form & task cards
│   ├── task.ejs                 # "Read More" single task detailed view
│   ├── edit.ejs                 # Edit task form
│   └── error.ejs                # Friendly error & 404 page
├── public/                      # Static assets
│   ├── css/
│   │   └── style.css            # Custom glassmorphic styling
│   └── js/
│       └── main.js              # Real-time search, counters & modal logic
├── server.js                    # Express app with all routes and FS logic
├── package.json                 # Dependencies and npm run scripts
└── README.md                    # Documentation
```

---

## 🧠 Express Routes & FS Methods Explained

### 1. Dashboard & Task Cards: `GET /`
- **FS Method**: `fs.readdir(TASKS_DIR)`
- **How it works**: Reads all files in the `./tasks/` directory, filters for `.txt` files, and reads each file's metadata (`fs.stat`) and snippet content (`fs.readFile`) to render the card grid on `index.ejs`.

### 2. Create Task: `POST /create`
- **Request Access**: `req.body.title`, `req.body.description`
- **FS Method**: `fs.writeFile(filePath, description, 'utf-8')`
- **How it works**: Validates and sanitizes the user's title into a safe filename `<title>.txt`. Persists the description content to disk and redirects to `/?msg=created`.

### 3. Read More (Full Details): `GET /task/:filename`
- **Request Access**: `req.params.filename`
- **FS Method**: `fs.readFile(filePath, 'utf-8')`
- **How it works**: Extracts `:filename` from the URL, sanitizes with `path.basename` to prevent path traversal attacks, reads the full content from disk, and renders `task.ejs`.

### 4. Edit / Update Task: `POST /update/:filename`
- **Request Access**: `req.params.filename`, `req.body.title`, `req.body.description`
- **FS Methods**: `fs.rename` (if title changed) and `fs.writeFile` (for updated description).

### 5. Delete Task: `POST /delete/:filename`
- **Request Access**: `req.params.filename`
- **FS Method**: `fs.unlink(filePath)`
- **How it works**: Unlinks and permanently deletes the specified `.txt` file from disk, then redirects back to the dashboard with a success toast.

---

## 🏃 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
Or with auto-reload:
```bash
npm run dev
```

### 3. Open in Browser
Visit [http://localhost:3000](http://localhost:3000) in your browser.
