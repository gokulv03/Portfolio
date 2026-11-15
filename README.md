# Portfolio

Personal portfolio of Gokul Vemulapalli, electrical engineer.

A single-page site built with Vite and React. A procedural circuit board,
drawn as line art with three.js, sits behind the page, and scrolling flies a
camera through it: a descent onto the board from the hero, a cruise along a
signal bus through the sections, a launch through a row of coils, and a climb
back out at the end.

## Run it

```bash
npm install
npm run dev
```

The dev server starts on http://localhost:3000.

```bash
npm run build
```

writes the production site to `dist/`.

## Where things are

| Path | What it holds |
| --- | --- |
| `src/App.jsx` | Page order and the boot hand-over |
| `src/components/` | One file per section, plus shared pieces (headings, labels, the 3D slots) |
| `src/three/world.js` | The board behind the page: geometry, camera shots, glow |
| `src/three/stage.js` | The small draggable 3D models of each project |
| `src/index.css` | All styling; design tokens are at the top |

## Notes

- Dark only, by design: the look is an instrument screen.
- Visitors who have "reduce motion" switched on get a still version without
  the 3D world or the pinned scroll scenes.
- Phones get a lighter version of the board.
