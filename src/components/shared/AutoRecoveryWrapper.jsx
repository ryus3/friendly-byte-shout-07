import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { navigationGuard } from '@/utils/navigationGuard';
import { memoryCleanup } from '@/utils/memoryCleanup';

const AutoRecoveryWrapper = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    let recoveryTimer = null;
    
    // Auto-recovery mechanism for blank screens
    const checkForBlankScreen = () => {
      const mainContent = document.querySelector('main, [role="main"], .main-content');
      const hasContent = mainContent && mainContent.children.length > 0;
      
      if (!hasContent && !isRecovering) {
        console.warn('🚨 Blank screen detected - initiating auto-recovery');
        setIsRecovering(true);
        
        // Force reset navigation guard
        navigationGuard.forceReset();
        
        // Clean up memory
        memoryCleanup.executeAll();
        
        // Reset recovery state
        setTimeout(() => {
          setIsRecovering(false);
          console.log('✅ Auto-recovery completed');
        }, 1000);
      }
    };

    // Check for blank screens after navigation
    recoveryTimer = setTimeout(checkForBlankScreen, 500);
    
    return () => {
      if (recoveryTimer) clearTimeout(recoveryTimer);
    };
  }, [location.pathname, isRecovering]);

  // Emergency fallback for stuck navigation
  useEffect(() => {
    const handleEmergencyReset = () => {
      console.log('🆘 Emergency navigation reset triggered');
      navigationGuard.forceReset();
      memoryCleanup.executeAll();
      window.location.reload();
    };

    window.addEventListener('emergencyReset', handleEmergencyReset);
    return () => window.removeEventListener('emergencyReset', handleEmergencyReset);
  }, []);

  return children;
};

export default AutoRecoveryWrapper;