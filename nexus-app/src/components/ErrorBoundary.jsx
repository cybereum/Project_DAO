import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-8">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-gray-400 mb-6">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <div className="flex gap-3 justify-center mb-4">
              <button
                onClick={() => this.setState({ hasError: false, error: null, showDetails: false })}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => { this.setState({ hasError: false, error: null, showDetails: false }); window.location.reload(); }}
                className="px-6 py-2 border border-gray-600 hover:border-cyan-500 rounded-lg transition-colors"
              >
                Reload Page
              </button>
            </div>
            <button
              onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {this.state.showDetails ? 'Hide details' : 'Show details'}
            </button>
            {this.state.showDetails && this.state.error?.stack && (
              <pre className="mt-3 p-3 rounded-lg bg-gray-900 text-left text-xs text-gray-500 overflow-auto max-h-40">
                {this.state.error.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
