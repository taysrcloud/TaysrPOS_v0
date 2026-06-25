const fs = require('fs');

const errorBoundaryCode = `
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("ErrorBoundary caught an error", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}>
          <h2>Something went wrong in the frontend!</h2>
          <pre style={{ background: '#f5f5f5', padding: '1rem', overflowX: 'auto' }}>
            {this.state.error?.toString()}
            <br/><br/>
            {this.state.error?.stack}
          </pre>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ padding: '10px', marginTop: '20px' }}>
            Clear Data & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
`;

let content = fs.readFileSync('src/main.tsx', 'utf8');

// Insert the ErrorBoundary class just before the createRoot line
content = content.replace(
  "const isCustomerDisplay = new URLSearchParams(window.location.search).get('mode') === 'customer';",
  errorBoundaryCode + "\nconst isCustomerDisplay = new URLSearchParams(window.location.search).get('mode') === 'customer';"
);

// Wrap App with ErrorBoundary
content = content.replace(
  "createRoot(document.getElementById('root')!).render(isCustomerDisplay ? <CustomerDisplay /> : <App />);",
  "createRoot(document.getElementById('root')!).render(isCustomerDisplay ? <CustomerDisplay /> : <ErrorBoundary><App /></ErrorBoundary>);"
);

fs.writeFileSync('src/main.tsx', content);
