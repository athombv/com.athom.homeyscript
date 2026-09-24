import http from 'node:http';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const homeyOS = path.resolve(process.env.HOMEY_OS_PATH || path.join(root, '../node-homey-os'));
const homeyWidgets = path.join(homeyOS, 'packages/homey-core/www/widgets');
const variants = new Set([
  'script-result',
  'script-result-transparent',
  'script-button',
  'script-button-transparent',
]);
const port = Number(process.env.WIDGET_PLAYGROUND_PORT || 5001);

try {
  await access(path.join(homeyWidgets, 'css/homey.widgets.css'));
} catch (err) {
  throw new Error(
    'Homey widget styles not found. Set HOMEY_OS_PATH to your node-homey-os checkout.',
    { cause: err },
  );
}

const server = http.createServer((request, response) => {
  serveRequest(request, response).catch((err) => {
    console.error('Widget playground request failed:', err);
    response.writeHead(500).end();
  });
});

async function serveRequest(request, response) {
  const url = new URL(request.url, 'http://localhost');
  let base = path.join(root, 'playground');
  let name = url.pathname.slice(1) || 'index.html';
  let preview = false;
  const match = url.pathname.match(/^\/preview\/([^/]+)\/(.+)$/);

  if (url.pathname.startsWith('/homey-widget/')) {
    base = homeyWidgets;
    name = url.pathname.slice('/homey-widget/'.length);

    // Only widget CSS and its fonts are exposed from the sibling checkout.
    if (!/^(css\/[^/]+\.css|fonts\/[^/]+\.ttf)$/.test(name)) {
      response.writeHead(404).end();
      return;
    }
  } else if (match && variants.has(match[1])) {
    base = path.join(root, 'widgets', match[1], 'public');
    name = match[2];
    preview = name === 'index.html';
  } else if (url.pathname.startsWith('/assets/')) {
    base = path.join(root, 'widgets/script-result/public');
    name = url.pathname.slice('/assets/'.length);
  }

  const file = path.resolve(base, name);

  if (!file.startsWith(`${base}${path.sep}`)) {
    response.writeHead(404).end();
    return;
  }

  try {
    let content = await readFile(file);

    if (preview) {
      // Keep the real widget markup, host logic and CSS. Replace only the Homey connection.
      content = content
        .toString()
        .replace(
          '<link rel="stylesheet" href="widget.css" />',
          '<link rel="stylesheet" href="/homey-widget/css/homey.widgets.css" />\n    <link rel="stylesheet" href="widget.css" />',
        )
        .replace('</head>', '<link rel="stylesheet" href="/preview-host.css" />\n  </head>')
        .replace(
          '<script src="widget.js"></script>',
          '<script src="/preview.js"></script>\n    <script src="widget.js"></script>',
        );
    }

    response.setHeader(
      'Content-Type',
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.ttf': 'font/ttf',
      }[path.extname(file)] || 'text/plain',
    );
    response.setHeader('Cache-Control', 'no-store');
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
}

server.listen(port, '127.0.0.1', () => {
  console.log(
    `Widget playground: http://127.0.0.1:${server.address().port} (simulated actions only)`,
  );
  console.log(`Homey widget styles: ${homeyWidgets}`);
});
