# UI Components Documentation

This document provides an overview of all available UI components in the Business Automation System web application.

## Overview

The application uses [shadcn/ui](https://ui.shadcn.com/) - a collection of reusable components built with Radix UI and Tailwind CSS. All components are located in `components/ui/` and follow a consistent design system.

## Configuration

Component management is configured via `components.json`:

```json
{
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

## Available Components

### Layout & Containers

#### Card
**File**: `components/ui/card.tsx`

Container component for grouping related content.

**Exports**: `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent`

**Example**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content goes here</CardContent>
  <CardFooter>Footer actions</CardFooter>
</Card>
```

#### Separator
**File**: `components/ui/separator.tsx`

Visual divider between content sections.

**Exports**: `Separator`

**Props**: `orientation` (horizontal | vertical)

#### Tabs
**File**: `components/ui/tabs.tsx`

Tab navigation component for switching between content sections.

**Exports**: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`

### Overlays & Dialogs

#### Dialog
**File**: `components/ui/dialog.tsx`

Modal dialog component using Radix UI Dialog primitive.

**Exports**: `Dialog`, `DialogPortal`, `DialogOverlay`, `DialogClose`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`

**Example**:
```tsx
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    Content
    <DialogFooter>Actions</DialogFooter>
  </DialogContent>
</Dialog>
```

#### Alert Dialog
**File**: `components/ui/alert-dialog.tsx`

Modal dialog for important confirmations and alerts.

**Exports**: `AlertDialog`, `AlertDialogPortal`, `AlertDialogOverlay`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`

#### Sheet
**File**: `components/ui/sheet.tsx`

Slide-out panel component with multiple side variants.

**Exports**: `Sheet`, `SheetPortal`, `SheetOverlay`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`

**Side variants**: `top`, `bottom`, `left`, `right` (default: `right`)

**Example**:
```tsx
<Sheet>
  <SheetTrigger>Open</SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Title</SheetTitle>
    </SheetHeader>
    Content
  </SheetContent>
</Sheet>
```

#### Popover
**File**: `components/ui/popover.tsx`

Floating content container for tooltips, menus, and more.

**Exports**: `Popover`, `PopoverTrigger`, `PopoverContent`

#### Dropdown Menu
**File**: `components/ui/dropdown-menu.tsx`

Contextual menu with multiple items and sub-menus.

**Exports**: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`, `DropdownMenuRadioGroup`

#### Command
**File**: `components/ui/command.tsx`

Command palette (⌘K menu) using cmdk library.

**Exports**: `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandSeparator`, `CommandShortcut`

**Example**:
```tsx
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Type a command..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Suggestions">
      <CommandItem>Calendar</CommandItem>
      <CommandItem>Search</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

### Form Components

#### Form
**File**: `components/ui/form.tsx`

React Hook Form integration wrapper with context-based field management.

**Exports**: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`

**Example**:
```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="username"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Username</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormDescription>Your public username</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

#### Input
**File**: `components/ui/input.tsx`

Text input field component.

**Exports**: `Input`

**Type**: Supports all standard HTML input types

#### Textarea
**File**: `components/ui/textarea.tsx`

Multi-line text input component.

**Exports**: `Textarea`

**Props**: Supports all standard HTML textarea attributes

#### Button
**File**: `components/ui/button.tsx`

Button component with multiple variants.

**Exports**: `Button`, `buttonVariants`

**Variants**: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`

**Sizes**: `default`, `sm`, `lg`, `icon`

#### Label
**File**: `components/ui/label.tsx`

Form label component using Radix UI Label primitive.

**Exports**: `Label`

#### Select
**File**: `components/ui/select.tsx`

Dropdown select component.

**Exports**: `Select`, `SelectGroup`, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectLabel`, `SelectItem`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton`

#### Checkbox
**File**: `components/ui/checkbox.tsx`

Checkbox input component with checked, unchecked, and indeterminate states.

**Exports**: `Checkbox`

**Example**:
```tsx
<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <label htmlFor="terms">Accept terms and conditions</label>
</div>
```

#### Radio Group
**File**: `components/ui/radio-group.tsx`

Radio button group component.

**Exports**: `RadioGroup`, `RadioGroupItem`

**Example**:
```tsx
<RadioGroup defaultValue="option-one">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option-one" id="option-one" />
    <Label htmlFor="option-one">Option One</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option-two" id="option-two" />
    <Label htmlFor="option-two">Option Two</Label>
  </div>
</RadioGroup>
```

#### Switch
**File**: `components/ui/switch.tsx`

Toggle switch component.

**Exports**: `Switch`

**Example**:
```tsx
<div className="flex items-center space-x-2">
  <Switch id="airplane-mode" />
  <Label htmlFor="airplane-mode">Airplane Mode</Label>
</div>
```

### Data Display

#### Table
**File**: `components/ui/table.tsx`

Data table component with semantic HTML table elements.

**Exports**: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption`

**Example**:
```tsx
<Table>
  <TableCaption>A list of your recent invoices.</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>INV001</TableCell>
      <TableCell>Paid</TableCell>
      <TableCell>$250.00</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

#### Badge
**File**: `components/ui/badge.tsx`

Small label component for status indicators and tags.

**Exports**: `Badge`, `badgeVariants`

**Variants**: `default`, `secondary`, `destructive`, `outline`

#### Avatar
**File**: `components/ui/avatar.tsx`

User avatar component with fallback support.

**Exports**: `Avatar`, `AvatarImage`, `AvatarFallback`

#### Skeleton
**File**: `components/ui/skeleton.tsx`

Loading placeholder component.

**Exports**: `Skeleton`

### Feedback & Notifications

#### Toast / Sonner
**File**: `components/ui/sonner.tsx`

Toast notification component using Sonner library with theme support.

**Exports**: `Toaster`

**Usage**: Add `<Toaster />` to your root layout, then use the `toast` function from `sonner`:

```tsx
import { toast } from 'sonner'

toast.success('Profile updated successfully')
toast.error('Failed to save changes')
toast.info('New message received')
toast.warning('Storage almost full')
```

**Legacy Toast** (`components/ui/toast.tsx`): Also available for backward compatibility, using Radix UI Toast primitive.

## Styling

All components use:
- **Tailwind CSS** for utility-based styling
- **CSS Variables** for theme customization (see `app/globals.css`)
- **cn() utility** for conditional className merging (from `lib/utils.ts`)

### CSS Variables

Theme colors are defined in `app/globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --secondary: 210 40% 96.1%;
  /* ... more variables */
}
```

### Dark Mode

Dark mode is supported via CSS variable overrides:

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... more variables */
}
```

