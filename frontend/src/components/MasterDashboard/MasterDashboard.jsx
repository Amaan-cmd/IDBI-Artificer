import { useEffect, useState } from 'react';
import './MasterDashboard.css';
import { ArrowLeft } from 'lucide-react';

export default function MasterDashboard({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    fetch(`${API_BASE}/api/v1/users`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setUsers(data.users);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="master-dashboard">
      <div className="dashboard-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} /> Back to Evaluator
        </button>
        <h2 className="display-text" style={{ fontSize: '2rem', margin: 0 }}>MASTER ADMIN DASHBOARD</h2>
        <div style={{ width: '150px' }}></div>
      </div>

      <div className="dashboard-content">
        <div className="table-container">
          {loading ? (
            <p>Loading profiles...</p>
          ) : (
            <table className="brutalist-table">
              <thead>
                <tr>
                  <th>PROFILE ID</th>
                  <th>USERNAME</th>
                  <th>AGENT CALLS</th>
                  <th>API COST ($)</th>
                  <th>LAST LOGIN</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td><code>{user.id}</code></td>
                    <td style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{user.username}</td>
                    <td>{user.calls} runs</td>
                    <td style={{ color: '#e8660a', fontWeight: 'bold' }}>
                      ${(user.cost || 0).toFixed(2)}
                    </td>
                    <td>{new Date(user.lastLogin).toLocaleString()}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center' }}>No profiles found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
