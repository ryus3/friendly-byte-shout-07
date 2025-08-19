import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { navigationGuard, performanceMonitor } from '@/utils/navigationGuard';

class ImprovedErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.error('🚨 ErrorBoundary caught error:', { errorId, error });
    
    return {
      hasError: true,
      errorId
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🔍 ErrorBoundary details:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId
    });
    
    // Performance monitoring
    performanceMonitor.memory();
    performanceMonitor.cleanup();
    
    // Reset navigation guard if stuck
    navigationGuard.forceReset();
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    // Force cleanup before reload
    performanceMonitor.cleanup();
    navigationGuard.forceReset();
    window.location.reload();
  };

  handleReset = () => {
    // Clear error state and reset navigation
    navigationGuard.forceReset();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  handleNavigateHome = () => {
    // Navigate to home with cleanup
    navigationGuard.forceReset();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">خطأ في التطبيق</CardTitle>
              <CardDescription>
                عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-mono text-xs text-muted-foreground mb-2">
                    ID: {this.state.errorId}
                  </p>
                  <p className="font-semibold text-destructive">
                    {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="mt-2 text-xs overflow-auto max-h-32 text-muted-foreground">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={this.handleReset} 
                  className="w-full"
                  variant="default"
                >
                  المحاولة مرة أخرى
                </Button>
                
                <Button 
                  onClick={this.handleNavigateHome} 
                  variant="outline"
                  className="w-full"
                >
                  <Home className="mr-2 h-4 w-4" />
                  العودة للرئيسية
                </Button>
                
                <Button 
                  onClick={this.handleReload} 
                  variant="secondary"
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  إعادة تحميل الصفحة
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center mt-4">
                إذا استمر هذا الخطأ، يرجى الاتصال بالدعم الفني.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ImprovedErrorBoundary;