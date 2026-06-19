import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const createRoom = () => {
    const id = crypto.randomUUID().slice(0, 8);
    navigate(`/r/${id}`);
  };
  return (
    <div style={{ padding: 40, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ margin: 0 }}>KodeFlow</h1>
      <p style={{ color: '#aaa' }}>Real-time collaborative code editor.</p>
      <button
        onClick={createRoom}
        style={{
          marginTop: 16,
          padding: '12px 22px',
          fontSize: 16,
          background: '#4ea1f3',
          color: '#0a0a0a',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        New room
      </button>
      <p style={{ marginTop: 32, color: '#888', fontSize: 14 }}>
        Tip: open the room URL in two browser windows to see CRDT sync in action.
      </p>
    </div>
  );
}
