# FactChecker Pro - Chrome Extension

A Google Chrome extension that fact-checks statements in real-time, similar to Grammarly but for factual accuracy. The extension analyzes text on web pages and highlights potentially inaccurate or unsourced factual claims with suggestions for improvement.

## Features

- **Real-time Fact Checking**: Automatically scans web pages for factual statements
- **Smart Pattern Recognition**: Identifies claims about statistics, dates, studies, and more
- **Visual Highlighting**: Highlights potentially problematic statements with red underlines
- **Interactive Tooltips**: Hover over highlights to see detailed explanations and suggestions
- **Clickable Source Links**: Direct links to verify information with original sources
- **Customizable Settings**: Toggle features on/off and adjust behavior
- **Statistics Tracking**: Monitor how many facts have been checked and issues found
- **Modern UI**: Clean, professional interface similar to Grammarly

## Installation

### Method 1: Load as Unpacked Extension (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension should now appear in your extensions list

### Method 2: Create Icons (Required)

Before using the extension, you need to create icon files:

1. Create three PNG icon files:
   - `icons/icon16.png` (16x16 pixels)
   - `icons/icon48.png` (48x48 pixels)
   - `icons/icon128.png` (128x128 pixels)

2. You can use any image editor or online icon generator to create these icons

## Usage

1. **Enable the Extension**: Click the FactChecker Pro icon in your Chrome toolbar
2. **Browse Normally**: The extension will automatically scan web pages for factual statements
3. **Review Highlights**: Look for red-highlighted text that may contain factual issues
4. **Hover for Details**: Mouse over highlighted text to see explanations and suggestions
5. **Adjust Settings**: Use the popup to customize the extension's behavior

## How It Works

### Fact Detection
The extension uses pattern matching to identify potential factual statements:

- **Statistics**: Numbers with percentages, millions, billions
- **Dates**: Years, dates, historical references
- **Comparative Claims**: "more than", "less than", "higher", "lower"
- **Absolute Statements**: "always", "never", "100%", "every"
- **Research Claims**: "studies show", "research indicates"
- **Measurements**: Quantities with units (miles, pounds, degrees)
- **Institutions**: Universities, colleges, research centers
- **Historical Events**: Time-based references

### Fact Checking Process
1. **Text Analysis**: Scans page content for factual patterns
2. **Statement Extraction**: Identifies individual factual claims
3. **Issue Detection**: Checks for common factual problems
4. **Highlighting**: Marks problematic statements with visual indicators
5. **Suggestions**: Provides improvement recommendations
6. **Source Verification**: Links to original sources for fact verification

### Source Links
The extension provides direct links to verify information with original sources:

- **Wikipedia**: Links to specific articles for reference checking
- **World Bank**: Links to data pages for economic and demographic facts
- **Google Fact Check**: Links to the fact-checking database
- **OpenAI**: Links to research resources
- **Google Natural Language**: Links to API documentation

Users can click on source links in tooltips to open the original sources in new tabs for verification.

## Settings

- **Auto-check facts**: Automatically scan new content
- **Highlight issues**: Show visual indicators for problems
- **Show suggestions**: Display improvement recommendations

## Current Limitations

This is a demonstration version with mock fact-checking. For production use, you would integrate with:

- **Snopes API**: For fact-checking verification
- **FactCheck.org API**: For political fact-checking
- **Google Fact Check API**: For general fact verification
- **OpenAI API**: For AI-powered fact analysis
- **Wikipedia API**: For reference checking

## Development

### File Structure
```
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── content.js            # Content script for page analysis
├── background.js         # Background service worker
├── styles.css            # Content script styling
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

### Adding Real Fact-Checking APIs

To integrate with real fact-checking services, modify the `mockFactCheck` function in `content.js`:

```javascript
async function realFactCheck(statement) {
    // Example: Snopes API integration
    const response = await fetch('https://api.snopes.com/v2/fact-check/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_API_KEY'
        },
        body: JSON.stringify({ query: statement })
    });
    
    const data = await response.json();
    return {
        hasIssues: data.rating === 'false' || data.rating === 'mixture',
        issues: data.explanation ? [data.explanation] : [],
        suggestions: data.suggestions || [],
        confidence: data.confidence || 0.8
    };
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues or questions, please open an issue on the GitHub repository.

---

**Note**: This extension is for educational and demonstration purposes. Always verify information from multiple reliable sources for important decisions. 