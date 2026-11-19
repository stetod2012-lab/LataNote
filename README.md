# LataNote

**A complete digital ecosystem for thinking, creating, learning, organizing and getting things done.**

LataNote combines a notebook, textbook, planner, document editor, recording studio, PDF annotator, presentation tool and study assistant in one connected space.

- `index.html`: marketing / landing page
- `app.html`: the LataNote web app

## Features

| Area | What you can do |
| --- | --- |
| **Handwriting & drawing** | Pressure-sensitive pen, highlighter, stroke eraser, lines, arrows, rectangles, ellipses (hold <kbd>Shift</kbd> to snap). Optional *Stylus only* mode for palm rejection, where fingers scroll instead of draw. Undo/redo. |
| **Typing & documents** | Rich text on the same page as your ink: headings, bold/italic/underline/strike, text color, highlight, bulleted/numbered lists, checklists, tables, links, images, quotes and code. |
| **Paper** | Lined, grid, dotted, Cornell and blank. Pages grow as you type, and you can add, reorder and delete them. |
| **Audio** | Record lessons into a note. Each stroke written while recording is timestamped, and on playback the ink rebuilds in sync with the audio. Rename and download recordings. |
| **PDF & image annotation** | Import a PDF (rendered with bundled pdf.js) or an image. Every page becomes a background you can write, highlight and type over. Drag and drop works too. |
| **Planner** | Month calendar with classes, tasks, exams and events, each optionally linked to a note. Includes a day agenda and a rolling 14-day upcoming list. |
| **Present** | Full-screen presentation of any note, with keyboard navigation and a laser pointer. |
| **Study assistant** | Runs entirely in the browser: extractive summaries and key terms, auto-generated flashcards with spaced repetition, multiple-choice and fill-in-the-blank quizzes, and "Ask your notes" passage search across one note or all notebooks. |
| **Organize & share** | Color-coded notebooks, full-text search, duplicate and move notes. Export to HTML, print or save as PDF, share a `.latanote` file, and back up or restore everything as JSON. Light and dark themes. Responsive on desktop, tablet and phone. |

## Running it

LataNote is plain HTML, CSS and JavaScript, with no build step and no dependencies to install.

```bash
# any static server works
python3 -m http.server 8000
# then open http://localhost:8000
```

You can also open `index.html` directly from disk. A local server is recommended so that pdf.js can use its web worker.

## Data & privacy

Everything is stored locally in the browser with IndexedDB. Audio recordings are stored as blobs on the device. Nothing is sent to a server. Use the sidebar's backup button to export your notebooks. Recordings stay on the device and aren't included in backups or shared note files.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `T` / `D` | Type mode / Draw mode |
| `P` / `H` / `E` | Pen / highlighter / eraser |
| `Ctrl/⌘ + Z`, `Ctrl/⌘ + Shift + Z` | Undo / redo ink |
| `Ctrl/⌘ + K` | Search notes |
| `Ctrl/⌘ + Alt + N` | New note |
| `←` `→` `L` `Esc` | Presentation: previous / next / laser / exit |
| `Space`, `1` `2` `3` | Flashcards: flip / grade |

## Project layout

```
index.html            landing page
app.html              application shell
css/base.css          shared design tokens
css/site.css          landing page styles
css/app.css           app styles (incl. print)
js/core.js            storage, state, icons, dialogs, sample content
js/ink.js             ink engine
js/editor.js          pages, text layer, formatting, PDF/image import
js/audio.js           recording & ink-synced playback
js/planner.js         calendar & agenda
js/study.js           study assistant
js/app.js             app controller, export, presenting, shortcuts
js/vendor/pdfjs/      pdf.js 3.11.174 (Apache-2.0)
```

## Notes on plans

The landing page describes Free, Plus and Campus & Teams plans. The prices and the Plus/Teams-only capabilities (cloud sync, handwriting recognition, real-time collaboration, admin console) are placeholders for future product decisions. Everything in the web app today works without an account.
