import http from 'http';

const VERIFY_TOKEN = 'knight_whatsapp_verify_2024';

// Handles verification for both WhatsApp and Instagram webhook paths
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  console.log('Got request:', { path, mode, token, challenge });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log(`Verification OK for ${path} - returning challenge`);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(challenge);
  } else {
    res.writeHead(403);
    res.end('Forbidden');
  }
});

server.listen(5678, () => {
  console.log('Temp verify server running on port 5678');
  console.log('Handles any path — use for WhatsApp or Instagram verification');
  console.log('Go verify in Meta Developer Console now!');
});
