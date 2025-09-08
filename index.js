const express = require('express');
const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify');

const app = express();
let mermaid = null; // Cached mermaid instance
let isInitializing = false; // Prevent multiple simultaneous initializations

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// CORS for n8n access
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Initialize mermaid with DOM environment
async function initializeMermaid() {
    if (mermaid) return mermaid; // Already initialized
    if (isInitializing) {
        // Wait for ongoing initialization
        while (isInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return mermaid;
    }
    
    isInitializing = true;
    
    try {
        // Create a DOM environment for Mermaid
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        global.navigator = dom.window.navigator;
        
        // Initialize DOMPurify with the window object
        const purify = DOMPurify(dom.window);
        global.DOMPurify = purify;
        
        // Now import and initialize Mermaid
        const mermaidModule = await import('mermaid');
        mermaid = mermaidModule.default;
        
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'strict',
            logLevel: 'error'
        });
        
        console.log('Mermaid parser initialized with DOM environment');
        return mermaid;
    } catch (error) {
        console.error('Failed to initialize mermaid:', error);
        throw error;
    } finally {
        isInitializing = false;
    }
}

// Validation endpoint
app.post('/validate', async (req, res) => {
    try {
        const diagram = req.body.diagram || req.body;
        
        if (!diagram || typeof diagram !== 'string') {
            return res.status(400).json({
                valid: false,
                error: 'Invalid input: diagram must be a string'
            });
        }

        // Initialize mermaid if needed (for serverless environments)
        try {
            const mermaidInstance = await initializeMermaid();
            
            if (!mermaidInstance) {
                return res.status(503).json({
                    valid: false,
                    error: 'Failed to initialize Mermaid parser'
                });
            }

            // Try to parse with mermaid
            await mermaidInstance.parse(diagram);
            console.log(diagram);
            
            // If parse succeeds, diagram is valid
            res.json({
                valid: true,
                message: 'Diagram is valid',
                timestamp: new Date().toISOString()
            });
            
        } catch (parseError) {
            // If it's an initialization error, return 503
            if (parseError.message && parseError.message.includes('initialize')) {
                return res.status(503).json({
                    valid: false,
                    error: 'Mermaid initialization failed',
                    details: parseError.message
                });
            }
            
            // Parse failed - return validation error
            const errorMessage = parseError.message || parseError.toString();
            console.log(`Error diagram: ${diagram}`)
            
            return res.status(400).json({
                valid: false,
                error: errorMessage,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({
            valid: false,
            error: 'Internal validation error',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/', async (req, res) => {
    // Try to initialize mermaid on health check too
    let mermaidReady = false;
    try {
        const mermaidInstance = await initializeMermaid();
        mermaidReady = !!mermaidInstance;
    } catch (e) {
        console.error('Health check: Mermaid init failed', e);
    }
    
    res.json({ 
        status: 'ok', 
        service: 'Mermaid Validator',
        version: '2.0.0',
        mermaidReady: mermaidReady,
        endpoints: ['/validate']
    });
});

const PORT = process.env.PORT || 3001;

// For local development, pre-initialize mermaid
if (process.env.NODE_ENV !== 'production') {
    initializeMermaid().then(() => {
        app.listen(PORT, () => {
            console.log(`Mermaid validation service running on port ${PORT}`);
            console.log(`Mermaid status: ${mermaid ? 'Ready' : 'Failed to load'}`);
        });
    }).catch(err => {
        console.error('Failed to start server:', err);
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT} but Mermaid failed to initialize`);
        });
    });
}

module.exports = app;