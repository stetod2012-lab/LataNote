# LataNote

**A complete digital ecosystem for thinking, creating, learning, organizing and getting things done.**

LataNote combines a notebook, textbook, planner, document editor, recording studio, PDF annotator, presentation tool and study assistant in one connected space.

- `index.html`: marketing / landing page
- `app.html`: the LataNote web app

## Features

Everything is free. There are no paid plans.

| Area | What you can do |
| --- | --- |
| **Handwriting & drawing** | Pressure-sensitive pen, highlighter, stroke eraser, lines, arrows, rectangles, ellipses (<kbd>Shift</kbd> snaps). Stylus-only palm rejection. Undo/redo. |
| **Lasso** | Circle ink to move, recolor, duplicate, delete or convert it to text. |
| **Handwriting to text** | On-device recognition (the browser's handwriting recognizer where available, otherwise bundled Tesseract OCR). Recognized handwriting becomes searchable and feeds the study tools. |
| **Typing & documents** | Rich text on the same page as ink: headings, formatting, colors, lists, checklists, tables, links, images, quotes and code. Includes speech-to-text dictation and read aloud. |
| **Templates** | Lecture (Cornell), meeting, to-do, daily journal, study guide, and sketch. |
| **Paper** | Lined, grid, dotted, Cornell and blank. Add, reorder and delete pages. Zoom with Ctrl+scroll or pinch. |
| **Audio** | Record lessons into a note. Ink written while recording replays in sync with the audio. |
| **PDF & image annotation** | Import PDFs (bundled pdf.js) or images and write on every page. Drag and drop works too. |
| **Study assistant** | Summaries and key terms, flashcards with spaced repetition, quizzes, "Ask your notes", and a **Tutor** chat. The tutor uses the browser's built-in on-device AI (Chrome's Prompt API) when available, or a built-in offline engine otherwise. |
| **Live collaboration** | Share a link to edit a note together in real time, including ink, over peer-to-peer WebRTC (PeerJS). |
| **Device sync** | Merge all notes between two devices with a 6-digit code, peer to peer. Newer edits win. |
| **Planner & focus** | Month calendar of classes, tasks, exams and events linked to notes, plus a Pomodoro focus timer. |
| **Full screen & present** | Full-screen mode (<kbd>F</kbd>), with focus mode on iPhone. Full-screen presentation with a laser pointer. |
| **Installable & offline** | Progressive web app with a manifest and service worker: install to the home screen or desktop, works offline, and opens `.latanote` files. |
| **Organize & share** | Notebooks, pinned notes, full-text search (including handwriting), Trash with 30-day restore. Export to HTML, Markdown or PDF (print), and share notes or whole notebooks as `.latanote` files. Backup and restore, dark mode, responsive layout. |

## Running it

LataNote is plain HTML, CSS and JavaScript, with no build step and no dependencies to install.

```bash
# any static server works
python3 -m http.server 8000
# then open http://localhost:8000
```

You can also open `index.html` directly from disk. A local server is recommended so that pdf.js can use its web worker.

## Data & privacy

Everything is stored locally in the browser (IndexedDB), and LataNote starts with an empty notebook. Nothing is uploaded to a server:

- **Live collaboration and device sync** send data directly between browsers over WebRTC. The free public PeerJS broker (`0.peerjs.com`) is used only to introduce the two devices. To use your own broker, set `window.LN_PEER_OPTS = { host, port, path, secure }` before the scripts load.
- **Study tools, the tutor and handwriting recognition** run on the device.
- **Dictation** uses the browser's speech recognition. In some browsers (such as Chrome), the browser vendor processes the audio.

Audio recordings stay on the device that recorded them. They aren't included in backups, sync or shared files.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `T` / `D` | Type mode / Draw mode |
| `P` / `H` / `E` / `L` | Pen / highlighter / eraser / lasso |
| `Del` | Delete lasso selection |
| `F` | Full screen |
| `?` | Shortcut list |
| `Ctrl/⌘ + Z`, `Ctrl/⌘ + Shift + Z` | Undo / redo ink |
| `Ctrl/⌘ + K` | Search notes |
| `Ctrl/⌘ + Alt + N` | New note |
| `←` `→` `L` `Esc` | Presentation: previous / next / laser / exit |
| `Space`, `1` `2` `3` | Flashcards: flip / grade |

## Project layout

```
index.html               landing page
app.html                 application shell
manifest.webmanifest     install metadata
sw.js                    service worker (offline support)
css/                     base tokens, landing page and app styles
js/core.js               storage, state, icons, dialogs
js/ink.js                ink engine and lasso
js/editor.js             pages, text layer, templates, formatting, imports
js/audio.js              recording and ink-synced playback
js/planner.js            calendar and agenda
js/study.js              study assistant and tutor
js/extras.js             full screen, install, timer, dictation, read aloud, Markdown, handwriting to text, settings
js/collab.js             live collaboration and device sync
js/app.js                app controller
js/vendor/               pdf.js 3.11 (Apache-2.0), Tesseract.js 7 (Apache-2.0), PeerJS 1.5 (MIT)
```
