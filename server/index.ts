import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Admin access routes MUST be defined BEFORE catch-all routes
  app.get('/admin-dashboard', (req, res) => {
    res.redirect('/?admin=true');
  });
  
  app.get('/admin', (req, res) => {
    res.redirect('/admin-dashboard');
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
