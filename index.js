const express = require('express');
const app = express();

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

// Validation endpoint
app.post('/validate', async (req, res) => {
    try {
        const diagram = req.body.diagram || req.body;
        
        // Basic syntax validation
        const validation = validateMermaidSyntax(diagram);
        
        if (!validation.isValid) {
            return res.status(400).json({
                valid: false,
                error: validation.error,
                line: validation.line,
                suggestions: validation.suggestions
            });
        }

        // Since @mermaid-js/mermaid-cli doesn't provide parse method,
        // we'll rely on syntax validation
        res.json({
            valid: true,
            message: 'Diagram is valid',
            diagramType: detectDiagramType(diagram),
            nodeCount: countNodes(diagram),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            valid: false,
            error: 'Internal validation error',
            details: error.message
        });
    }
});

// Basic syntax validation
function validateMermaidSyntax(diagram) {
    const lines = diagram.split('\n');
    
    // Check for diagram type declaration
    const firstLine = lines[0].trim();
    const validTypes = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gitGraph', 'journey', 'gantt', 'pie', 'quadrantChart', 'mindmap', 'timeline'];
    
    let hasValidType = false;
    for (const type of validTypes) {
        if (firstLine.startsWith(type)) {
            hasValidType = true;
            break;
        }
    }
    
    if (!hasValidType) {
        return {
            isValid: false,
            error: `Invalid diagram type. Must start with one of: ${validTypes.join(', ')}`,
            line: 1,
            suggestions: ['Add a valid diagram type declaration at the beginning']
        };
    }
    
    // Check for common syntax errors
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('%%')) continue; // Skip empty lines and comments
        
        // Check for unmatched brackets
        const openBrackets = (line.match(/\[/g) || []).length;
        const closeBrackets = (line.match(/\]/g) || []).length;
        const openParens = (line.match(/\(/g) || []).length;
        const closeParens = (line.match(/\)/g) || []).length;
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        
        if (openBrackets !== closeBrackets) {
            return {
                isValid: false,
                error: `Unmatched square brackets on line ${i + 1}`,
                line: i + 1,
                suggestions: ['Check that all [ have matching ]']
            };
        }
        
        if (openParens !== closeParens) {
            return {
                isValid: false,
                error: `Unmatched parentheses on line ${i + 1}`,
                line: i + 1,
                suggestions: ['Check that all ( have matching )']
            };
        }
        
        if (openBraces !== closeBraces) {
            return {
                isValid: false,
                error: `Unmatched curly braces on line ${i + 1}`,
                line: i + 1,
                suggestions: ['Check that all { have matching }']
            };
        }
    }
    
    // Additional validation for specific diagram types
    if (firstLine.startsWith('graph') || firstLine.startsWith('flowchart')) {
        return validateFlowchart(lines);
    } else if (firstLine.startsWith('sequenceDiagram')) {
        return validateSequenceDiagram(lines);
    }
    
    return { isValid: true };
}

function validateFlowchart(lines) {
    let inSubgraph = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('%%')) continue;
        
        // Check subgraph syntax
        if (line.startsWith('subgraph')) {
            inSubgraph = true;
        } else if (line === 'end') {
            inSubgraph = false;
        }
        
        // Check arrow syntax
        if (line.includes('-->') || line.includes('---') || line.includes('-.->') || line.includes('==>')) {
            const parts = line.split(/-->|---|-.->|==>/);
            if (parts.length < 2) {
                return {
                    isValid: false,
                    error: `Invalid arrow syntax on line ${i + 1}`,
                    line: i + 1,
                    suggestions: ['Check that arrows connect two nodes']
                };
            }
        }
    }
    
    if (inSubgraph) {
        return {
            isValid: false,
            error: 'Unclosed subgraph',
            suggestions: ['Add "end" to close the subgraph']
        };
    }
    
    return { isValid: true };
}

function validateSequenceDiagram(lines) {
    const participants = new Set();
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('%%')) continue;
        
        // Extract participants
        if (line.startsWith('participant')) {
            const match = line.match(/participant\s+(\w+)/);
            if (match) {
                participants.add(match[1]);
            }
        }
        
        // Check message syntax
        if (line.includes('->>') || line.includes('-->>')) {
            const match = line.match(/(\w+)\s*(->>|-->>)\s*(\w+)/);
            if (!match) {
                return {
                    isValid: false,
                    error: `Invalid message syntax on line ${i + 1}`,
                    line: i + 1,
                    suggestions: ['Use format: Actor1->>Actor2: Message']
                };
            }
        }
    }
    
    return { isValid: true };
}

function detectDiagramType(diagram) {
    const firstLine = diagram.split('\n')[0].trim();
    if (firstLine.startsWith('graph')) return 'flowchart';
    if (firstLine.startsWith('flowchart')) return 'flowchart';
    if (firstLine.startsWith('sequenceDiagram')) return 'sequence';
    if (firstLine.startsWith('classDiagram')) return 'class';
    if (firstLine.startsWith('stateDiagram')) return 'state';
    if (firstLine.startsWith('erDiagram')) return 'er';
    if (firstLine.startsWith('gantt')) return 'gantt';
    if (firstLine.startsWith('pie')) return 'pie';
    if (firstLine.startsWith('journey')) return 'journey';
    if (firstLine.startsWith('gitGraph')) return 'gitGraph';
    if (firstLine.startsWith('mindmap')) return 'mindmap';
    if (firstLine.startsWith('timeline')) return 'timeline';
    return 'unknown';
}

function countNodes(diagram) {
    // Simple node counting for flowcharts
    const nodeMatches = diagram.match(/\w+\[.*?\]/g) || [];
    const nodeIds = new Set();
    
    // Also count nodes from connections
    const connectionMatches = diagram.match(/(\w+)\s*(-->|---|-.->|==>)\s*(\w+)/g) || [];
    connectionMatches.forEach(match => {
        const parts = match.split(/-->|---|-.->|==>/);
        if (parts[0]) nodeIds.add(parts[0].trim());
        if (parts[1]) nodeIds.add(parts[1].trim());
    });
    
    return nodeMatches.length + nodeIds.size;
}

function getSuggestions(error) {
    const suggestions = [];
    
    if (error.includes('Parse error')) {
        suggestions.push('Check diagram syntax and structure');
        suggestions.push('Verify all node connections use valid arrow syntax');
    }
    
    if (error.includes('Lexical error')) {
        suggestions.push('Check for invalid characters or keywords');
        suggestions.push('Ensure proper spacing around arrows and operators');
    }
    
    if (error.includes('subgraph')) {
        suggestions.push('Check subgraph syntax: subgraph "title"');
        suggestions.push('Ensure subgraphs are properly closed with "end"');
    }
    
    return suggestions.length > 0 ? suggestions : ['Check Mermaid documentation for syntax rules'];
}

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Mermaid Validator',
        endpoints: ['/validate']
    });
});

const PORT = process.env.PORT || 3001;

// For local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Mermaid validation service running on port ${PORT}`);
    });
}

module.exports = app;