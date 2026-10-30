import express, { Request, Response } from 'express';

const app = express();
const PORT = 3002;

/**
 * ============================================================================
 * TYPE 2: STORED CROSS-SITE SCRIPTING (Persistent XSS)
 * ============================================================================
 * 
 * THE PROBLEM:
 * Stored XSS (also called Persistent XSS) occurs when untrusted user input is
 * saved on the target server (e.g., in a database, filesystem, or cache), and
 * later embedded into web pages delivered to other users without encoding.
 * 
 * WHY IT IS MORE SEVERE THAN REFLECTED XSS:
 *   - Reflected XSS requires tricking an individual victim into clicking a link.
 *   - Stored XSS affects EVERY user who visits the compromised page automatically!
 *   - The attacker only needs to submit the payload once (e.g. in a comment,
 *     forum post, profile name, or review).
 * 
 * VULNERABLE DATA FLOW (Source -> Storage -> Sink):
 *   1. Source: HTTP POST request containing comment body.
 *   2. Storage: Server stores the raw, unvalidated string directly in the database.
 *   3. Retrieval: Server reads the raw strings from the database for another user.
 *   4. Sink: Server concatenates the raw string into HTML sent to any visiting browser.
 * ============================================================================
 */

app.use(express.urlencoded({ extended: true }));

// In-memory simulation of a database table (e.g., Comments or Reviews)
interface CommentRecord {
  id: number;
  author: string;
  text: string;
  createdAt: string;
}

const commentsDatabase: CommentRecord[] = [
  {
    id: 1,
    author: 'Alice',
    text: 'Great product! Really enjoyed using it.',
    createdAt: new Date().toLocaleTimeString(),
  },
  {
    id: 2,
    author: 'Bob',
    text: 'Fast shipping and well packaged.',
    createdAt: new Date().toLocaleTimeString(),
  }
];

// Display the guestbook/comments
app.get('/', (req: Request, res: Response) => {
  // INSECURE CODE PATTERN:
  // The server loops over stored comments and drops `c.text` directly into the HTML string!
  const renderedComments = commentsDatabase
    .map(
      (c) => `
      <div class="comment-item">
        <div class="comment-header">
          <strong>${c.author}</strong> <span class="time">${c.createdAt}</span>
        </div>
        <!-- VULNERABLE SINK BELOW: Database text rendered as raw HTML -->
        <div class="comment-body">${c.text}</div>
      </div>
    `
    )
    .join('');

  const htmlResponse = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Stored XSS Demonstration</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #f59e0b; margin-top: 0; }
    .badge { display: inline-block; background: #ea580c; color: white; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; margin-bottom: 15px; }
    .card { background: #334155; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ea580c; }
    input[type="text"], textarea { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 15px; margin-bottom: 12px; }
    textarea { height: 80px; resize: vertical; }
    button { padding: 12px 24px; border-radius: 6px; border: none; background: #f59e0b; color: #0f172a; font-weight: bold; font-size: 16px; cursor: pointer; }
    button:hover { background: #d97706; color: white; }
    .comment-item { background: #0f172a; padding: 16px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #334155; }
    .comment-header { display: flex; justify-content: space-between; margin-bottom: 8px; color: #94a3b8; font-size: 14px; }
    .comment-body { color: #e2e8f0; font-size: 16px; }
    pre { background: #000; color: #4ade80; padding: 15px; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">Vulnerability Lab: Stored XSS</span>
    <h1>Customer Reviews Feed</h1>
    <p>Every review posted below is stored permanently in the database and displayed to every visitor.</p>

    <div class="card">
      <h3>Post a Review</h3>
      <form method="POST" action="/comments">
        <input type="text" name="author" placeholder="Your name (e.g. Charlie)" required />
        <textarea name="text" placeholder="Write your review here..." required></textarea>
        <button type="submit">Submit Review</button>
      </form>
    </div>

    <h3>Existing Reviews (${commentsDatabase.length}):</h3>
    <div class="comments-list">
      ${renderedComments}
    </div>

    <div class="card">
      <h3>Why is this code vulnerable?</h3>
      <p>In this server file, when reviews are submitted via POST:</p>
      <pre><code>commentsDatabase.push({ author, text, createdAt });</code></pre>
      <p>And when rendered back in HTML:</p>
      <pre><code>&lt;div class="comment-body"&gt;\${c.text}&lt;/div&gt;</code></pre>
      <p>The stored text is never escaped before being placed into HTML. If someone stores HTML markup, every subsequent user who requests the page receives that markup rendered directly as browser DOM elements.</p>
    </div>
  </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(htmlResponse);
});

// Endpoint to receive comments
app.post('/comments', (req: Request, res: Response) => {
  const { author, text } = req.body;
  if (author && text) {
    // INSECURE: Storing raw unescaped input directly into database
    commentsDatabase.push({
      id: commentsDatabase.length + 1,
      author: String(author),
      text: String(text),
      createdAt: new Date().toLocaleTimeString(),
    });
  }
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`[2] Stored XSS Server running at http://localhost:${PORT}`);
  console.log(`[!] Visit http://localhost:${PORT} in your browser to inspect.`);
});
