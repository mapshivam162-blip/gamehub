# Snake 🐍

GameHub ka pehla live game!

Based on [devsargam/SnakeGame](https://github.com/devsargam/SnakeGame) (MIT License —
`LICENSE` file dekho). GameHub me ye changes kiye gaye hain:

- 📱 **Swipe controls** (phone support) — original sirf keyboard tha
- ⏸ **Pause button** mobile ke liye
- 🏠 Portal back-link
- 🎨 GameHub dark theme + system fonts (offline-first, no Google Fonts)
- 📐 Responsive canvas (phone screen pe fit)
- 🚫 Koi bundling nahi — plain ES modules, service worker cache friendly

## Files

```
index.html        game page
styles.css        styles
js/index.js       game loop
js/touch.js       swipe + pause (GameHub addition)
js/sound.js       sounds
js/utils.js       direction helpers
js/difficulty.js  Easy / Medium / Hard
js/themes.js      11 color themes
js/classes/       snake, food, board logic
assets/audio/     game sounds (mp3)
```
