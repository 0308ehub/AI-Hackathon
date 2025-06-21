# Fact-Checking Sources Guide

## 🎯 **Recommended Sources for Fact Validation**

### **1. Google Fact Check Tools API (Primary)**
**Best for**: General fact verification, political claims, viral content
- **API**: `https://factchecktools.googleapis.com/v1alpha1/claims:search`
- **Cost**: Free with quotas
- **Coverage**: Global, comprehensive database
- **Response Format**: JSON with fact-check ratings
- **Strengths**: 
  - Professional fact-checking organizations
  - Real-time updates
  - Multiple languages
  - High accuracy

**Example Response**:
```json
{
  "claimReview": [{
    "textualRating": "FALSE",
    "claim": "The statement being checked",
    "explanation": "Detailed explanation of why it's false",
    "url": "https://factcheck.org/article/...",
    "reviewer": "FactCheck.org"
  }]
}
```

### **2. Wikipedia API (Secondary)**
**Best for**: Historical facts, dates, institutional information, encyclopedic knowledge
- **API**: `https://en.wikipedia.org/api/rest_v1/page/summary`
- **Cost**: Free
- **Coverage**: Comprehensive encyclopedic content
- **Strengths**:
  - Well-sourced information
  - Historical accuracy
  - Institutional data
  - Multiple languages

**Example Usage**:
```javascript
// Check if "Stanford University was founded in 1885"
const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/Stanford_University');
const data = await response.json();
// Verify founding date in extract
```

### **3. World Bank API (Statistics)**
**Best for**: Economic data, population statistics, development indicators
- **API**: `https://api.worldbank.org/v2`
- **Cost**: Free
- **Coverage**: Global economic and social data
- **Strengths**:
  - Official government data
  - Time series data
  - Multiple indicators
  - Reliable sources

**Example Usage**:
```javascript
// Check "China has 1.4 billion people"
const response = await fetch('https://api.worldbank.org/v2/country/CHN/indicator/SP.POP.TOTL?format=json&per_page=1');
const data = await response.json();
// Compare with claimed population
```

### **4. OpenAI API (AI Verification)**
**Best for**: General fact verification, explanation generation, complex claims
- **API**: `https://api.openai.com/v1/chat/completions`
- **Cost**: Per token usage (~$0.03 per 1K tokens)
- **Model**: GPT-4 (recommended)
- **Strengths**:
  - Can explain complex issues
  - Context-aware responses
  - Handles nuanced claims
  - Generates suggestions

**Example Prompt**:
```
Please fact-check this statement: "The Earth is flat"
Respond in JSON format:
{
  "hasIssues": boolean,
  "confidence": number (0-1),
  "issues": [array of issues],
  "suggestions": [array of suggestions],
  "explanation": "brief explanation"
}
```

## 🔍 **Specialized Sources by Category**

### **Health & Medical Facts**
- **WHO API**: Health statistics, disease data
- **CDC API**: US health information
- **PubMed API**: Medical research papers
- **FDA API**: Drug and food safety information

### **Scientific Facts**
- **NASA API**: Space, astronomy, climate data
- **NOAA API**: Weather, climate, ocean data
- **ArXiv API**: Scientific papers
- **Nature API**: Scientific publications

### **Political & Policy Facts**
- **FactCheck.org RSS**: Political fact-checking
- **PolitiFact API**: Political claims verification
- **Congress.gov API**: Legislative information
- **White House API**: Executive branch data

### **Economic & Financial Facts**
- **Federal Reserve API**: Economic data
- **IMF API**: International financial statistics
- **OECD API**: Economic indicators
- **Yahoo Finance API**: Stock market data

## 🛠 **Implementation Strategy**

### **Source Selection Logic**
```javascript
function selectSources(factType) {
    switch(factType) {
        case 'statistics':
            return ['google', 'worldbank', 'wikipedia'];
        case 'historical_date':
            return ['google', 'wikipedia'];
        case 'research_claim':
            return ['google', 'openai'];
        case 'institutional_claim':
            return ['google', 'wikipedia'];
        case 'medical_claim':
            return ['google', 'who', 'cdc'];
        default:
            return ['google', 'wikipedia', 'openai'];
    }
}
```

### **Confidence Weighting**
```javascript
const sourceWeights = {
    google: 0.4,      // Professional fact-checkers
    wikipedia: 0.3,   // Well-sourced encyclopedia
    worldbank: 0.2,   // Official government data
    openai: 0.1       // AI analysis
};
```

### **Result Aggregation**
```javascript
function aggregateResults(results) {
    let totalWeight = 0;
    let weightedIssues = 0;
    
    results.forEach(({source, result}) => {
        const weight = sourceWeights[source];
        totalWeight += weight;
        if (result.hasIssues) {
            weightedIssues += weight;
        }
    });
    
    return {
        hasIssues: weightedIssues / totalWeight > 0.5,
        confidence: calculateConfidence(results),
        sources: results.map(r => r.source)
    };
}
```

## 📊 **API Setup Instructions**

### **Google Fact Check API**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable "Fact Check Tools API"
4. Create credentials (API key)
5. Set quotas and restrictions

### **OpenAI API**
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up for an account
3. Add payment method
4. Create API key
5. Set usage limits

### **World Bank API**
1. No registration required
2. Free to use
3. Rate limits apply
4. Documentation: [World Bank API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889386-developer-information-overview)

## 🎯 **Best Practices**

### **1. Source Diversity**
- Use multiple sources for verification
- Cross-reference results
- Weight sources by reliability
- Consider source bias

### **2. Caching Strategy**
- Cache results for 24 hours
- Implement rate limiting
- Handle API failures gracefully
- Provide fallback responses

### **3. User Experience**
- Show confidence levels
- Explain reasoning
- Provide source links
- Offer suggestions for improvement

### **4. Privacy & Security**
- Don't store API keys in client-side code
- Use secure storage for sensitive data
- Respect rate limits
- Handle user data responsibly

## 🚀 **Future Enhancements**

### **Additional Sources to Consider**
- **Snopes API**: For viral content and urban legends
- **FactCheck.org API**: For political fact-checking
- **Reuters Fact Check**: For news verification
- **AP Fact Check**: For Associated Press verification
- **BBC Reality Check**: For UK-focused fact-checking

### **Advanced Features**
- **Real-time verification**: Check facts as users type
- **Source credibility scoring**: Rate sources by reliability
- **Contextual analysis**: Consider surrounding text
- **Multi-language support**: Check facts in different languages
- **Historical tracking**: Track how facts change over time

## 💡 **Cost Optimization**

### **Free Tier Limits**
- **Google Fact Check**: 1,000 requests/day
- **Wikipedia**: No limits (be respectful)
- **World Bank**: No limits
- **OpenAI**: $18 credit free tier

### **Cost-Effective Strategies**
1. Use free sources first
2. Cache results aggressively
3. Implement smart rate limiting
4. Use AI sparingly for complex cases
5. Batch requests when possible

This multi-source approach ensures comprehensive fact-checking while maintaining cost-effectiveness and user experience. 