import express, { type Request, Response, NextFunction } from "express";
import { config } from "dotenv";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { promises as fs } from "fs";

// Load environment variables from .env file
config();

const app = express();
app.use(express.json({ limit: '10mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Add request timeout to prevent hanging connections
app.use((req, res, next) => {
  // Set a timeout for all requests (30 seconds)
  req.setTimeout(30000);
  res.setTimeout(30000);
  
  // Handle timeout errors gracefully
  req.on('timeout', () => {
    console.warn('Request timeout for:', req.url);
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  });
  
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Warning per request lente (potrebbero indicare sovraccarico)
      if (duration > 5000) {
        console.warn(`🚨 SLOW REQUEST: ${logLine}`);
      }
      
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Add global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception (preventing crash):', error);
  console.error('Stack:', error.stack);
  // Don't exit - this is what causes the intermittent errors
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (reason instanceof Error) {
    console.error('Error stack:', reason.stack);
  }
  // Don't exit - handle gracefully
});

// Add warning handlers
process.on('warning', (warning) => {
  console.warn('Process warning:', warning.name, warning.message);
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

(async () => {
  // Add CSV export endpoint BEFORE Vite setup to ensure it's not intercepted
  app.post("/api/admin/export-csv", async (req, res) => {
    try {
      const { sessionIds } = req.body;
      
      if (!sessionIds || sessionIds.length === 0) {
        return res.status(400).json({ error: "No sessions selected" });
      }

      const { storage } = await import("./storage");
      const rows: any[] = [];
      
      // Define all possible fields for vertical CSV format
      const fields = [
        'Session ID', 'User Name', 'Created At', 'Message Count', 'Cream Access',
        // Skin Analysis fields
        'Punteggio Generale', 'Rossori', 'Acne', 'Rughe', 'Pigmentazione', 
        'Pori Dilatati', 'Oleosità', 'Danni Solari', 'Occhiaie', 
        'Idratazione', 'Elasticità', 'Texture Uniforme',
        // User data fields  
        'Età', 'Sesso', 'Tipo Pelle Dichiarato', 'Zona Geografica',
        // Questions and answers
        'Usa Trucco', 'Strucca Sempre', 'Prodotti Attuali', 'Problemi Principali',
        'Allergie', 'Fragranza OK', 'Protezione Solare', 'Acqua Giornaliera',
        'Ore Sonno', 'Stress Level', 'Fumo', 'Dieta Equilibrata', 'Attività Fisica',
        'Farmaci', 'Condizioni Mediche', 'Routine Desiderata', 'Email',
        // Full conversation
        'Conversazione Completa'
      ];

      // Process each selected session
      for (const sessionId of sessionIds) {
        const session = await storage.getChatSession(sessionId);
        if (!session) continue;

        const messages = await storage.getChatMessages(sessionId);
        if (!messages) continue;

        // Extract data from messages
        const extractedData: any = {
          'Session ID': sessionId,
          'User Name': session.userName,
          'Created At': session.createdAt ? new Date(session.createdAt).toLocaleString('it-IT') : '',
          'Message Count': messages.length,
          'Cream Access': session.finalButtonClicked ? 'Sì' : 'No'
        };

        let fullConversation = '';
        let skinAnalysisFound = false;

        // Process each message to build conversation and extract data
        for (let i = 0; i < messages.length; i++) {
          const message = messages[i];
          fullConversation += `[${message.role.toUpperCase()}]: ${message.content}\n\n`;

          // Extract skin analysis data
          if (message.metadata && 'skinAnalysis' in message.metadata && !skinAnalysisFound) {
            const analysis = (message.metadata as any).skinAnalysis;
            extractedData['Rossori'] = analysis.rossori || '';
            extractedData['Acne'] = analysis.acne || '';
            extractedData['Rughe'] = analysis.rughe || '';
            extractedData['Pigmentazione'] = analysis.pigmentazione || '';
            extractedData['Pori Dilatati'] = analysis.pori_dilatati || '';
            extractedData['Oleosità'] = analysis.oleosita || '';
            extractedData['Danni Solari'] = analysis.danni_solari || '';
            extractedData['Occhiaie'] = analysis.occhiaie || '';
            extractedData['Idratazione'] = analysis.idratazione || '';
            extractedData['Elasticità'] = analysis.elasticita || '';
            extractedData['Texture Uniforme'] = analysis.texture_uniforme || '';
            
            // Calculate overall score
            const values = [
              analysis.rossori, analysis.acne, analysis.rughe, 
              analysis.pigmentazione, analysis.pori_dilatati, analysis.oleosita,
              analysis.danni_solari, analysis.occhiaie
            ].filter(v => v !== undefined);
            
            if (values.length > 0) {
              const sum = values.reduce((a, b) => a + b, 0);
              extractedData['Punteggio Generale'] = Math.round(sum / values.length);
            }
            
            skinAnalysisFound = true;
          }

          // Extract user responses based on patterns
          if (message.role === 'user') {
            const userResponse = message.content.trim();
            
            // Check previous assistant message for question context
            if (i > 0 && messages[i - 1].role === 'assistant') {
              const prevQuestion = messages[i - 1].content.toLowerCase();
              
              // Direct mapping based on known question patterns
              if (prevQuestion.includes('fragranza') && prevQuestion.includes('fiori')) {
                extractedData['Fragranza OK'] = userResponse === 'Sì' ? 'Sì' : 'No';
              }
              
              if (prevQuestion.includes('crema solare') && prevQuestion.includes('ogni giorno')) {
                extractedData['Protezione Solare'] = userResponse;
              }
              
              if (prevQuestion.includes('litri') && prevQuestion.includes('acqua')) {
                extractedData['Acqua Giornaliera'] = userResponse;
              }
              
              if (prevQuestion.includes('ore') && prevQuestion.includes('dormi')) {
                extractedData['Ore Sonno'] = userResponse;
              }
              
              if (prevQuestion.includes('stress') && prevQuestion.includes('da 1 a 10')) {
                // Map numeric stress to category
                const stressNum = parseInt(userResponse);
                if (stressNum >= 1 && stressNum <= 3) extractedData['Stress Level'] = 'Poco';
                else if (stressNum >= 4 && stressNum <= 6) extractedData['Stress Level'] = 'Poco';
                else if (stressNum >= 7 && stressNum <= 8) extractedData['Stress Level'] = 'Abbastanza';
                else if (stressNum >= 9 && stressNum <= 10) extractedData['Stress Level'] = 'Molto';
              }
              
              if (prevQuestion.includes('fumi?')) {
                extractedData['Fumo'] = userResponse;
              }
              
              if (prevQuestion.includes('alimentazione bilanciata')) {
                extractedData['Dieta Equilibrata'] = userResponse;
              }
              
              if (prevQuestion.includes('ingredienti') && prevQuestion.includes('allergica')) {
                extractedData['Allergie'] = userResponse === 'no' ? 'Nessuna' : userResponse;
              }
              
              // Age extraction
              if (prevQuestion.includes('anni') && prevQuestion.includes('hai')) {
                extractedData['Età'] = userResponse;
              }
              
              // Gender extraction
              if (prevQuestion.includes('genere')) {
                extractedData['Sesso'] = userResponse;
              }
            }
          }

          // Extract other data patterns
          const content = message.content.toLowerCase();
          
          // Age extraction
          const ageMatch = message.content.match(/(\d{2})\s*anni/i) || 
                          message.content.match(/ho\s*(\d{2})/i);
          if (ageMatch && !extractedData['Età']) {
            extractedData['Età'] = ageMatch[1];
          }

          // Gender extraction
          if (content.includes('femminile') || content.includes('donna')) {
            extractedData['Sesso'] = 'Femminile';
          } else if (content.includes('maschile') || content.includes('uomo')) {
            extractedData['Sesso'] = 'Maschile';
          }

          // Extract email
          const emailMatch = message.content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (emailMatch && !extractedData['Email']) {
            extractedData['Email'] = emailMatch[1];
          }
        }

        // Additional intelligent extraction from AI responses
        for (const message of messages) {
          if (message.role === 'assistant') {
            const content = message.content;
            
            // Extract deduced information from AI analysis
            if (content.includes('deduco che') || content.includes('noto che') || 
                content.includes('vedo che') || content.includes('analizzando')) {
              
              // Extract deduced age if mentioned
              if (!extractedData['Età'] && content.includes('anni')) {
                const ageMatch = content.match(/(\d{2})\s*anni/);
                if (ageMatch) {
                  extractedData['Età'] = ageMatch[1] + ' (dedotto)';
                }
              }

              // Extract deduced skin type
              if (!extractedData['Tipo Pelle Dichiarato'] && content.includes('pelle')) {
                if (content.includes('pelle grassa')) {
                  extractedData['Tipo Pelle Dichiarato'] = 'Grassa (dedotto)';
                } else if (content.includes('pelle secca')) {
                  extractedData['Tipo Pelle Dichiarato'] = 'Secca (dedotto)';
                } else if (content.includes('pelle mista')) {
                  extractedData['Tipo Pelle Dichiarato'] = 'Mista (dedotto)';
                }
              }
            }

            // Extract skin analysis results if present in a table format
            if (content.includes('| Parametro') && content.includes('| Valore')) {
              const lines = content.split('\n');
              for (const line of lines) {
                if (line.includes('|') && !line.includes('Parametro')) {
                  const parts = line.split('|').map(p => p.trim());
                  if (parts.length >= 3) {
                    const param = parts[1];
                    const value = parts[2];
                    
                    // Map parameters to column names
                    const paramMap: { [key: string]: string } = {
                      'Rossori': 'Rossori',
                      'Acne': 'Acne',
                      'Rughe': 'Rughe',
                      'Pigmentazione': 'Pigmentazione',
                      'Pori dilatati': 'Pori Dilatati',
                      'Oleosità': 'Oleosità',
                      'Danni solari': 'Danni Solari',
                      'Occhiaie': 'Occhiaie',
                      'Idratazione': 'Idratazione',
                      'Elasticità': 'Elasticità',
                      'Texture uniforme': 'Texture Uniforme',
                      'Punteggio generale': 'Punteggio Generale'
                    };
                    
                    if (paramMap[param] && value && value !== '-') {
                      extractedData[paramMap[param]] = value;
                    }
                  }
                }
              }
            }
          }
        }

        extractedData['Conversazione Completa'] = fullConversation.trim();

        // Store the extracted data for this session
        rows.push(extractedData);
      }

      // Generate VERTICAL CSV content
      let csvContent = '';
      
      // Add header row
      csvContent += '"Campo","Valore"\n';
      
      // For each session, create vertical format
      for (let i = 0; i < rows.length; i++) {
        const sessionData = rows[i];
        
        // Add session separator if multiple sessions
        if (i > 0) {
          csvContent += '"",""\n'; // Empty row separator
        }
        
        // Add session header
        csvContent += `"=== SESSIONE ${i + 1} ===",""\n`;
        
        // Add each field as a separate row
        for (const field of fields) {
          const value = sessionData[field] || '';
          // Escape quotes and wrap in quotes
          const escapedValue = String(value).replace(/"/g, '""');
          csvContent += `"${field}","${escapedValue}"\n`;
        }
      }

      // Send CSV file
      const filename = `ai-dermasense-export-${new Date().toISOString().split('T')[0]}.csv`;
      
      // Ensure CSV response before Vite can intercept
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength('\ufeff' + csvContent)
      });
      
      res.end('\ufeff' + csvContent);
      
    } catch (error) {
      console.error("Error generating CSV:", error);
      res.status(500).json({ error: "Failed to generate CSV" });
    }
  });

  // Add health check endpoint
  app.get('/health', (req, res) => {
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      memory: {
        heapUsed: memUsageMB + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
      },
      activeSessions: geminiServices ? geminiServices.size : 0,
      nodeVersion: process.version,
      platform: process.platform
    });
  });

  // Add a simple endpoint to test main functionality
  app.get('/api/status', (req, res) => {
    res.status(200).json({ 
      status: 'operational', 
      services: {
        gemini: !!process.env.GOOGLE_GEMINI_API_KEY,
        sheets: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        klaviyo: !!process.env.KLAVIYO_API_KEY
      }
    });
  });

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Log dettagliato dell'errore
    console.error('=== SERVER ERROR ===');
    console.error('Status:', status);
    console.error('Message:', message);
    console.error('URL:', _req.url);
    console.error('Method:', _req.method);
    console.error('Headers:', _req.headers);
    console.error('Body:', _req.body);
    console.error('Stack:', err.stack);
    console.error('===================');

    // Only send response if headers haven't been sent yet
    if (!res.headersSent) {
      try {
        res.status(status).json({ 
          message: status === 500 ? "Si è verificato un errore temporaneo. Riprova tra poco." : message,
          timestamp: new Date().toISOString(),
          requestId: _req.headers['x-request-id'] || 'unknown'
        });
      } catch (sendError) {
        console.error('Error sending error response:', sendError);
      }
    }
    
    // Don't throw the error again - just log it
  });

  // Admin access routes MUST be defined BEFORE catch-all routes
  // Remove redirect, let frontend handle /admin-dashboard routing
  
  app.get('/admin', (req, res) => {
    res.redirect('/admin-dashboard');
  });

  // Admin dashboard endpoint that works guaranteed
  app.get('/admin-working', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - AI DermaSense</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
        }
        .admin-container {
            min-height: 100vh;
            padding: 1rem;
        }
        .admin-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 16px;
            margin-bottom: 2rem;
            text-align: center;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
        }
        .conversation-item {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
            margin-bottom: 0.5rem;
            border-radius: 8px;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f4f6;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="admin-container">
        <div class="admin-header">
            <h1 class="text-3xl font-bold mb-2">🔐 AI-DermaSense Admin</h1>
            <p class="text-lg opacity-90">Dashboard Amministrativa</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="text-sm text-gray-500 mb-2">Conversazioni Totali</div>
                <div class="text-3xl font-bold text-gray-900" id="totalSessions">-</div>
            </div>
            <div class="stat-card">
                <div class="text-sm text-gray-500 mb-2">Conversazioni Oggi</div>
                <div class="text-3xl font-bold text-gray-900" id="todaySessions">-</div>
            </div>
            <div class="stat-card">
                <div class="text-sm text-gray-500 mb-2">Accessi Crema</div>
                <div class="text-3xl font-bold text-gray-900" id="finalButtonClicks">-</div>
            </div>
            <div class="stat-card">
                <div class="text-sm text-gray-500 mb-2">Messaggi Totali</div>
                <div class="text-3xl font-bold text-gray-900" id="totalMessages">-</div>
            </div>
        </div>
        
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="p-6 border-b border-gray-200 bg-gray-50">
                <h2 class="text-xl font-semibold text-gray-900">Conversazioni Recenti</h2>
            </div>
            <div class="p-4 max-h-96 overflow-y-auto" id="conversationList">
                <div class="text-center py-8">
                    <div class="spinner"></div>
                    <div class="text-gray-500">Caricamento conversazioni...</div>
                </div>
            </div>
        </div>
        
        <div class="mt-6 text-center">
            <a href="/?admin=true" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                Accedi alla Dashboard Completa
            </a>
        </div>
    </div>

    <script>
        const API_BASE = window.location.origin + '/api/admin';
        
        async function loadStats() {
            try {
                const response = await fetch(API_BASE + '/stats');
                const stats = await response.json();
                
                document.getElementById('totalSessions').textContent = stats.totalSessions;
                document.getElementById('todaySessions').textContent = stats.todaySessions;
                document.getElementById('finalButtonClicks').textContent = stats.finalButtonClicks;
                document.getElementById('totalMessages').textContent = stats.totalMessages;
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }
        
        async function loadConversations() {
            try {
                const response = await fetch(API_BASE + '/sessions');
                const sessions = await response.json();
                
                const listElement = document.getElementById('conversationList');
                listElement.innerHTML = '';
                
                sessions.slice(0, 10).forEach(session => {
                    const item = document.createElement('div');
                    item.className = 'conversation-item';
                    
                    const date = new Date(session.createdAt).toLocaleDateString('it-IT');
                    const time = new Date(session.createdAt).toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    item.innerHTML = \`
                        <div>
                            <div class="font-medium text-gray-900">\${session.userName}</div>
                            <div class="text-xs text-gray-500 font-mono">\${session.sessionId.substring(0, 20)}...</div>
                        </div>
                        <div class="text-right text-sm text-gray-500">
                            <div>\${date}</div>
                            <div>\${time}</div>
                        </div>
                    \`;
                    
                    listElement.appendChild(item);
                });
                
                if (sessions.length === 0) {
                    listElement.innerHTML = '<div class="text-center py-8 text-gray-500">Nessuna conversazione trovata</div>';
                }
            } catch (error) {
                console.error('Error loading conversations:', error);
                document.getElementById('conversationList').innerHTML = 
                    '<div class="text-center py-8 text-red-500">Errore nel caricamento delle conversazioni</div>';
            }
        }
        
        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            loadStats();
            loadConversations();
            
            // Auto-refresh
            setInterval(loadStats, 30000);
            setInterval(loadConversations, 60000);
        });
    </script>
</body>
</html>`);
  });

  // Direct admin access route with visual loading
  app.get('/admin-direct', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - AI DermaSense</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f8fafc;
        }
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            flex-direction: column;
            gap: 16px;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #e2e8f0;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 8px;
        }
        .subtitle {
            color: #64748b;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="loading">
        <div class="logo">AI-DermaSense</div>
        <div class="spinner"></div>
        <div class="subtitle">Caricamento Dashboard Admin...</div>
    </div>
    <script>
        window.location.href = '/?admin=true';
    </script>
</body>
</html>`);
  });

  // Simple dashboard access route
  app.get('/dashboard', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Admin - AI DermaSense</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 500px;
            width: 90%;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #64748b;
            font-size: 16px;
            margin-bottom: 30px;
        }
        .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid #f3f4f6;
            border-top: 5px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .status {
            color: #6b7280;
            font-size: 14px;
            margin-top: 20px;
        }
        .url-info {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            margin-top: 20px;
        }
        .url-info h4 {
            color: #374151;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .url-info code {
            background: #e2e8f0;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 12px;
            color: #1e293b;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🔐 AI-DermaSense</div>
        <div class="subtitle">Dashboard Amministrativa</div>
        <div class="spinner"></div>
        <div class="status">Caricamento in corso...</div>
        
        <div class="url-info">
            <h4>📌 URL per accesso diretto:</h4>
            <code>https://bonnie-beauty.replit.app/dashboard</code>
        </div>
    </div>
    <script>
        setTimeout(() => {
            window.location.href = '/?admin=true';
        }, 2000);
    </script>
</body>
</html>`);
  });



  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
