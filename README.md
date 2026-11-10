# Page Image Grabber

A Chromium browser extension that downloads **every image on the page you're viewing** into **a folder you choose**, picking the **highest-quality version** of each one.

Works in Chrome, Edge, Brave, Opera, Opera GX and other Chromium-based browsers, including private/incognito windows.

## Features

- One click: open a page, click the extension icon, choose a folder, done
- Saves directly to any folder on your PC (File System Access API), not just the browser's Downloads folder
- Finds `<img>` tags, `<picture>` sources, lazy-loaded images, image inputs and CSS background images
- Picks the largest available version of each image (`srcset`, `data-*` full/zoom/original attributes, and links to full-size files), with automatic fallback to the next best
- Auto-scrolls the page first so lazy-loaded images are loaded
- Removes duplicates (a thumbnail and its full-size version produce one file)
- Saves the original bytes with no re-encoding, so there is no quality loss
- Opens in the same window type as your page, so private windows stay private

## Install (from source)

1. Download or clone this repository.
2. Open your browser's extensions page:
   - Chrome / Brave: `chrome://extensions`
   - Edge: `edge://extensions`
   - Opera / Opera GX: `opera://extensions`
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `extension/` folder.

### Using it in incognito / private windows

1. On the extension's card, turn on **Allow in Incognito** (Opera: **Allow in Private**).
2. In the private window, pin the extension from the puzzle-piece menu.
3. Reload the extension after changing the setting.

## Usage

1. Go to any webpage.
2. Click the **Page Image Grabber** icon.
3. A new tab opens, scans the page, and shows how many images were found.
4. Click **Choose folder & download** and pick a destination folder.

## How it works

| File | Role |
| --- | --- |
| `extension/manifest.json` | Manifest V3 config (`activeTab`, `scripting`, all-URL host access, split incognito) |
| `extension/background.js` | Opens the grabber page in the same window mode as the current tab |
| `extension/app.html` / `app.js` | Injects a scanner into the page, then fetches each image and writes it to the chosen folder |

The extension page itself does the downloading (not the web page), which avoids CORS restrictions. The folder picker runs in a full tab because browsers close toolbar popups when a file dialog opens.

## Limitations

- Can't run on browser-internal pages (`chrome://`, the extension store, etc.)
- Only picks among versions the page exposes. URL-parameter resizing (e.g. `?w=300`) is not guessed or upgraded
- `blob:` images are skipped
- Some sites block hotlinked image requests, so a few downloads may fail (shown as ✗ in the log)
- Endless-scroll feeds are only scrolled a limited number of steps
- Firefox is not supported (no directory picker, different extension APIs)

## Privacy

Everything runs locally in your browser. The extension collects no data and makes no requests except fetching the images on the page you chose to scan.

## Responsible use

Respect copyright and each website's terms of service. Only download images you have the right to use.

## License

[MIT](LICENSE)
