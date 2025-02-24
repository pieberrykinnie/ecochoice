# EcoChoice Technical Documentation

## System Architecture

### 1. Extension Components

#### 1.1 Popup Interface (`src/popup/PopupPage.tsx`)
- **State Management**: Uses React hooks for local state
- **Chrome API Integration**: Manages tab communication and storage
- **UI Components**: TailwindCSS for styling
- **Analytics**: Tracks user interactions and analysis stats

#### 1.2 Content Script
- **DOM Manipulation**: Injects sustainability badges
- **Product Extraction**: Parses page content for analysis
- **Event Handling**: Manages user interactions
- **Performance**: Uses requestAnimationFrame for smooth animations

#### 1.3 Background Script
- **State Persistence**: Manages Chrome storage
- **Event Coordination**: Handles message passing
- **API Integration**: Coordinates external service calls

### 2. Sustainability Analysis System

#### 2.1 Product Type Detection
```typescript
interface ProductType {
  keywords: string[]
  score_adjustments: Record<string, number>
  factors: {
    positive: string[]
    negative: string[]
  }
}

const productTypes: Record<string, ProductType> = {
  digital_product: {
    keywords: ['kindle edition', 'ebook', ...]
    score_adjustments: {
      materials: 0.8,
      energy: 0.4,
      ...
    }
  },
  // Additional types...
}
```

#### 2.2 Scoring Algorithm
1. **Base Score Calculation**:
   - Initial score: 0.5 (50%)
   - Category weights:
     - Materials: 30%
     - Energy: 25%
     - Packaging: 15%
     - Manufacturing: 15%
     - Durability: 15%

2. **Score Adjustments**:
   ```typescript
   finalScore = baseScore + 
     (categoryScores.materials * 0.30) +
     (categoryScores.energy * 0.25) +
     (categoryScores.packaging * 0.15) +
     (categoryScores.manufacturing * 0.15) +
     (categoryScores.durability * 0.15)
   ```

3. **Product-Specific Modifiers**:
   - Digital products: Minimum 80% score
   - Electronics: Energy efficiency penalties
   - Artificial items: Material sustainability penalties

#### 2.3 ML Data Collection
```typescript
interface TrainingData {
  timestamp: string
  url: string
  product: {
    title: string
    description: string
    features: string[]
    materials: string
    manufacturer: string
    price: string
  }
  analysis: {
    score: number
    factors: string[]
    detectedType: string | null
  }
  textFeatures: {
    titleLength: number
    descriptionLength: number
    featureCount: number
    hasMaterials: boolean
    hasManufacturer: boolean
    priceValue: number
  }
}
```

### 3. UI/UX Implementation

#### 3.1 Notification Badge
```css
/* Core Styles */
position: fixed;
top: 20px;
left: 20px;
z-index: 2147483647;
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Animations */
transform: translateY(-10px);
transition: all 0.3s ease;
```

#### 3.2 Color Coding
- Green (>65%): #059669
- Yellow (35-65%): #ca8a04
- Red (<35%): #dc2626

## Development Guidelines

### 1. Code Style

#### 1.1 TypeScript
- Use strict type checking
- Prefer interfaces over types
- Document complex functions
- Use enums for constants

#### 1.2 React Components
- Functional components with hooks
- Props interface definitions
- Memoization for expensive operations
- Error boundaries for stability

### 2. Testing Strategy

#### 2.1 Unit Tests
```typescript
describe('Sustainability Analysis', () => {
  test('should detect product type correctly', () => {
    const product = {
      title: 'Kindle Book',
      description: 'Digital edition'
    }
    expect(detectProductType(product)).toBe('digital_product')
  })
})
```

#### 2.2 Integration Tests
- Chrome API mocking
- DOM manipulation tests
- Event handling verification
- Storage persistence checks

### 3. Performance Optimization

#### 3.1 Analysis Optimization
- Caching of analysis results
- Debounced DOM operations
- Lazy loading of ML features
- Memory leak prevention

#### 3.2 UI Performance
- Throttled animations
- Efficient DOM updates
- Resource preloading
- Asset optimization

### 4. Security Considerations

#### 4.1 Data Safety
- Sanitize user inputs
- Validate product data
- Secure storage handling
- Privacy-focused analytics

#### 4.2 Chrome API Usage
- Minimal permissions
- Secure messaging
- Safe DOM manipulation
- Error handling

## Debugging Guide

### 1. Common Issues

#### 1.1 Analysis Failures
```typescript
// Debug logging
console.debug('Product analysis:', {
  type: detectedType,
  score: analysis.score,
  factors: analysis.factors
})
```

#### 1.2 UI Glitches
- Check z-index conflicts
- Verify style inheritance
- Monitor animation performance
- Test across browsers

### 2. Development Tools

#### 2.1 Chrome DevTools
- Extensions debugging
- Network monitoring
- Performance profiling
- Storage inspection

#### 2.2 Testing Tools
- Jest for unit tests
- Puppeteer for E2E
- Chrome extension debugger
- React DevTools

## API Integration

### 1. Chrome Extension API

#### 1.1 Storage
```typescript
// Save analysis results
chrome.storage.local.set({
  mlTrainingData: trainingData
})

// Retrieve saved data
chrome.storage.local.get('stats', (data) => {
  updateStats(data.stats)
})
```

#### 1.2 Messaging
```typescript
// Send message to background
chrome.runtime.sendMessage({
  type: 'ANALYZE_PRODUCT',
  data: productInfo
})

// Receive messages
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.type === 'ANALYSIS_COMPLETE') {
    updateUI(message.data)
  }
})
```

### 2. Future ML API Integration

#### 2.1 Model Training
```typescript
interface MLFeatures {
  textFeatures: number[]
  categoryFeatures: number[]
  priceFeature: number
}

interface MLPrediction {
  sustainabilityScore: number
  confidence: number
}
```

#### 2.2 Inference API
- Endpoint: `/api/analyze`
- Method: POST
- Rate limiting: 100 requests/minute
- Caching: 24-hour TTL

## Deployment

### 1. Extension Publishing

#### 1.1 Build Process
```bash
# Production build
npm run build-extension

# Generate source maps
npm run build-extension -- --source-maps
```

#### 1.2 Chrome Web Store
- Manifest requirements
- Asset guidelines
- Review process
- Update workflow

### 2. Version Control

#### 2.1 Git Workflow
- Feature branches
- Semantic versioning
- Commit conventions
- PR templates

#### 2.2 Release Process
- Version bumping
- Changelog updates
- Asset packaging
- Store submission

## Monitoring

### 1. Analytics

#### 1.1 Usage Metrics
- Analysis counts
- Score distribution
- User engagement
- Error rates

#### 1.2 Performance Metrics
- Analysis latency
- UI responsiveness
- Memory usage
- API performance

### 2. Error Tracking

#### 2.1 Error Types
- Analysis failures
- API timeouts
- UI rendering issues
- Storage errors

#### 2.2 Logging Strategy
- Error severity levels
- Context capture
- Stack traces
- User feedback

## Future Enhancements

### 1. ML Pipeline

#### 1.1 Feature Engineering
- Text embeddings
- Image analysis
- Price normalization
- Category clustering

#### 1.2 Model Improvements
- Transfer learning
- Active learning
- Ensemble methods
- Confidence scoring

### 2. UI Enhancements

#### 2.1 Interactive Features
- Score explanations
- Alternative comparisons
- Impact visualization
- User preferences

#### 2.2 Accessibility
- ARIA labels
- Keyboard navigation
- Color contrast
- Screen reader support 