const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TASKS_DIR = path.join(__dirname, 'tasks');

// Ensure tasks directory exists
if (!fs.existsSync(TASKS_DIR)) {
  fs.mkdirSync(TASKS_DIR, { recursive: true });
}

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helper function to sanitize filename
function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return `task-${Date.now()}`;
  const cleaned = name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  return cleaned.length > 0 ? cleaned.slice(0, 100) : `task-${Date.now()}`;
}

// Helper to format file size
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * GET /
 * Lists all tasks saved as .txt files in the tasks directory.
 * Uses: fs.readdir, fs.readFile, fs.stat
 */
app.get('/', (req, res) => {
  fs.readdir(TASKS_DIR, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return res.status(500).render('error', { 
        title: 'Filesystem Error', 
        message: 'Unable to read the tasks storage directory.' 
      });
    }

    // Filter to only include .txt files
    const txtFiles = files.filter(file => file.endsWith('.txt'));

    // Read content and stats for each file
    const taskPromises = txtFiles.map(file => {
      const filePath = path.join(TASKS_DIR, file);
      return new Promise((resolve) => {
        fs.readFile(filePath, 'utf-8', (readErr, content) => {
          fs.stat(filePath, (statErr, stats) => {
            const rawContent = readErr ? '' : content;
            const title = file.replace(/\.txt$/, '');
            const preview = rawContent.length > 120 
              ? rawContent.slice(0, 120) + '...' 
              : rawContent;
            
            const words = rawContent.trim() ? rawContent.trim().split(/\s+/).length : 0;
            const characters = rawContent.length;

            resolve({
              filename: file,
              title: title,
              preview: preview,
              content: rawContent,
              words: words,
              characters: characters,
              sizeFormatted: statErr ? '0 B' : formatBytes(stats.size),
              sizeBytes: statErr ? 0 : stats.size,
              createdAt: statErr ? new Date() : stats.birthtime || stats.mtime,
              modifiedAt: statErr ? new Date() : stats.mtime
            });
          });
        });
      });
    });

    Promise.all(taskPromises).then(tasks => {
      // Sort tasks by modification time (newest first)
      tasks.sort((a, b) => b.modifiedAt - a.modifiedAt);

      const totalSize = tasks.reduce((acc, t) => acc + t.sizeBytes, 0);

      res.render('index', {
        title: 'TaskFlow | Minimalist FS Task Manager',
        tasks: tasks,
        stats: {
          total: tasks.length,
          totalSizeFormatted: formatBytes(totalSize)
        },
        alert: req.query.msg || null
      });
    });
  });
});

/**
 * POST /create
 * Creates a new task and writes it to a .txt file.
 * Uses: req.body, fs.writeFile
 */
app.post('/create', (req, res) => {
  const { title, description } = req.body;

  if (!title || !title.trim()) {
    return res.redirect('/?msg=error_empty_title');
  }

  const baseName = sanitizeFilename(title);
  let finalFileName = `${baseName}.txt`;
  let targetPath = path.join(TASKS_DIR, finalFileName);

  // If a file with the exact name already exists, add a unique suffix
  let counter = 1;
  while (fs.existsSync(targetPath)) {
    finalFileName = `${baseName}-${counter}.txt`;
    targetPath = path.join(TASKS_DIR, finalFileName);
    counter++;
  }

  const taskBody = (description || '').trim();

  fs.writeFile(targetPath, taskBody, 'utf-8', (err) => {
    if (err) {
      console.error('Error writing task file:', err);
      return res.status(500).render('error', {
        title: 'Save Failed',
        message: 'Could not write task to disk.'
      });
    }

    console.log(`[Task Created] Saved ${finalFileName}`);
    res.redirect('/?msg=created');
  });
});

/**
 * GET /task/:filename
 * "Read More" route to view the full details of a specific task.
 * Uses: req.params, fs.readFile, fs.stat
 */
app.get('/task/:filename', (req, res) => {
  // Prevent directory traversal
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(TASKS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).render('error', {
      title: 'Task Not Found',
      message: `The task file "${safeFilename}" does not exist in storage.`
    });
  }

  fs.readFile(filePath, 'utf-8', (err, content) => {
    if (err) {
      console.error('Error reading task file:', err);
      return res.status(500).render('error', {
        title: 'Read Error',
        message: 'Failed to read task content.'
      });
    }

    fs.stat(filePath, (statErr, stats) => {
      const title = safeFilename.replace(/\.txt$/, '');
      const words = content.trim() ? content.trim().split(/\s+/).length : 0;
      const characters = content.length;

      res.render('task', {
        title: `${title} | Task Details`,
        filename: safeFilename,
        taskTitle: title,
        content: content,
        stats: {
          words: words,
          characters: characters,
          sizeFormatted: statErr ? '0 B' : formatBytes(stats.size),
          createdAt: statErr ? new Date() : stats.birthtime || stats.mtime,
          modifiedAt: statErr ? new Date() : stats.mtime
        },
        alert: req.query.msg || null
      });
    });
  });
});

