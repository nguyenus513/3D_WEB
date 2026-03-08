/**
 * UI Components Barrel Export
 * 
 * Central export for all UI components.
 * Import components from '@/components/ui' for convenience.
 */

// =============================================================================
// shadcn/ui Components (lowercase)
// =============================================================================

export { Button, buttonVariants } from './button';
export { Input } from './input';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card';
export { Badge, badgeVariants } from './badge';
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion';
export { Avatar, AvatarImage, AvatarFallback } from './avatar';
export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from './dialog';
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup } from './dropdown-menu';
export { Progress } from './progress';
export { Switch } from './switch';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip';
export { Skeleton } from './skeleton';
export { Separator } from './separator';
export { Label } from './label';
export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton } from './select';
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from './table';
export { Textarea } from './textarea';
export { Checkbox } from './checkbox';
export { ScrollArea, ScrollBar } from './scroll-area';
export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from './sheet';
export { Popover, PopoverTrigger, PopoverContent } from './popover';

// =============================================================================
// Custom Components (PascalCase - unique to this project)
// =============================================================================

export { Alert } from './Alert';
export {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbSeparator
} from './Breadcrumb';
export {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownCheckboxItem,
    DropdownSeparator,
    DropdownLabel
} from './Dropdown';
export { Slider, RangeSlider } from './Slider';
export { Toast, ToastProvider, useToast } from './Toast';
export {
    GlassCard,
    GlassCardHeader,
    GlassCardTitle,
    GlassCardDescription,
    GlassCardContent,
    GlassCardFooter,
    StatCard
} from './GlassCard';
export {
    ProductCardSkeleton,
    ProductGridSkeleton,
    OrderCardSkeleton,
    TableRowSkeleton,
    PageSkeleton,
    FormSkeleton,
    ProfileSkeleton,
    Spinner,
    LoadingOverlay
} from './custom-skeleton';
export { Input as CustomInput } from './custom-input';
export { Switch as CustomSwitch } from './custom-switch';
