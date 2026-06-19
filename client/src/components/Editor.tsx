import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import { MonacoBinding } from 'y-monaco';
import { io, type Socket } from 'socket.io-client';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import './cursor.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

type User = { name: string; color: string };

// Strip anything that could break out of a CSS content string. The name is
// user-controlled so we sanitize before injecting it into a stylesheet.
function safeName(raw: string): string {
  return raw.replace(/[\\"<>\r\n]/g, '').slice(0, 32) || 'Anon';
}

function safeColor(raw: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#4ea1f3';
}

export default function Editor({ roomId, user }: { roomId: string; user: User }) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);

  const handleMount: OnMount = (editor) => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const ytext = ydoc.getText('monaco');

    const awareness = new Awareness(ydoc);
    awarenessRef.current = awareness;
    awareness.setLocalStateField('user', user);

    // One <style> element holds all per-peer cursor/selection styling; we
    // rewrite it whenever awareness changes.
    const styleEl = document.createElement('style');
    styleEl.dataset.kodeflow = 'awareness';
    document.head.appendChild(styleEl);

    const renderPeerStyles = () => {
      let css = '';
      awareness.getStates().forEach((state, clientID) => {
        if (clientID === ydoc.clientID) return;
        const u = state.user as User | undefined;
        if (!u) return;
        const color = safeColor(u.color);
        const name = safeName(u.name);
        css += `
.yRemoteSelection-${clientID} { background-color: ${color}3d; }
.yRemoteSelectionHead-${clientID} {
  position: absolute;
  border-left: 2px solid ${color};
  border-top: 2px solid ${color};
  border-bottom: 2px solid ${color};
  height: 100%;
  box-sizing: border-box;
}
.yRemoteSelectionHead-${clientID}::after {
  position: absolute;
  content: "${name}";
  top: -1.1em;
  left: -2px;
  padding: 1px 4px;
  font-size: 11px;
  line-height: 1;
  font-weight: 600;
  color: #0a0a0a;
  background: ${color};
  border-radius: 3px 3px 3px 0;
  white-space: nowrap;
  pointer-events: none;
}`;
      });
      styleEl.textContent = css;
    };
    awareness.on('change', renderPeerStyles);

    const socket = io(SERVER_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', roomId, ydoc.clientID);
    });

    socket.on('sync', (update: ArrayBuffer) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');
    });

    socket.on('update', (update: ArrayBuffer) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');
    });

    socket.on('awareness-init', (updates: ArrayBuffer[]) => {
      for (const u of updates) {
        applyAwarenessUpdate(awareness, new Uint8Array(u), 'remote');
      }
    });

    socket.on('awareness', (update: ArrayBuffer) => {
      applyAwarenessUpdate(awareness, new Uint8Array(update), 'remote');
    });

    socket.on('awareness-remove', (clientID: number) => {
      removeAwarenessStates(awareness, [clientID], 'remote');
    });

    ydoc.on('update', (update, origin) => {
      if (origin !== 'remote') socket.emit('update', roomId, update);
    });

    // Encode only the clients that actually changed locally so we don't echo
    // back updates we just received from the network.
    awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        if (origin === 'remote') return;
        const changed = added.concat(updated, removed);
        if (!changed.length) return;
        const payload = encodeAwarenessUpdate(awareness, changed);
        socket.emit('awareness', roomId, payload);
      },
    );

    const model = editor.getModel();
    if (model) {
      bindingRef.current = new MonacoBinding(
        ytext,
        model,
        new Set([editor]),
        awareness,
      );
    }

    // Stash for cleanup.
    (awareness as unknown as { _kfStyleEl?: HTMLStyleElement })._kfStyleEl = styleEl;
  };

  useEffect(() => {
    awarenessRef.current?.setLocalStateField('user', user);
  }, [user.name, user.color]);

  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      const aw = awarenessRef.current as
        | (Awareness & { _kfStyleEl?: HTMLStyleElement })
        | null;
      aw?._kfStyleEl?.remove();
      aw?.destroy();
      socketRef.current?.disconnect();
      ydocRef.current?.destroy();
    };
  }, []);

  return (
    <MonacoEditor
      height="100%"
      defaultLanguage="typescript"
      defaultValue={`// Welcome to KodeFlow\n// Open this URL in another window — both edit at once.\n\nfunction greet(name: string) {\n  return \`Hello, \${name}!\`;\n}\n`}
      theme="vs-dark"
      onMount={handleMount}
      options={{ fontSize: 14, minimap: { enabled: false } }}
    />
  );
}