## Adding New Components

To add a new shadcn/ui component:

1. Use the shadcn CLI (requires `components.json`):
```bash
npx shadcn-ui@latest add [component-name]
```

2. Or manually create the component file in `components/ui/` following the existing patterns:
   - Import Radix UI primitives if applicable
   - Use `cn()` for className merging
   - Follow the forwardRef pattern for proper ref handling
   - Export all component parts

## Component Dependencies

### Core Dependencies

- `@radix-ui/react-*` - Unstyled, accessible UI primitives
- `class-variance-authority` - Variant-based styling
- `clsx` - Conditional className utility
- `tailwind-merge` - Tailwind class conflict resolution
- `cmdk` - Command palette
- `sonner` - Toast notifications
- `react-hook-form` - Form management

### Icons

Icons are imported from `@radix-ui/react-icons`:

```tsx
import { CheckIcon, Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons"
```

## Best Practices

1. **Composition**: Compose complex UIs from simple component primitives
2. **Variants**: Use `cva()` for managing component variants
3. **Accessibility**: All components are built on accessible Radix UI primitives
4. **Customization**: Pass className props to override default styles
5. **Consistency**: Follow the established patterns when adding new components
6. **Type Safety**: All components are fully typed with TypeScript

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React Hook Form](https://react-hook-form.com/)
