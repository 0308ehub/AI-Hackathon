# FactChecker Pro - Installation Guide

## Quick Installation Steps

### 1. Create Extension Icons (Required)

Before installing, you need to create icon files. You can use any image editor or online tool:

**Option A: Use an Online Icon Generator**
1. Go to [Favicon.io](https://favicon.io/) or [Canva](https://canva.com/)
2. Create a simple icon (suggested: a checkmark or fact-check symbol)
3. Download in PNG format
4. Create three sizes: 16x16, 48x48, and 128x128 pixels

**Option B: Use a Simple Text Icon**
1. Create a simple text-based icon using any image editor
2. Use a fact-checking symbol like ✓, 🔍, or 📊
3. Save as PNG files with the required sizes

**Option C: Download Sample Icons**
You can find free icons on:
- [Flaticon](https://www.flaticon.com/)
- [Icons8](https://icons8.com/)
- [Feather Icons](https://feathericons.com/)

### 2. Place Icons in the Extension Folder

Put your icon files in the `icons/` folder:
```
icons/
├── icon16.png  (16x16 pixels)
├── icon48.png  (48x48 pixels)
└── icon128.png (128x128 pixels)
```

### 3. Load the Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right corner)
4. Click "Load unpacked"
5. Select the extension folder (the folder containing `manifest.json`)
6. The extension should now appear in your extensions list

### 4. Test the Extension

1. Click the FactChecker Pro icon in your Chrome toolbar
2. Open the demo page: `file:///path/to/your/extension/demo.html`
3. You should see red highlights on factual statements
4. Hover over highlights to see tooltips with explanations

## Troubleshooting

### Extension Not Loading
- Make sure all files are in the correct folder structure
- Check that `manifest.json` is valid JSON
- Ensure icon files exist and are the correct sizes
- Try refreshing the extensions page

### No Highlights Appearing
- Check that the extension is enabled
- Refresh the webpage after loading the extension
- Open the browser console (F12) to check for errors
- Try the demo page to test functionality

### Icons Not Showing
- Verify icon files are PNG format
- Check file sizes match requirements (16x16, 48x48, 128x128)
- Ensure file names match exactly: `icon16.png`, `icon48.png`, `icon128.png`

## File Structure

Your extension folder should look like this:
```
FactChecker-Pro/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── content.js
├── background.js
├── styles.css
├── options.html
├── options.js
├── demo.html
├── README.md
├── install.md
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Next Steps

After installation:
1. Customize settings in the extension popup
2. Access advanced options via the options page
3. Test on various websites
4. Consider integrating real fact-checking APIs for production use

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify all files are present and correctly named
3. Try reinstalling the extension
4. Check that Chrome is up to date 