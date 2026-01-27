/**
 * UI Components Barrel Export
 * 
 * Central export for all UI components.
 * Import components from '@/components/ui' for convenience.
 */

// =============================================================================
// Core Components (Existing)
// =============================================================================

export { Button } from './Button';
export { Input } from './Input';
export { Card } from './Card';
export { Badge } from './Badge';

// =============================================================================
// New Components - Phase 1 UI/UX Overhaul
// =============================================================================

// Accordion
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './Accordion';

// Alert
export { Alert } from './Alert';

// Avatar
export { Avatar, AvatarGroup } from './Avatar';

// Breadcrumb
export {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbSeparator
} from './Breadcrumb';

// Dialog/Modal
export {
    Dialog,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogBody,
    DialogFooter
} from './Dialog';

// Dropdown
export {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownCheckboxItem,
    DropdownSeparator,
    DropdownLabel
} from './Dropdown';

// Progress
export { Progress, CircularProgress } from './Progress';

// Slider
export { Slider, RangeSlider } from './Slider';

// Switch
export { Switch } from './Switch';

// Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';

// Toast
export { Toast, ToastProvider, useToast } from './Toast';

// Tooltip
export { Tooltip } from './Tooltip';

// GlassCard
export {
    GlassCard,
    GlassCardHeader,
    GlassCardTitle,
    GlassCardDescription,
    GlassCardContent,
    GlassCardFooter,
    StatCard
} from './GlassCard';

// Skeleton / Loading
export {
    Skeleton,
    ProductCardSkeleton,
    ProductGridSkeleton,
    OrderCardSkeleton,
    TableRowSkeleton,
    PageSkeleton,
    FormSkeleton,
    ProfileSkeleton,
    Spinner,
    LoadingOverlay
} from './Skeleton';
