# EcoChoice Browser Companion

An AI-powered sustainable shopping assistant that helps users make environmentally conscious purchasing decisions on e-commerce platforms.

![EcoChoice Logo](public/icons/icon128.png)

## Features

### Core Functionality
- 🔍 Real-time product sustainability analysis
- 🌱 Eco-friendly alternative suggestions
- 📊 Environmental impact tracking
- ⚠️ Greenwashing detection
- 🎯 SDG alignment scoring
- 📈 Machine learning-based scoring improvements

### Technical Features
- Smart product type detection
- Category-specific sustainability scoring
- Automated data collection for ML training
- Beautiful animated UI notifications
- Cross-platform browser support
- Offline-capable analysis

## Tech Stack

- **Frontend**: Next.js with TypeScript
- **ML/AI**: TensorFlow.js for sustainability classification
- **Styling**: TailwindCSS for modern UI
- **Testing**: Jest for unit and integration tests
- **Build**: Webpack for extension bundling
- **State**: Chrome Storage API for persistence

## Installation

### For Users
1. Download the latest release from the Chrome Web Store (coming soon)
2. Click "Add to Chrome" to install the extension
3. Navigate to any supported e-commerce product page
4. Click the EcoChoice icon to analyze sustainability

### For Developers
1. Clone the repository:
```bash
git clone https://github.com/pieberrykinnie/ecochoice.git
cd ecochoice
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

4. Build the extension:
```bash
npm run build-extension
```

5. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory

## Project Structure

```
ecochoice/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── SustainabilityAnalyzer.tsx
│   └── TestAnalyzer.tsx
├── public/               # Static assets
│   ├── icons/           # Extension icons
│   ├── models/          # ML models
│   ├── background.js    # Extension background script
│   ├── content.js       # Content script
│   └── manifest.json    # Extension manifest
├── src/                 # Source code
│   └── popup/          # Extension popup
└── scripts/            # Build scripts
```

## Architecture

### Extension Components
1. **Popup Interface** (`src/popup/`)
   - User interface for triggering analysis
   - Displays sustainability scores and statistics
   - Manages user preferences

2. **Content Script** (`public/content.js`)
   - Extracts product information from web pages
   - Injects sustainability badges
   - Handles user interactions

3. **Background Script** (`public/background.js`)
   - Manages ML model loading
   - Coordinates analysis requests
   - Handles cross-script communication

### Sustainability Analysis
1. **Product Detection**
   - Smart type detection based on keywords
   - Category-specific scoring adjustments
   - Contextual factor generation

2. **Scoring System**
   - Materials analysis (30%)
   - Energy efficiency (25%)
   - Packaging sustainability (15%)
   - Manufacturing impact (15%)
   - Product durability (15%)

3. **ML Pipeline**
   - Automated data collection
   - Feature extraction
   - Score prediction
   - Continuous improvement

## Development

### Getting Started
1. Set up your development environment:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Watch for extension changes:
```bash
npm run watch-extension
```

### Testing
Run the test suite:
```bash
npm test
```

### Building
Build the extension:
```bash
npm run build-extension
```

### Contributing
1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Submit a pull request

## API Documentation

### Chrome Extension API
- `chrome.storage.local`: Stores user preferences and analysis data
- `chrome.tabs`: Manages tab interactions
- `chrome.runtime`: Handles messaging between components

### Content Script API
```typescript
interface ProductInfo {
  title: string
  description: string
  features: string[]
  materials: string
  packaging: string
  weight: string
  manufacturer: string
}

interface SustainabilityScore {
  score: number
  factors: string[]
  detectedType: string
}
```

## Roadmap

### Short-term
- [ ] Implement advanced ML model training
- [ ] Add support for more e-commerce platforms
- [ ] Enhance alternative product suggestions
- [ ] Improve accuracy of sustainability scoring

### Long-term
- [ ] Develop community-driven sustainability database
- [ ] Add social sharing features
- [ ] Implement carbon footprint calculator
- [ ] Create sustainability achievement system

## License

MIT License - See [LICENSE](LICENSE) for details

## Acknowledgments

- UN Sustainable Development Goals
- TensorFlow.js team
- Chrome Extensions community
- Open-source contributors

## Support

For support, please open an issue on GitHub or contact me at peter.vu298@gmail.com 