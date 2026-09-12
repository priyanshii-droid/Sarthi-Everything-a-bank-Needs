# Render button fix

This build adds delegated click handling for `[data-view]` and `[data-q]`, makes buttons explicit `type=button`, and cache-busts app.js/style.css.

After deploying:
1. In Render, trigger Manual Deploy → Clear build cache & deploy.
2. Open the Render URL in an incognito/private window.
3. Open `/api/health` first and confirm JSON.
4. Open the homepage.
5. If the old UI appears, hard refresh (Ctrl+Shift+R).

The app should be served by Express at the same origin. Do not open index.html from the filesystem.
