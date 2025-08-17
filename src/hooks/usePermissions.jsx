/**
 * Bridge file for backward compatibility
 * Redirects to the unified permissions system
 */
import { useUnifiedPermissionsSystem } from './useUnifiedPermissionsSystem.jsx';

export { useUnifiedPermissionsSystem as usePermissions };
export default useUnifiedPermissionsSystem;