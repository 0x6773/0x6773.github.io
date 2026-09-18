# Breakout

A classic brick breaker game built with pure HTML, CSS, and JavaScript using the Canvas API. No dependencies required.

## How to Play

1. Start a local server from this folder:
   ```
   python3 -m http.server 8080
   ```
2. Open `http://localhost:8080` in your browser.
3. Click **Start Game** to begin.

### Controls

| Input | Action |
|-------|--------|
| Mouse | Move paddle |
| Arrow keys / A, D | Move paddle (keyboard) |
| Touch drag | Move paddle (mobile) |

### Objective

Break all the bricks by bouncing the ball off your paddle. Clear all 5 levels to win.

## Features

### Gameplay
- 5 rows of color-coded bricks with different point values (red = 7, orange = 5, yellow = 3, green = 2, blue = 1)
- Score multiplied by current level
- 3 lives per game
- 5 levels with increasing ball speed
- Ball angle changes based on where it hits the paddle

### Power-ups
Destroyed bricks have a 20% chance to drop a power-up. Catch it with your paddle to activate.

| Power-up | Icon | Effect | Duration |
|----------|------|--------|----------|
| Wide Paddle | W | Widens paddle by 60% | 10 seconds |
| Multi-Ball | M | Spawns 2 extra balls | Until lost |
| Slow Motion | S | Halves ball speed | 8 seconds |
| Extra Life | + | Grants +1 life | Instant |

Active timed power-ups display a countdown timer and progress bar below the canvas.

### Sound Effects
Procedural audio generated via the Web Audio API -- no audio files needed:
- Paddle hit, wall bounce, brick break (pitch varies by row)
- Life lost, power-up collected, level up
- Game over and win jingles

### Visuals
- Particle explosions on brick destruction
- Sparkle effects on paddle hits
- Floating score text on brick breaks
- Ball trail with afterimage effect
- 3D gradient bricks with shine highlights
- Twinkling starfield background
- Screen shake on losing a ball
- Spinning diamond-shaped power-ups with glow
- Glowing paddle (changes color when widened)

### High Scores
Top 5 scores are saved to `localStorage` and displayed on the start and game over screens with gold, silver, and bronze styling.

### Mobile Support
- Touch controls for paddle movement
- Scroll and zoom prevention for uninterrupted gameplay
- Responsive canvas scaling

## File Structure

```
breakout/
  index.html   - HTML structure and layout
  style.css    - Styling, responsive design, power-up HUD
  game.js      - Game engine (~780 lines)
```

## Tech Stack

- HTML5 Canvas for rendering
- CSS3 for UI and responsive layout
- Vanilla JavaScript (no frameworks or libraries)
- Web Audio API for procedural sound effects
- localStorage for high score persistence
