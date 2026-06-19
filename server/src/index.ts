import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import * as Y from 'yjs';

const PORT = Number(process.env.PORT || 3001);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e8,
});

// Each room has a Y.Doc kept in memory so newcomers can be sync'd to the
// current state of the document. Updates from clients are applied to it,
// then broadcast to the rest of the room.
// For production you'd persist this snapshot (Redis, Postgres, or S3).
const roomDocs = new Map<string, Y.Doc>();

// Last-known awareness payload per socket, plus the Yjs clientID that produced
// it. We cache the payload so newcomers can be primed with everyone else's
// cursor on join, and we remember the clientID so we can broadcast a clean
// removal when the socket disconnects (instead of waiting for the awareness
// heartbeat to time it out).
type AwarenessEntry = { roomId: string; clientID: number; payload: Uint8Array };
const socketAwareness = new Map<string, AwarenessEntry>();

function getDoc(roomId: string): Y.Doc {
  let doc = roomDocs.get(roomId);
  if (!doc) {
    doc = new Y.Doc();
    roomDocs.set(roomId, doc);
  }
  return doc;
}

function toBytes(update: ArrayBuffer | Buffer): Uint8Array {
  return update instanceof Buffer
    ? new Uint8Array(update.buffer, update.byteOffset, update.byteLength)
    : new Uint8Array(update);
}

io.on('connection', (socket) => {
  console.log(`[kodeflow] connected ${socket.id}`);

  socket.on('join', (roomId: string, clientID: number) => {
    socket.join(roomId);
    const doc = getDoc(roomId);
    const snapshot = Y.encodeStateAsUpdate(doc);
    socket.emit('sync', snapshot);

    // Track this socket's clientID so we can emit a removal on disconnect.
    socketAwareness.set(socket.id, {
      roomId,
      clientID,
      payload: new Uint8Array(),
    });

    // Prime the newcomer with the current awareness of every other socket
    // in the room.
    const peers: Uint8Array[] = [];
    for (const [sid, entry] of socketAwareness) {
      if (sid !== socket.id && entry.roomId === roomId && entry.payload.length) {
        peers.push(entry.payload);
      }
    }
    if (peers.length) socket.emit('awareness-init', peers);

    console.log(`[kodeflow] ${socket.id} joined ${roomId} (client ${clientID})`);
  });

  socket.on('update', (roomId: string, update: ArrayBuffer | Buffer) => {
    const bytes = toBytes(update);
    const doc = getDoc(roomId);
    Y.applyUpdate(doc, bytes);
    socket.to(roomId).emit('update', bytes);
  });

  socket.on('awareness', (roomId: string, update: ArrayBuffer | Buffer) => {
    const bytes = toBytes(update);
    const entry = socketAwareness.get(socket.id);
    if (entry) entry.payload = bytes;
    socket.to(roomId).emit('awareness', bytes);
  });

  socket.on('disconnect', () => {
    const entry = socketAwareness.get(socket.id);
    if (entry) {
      socket.to(entry.roomId).emit('awareness-remove', entry.clientID);
      socketAwareness.delete(socket.id);
    }
    console.log(`[kodeflow] disconnected ${socket.id}`);
  });
});

async function start() {
  try {
    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[kodeflow] Redis adapter connected');
  } catch (err) {
    console.warn('[kodeflow] Redis unavailable, running single-instance:', err);
  }

  httpServer.listen(PORT, () => {
    console.log(`[kodeflow] listening on :${PORT}`);
  });
}

start();
