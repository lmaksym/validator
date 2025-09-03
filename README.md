# Mermaid Diagram Validator API

A REST API service for validating Mermaid diagram syntax, deployable to Vercel.

## Features

- Validates Mermaid diagram syntax
- Supports all major diagram types (flowchart, sequence, class, state, ER, Gantt, etc.)
- Returns detailed error messages with line numbers
- Provides helpful suggestions for fixing errors
- CORS enabled for n8n integration

## Endpoints

### `GET /`
Health check endpoint

### `POST /validate`
Validates a Mermaid diagram

**Request body:**
```json
{
  "diagram": "graph TD\n  A[Start] --> B[End]"
}
```

**Success response:**
```json
{
  "valid": true,
  "message": "Diagram is valid",
  "diagramType": "flowchart",
  "nodeCount": 2,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error response:**
```json
{
  "valid": false,
  "error": "Error message",
  "line": 1,
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}
```

## Local Development

```bash
npm install
npm run dev
```

Server runs on http://localhost:3001

## Deployment to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow the prompts to configure your deployment

## Testing

```bash
curl -X POST http://localhost:3001/validate \
  -H "Content-Type: application/json" \
  -d '{"diagram": "graph TD\n  A[Start] --> B[End]"}'
```

## Integration with n8n

Use the HTTP Request node in n8n with:
- Method: POST
- URL: `https://your-app.vercel.app/validate`
- Body: JSON with `diagram` field
- Headers: `Content-Type: application/json`