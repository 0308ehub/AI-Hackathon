// FactChecker Pro - Multi-Source Fact Checking Service
class FactCheckingService {
    constructor() {
        this.sources = {
            googleFactCheck: {
                enabled: true,
                apiKey: null,
                baseUrl: 'https://factchecktools.googleapis.com/v1alpha1/claims:search'
            },
            wikipedia: {
                enabled: true,
                baseUrl: 'https://en.wikipedia.org/api/rest_v1/page/summary'
            },
            openai: {
                enabled: false,
                apiKey: null,
                model: 'gpt-4'
            },
            worldBank: {
                enabled: true,
                baseUrl: 'https://api.worldbank.org/v2'
            }
        };
        
        this.cache = new Map();
        this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    }

    async checkFact(statement, context = '') {
        try {
            // Check cache first
            const cacheKey = this.generateCacheKey(statement);
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.result;
            }

            // Determine fact type and select appropriate sources
            const factType = this.categorizeFact(statement);
            const results = await this.checkWithMultipleSources(statement, factType, context);
            
            // Aggregate results
            const aggregatedResult = this.aggregateResults(results);
            
            // Cache the result
            this.cache.set(cacheKey, {
                result: aggregatedResult,
                timestamp: Date.now()
            });

            return aggregatedResult;

        } catch (error) {
            console.error('Fact checking error:', error);
            return this.getFallbackResult(statement);
        }
    }

    categorizeFact(statement) {
        const lower = statement.toLowerCase();
        
        if (/\d{4}/.test(statement) && /(founded|established|created|started)/.test(lower)) {
            return 'historical_date';
        }
        
        if (/\d+%|\d+ percent|\d+ million|\d+ billion/.test(statement)) {
            return 'statistics';
        }
        
        if (/(studies show|research indicates|according to study)/.test(lower)) {
            return 'research_claim';
        }
        
        if (/(always|never|every|all|none|100%)/.test(lower)) {
            return 'absolute_statement';
        }
        
        if (/(university|college|institute|organization)/.test(lower)) {
            return 'institutional_claim';
        }
        
        if (/(miles|kilometers|pounds|kilograms|degrees)/.test(lower)) {
            return 'measurement';
        }
        
        return 'general';
    }

    async checkWithMultipleSources(statement, factType, context) {
        const promises = [];
        const results = [];

        // Google Fact Check (primary source)
        if (this.sources.googleFactCheck.enabled) {
            promises.push(
                this.checkGoogleFactCheck(statement)
                    .then(result => results.push({ source: 'google', result }))
                    .catch(err => console.warn('Google Fact Check failed:', err))
            );
        }

        // Wikipedia for historical/encyclopedic facts
        if (this.sources.wikipedia.enabled && this.isWikipediaSuitable(factType)) {
            promises.push(
                this.checkWikipedia(statement)
                    .then(result => results.push({ source: 'wikipedia', result }))
                    .catch(err => console.warn('Wikipedia check failed:', err))
            );
        }

        // World Bank for economic/population statistics
        if (this.sources.worldBank.enabled && factType === 'statistics') {
            promises.push(
                this.checkWorldBank(statement)
                    .then(result => results.push({ source: 'worldbank', result }))
                    .catch(err => console.warn('World Bank check failed:', err))
            );
        }

        // OpenAI for general verification and explanation
        if (this.sources.openai.enabled && this.sources.openai.apiKey) {
            promises.push(
                this.checkOpenAI(statement, context)
                    .then(result => results.push({ source: 'openai', result }))
                    .catch(err => console.warn('OpenAI check failed:', err))
            );
        }

        await Promise.allSettled(promises);
        return results;
    }

    async checkGoogleFactCheck(statement) {
        if (!this.sources.googleFactCheck.apiKey) {
            return { hasIssues: false, confidence: 0.5, message: 'API key not configured' };
        }

        const url = `${this.sources.googleFactCheck.baseUrl}?query=${encodeURIComponent(statement)}&key=${this.sources.googleFactCheck.apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.claimReview && data.claimReview.length > 0) {
            const review = data.claimReview[0];
            const rating = review.textualRating?.toLowerCase();
            
            return {
                hasIssues: ['false', 'mostly false', 'mixture'].includes(rating),
                confidence: 0.9,
                rating: rating,
                explanation: review.explanation || 'Fact-checked by Google',
                source: review.url,
                issues: this.getIssuesFromRating(rating),
                suggestions: this.getSuggestionsFromRating(rating)
            };
        }

        return { hasIssues: false, confidence: 0.3, message: 'No fact-check found' };
    }

    async checkWikipedia(statement) {
        // Extract potential Wikipedia search terms
        const searchTerms = this.extractWikipediaSearchTerms(statement);
        
        for (const term of searchTerms) {
            try {
                const url = `${this.sources.wikipedia.baseUrl}/${encodeURIComponent(term)}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.extract) {
                    return {
                        hasIssues: false,
                        confidence: 0.7,
                        source: 'Wikipedia',
                        explanation: `Verified against Wikipedia article: ${term}`,
                        extract: data.extract.substring(0, 200) + '...'
                    };
                }
            } catch (err) {
                continue;
            }
        }

        return { hasIssues: false, confidence: 0.3, message: 'No Wikipedia match found' };
    }

    async checkWorldBank(statement) {
        // Extract country and indicator from statement
        const { country, indicator } = this.extractWorldBankData(statement);
        
        if (!country || !indicator) {
            return { hasIssues: false, confidence: 0.3, message: 'No World Bank data found' };
        }

        try {
            const url = `${this.sources.worldBank.baseUrl}/country/${country}/indicator/${indicator}?format=json&per_page=1`;
            const response = await fetch(url);
            const data = await response.json();

            if (data[1] && data[1][0]) {
                const value = data[1][0].value;
                return {
                    hasIssues: false,
                    confidence: 0.8,
                    source: 'World Bank',
                    explanation: `World Bank data: ${value}`,
                    data: { country, indicator, value }
                };
            }
        } catch (err) {
            console.warn('World Bank API error:', err);
        }

        return { hasIssues: false, confidence: 0.3, message: 'World Bank data not available' };
    }

    async checkOpenAI(statement, context) {
        if (!this.sources.openai.apiKey) {
            return { hasIssues: false, confidence: 0.5, message: 'OpenAI API key not configured' };
        }

        const prompt = `Please fact-check this statement: "${statement}"
        
Context: ${context}

Respond in JSON format:
{
  "hasIssues": boolean,
  "confidence": number (0-1),
  "issues": [array of issues],
  "suggestions": [array of suggestions],
  "explanation": "brief explanation"
}`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sources.openai.apiKey}`
                },
                body: JSON.stringify({
                    model: this.sources.openai.model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3
                })
            });

            const data = await response.json();
            const content = data.choices[0].message.content;
            
            try {
                return JSON.parse(content);
            } catch (err) {
                return { hasIssues: false, confidence: 0.5, message: 'OpenAI response parsing failed' };
            }
        } catch (err) {
            return { hasIssues: false, confidence: 0.5, message: 'OpenAI API error' };
        }
    }

    aggregateResults(results) {
        if (results.length === 0) {
            return this.getFallbackResult();
        }

        // Weight results by source reliability
        const weights = {
            google: 0.4,
            wikipedia: 0.3,
            worldbank: 0.2,
            openai: 0.1
        };

        let totalWeight = 0;
        let weightedIssues = 0;
        let weightedConfidence = 0;
        const allIssues = [];
        const allSuggestions = [];
        const sources = [];

        results.forEach(({ source, result }) => {
            const weight = weights[source] || 0.1;
            totalWeight += weight;
            
            if (result.hasIssues) {
                weightedIssues += weight;
            }
            
            weightedConfidence += result.confidence * weight;
            
            if (result.issues) {
                allIssues.push(...result.issues);
            }
            
            if (result.suggestions) {
                allSuggestions.push(...result.suggestions);
            }
            
            sources.push(source);
        });

        const hasIssues = weightedIssues / totalWeight > 0.5;
        const confidence = weightedConfidence / totalWeight;

        return {
            hasIssues,
            confidence,
            issues: [...new Set(allIssues)],
            suggestions: [...new Set(allSuggestions)],
            sources,
            explanation: `Checked against ${sources.join(', ')}`
        };
    }

    // Helper methods
    generateCacheKey(statement) {
        return btoa(statement.toLowerCase().trim());
    }

    isWikipediaSuitable(factType) {
        return ['historical_date', 'institutional_claim', 'general'].includes(factType);
    }

    extractWikipediaSearchTerms(statement) {
        // Extract potential Wikipedia search terms
        const terms = [];
        
        // Look for proper nouns (capitalized words)
        const properNouns = statement.match(/[A-Z][a-z]+/g) || [];
        terms.push(...properNouns);
        
        // Look for specific entities
        const entities = statement.match(/([A-Z][a-z]+ (University|College|Institute|Organization|Company))/g) || [];
        terms.push(...entities);
        
        return terms.slice(0, 3); // Limit to top 3 terms
    }

    extractWorldBankData(statement) {
        // Extract country and indicator from statement
        const countries = ['china', 'usa', 'india', 'japan', 'germany', 'uk', 'france'];
        const indicators = ['SP.POP.TOTL', 'NY.GDP.MKTP.CD', 'SE.ADT.LITR.ZS'];
        
        const lower = statement.toLowerCase();
        const country = countries.find(c => lower.includes(c));
        const indicator = indicators.find(i => lower.includes('population') || lower.includes('gdp') || lower.includes('literacy'));
        
        return { country, indicator };
    }

    getIssuesFromRating(rating) {
        const issues = {
            'false': ['This claim is false'],
            'mostly false': ['This claim is mostly false'],
            'mixture': ['This claim contains both true and false elements'],
            'mostly true': ['This claim is mostly true but may have some inaccuracies'],
            'true': []
        };
        
        return issues[rating] || [];
    }

    getSuggestionsFromRating(rating) {
        const suggestions = {
            'false': ['Verify this information with reliable sources', 'Check for recent updates to this information'],
            'mostly false': ['Seek additional sources to verify the accurate parts', 'Be cautious about the false elements'],
            'mixture': ['Separate the true and false elements', 'Verify each part independently'],
            'mostly true': ['The claim is generally accurate', 'Minor corrections may be needed'],
            'true': ['This claim appears to be accurate']
        };
        
        return suggestions[rating] || [];
    }

    getFallbackResult(statement = '') {
        return {
            hasIssues: false,
            confidence: 0.3,
            issues: [],
            suggestions: ['Verify this information with additional sources'],
            explanation: 'Unable to verify with external sources',
            sources: []
        };
    }

    // Configuration methods
    setApiKey(source, apiKey) {
        if (this.sources[source]) {
            this.sources[source].apiKey = apiKey;
        }
    }

    enableSource(source, enabled) {
        if (this.sources[source]) {
            this.sources[source].enabled = enabled;
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FactCheckingService;
} 