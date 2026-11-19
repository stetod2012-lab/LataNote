# LataNote

**A complete digital ecosystem for thinking, creating, learning, organizing and getting things done.**

LataNote combines a notebook, textbook, planner, document editor, recording studio, PDF annotator, presentation tool and study assistant in one connected space.

- `index.html`: marketing / landing page
- `app.html`: the LataNote web app

## Features

Everything is free. There are no paid plans.

| Area | What you can do |
| --- | --- |
| **Handwriting & drawing** | **Pen** in five styles: Fountain (pressure and speed), Ballpoint, Brush (tapered), Calligraphy (angled nib) and Felt marker. **Pencil** with real graphite grain: Sharp HB, Soft 2B and Sketch 6B. Click the active pen or pencil (or press P/N again) to switch style. Also highlighter, stroke eraser, lasso, and shapes (line, arrow, rectangle, ellipse; <kbd>Shift</kbd> snaps). Stylus-only palm rejection. Undo/redo. |
| **Lasso** | Circle ink to move, recolor, duplicate, delete or convert it to text. |
| **Handwriting to text** | On-device recognition (the browser's handwriting recognizer where available, otherwise bundled Tesseract OCR). Recognized handwriting becomes searchable and feeds the study tools. |
| **Typing & documents** | Rich text on the same page as ink: headings, formatting, colors, lists, checklists, tables, links, images, quotes and code. Includes speech-to-text dictation and read aloud. |
| **Templates** | Lecture (Cornell), meeting, to-do, daily journal, study guide, and sketch. |
| **Paper & pages** | 13 paper styles: lined, lined without margin, legal pad, Cornell, checklist, handwriting practice, grid, engineering graph, dotted, isometric dots, music staff, storyboard and blank. Narrow, normal or wide line spacing (text size follows). 9 paper colors plus custom. Set the background for the whole note or for a single page, and pick a default for new notes. **Custom papers:** upload any image or PDF page (planner layout, worksheet, letterhead) as reusable paper. **Page templates:** save any of your pages as a template. **Add page:** blank, duplicate, from a template, copied from another note, or from a PDF or image. Zoom with Ctrl+scroll or pinch. |
| **Audio** | Record lessons into a note. Ink written while recording replays in sync with the audio. |
| **PDF & image annotation** | Import PDFs (bundled pdf.js) or images and write on every page. Drag and drop works too. |
| **Study assistant** | Summaries and key terms, flashcards with spaced repetition, quizzes, "Ask your notes", and a **Tutor** chat. The tutor uses the browser's built-in on-device AI (Chrome's Prompt API) when available, or a built-in offline engine otherwise. |
| **Live collaboration** | Share a link to edit a note together in real time, including ink, over peer-to-peer WebRTC (PeerJS). |
| **Device sync** | Merge all notes between two devices with a 6-digit code, peer to peer. Newer edits win. |
| **Planner & focus** | Month calendar of classes, tasks, exams and events linked to notes, plus a Pomodoro focus timer. |
| **Full screen & present** | Full-screen mode (<kbd>F</kbd>), with focus mode on iPhone. Full-screen presentation with a laser pointer. |
| **Installable & offline** | Progressive web app with a manifest and service worker: install to the home screen or desktop, works offline, and opens `.latanote` files. |
| **Library** | Organize as **Folder › Divider › Notebook › Section › Note**. Folders can nest, and levels can be skipped. The **All notes** page shows every note as a page thumbnail side by side, with your folders and notebooks above. Folder pages group notebooks under their dividers, and notebook pages show sections as tabs. The sidebar holds a collapsible tree. Create items from **+ New** or any item's menu, move things by drag and drop or **Move to…**, and share any folder or notebook as a file. |
| **Organize & share** | Pinned notes, full-text search (including handwriting), Trash with 30-day restore. Export to HTML, Markdown or PDF (print), and share notes or whole folders as `.latanote` files. Backup and restore, dark mode, responsive layout. |
| **Appearance & accessibility** | 12 themes: Classic, Midnight, Sepia, Forest, Candy and High contrast, plus animated Ocean waves, Sunset glow, Sakura, Aurora, Starry night and Snowfall. **Larger text** scales the whole interface (Default, Large, Larger, Largest). An easy-to-read font (Atkinson Hyperlegible) and a Reduce motion setting, which follows the system preference by default. |

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
css/                     base tokens, landing page, app styles, themes
js/core.js               storage, state, icons, dialogs, popover menus
js/appearance.js         themes, animated backgrounds, text size, readable font
js/paper.js              paper styles, spacing, colors, custom papers, page templates
js/ink.js                ink engine and lasso
js/editor.js             pages, text layer, templates, formatting, imports
js/library.js            folders, dividers, notebooks, sections, sidebar tree, All notes page
js/audio.js              recording and ink-synced playback
js/planner.js            calendar and agenda
js/study.js              study assistant and tutor
js/extras.js             full screen, install, timer, dictation, read aloud, Markdown, handwriting to text, settings
js/collab.js             live collaboration and device sync
js/app.js                app controller
js/vendor/               pdf.js 3.11 (Apache-2.0), Tesseract.js 7 (Apache-2.0), PeerJS 1.5 (MIT)
```
