import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', background: '#f8d7da', color: '#721c24', minHeight: '100vh' }} dir="ltr">
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Something went wrong.</h1>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px', marginTop: '10px' }}>
                        {this.state.error && this.state.error.toString()}
                    </pre>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', marginTop: '10px', color: '#555' }}>
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                    <button 
                        onClick={() => { localStorage.clear(); window.location.reload(); }}
                        style={{ marginTop: '20px', padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                    >
                        Clear Cache and Reload
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
