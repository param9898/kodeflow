import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Editor from '../components/Editor';

const COLORS = [
  '#ff5d8f', '#ffb454', '#ffe066', '#7bd389',
  '#4ea1f3', '#a78bfa', '#f472b6', '#34d399',
];

function pickColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function defaultName(): string {
  return `User-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();

  const [name, setName] = useState<string>(() => {
    return localStorage.getItem('kf:name') || defaultName();
  });
  const [color] = useState<string>(() => {
    return localStorage.getItem('kf:color') || pickColor();
  });

  useEffect(() => {
    localStorage.setItem('kf:name', name);
  }, [name]);
  useEffect(() => {
    localStorage.setItem('kf:color', color);
  }, [color]);

  const user = useMemo(() => ({ name, color }), [name, color]);

  if (!roomId) return null;
  const shareUrl = window.location.href;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 14,
        }}
      >
        <strong>KodeFlow</strong>
        <span style={{ color: '#888' }}>·</span>
        <span>
          Room{' '}
          <code style={{ background: '#2a2a2a', padding: '2px 6px', borderRadius: 4 }}>
            {roomId}
          </code>
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: color,
              display: 'inline-block',
            }}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 32))}
            placeholder="Your name"
            style={{
              background: '#1a1a1a',
              color: '#e6e6e6',
              border: '1px solid #444',
              borderRadius: 4,
              padding: '5px 8px',
              fontSize: 13,
              width: 140,
            }}
          />
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            style={{
              padding: '6px 12px',
              background: '#2a2a2a',
              color: '#e6e6e6',
              border: '1px solid #444',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Copy share link
          </button>
        </span>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor roomId={roomId} user={user} />
      </div>
    </div>
  );
}
