const fs = require('fs');

let mainTsx = fs.readFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', 'utf8');

// Replace the warehouse switcher div
const oldSwitcher = `<div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
          <select 
            value={currentLocationId} 
            onChange={(e) => setCurrentLocationId(Number(e.target.value))}
            style={{ width: '100%', padding: '0.6rem', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>`;

const newSwitcher = `<div style={{ padding: '0 16px', marginBottom: '16px' }}>
          <div style={{ position: 'relative' }}>
            <select 
              value={currentLocationId} 
              onChange={(e) => setCurrentLocationId(Number(e.target.value))}
              style={{ appearance: 'none', width: '100%', padding: '8px 32px 8px 12px', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', outline: 'none', cursor: 'pointer', fontWeight: 700 }}
            >
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          </div>
        </div>`;

mainTsx = mainTsx.replace(oldSwitcher, newSwitcher);

// Remove the sidebar search
const sidebarSearch = `<div className="sidebar-search"><button><Search size={18} /><span>Recherche rapide</span><kbd>Ctrl K</kbd></button></div>`;
mainTsx = mainTsx.replace(sidebarSearch, '');

fs.writeFileSync('c:/xampp/htdocs/TaysrSuite/apps/TaysrPOS_v0/frontend/src/main.tsx', mainTsx, 'utf8');
console.log('main.tsx UI updated');
