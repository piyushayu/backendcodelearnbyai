import express, { Request, Response } from 'express';

const app = express();
const PORT = 3004;

/**
 * ============================================================================
 * TYPE 4: MUTATION CROSS-SITE SCRIPTING (Mutation XSS / mXSS)
 * ============================================================================
 * 
 * THE PROBLEM:
 * Mutation XSS occurs when an application attempts to sanitize or filter user-supplied
 * HTML, but the browser's HTML parser "mutates" (restructures, normalizes, or corrects)
 * the markup during DOM parsing or serialization (such as when reading or writing
 * `element.innerHTML`).
 * 
 * As a result of this browser mutation:
 *   - Markup that appeared completely inert or safe during string inspection/filtering
 *     is transformed by the browser into executable elements or event handlers.
 * 
 * THE ROOT CAUSE:
 *   1. Parser leniency & HTML5 Tree Construction: Browsers are designed to be extremely
 *      forgiving with invalid or malformed HTML (e.g. unclosed tags, duplicate attributes,
 *      improperly nested SVG/MathML foreign objects).
 *   2. Namespace Transitions: In HTML5, tags like `<svg>` and `<math>` switch the parser
 *      into XML/Foreign Object mode. Certain tags inside `<math>` (like `<mtext>` or
 *      `<annotation-xml>`) can switch parsing rules back and forth unexpectedly.
 *   3. Re-serialization Mismatch: When an application takes untrusted HTML, parses it
 *      into an off-screen DOM, reads back `.innerHTML` (serialization), and later injects
 *      it into the live document, differences between the sanitizer's parsing rules
 *      and the live document parser lead to unexpected code execution.
 * 
 * WHY REGEX & NAIVE STRING FILTERS FAIL:
 *   - Regular expressions do not implement the full HTML5 state-machine parser.
 *   - What a regex thinks is an attribute value might be parsed by the browser as a tag name!
 * ============================================================================
 */

