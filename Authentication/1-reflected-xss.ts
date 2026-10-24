import express, { Request, Response } from 'express';

const app = express();
const PORT = 3001;

app.use(express.urlencoded({ extended: true }));

app.get('/', (req: Request, res: Response) => {
  const searchTerm = (req.query.search as string) || '';

  const htmlResponse = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Reflected XSS Demonstration</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #38bdf8; margin-top: 0; }
    .badge { display: inline-block; background: #ef4444; color: white; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; margin-bottom: 15px; }
    .card { background: #334155; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
    input[type="text"] { width: 70%; padding: 12px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 16px; }
    button { padding: 12px 24px; border-radius: 6px; border: none; background: #38bdf8; color: #0f172a; font-weight: bold; font-size: 16px; cursor: pointer; }
    button:hover { background: #0284c7; color: white; }
    .results-area { background: #0f172a; padding: 20px; border-radius: 8px; margin-top: 20px; border: 1px dashed #64748b; }
    u { text-decoration: underline 3px #38bdf8; text-underline-offset: 4px; font-weight: bold; }
    mark { background: #facc15; color: #000; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
    .sample-tags { margin: 12px 0; font-size: 13px; color: #94a3b8; }
    .sample-pill { display: inline-block; background: #334155; color: #38bdf8; padding: 4px 10px; border-radius: 6px; text-decoration: none; margin: 4px; font-family: monospace; font-size: 12px; }
    .sample-pill:hover { background: #475569; color: #fff; }
    pre { background: #000; color: #4ade80; padding: 15px; border-radius: 6px; overflow-x: auto; }
    .warning { color: #f87171; font-size: 14px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">Vulnerability Lab: Reflected XSS</span>
    <h1>Product Search Portal</h1>
    <p>This page reflects whatever search term is passed in the <code>?search=</code> query parameter.</p>

    <div class="sample-tags">
      Quick test examples (click one to test):
      <a class="sample-pill" href="/?search=%3Cu%3EPiyush+Singh%3C%2Fu%3E">&lt;u&gt;Piyush Singh&lt;/u&gt;</a>
      <a class="sample-pill" href="/?search=%3Cmark%3EPiyush+Singh%3C%2Fmark%3E">&lt;mark&gt;Piyush Singh&lt;/mark&gt;</a>
      <a class="sample-pill" href="/?search=%3Cbutton%3EClick+Me%3C%2Fbutton%3E">&lt;button&gt;Click Me&lt;/button&gt;</a>
    </div>

    <form method="GET" action="/">
      <input type="text" name="search" placeholder="Search for items (e.g. laptop, phone)" value="${searchTerm.replace(/"/g, '&quot;')}" />
      <button type="submit">Search</button>
    </form>

    ${searchTerm ? `
      <div class="results-area">
        <h3>Search Results:</h3>
        <!-- VULNERABLE LINE BELOW: searchTerm is placed directly into HTML without escaping -->
        <p>You searched for: <strong>${searchTerm}</strong></p>
        <p><em>No products found matching your search term.</em></p>
      </div>
    ` : ''}

    <div class="card">
      <h3>Why is this code vulnerable?</h3>
      <p>Look at line 67 in this server file:</p>
      <pre><code>&lt;p&gt;You searched for: &lt;strong&gt;\${searchTerm}&lt;/strong&gt;&lt;/p&gt;</code></pre>
      <p>Because the variable <code>searchTerm</code> is injected directly into the HTML stream:</p>
      <ul>
        <li>If a user types <code>laptop</code>, it renders: <code>&lt;strong&gt;laptop&lt;/strong&gt;</code> (harmless text).</li>
        <li>If input contains HTML tags (e.g. <code>&lt;u&gt;underlined&lt;/u&gt;</code> or <code>&lt;img src=x onerror=...&gt;</code>), the browser cannot tell that this was supposed to be text data. It parses and executes the tags!</li>
      </ul>
    </div>
  </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(htmlResponse);
});

app.listen(PORT, () => {
  console.log(`[1] Reflected XSS Server running at http://localhost:${PORT}`);
  console.log(`[!] Visit http://localhost:${PORT} in your browser to inspect.`);
});