/**
 * GET /edit/:filename
 * Displays the form to edit an existing task's title and description.
 * Uses: req.params, fs.readFile
 */
app.get('/edit/:filename', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(TASKS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).render('error', {
      title: 'Task Not Found',
      message: `The task file "${safeFilename}" does not exist.`
    });
  }

  fs.readFile(filePath, 'utf-8', (err, content) => {
    if (err) {
      console.error('Error reading file for edit:', err);
      return res.status(500).render('error', {
        title: 'Read Error',
        message: 'Could not load file for editing.'
      });
    }

    res.render('edit', {
      title: `Edit ${safeFilename.replace(/\.txt$/, '')}`,
      filename: safeFilename,
      taskTitle: safeFilename.replace(/\.txt$/, ''),
      content: content
    });
  });
});

/**
 * POST /update/:filename
 * Updates the title and/or content of an existing task.
 * Uses: req.params, req.body, fs.writeFile, fs.rename
 */
app.post('/update/:filename', (req, res) => {
  const oldFilename = path.basename(req.params.filename);
  const oldPath = path.join(TASKS_DIR, oldFilename);
  const { title, description } = req.body;

  if (!fs.existsSync(oldPath)) {
    return res.status(404).render('error', {
      title: 'Task Not Found',
      message: `The file "${oldFilename}" was not found.`
    });
  }

  const newBaseName = sanitizeFilename(title);
  const newFilename = `${newBaseName}.txt`;
  const newPath = path.join(TASKS_DIR, newFilename);
  const newContent = (description || '').trim();

  // If title was changed and new filename is different
  if (newFilename !== oldFilename) {
    // If destination already exists and isn't the same file, handle collision
    let finalTarget = newPath;
    let counter = 1;
    while (fs.existsSync(finalTarget) && finalTarget !== oldPath) {
      finalTarget = path.join(TASKS_DIR, `${newBaseName}-${counter}.txt`);
      counter++;
    }

    // Rename old file and write updated content
    fs.rename(oldPath, finalTarget, (renameErr) => {
      if (renameErr) {
        console.error('Error renaming file:', renameErr);
        return res.status(500).render('error', {
          title: 'Update Error',
          message: 'Failed to rename task file.'
        });
      }

      fs.writeFile(finalTarget, newContent, 'utf-8', (writeErr) => {
        if (writeErr) {
          console.error('Error writing updated content:', writeErr);
        }
        const updatedName = path.basename(finalTarget);
        res.redirect(`/task/${encodeURIComponent(updatedName)}?msg=updated`);
      });
    });
  } else {
    // Just rewrite the existing file with new content
    fs.writeFile(oldPath, newContent, 'utf-8', (writeErr) => {
      if (writeErr) {
        console.error('Error updating content:', writeErr);
        return res.status(500).render('error', {
          title: 'Update Error',
          message: 'Failed to update task description.'
        });
      }
      res.redirect(`/task/${encodeURIComponent(oldFilename)}?msg=updated`);
    });
  }
});

/**
 * POST /delete/:filename
 * Deletes the specified .txt task file.
 * Uses: req.params, fs.unlink
 */
app.post('/delete/:filename', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(TASKS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.redirect('/?msg=not_found');
  }

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
      return res.status(500).render('error', {
        title: 'Delete Failed',
        message: 'Could not remove the task file from disk.'
      });
    }

    console.log(`[Task Deleted] Removed ${safeFilename}`);
    res.redirect('/?msg=deleted');
  });
});

/**
 * GET /download/:filename
 * Allows downloading the raw .txt file directly.
 */
app.get('/download/:filename', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(TASKS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.download(filePath, safeFilename);
});

// 404 Route
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Not Found',
    message: 'The requested page or resource could not be found.'
  });
});

app.listen(PORT, () => {
  console.log(`✨ TaskFlow server running at http://localhost:${PORT}`);
  console.log(`📁 Tasks directory: ${TASKS_DIR}`);
});