app.get('/', (req: Request, res: Response) => {
  const htmlResponse = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mutation XSS (mXSS) Demonstration</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 850px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #ec4899; margin-top: 0; }
    .badge { display: inline-block; background: #db2777; color: white; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; margin-bottom: 15px; }
    .card { background: #334155; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #db2777; }
    textarea { width: 100%; box-sizing: border-box; height: 90px; padding: 12px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 14px; font-family: monospace; }
    button { padding: 10px 20px; border-radius: 6px; border: none; background: #ec4899; color: white; font-weight: bold; font-size: 15px; cursor: pointer; margin-top: 8px; }
    button:hover { background: #be185d; }
    .stage-box { background: #0f172a; padding: 16px; border-radius: 8px; margin: 12px 0; border: 1px solid #475569; }
    .stage-title { color: #38bdf8; font-weight: bold; font-size: 14px; margin-bottom: 6px; }
    pre { background: #000; color: #4ade80; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
    .sample-btn { background: #475569; color: #cbd5e1; font-size: 12px; padding: 6px 12px; margin-right: 6px; margin-bottom: 8px; }
    .sample-btn:hover { background: #64748b; color: #fff; }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">Vulnerability Lab: Mutation XSS (mXSS)</span>
    <h1>Rich-Text Parser & Mutation Explorer</h1>
    <p>Mutation XSS happens when browser parsing quirks mutate benign-looking markup into executable nodes when assigned to <code>innerHTML</code>.</p>

    <div class="card">
      <h3>Test an Input String</h3>
      <p style="font-size:13px; color:#cbd5e1;">Click an example to test how the browser parser alters or repairs malformed structures:</p>
      <div>
        <button type="button" class="sample-btn" onclick="loadSample(1)">Malformed Form In Table</button>
        <button type="button" class="sample-btn" onclick="loadSample(2)">MathML / SVG ForeignObject</button>
        <button type="button" class="sample-btn" onclick="loadSample(3)">Unquoted Attribute Mutation</button>
      </div>

      <textarea id="rawInput">&lt;form&gt;&lt;table&gt;&lt;form&gt;&lt;input type="text"&gt;&lt;/form&gt;&lt;/table&gt;&lt;/form&gt;</textarea>
      <button type="button" onclick="inspectMutation()">Simulate & Inspect Parser Mutation</button>
    </div>

    <div class="stage-box">
      <div class="stage-title">Step 1: Naive Filter Inspection (What the backend / regex sees)</div>
      <div id="filterResult"><em>Click inspect above</em></div>
    </div>

    <div class="stage-box">
      <div class="stage-title">Step 2: Browser DOM Parser Mutation (What happens after innerHTML assignment)</div>
      <div id="mutationResult"><em>Click inspect above</em></div>
    </div>

    <div class="card">
      <h3>Why does Mutation occur?</h3>
      <p>The HTML5 specification defines strict, highly complex rules for handling invalid markup:</p>
      <ul>
        <li><strong>Auto-closing:</strong> Certain tags automatically close other tags (e.g. a <code>&lt;p&gt;</code> tag closes an existing <code>&lt;p&gt;</code>).</li>
        <li><strong>Foster Parenting:</strong> Elements placed inside a <code>&lt;table&gt;</code> that don't belong in a table are forcefully evicted and moved outside the table during DOM tree construction.</li>
        <li><strong>Foreign Content:</strong> Tags inside <code>&lt;svg&gt;</code> or <code>&lt;math&gt;</code> are parsed using different namespace rules. When tags transition across these boundaries, characters like quotes or brackets change their semantic meaning.</li>
      </ul>
      <p>When an application filters input using regex or a mismatched parsing routine, the live browser reparses and "mutates" the structure, potentially exposing executable nodes.</p>
    </div>
  </div>

  <script>
    function loadSample(num) {
      const input = document.getElementById('rawInput');
      if (num === 1) {
        input.value = '<table><form><tr><td><input name="test"></td></tr></form></table>';
      } else if (num === 2) {
        input.value = '<math><mtext><table><mglyph><style><!--</style><img src="x" onerror="console.log(1)">';
      } else if (num === 3) {
        input.value = '<listing>&lt;img src=x onerror=console.log(1)&gt;</listing>';
      }
      inspectMutation();
    }

    function inspectMutation() {
      const input = document.getElementById('rawInput').value;

      // 1. Simulate a naive regex filter (e.g., checks for simple <script> tag)
      const hasScriptTag = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(input);
      document.getElementById('filterResult').innerHTML = 
        '<p><strong>Regex check for &lt;script&gt;:</strong> ' + 
        (hasScriptTag ? '<span style="color:#ef4444">Detected &lt;script&gt; tag!</span>' : '<span style="color:#4ade80">Passed (No &lt;script&gt; tag found)</span>') + 
        '</p><pre><code>Raw input string: ' + escapeHtml(input) + '</code></pre>';

      // 2. Observe how the real browser DOM parser parses and re-serializes this markup
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = input; // Browser parser tree construction occurs here
      const mutatedOutput = tempDiv.innerHTML; // Browser re-serializes the mutated DOM

      document.getElementById('mutationResult').innerHTML = 
        '<p><strong>Browser Mutated DOM Serialization:</strong></p>' +
        '<pre><code>' + escapeHtml(mutatedOutput) + '</code></pre>' +
        '<p style="font-size:13px; color:#94a3b8;">Notice how the browser rearranged tags, closed elements, or changed nesting order according to HTML5 tree construction rules.</p>';
    }

    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Run on load
    inspectMutation();
  </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(htmlResponse);
});

app.listen(PORT, () => {
  console.log(`[4] Mutation XSS Server running at http://localhost:${PORT}`);
  console.log(`[!] Visit http://localhost:${PORT} in your browser to inspect.`);
});
