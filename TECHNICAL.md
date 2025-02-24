# EcoChoice Technical Documentation

## Architecture Overview

EcoChoice is implemented as a browser extension that analyzes product pages in real-time. The current architecture focuses on text analysis and rule-based scoring, with data collection for future ML integration.

### Core Components

```
src/
├── popup/
│   ├── PopupPage.tsx       # Main UI and analysis logic
│   ├── components/         # Reusable UI components
│   └── styles/            # Component styling
├── background/
│   └── background.ts      # Extension background script
└── utils/
    ├── analysis.ts        # Sustainability analysis logic
    ├── storage.ts         # Data collection and storage
    └── types.ts          # TypeScript type definitions
```

## Implementation Details

### 1. Product Analysis Engine

#### 1.1 Text Analysis
- Pattern matching using predefined keywords
- Context-aware product type detection
- Score calculation based on detected features

```typescript
interface ProductAnalysis {
  score: number;
  factors: string[];
  detectedType: string;
  categoryScores: {
    materials: number;
    energy: number;
    packaging: number;
    manufacturing: number;
    durability: number;
  };
}
```

#### 1.2 Scoring System
- Category-based scoring (materials, energy, etc.)
- Product type specific adjustments
- Weighted average calculation

### 2. Data Collection

#### 2.1 Features Collected
- Product title and description
- Detected keywords and patterns
- Final scores and category breakdowns
- User interaction metrics

#### 2.2 Storage Implementation
```typescript
interface TrainingData {
  timestamp: number;
  productType: string;
  textFeatures: {
    titleLength: number;
    descriptionLength: number;
    keywordMatches: Record<string, number>;
  };
  scores: ProductAnalysis;
}
```

### 3. UI Components

#### 3.1 Main Interface
- Real-time score display
- Factor breakdown visualization
- Alternative suggestions panel

#### 3.2 State Management
- React hooks for local state
- Chrome storage for persistence
- Event-based updates

## Technical Limitations

### 1. Analysis Engine
- Limited to text-based analysis
- No image processing capabilities
- Basic keyword matching only

### 2. Performance Constraints
- Initial load time: ~450ms
- Storage limit: 1000 entries
- Bundle size: 1.12MB

### 3. Browser Support
- Chrome/Chromium only
- No Firefox support yet
- Limited mobile compatibility

## Development Workflow

### 1. Build Process
```bash
npm run build-extension    # Builds extension bundle
npm run watch             # Development mode
npm run test             # Runs test suite
```

### 2. Testing Strategy
- Jest for unit testing
- React Testing Library for components
- Manual integration testing

## Future Technical Roadmap

### Phase 1: ML Integration
- Feature extraction pipeline
- Model training infrastructure
- Inference optimization

### Phase 2: Enhanced Analysis
- Image analysis integration
- Certificate validation
- Carbon footprint calculation

### Phase 3: Platform Expansion
- Firefox support
- Mobile adaptation
- API infrastructure

## Development Guidelines

### 1. Code Style
- ESLint configuration
- Prettier formatting
- TypeScript strict mode

### 2. Git Workflow
- Feature branches
- PR reviews required
- Semantic versioning

### 3. Performance Requirements
- Load time < 500ms
- Memory usage < 50MB
- CPU usage < 5%

## Debugging

### 1. Common Issues
- Chrome storage quota exceeded
- DOM parsing failures
- Analysis timing issues

### 2. Debugging Tools
- Chrome DevTools
- React DevTools
- Performance profiler

## Security Considerations

### 1. Data Storage
- Local storage only
- No PII collection
- Encrypted when possible

### 2. Permissions
- Limited to product pages
- No sensitive data access
- Minimal storage usage

## Version History

### v0.1.0 (2024-03-21)
- Initial implementation
- Basic scoring system
- Chrome extension structure

### v0.1.1 (2024-03-22)
- Data collection added
- Performance monitoring
- UI improvements 