# Jysk Ninja

A browser ninja game with five scenes: Rain Garden, Lantern Street, Night Ferry, Winter Harbour and Shinkansen.

**Site address after enabling Pages:** https://syntopia.github.io/JyskNinja/

## Publish with GitHub Pages

One-time setup:

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open **Actions → Deploy game to GitHub Pages → Run workflow**, using `main`.

After setup, pushes that change `docs/` deploy automatically. The workflow publishes only `docs/`; no npm install or build step is required. If the initial workflow ran before Pages was enabled, rerun it after completing step 2.

The `docs/` layout also supports GitHub's branch-based publishing from `main` / `/docs` if preferred; use one publishing method at a time.

## Local preview

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory docs
```

Open http://127.0.0.1:8000/. Use a web server rather than opening `index.html` as a file.

## Update the game

Replace the contents of `docs/` with the latest ready-to-host export, keeping `.nojekyll`, then:

```sh
git add docs
git commit -m "Update game"
git push origin main
```

Only put deployable game files in `docs/`. Keep Blender sources, original uncompressed assets, benchmarks, credentials and development dependencies outside it.

## Package

- Approximately **116.4 MB** uncompressed; approximately 97.6 MB with gzip transfer, depending on hosting.
- Meshopt geometry compression and WebP textures, preserving triangle counts, texture dimensions and animations.
- Full Carpenter and female worker meshes, instanced 50/50 in the city crowd.
- All five scenes and required animations/audio included.
- Desktop browser/PC target. Press **P** to download a screenshot at twice the normal resolution without the HUD; **Esc** pauses.

Third-party credits and licenses are included in [docs/CREDITS.md](docs/CREDITS.md), the other license files under `docs/`, and the in-game credits. No additional license is granted here for third-party assets.

Deployment uses the [official GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
