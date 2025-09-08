const express = require('express');
const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify');

const app = express();
let mermaid; // Will be initialized asynchronously

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

// Initialize mermaid asynchronously with DOM environment
async function initializeMermaid() {
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
        return true;
    } catch (error) {
        console.error('Failed to initialize mermaid:', error);
        return false;
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

        if (!mermaid) {
            return res.status(503).json({
                valid: false,
                error: 'Mermaid parser not yet initialized'
            });
        }

        // Try to parse with mermaid
        try {
            // Attempt to parse the diagram
            await mermaid.parse(diagram);
            console.log(diagram);
            // If parse succeeds, diagram is valid
            res.json({
                valid: true,
                message: 'Diagram is valid',
                timestamp: new Date().toISOString()
            });
            
        } catch (parseError) {
            // Parse failed - return error
            const errorMessage = parseError.message || parseError.toString();
            console.warn(`Error diagram: ${diagram}`)
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
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Mermaid Validator',
        version: '2.0.0',
        mermaidReady: !!mermaid,
        endpoints: ['/validate']
    });
});

const PORT = process.env.PORT || 3001;

// Initialize mermaid first, then start server
initializeMermaid().then(() => {
    // For local development
    if (process.env.NODE_ENV !== 'production') {
        app.listen(PORT, () => {
            console.log(`Mermaid validation service running on port ${PORT}`);
            console.log(`Mermaid status: ${mermaid ? 'Ready' : 'Failed to load'}`);
        });
    }
});

module.exports = app;