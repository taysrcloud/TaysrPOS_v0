import fs from 'fs';

const file = 'C:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add fetching of users from backend instead of seedUsers
const authLogic = `
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserForLogin, setSelectedUserForLogin] = useState<User | null>(null);
  const [pinEntry, setPinEntry] = useState('');
  
  useEffect(() => {
    // Load users for login screen
    if (!isAuthenticated) {
      fetch(\`\${apiBase}/api/auth/users\`)
        .then(res => res.json())
        .then(data => setUsers(data.users || []))
        .catch(err => console.error(err));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const handleAuthError = () => {
      setIsAuthenticated(false);
      setCurrentUser(null);
      localStorage.removeItem('taysrPOS_token');
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  const handlePinSubmit = async () => {
    if (!selectedUserForLogin || pinEntry.length !== 4) return;
    try {
      const res = await fetch(\`\${apiBase}/api/auth/login\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserForLogin.id, pin: pinEntry })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('taysrPOS_token', data.token);
        setCurrentUser(data.user);
        setIsAuthenticated(true);
      } else {
        alert('Code PIN incorrect');
      }
    } catch (err) {
      alert('Erreur de connexion');
    }
    setPinEntry('');
  };
`;

content = content.replace(/const \[page, setPage\] = useState<PageKey>\('Tableau de bord'\);/g, `const [page, setPage] = useState<PageKey>('Tableau de bord');\n${authLogic}`);

// 2. Replace the login UI rendering
const loginUIPattern = /<div className="auth-form-container">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\);/;

const newLoginUI = `<div className="auth-form-container">
          <div className="auth-form-box" style={{ maxWidth: '400px' }}>
            {!selectedUserForLogin ? (
              <>
                <h2>Choisissez un profil</h2>
                <p>Cliquez sur un profil ci-dessous pour vous connecter.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '1.5rem' }}>
                  {users.map(user => (
                    <button 
                      key={user.id} 
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                      onClick={() => setSelectedUserForLogin(user)}
                      onMouseOver={e => e.currentTarget.style.borderColor = '#3b82f6'}
                      onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{user.fullName}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Rôle: {user.role}</div>
                      </div>
                    </button>
                  ))}
                  {users.length === 0 && <p style={{ color: '#64748b', fontSize: '14px' }}>Chargement des utilisateurs...</p>}
                </div>
              </>
            ) : (
              <>
                <h2>Code PIN</h2>
                <p>Entrez le code PIN pour {selectedUserForLogin.fullName}</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '20px 0' }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{ width: '40px', height: '40px', borderBottom: '3px solid ' + (pinEntry.length > i ? '#6366f1' : '#cbd5e1'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
                      {pinEntry.length > i ? '•' : ''}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '250px', margin: '0 auto' }}>
                  {[1,2,3,4,5,6,7,8,9].map(num => (
                    <button key={num} onClick={() => setPinEntry(p => p.length < 4 ? p + num : p)} style={{ padding: '15px', fontSize: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer' }}>{num}</button>
                  ))}
                  <button onClick={() => setSelectedUserForLogin(null)} style={{ padding: '15px', fontSize: '14px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>Retour</button>
                  <button onClick={() => setPinEntry(p => p.length < 4 ? p + '0' : p)} style={{ padding: '15px', fontSize: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer' }}>0</button>
                  <button onClick={() => setPinEntry(p => p.slice(0, -1))} style={{ padding: '15px', fontSize: '14px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}>Effacer</button>
                </div>
                <button className="primary-action" style={{ width: '100%', marginTop: '20px', padding: '12px' }} onClick={handlePinSubmit} disabled={pinEntry.length !== 4}>Valider</button>
              </>
            )}
          </div>
        </div>
      </div>
    );`;

content = content.replace(loginUIPattern, newLoginUI);

fs.writeFileSync(file, content);
console.log('Done replacement');
