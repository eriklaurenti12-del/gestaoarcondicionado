import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <Card className="w-full max-w-md border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Erro na Aplicação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <p className="text-sm font-mono text-red-900 break-all">
                  {this.state.error?.message || 'Erro desconhecido'}
                </p>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="text-xs bg-gray-100 p-2 rounded">
                  <summary className="cursor-pointer font-bold">Detalhes do erro</summary>
                  <pre className="mt-2 overflow-auto max-h-48 text-gray-700">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Um erro inesperado ocorreu. Tente recarregar a página.
                </p>
              </div>

              <Button 
                onClick={this.handleReset}
                className="w-full bg-red-600 hover:bg-red-700 gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Página
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
