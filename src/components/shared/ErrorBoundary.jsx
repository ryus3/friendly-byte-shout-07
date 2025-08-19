import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error details with more context
    console.error('🚨 ErrorBoundary caught an error:', error, errorInfo);
    console.error('🔍 Component stack:', errorInfo.componentStack);
    console.error('🔍 Error stack:', error.stack);
    
    // Check for memory-related errors
    if (error.message?.includes('memory') || error.message?.includes('Maximum call stack')) {
      console.error('💾 Memory-related error detected');
    }
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">عذراً، حدث خطأ!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-center">
                تعذر تحميل هذه الصفحة. يرجى المحاولة مرة أخرى.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-destructive/5 p-3 rounded-lg">
                  <p className="text-sm text-destructive font-mono">
                    {this.state.error.toString()}
                  </p>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="flex-1"
                >
                  إعادة المحاولة
                </Button>
                <Button
                  onClick={this.handleReload}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  إعادة تحميل الصفحة
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;