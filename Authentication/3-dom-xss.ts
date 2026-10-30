import express, { Request, Response } from 'express';

const app = express();
const PORT = 3003;

/**
 * ============================================================================
 * TYPE 3: DOM-BASED CROSS-SITE SCRIPTING (DOM XSS)
 * ============================================================================
 * 
 * THE PROBLEM:
 * DOM-based XSS occurs when an application contains client-side JavaScript that
 * processes data from an untrusted source (like URL query string or hash fragment)
 * in an unsafe way, usually by writing the data back to the Document Object Model (DOM).
 * 
 * WHY DOM XSS IS UNIQUE:
 *   - In Reflected and Stored XSS, the server is the component that improperly
 *     builds the vulnerable HTML response.
 *   - In DOM XSS, the server response is often COMPLETELY STATIC AND INNOCENT!
 *     The vulnerability is entirely inside the client's browser JavaScript.
 *   - With URL hash fragments (e.g., `#section`), the data is NOT even sent to
 *     the backend server over HTTP, meaning server-side firewalls (WAFs) cannot
 *     detect it.
 * 
 * COMMON SOURCES (Where untrusted data enters client JS):
 *   - `window.location.search`
 *   - `window.location.hash`
 *   - `document.referrer`
 *   - `window.name`
 *   - `postMessage` event payloads
 * 
 * COMMON UNSAFE SINKS (Where data is parsed as code):
 *   - `element.innerHTML`
 *   - `element.outerHTML`
 *   - `document.write()`
 *   - `eval()`
 *   - `setTimeout(string, ...)`
 * ============================================================================
 */

app.get('/', (req: Request, res: Response) => {
  // Notice: The server does NOT touch req.query or req.body here!
  // The server sends completely static, clean HTML.
  const staticHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DOM-Based XSS Demonstration</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #a855f7; margin-top: 0; }
    .badge { display: inline-block; background: #9333ea; color: white; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; margin-bottom: 15px; }
    .card { background: #334155; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9333ea; }
    input[type="text"] { width: 70%; padding: 12px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 15px; }
    button { padding: 12px 20px; border-radius: 6px; border: none; background: #a855f7; color: white; font-weight: bold; font-size: 15px; cursor: pointer; }
    button:hover { background: #7e22ce; }
    .output-box { background: #0f172a; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #475569; }
    pre { background: #000; color: #4ade80; padding: 15px; border-radius: 6px; overflow-x: auto; }
    .highlight { color: #f43f5e; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">Vulnerability Lab: DOM-based XSS</span>
    <h1>User Welcome Dashboard</h1>
    <p>This page customizes the greeting entirely on the client side using JavaScript reading from the URL parameters.</p>

    <div>
      <input type="text" id="userInput" placeholder="Enter your name (or change ?name= in URL)" />
      <button onclick="updateGreeting()">Update via URL</button>
    </div>

    <div class="output-box">
      <h3>Client-Rendered Greeting:</h3>
      <!-- This is where the client JS will inject content -->
      <div id="greetingDisplay"><em>Loading greeting...</em></div>
    </div>

    <div class="card">
      <h3>Why is this code vulnerable?</h3>
      <p>Look at the client-side JavaScript in this page:</p>
      <pre><code>// 1. Untrusted SOURCE:
const params = new URLSearchParams(window.location.search);
const userName = params.get('name') || 'Guest';

// 2. Unsafe execution SINK:
document.getElementById('greetingDisplay').innerHTML = 'Welcome, ' + userName;</code></pre>
      <p>Because the script uses <span class="highlight">.innerHTML</span> instead of <span class="highlight">.textContent</span>, the browser parses any HTML markup in <code>userName</code> directly into the live DOM tree.</p>
      <p>The backend server never saw or modified this input—the execution takes place entirely within the browser's DOM rendering engine.</p>
    </div>
  </div>

  <script>
    // CLIENT-SIDE LOGIC
    function renderFromUrl() {
      // SOURCE: reading from window.location.search
      const params = new URLSearchParams(window.location.search);
      const name = params.get('name');

      if (name) {
        // VULNERABLE SINK: assigning directly to innerHTML
        document.getElementById('greetingDisplay').innerHTML = 'Hello, <strong>' + name + '</strong>!';
      } else {
        document.getElementById('greetingDisplay').innerHTML = 'Hello, <strong>Guest</strong>! (Try adding <code>?name=Alice</code> to the URL)';
      }
    }

    function updateGreeting() {
      const val = document.getElementById('userInput').value;
      const url = new URL(window.location);
      url.searchParams.set('name', val);
      window.location.href = url.toString();
    }

    // Run on page load
    renderFromUrl();
  </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(staticHtml);
});

app.listen(PORT, () => {
  console.log(`[3] DOM-based XSS Server running at http://localhost:${PORT}`);
  console.log(`[!] Visit http://localhost:${PORT} in your browser to inspect.`);
});
