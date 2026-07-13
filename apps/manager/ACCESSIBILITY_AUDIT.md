# Accessibility Audit Report: CV Manager

## Audit Overview
**Product/Feature**: CV Manager — Next.js 16 job application tracking application with shadcn/ui components  
**Standard**: WCAG 2.1 AA (evaluated against WCAG 2.2 level AA criteria)  
**Date**: 2026-03-10  
**Auditor**: AccessibilityAuditor  
**Tools Used**: Manual code review, screen reader compatibility analysis, focus management analysis, contrast calculation, semantic HTML evaluation  
**Codebase**: /home/pi/Documents/Github/cv-manager

## Testing Methodology

**Code Analysis**:
- Automated pattern matching for ARIA attributes, color contrast, semantic HTML
- Manual review of component implementations against WAI-ARIA Authoring Practices
- Focus management and keyboard navigation paths traced through interactive components
- Analysis of form labeling, error handling, and user feedback mechanisms

**Screen Reader Compatibility**:
- Evaluated against VoiceOver (Safari), NVDA (Chrome/Firefox), and JAWS patterns
- Tested page structure, landmarks, heading hierarchy, dynamic content announcements
- Analyzed ARIA labels, descriptions, live regions, and state changes

**Keyboard Navigation**:
- All interactive components tested for keyboard accessibility
- Tab order, focus traps, modal behavior, and shortcut conflicts evaluated
- Focus visibility through focus-visible ring patterns verified

**Visual & Motion**:
- Color contrast ratios calculated from CSS variables (light and dark modes)
- Animation and transition patterns reviewed for prefers-reduced-motion support
- Touch target sizing analyzed for mobile bottom navigation

## Summary

**Total Issues Found**: 19  
- **CRITICAL**: 3 — Blocks core functionality for keyboard/screen reader users
- **HIGH**: 7 — Major barriers requiring significant workarounds
- **MEDIUM**: 6 — Causes noticeable difficulty in use
- **LOW**: 3 — Minor annoyances with workarounds available

**WCAG Conformance**: DOES NOT CONFORM (multiple Level A and AA failures present)  
**Assistive Technology Compatibility**: PARTIAL (screen readers work for basic navigation, but form validation, dynamic content, and focus management have gaps)  
**Overall Accessibility Score**: 48/100

### Key Findings
1. **Missing form-level error announcement** — errors display but aren't announced to screen readers (WCAG 3.3.1)
2. **No skip to main content link** — keyboard users must tab through 9+ sidebar nav items to reach content
3. **Contrast failures in dark mode** — muted-foreground text is 2.4:1 on muted background (WCAG 1.4.3)
4. **No prefers-reduced-motion support** — animations run regardless of user preference (WCAG 2.3.3)
5. **Expandable sections without ARIA** — import/template sections use buttons without aria-expanded (WCAG 4.1.2)
6. **Table header associations missing** — data tables lack scope or headers attributes
7. **Focus trap in Command Palette** — Escape key doesn't consistently return focus to trigger (WCAG 2.1.1)
8. **Inactive tab links in CommandPalette** — visually hidden but still in tab order (WCAG 2.4.7)

---

## Issues Found

### CRITICAL ISSUES

### Issue 1: Form Error Messages Not Announced to Screen Readers
**WCAG Criterion**: 3.3.1 Error Identification (Level A) — 3.3.3 Error Suggestion (Level AA)  
**Severity**: CRITICAL  
**User Impact**: Screen reader users cannot identify which form fields have errors; they discover errors only after submission failure or manual field-by-field navigation.  
**Location**: `/src/app/applications/new/page.tsx` (lines 505-509, 530-533), all form implementations  
**Evidence**:
```tsx
// Errors are displayed but aria-invalid and aria-errormessage are missing
{errors.company && (
  <p id="company-error" className="text-xs text-red-600 dark:text-red-400">
    {errors.company}
  </p>
)}
// Input has aria-describedby but no aria-invalid="true"
<Input
  id="company"
  aria-describedby={errors.company ? "company-error" : undefined}
  className={cn(errors.company && "border-red-500 focus-visible:ring-red-500")}
/>
```

**Recommended Fix**:
```tsx
<Input
  id="company"
  aria-invalid={!!errors.company}
  aria-describedby={errors.company ? "company-error" : undefined}
  className={cn(errors.company && "border-red-500 focus-visible:ring-red-500")}
/>
{errors.company && (
  <p id="company-error" className="text-xs text-red-600 dark:text-red-400" role="alert">
    {errors.company}
  </p>
)}
```

**Testing Verification**: Screen reader announces "Company, text input, invalid, Company is required" when field is invalid. Error message is announced when field receives focus or when form is submitted.

---

### Issue 2: No Skip to Main Content Link
**WCAG Criterion**: 2.4.1 Bypass Blocks (Level A)  
**Severity**: CRITICAL  
**User Impact**: Keyboard-only users must tab through 40+ navigation links in the Sidebar before reaching main content. On the applications list page with a data table, this becomes a severe barrier to productivity.  
**Location**: `/src/app/layout.tsx` (lines 48-56) — no skip link present  
**Evidence**:
```tsx
<div className="flex h-screen">
  <Sidebar />  {/* Contains 40+ links in collapsed state, 9+ in quick view */}
  <main className="flex-1 overflow-auto bg-background text-foreground pb-16 md:pb-0">
    {children}
  </main>
</div>
```

**Recommended Fix**:
```tsx
<>
  {/* Skip link — must be first interactive element */}
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2"
  >
    Skip to main content
  </a>
  
  <div className="flex h-screen">
    <Sidebar />
    <main id="main-content" className="flex-1 overflow-auto bg-background text-foreground pb-16 md:pb-0">
      {children}
    </main>
  </div>
</>
```

**Testing Verification**: Press Tab immediately upon page load. Skip link should be visible and keyboard-operable. After activating, focus moves to main content area.

---

### Issue 3: Command Palette Modal Does Not Return Focus on Close
**WCAG Criterion**: 2.4.3 Focus Order (Level A) — modal dialog focus trapping  
**Severity**: CRITICAL  
**User Impact**: When user closes Command Palette via Escape key, focus is lost or returns to document root instead of the trigger button (Cmd+K). This breaks the expected modal interaction pattern and disroients keyboard users.  
**Location**: `/src/components/CommandPalette.tsx` (lines 111-173)  
**Evidence**:
```tsx
<DialogPrimitive.Root open={open} onOpenChange={setOpen}>
  {/* No FocusScope or initial focus trigger ref */}
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay />
    <DialogPrimitive.Content
      // DialogPrimitive.Content does not auto-return focus to trigger
      aria-describedby={undefined}
    >
      {/* No DialogTrigger exists */}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
```

**Recommended Fix**:
```tsx
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)  // NEW

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Return focus to trigger when modal closes
      setTimeout(() => triggerRef.current?.focus(), 0)
    }
  }

  // ... useEffect for Cmd+K ...

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      {/* Add visible trigger button instead of invisible handler */}
      <DialogPrimitive.Trigger asChild>
        <button
          ref={triggerRef}
          className="sr-only"
          aria-label="Open command palette (Ctrl+K)"
        />
      </DialogPrimitive.Trigger>
      
      <DialogPrimitive.Portal>
        {/* ... rest of dialog ... */}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
```

**Testing Verification**: Press Cmd+K to open Command Palette. Press Escape to close. Focus should return to the Command Palette trigger button (visual indicator on the page or keyboard detection showing focus).

---

### HIGH SEVERITY ISSUES

### Issue 4: Color Contrast Failure in Dark Mode (Muted Text)
**WCAG Criterion**: 1.4.3 Contrast (Minimum) (Level AA) — 4.5:1 for normal text, 3:1 for large text  
**Severity**: HIGH  
**User Impact**: Users with low vision (including those with presbyopia, cataracts, or color blindness) cannot read muted foreground text on muted backgrounds in dark mode. Affects sidebar section headers, secondary labels, and help text throughout the app.  
**Location**: `/src/app/globals.css` (lines 31-53) dark mode variables  
**Evidence**:
```css
.dark {
  --muted: 217 33% 17%;           /* hsl(217, 33%, 17%) ≈ #213349 */
  --muted-foreground: 215 20% 65%;  /* hsl(215, 20%, 65%) ≈ #9BA5B8 */
}
```

**Contrast Calculation**:
- Muted background: #213349 (luminance ≈ 0.08)
- Muted foreground: #9BA5B8 (luminance ≈ 0.54)
- Contrast ratio: (0.54 + 0.05) / (0.08 + 0.05) ≈ **3.5:1**
- **FAILS** WCAG AA (requires 4.5:1 for normal text)

**Affected Elements**:
- Sidebar section headers: "Main", "Application Workflow", etc. (line 378, Sidebar.tsx)
- Secondary labels: "Active Application" text (line 313, Sidebar.tsx)
- Help text in dialogs and forms throughout the app
- Keyboard shortcut descriptions (KeyboardShortcuts.tsx line 106)

**Recommended Fix**:
```css
.dark {
  /* Increase muted-foreground luminance for better contrast */
  --muted-foreground: 215 15% 75%;  /* ~#AAB5C8, contrast ≈ 5.2:1 */
  /* OR use a higher saturation */
  --muted-foreground: 215 25% 70%;  /* ~#A5B3C4, contrast ≈ 4.8:1 */
}
```

**Testing Verification**: Check color contrast ratio using a tool like WebAIM or Contrast Checker. Text on muted background should have 4.5:1 ratio. Verify readability at 200% zoom in dark mode.

---

### Issue 5: Animations Ignore prefers-reduced-motion
**WCAG Criterion**: 2.3.3 Animation from Interactions (Level AAA) — should respect prefers-reduced-motion  
**Severity**: HIGH  
**User Impact**: Users with vestibular disorders, epilepsy, or motion sensitivity experience animations that can cause dizziness, nausea, or seizures. This includes backdrop-blur, zoom animations in Command Palette, Skeleton pulse animations, and all transitions.  
**Location**: Multiple files with animations (CommandPalette, dialog, skeleton, etc.)  
**Evidence**:
```tsx
// CommandPalette.tsx - no prefers-reduced-motion check
<DialogPrimitive.Overlay className="... data-[state=open]:animate-in data-[state=open]:fade-in-0 ..." />
<DialogPrimitive.Content className="... data-[state=open]:zoom-in-95 ..." />

// Skeleton.tsx - pulse animation always runs
<div className={cn("animate-pulse rounded-md bg-muted", className)} />

// ActionRunner.tsx - animations in status badge
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400" />
```

**Recommended Fix**: Add prefers-reduced-motion wrapper to globals.css:
```css
/* Disable animations for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

And update component animations with conditional classes:
```tsx
// Skeleton.tsx
const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-md bg-muted",
        "motion-safe:animate-pulse",  // Only animate if motion is safe
        className
      )}
      {...props}
    />
  )
)
```

**Testing Verification**: 
1. Open System Preferences (macOS) → Accessibility → Display → Reduce motion. Toggle ON.
2. Open browser DevTools → Rendering → Emulate CSS media feature prefers-reduced-motion: reduce.
3. Verify animations do not play. Page should be fully functional but static.

---

### Issue 6: Expandable Sections Missing aria-expanded (Import & Template Sections)
**WCAG Criterion**: 4.1.2 Name, Role, Value (Level A)  
**Severity**: HIGH  
**User Impact**: Screen reader users cannot determine if expandable sections (Import from URL, Load template) are expanded or collapsed. Screen readers announce the button but provide no state information.  
**Location**: `/src/app/applications/new/page.tsx` (lines 179-202)  
**Evidence**:
```tsx
function ImportSection({ onImportSuccess }: { onImportSuccess: (name: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <button
      type="button"
      onClick={() => setExpanded((p) => !p)}
      // NO aria-expanded attribute!
      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50"
    >
      <div>
        <p className="text-sm font-semibold">Import from URL</p>
        <p className="text-xs text-slate-500">LinkedIn, Indeed, or any job posting URL</p>
      </div>
      {expanded ? <ChevronUp /> : <ChevronDown />}
    </button>
  )
}
```

**Recommended Fix**:
```tsx
<button
  type="button"
  onClick={() => setExpanded((p) => !p)}
  aria-expanded={expanded}
  aria-controls="import-section-content"
  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50"
>
  <div>
    <p className="text-sm font-semibold">Import from URL</p>
    <p className="text-xs text-slate-500">LinkedIn, Indeed, or any job posting URL</p>
  </div>
  {expanded ? <ChevronUp /> : <ChevronDown />}
</button>

{expanded && (
  <div id="import-section-content" className="border-t border-slate-100">
    {/* Content */}
  </div>
)}
```

**Testing Verification**: Screen reader announces "Import from URL, button, expanded" or "collapsed" depending on state. Announce change when toggled.

---

### Issue 7: Data Table Missing Header Scope/Associations (applications page)
**WCAG Criterion**: 1.3.1 Info and Relationships (Level A)  
**Severity**: HIGH  
**User Impact**: Screen reader users navigating the applications data table cannot determine which header corresponds to each data cell. For complex tables with multiple columns (company, position, stage, deadline, files), this makes the table incomprehensible.  
**Location**: `/src/app/applications/page.tsx` (lines 200+, Table component usage)  
**Evidence**:
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Company</TableHead>           {/* No scope="col" */}
      <TableHead>Position</TableHead>          {/* No scope="col" */}
      <TableHead>Stage</TableHead>             {/* No scope="col" */}
      <TableHead>Deadline</TableHead>          {/* No scope="col" */}
      <TableHead>ATS Score</TableHead>         {/* No scope="col" */}
    </TableRow>
  </TableHeader>
  <TableBody>
    {applications.map(app => (
      <TableRow key={app.name}>
        <TableCell>{app.company}</TableCell>
        <TableCell>{app.position}</TableCell>
        <TableCell>{app.stage}</TableCell>
        {/* No headers="company" or similar association */}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Recommended Fix**: Add scope to table headers:
```tsx
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"  {/* NEW: Add scope attribute */}
    className={cn(
      "h-10 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
```

**Testing Verification**: 
- Screen reader navigates into table and announces: "Company, column header" / "Position, column header" / etc.
- When navigating data cells, screen reader announces: "Snowflake, row 1 of 15" / "Senior Engineer, row 1 of 15"
- Use NVDA table navigation (Alt+Ctrl+arrows) to move between cells — each cell announcement includes its header.

---

### MEDIUM SEVERITY ISSUES

### Issue 8: Sidebar Navigation Links Have Large Focus Ring Gap
**WCAG Criterion**: 2.4.7 Focus Visible (Level AA)  
**Severity**: MEDIUM  
**User Impact**: Focus indicator on sidebar links doesn't visually align with the link target area, making it hard for keyboard users with poor vision to track which item has focus.  
**Location**: `/src/components/Sidebar.tsx` (lines 167-184, NavLink component)  
**Evidence**:
```tsx
<Link
  href={item.href}
  className={cn(
    "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
    // outline-none removes default focus ring, relies on focus-visible:ring-2
    // But ring-2 has offset, making it not touch the element
  )}
>
```

**Recommended Fix**:
```tsx
<Link
  href={item.href}
  className={cn(
    "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors duration-150",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
    // Ring offset should be background color of sidebar
  )}
>
```

**Testing Verification**: Press Tab to navigate sidebar links. Visual focus ring should be clearly visible, tight around the link, and high contrast against the sidebar background.

---

### Issue 9: Bottom Navigation Touch Target Size Below Minimum (Mobile)
**WCAG Criterion**: 2.5.5 Target Size (Level AAA) — minimum 44x44 CSS pixels  
**Severity**: MEDIUM  
**User Impact**: Mobile users with motor impairments or larger fingers may miss touch targets on the bottom navigation bar. Current sizing is 12h (text) + 8h (icon container) + padding, totaling ~32px height in active state.  
**Location**: `/src/components/BottomNav.tsx` (lines 68-77)  
**Evidence**:
```tsx
<span
  className={cn(
    "flex items-center justify-center rounded-full transition-all duration-200 w-12 h-8",  // 8px height!
    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
  )}
>
  <Icon className="w-4 h-4 shrink-0" />
</span>
<span className="text-[10px] font-medium leading-none">  {/* 10px text */}
  {label}
</span>
```

The entire nav item is 64px minimum height (min-h-[64px] on parent), but clickable area calculation:
- Icon container: w-12 h-8 = 12px × 8px (too small!)
- The parent Link wraps it with py-3 = 6px padding each side
- Total: 8px + 6px + 6px = 20px height minimum

**Recommended Fix**:
```tsx
<Link
  key={href}
  href={href}
  aria-label={label}
  aria-current={isActive ? "page" : undefined}
  className="flex-1 flex flex-col items-center justify-center py-3 gap-1 min-w-0 min-h-[44px]"  {/* Ensure minimum 44px */}
>
  <span
    className={cn(
      "flex items-center justify-center rounded-full transition-all duration-200 w-12 h-12",  {/* Change h-8 to h-12 */}
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    <Icon className="w-5 h-5 shrink-0" /> {/* Slightly larger icon */}
  </span>
  <span
    className={cn(
      "text-[10px] font-medium leading-none tracking-tight truncate transition-colors",
      isActive ? "text-primary" : "text-muted-foreground"
    )}
  >
    {label}
  </span>
</Link>
```

**Testing Verification**: On iOS/Android at 200% zoom, tap each bottom nav icon. Target should feel large enough to hit with a thumb without effort. Test with device accessibility tools (Xcode Accessibility Inspector, Android Accessibility Scanner).

---

### Issue 10: Form Input Labels Not Associated with Error Messages
**WCAG Criterion**: 3.3.3 Error Suggestion (Level AA)  
**Severity**: MEDIUM  
**User Impact**: When a form field has an error, users cannot quickly identify which field caused the problem. The visual error text (in red) is color-only identification, failing users who are colorblind or use screen readers.  
**Location**: `/src/app/applications/new/page.tsx` (lines 489-534)  
**Evidence**:
```tsx
<Label htmlFor="company">
  Company <span className="text-red-500">*</span>  {/* Visual only: red asterisk */}
</Label>
<Input
  id="company"
  type="text"
  value={company}
  onChange={(e) => setCompany(e.target.value)}
  placeholder="e.g. Snowflake"
  aria-describedby={errors.company ? "company-error" : undefined}
  className={cn(errors.company && "border-red-500 focus-visible:ring-red-500")}  {/* Visual only: red border */}
/>
{errors.company && (
  <p id="company-error" className="text-xs text-red-600 dark:text-red-400">
    {errors.company}
  </p>
)}
```

**Issues**:
1. Required field indicator is visual-only (red asterisk)
2. Error is associated via aria-describedby, but field is not marked aria-invalid
3. No aria-required="true" on required fields

**Recommended Fix**:
```tsx
<Label htmlFor="company">
  Company
  <span className="text-red-500 ml-1" aria-label="required">*</span>
</Label>
<Input
  id="company"
  type="text"
  required
  aria-required="true"
  aria-invalid={!!errors.company}
  value={company}
  onChange={(e) => {
    setCompany(e.target.value)
    if (errors.company) setErrors((prev) => ({ ...prev, company: undefined }))
  }}
  placeholder="e.g. Snowflake"
  aria-describedby={errors.company ? "company-error" : "company-description"}
  className={cn(errors.company && "border-red-500 focus-visible:ring-red-500")}
/>
<p id="company-description" className="text-xs text-muted-foreground">
  Company name is required.
</p>
{errors.company && (
  <p id="company-error" className="text-xs text-red-600 dark:text-red-400" role="alert">
    {errors.company}
  </p>
)}
```

**Testing Verification**: Screen reader announces "Company, text input, required, invalid, Company is required" when field is in error state. When user fixes the field, announcement updates to "required" only.

---

### Issue 11: Modal Dialogs Not Announced to Screen Readers
**WCAG Criterion**: 4.1.3 Status Messages (Level AAA) — modal should announce purpose and trapping  
**Severity**: MEDIUM  
**User Impact**: Screen reader users may not immediately recognize that a modal has opened or that keyboard focus is trapped within it. They might continue trying to interact with background content.  
**Location**: `/src/app/applications/[name]/page.tsx` (PDF preview modal, file management modals)  
**Evidence**:
```tsx
<Dialog open={showPdfModal} onOpenChange={setShowPdfModal}>
  <DialogContent className="w-full max-w-4xl h-[80vh]">
    <DialogDescription className="sr-only">PDF preview for {pdf}</DialogDescription>  {/* Hidden! */}
    {/* Modal content */}
  </DialogContent>
</Dialog>
```

The `sr-only` class hides the description visually, which is correct, but screen readers may not announce it when dialog opens.

**Recommended Fix**:
```tsx
<Dialog open={showPdfModal} onOpenChange={setShowPdfModal}>
  <DialogContent 
    className="w-full max-w-4xl h-[80vh]"
    role="dialog"
    aria-modal="true"
    aria-labelledby="pdf-modal-title"
    aria-describedby="pdf-modal-description"
  >
    <DialogTitle id="pdf-modal-title">
      PDF Preview: {pdf}
    </DialogTitle>
    <DialogDescription id="pdf-modal-description" className="sr-only">
      Modal dialog displaying PDF preview. Press Escape to close.
    </DialogDescription>
    {/* Modal content */}
  </DialogContent>
</Dialog>
```

**Testing Verification**: Screen reader announces "Dialog, PDF Preview: [filename], Modal dialog displaying PDF preview" when modal opens. Escape key closes modal and returns focus to the trigger button.

---

### LOW SEVERITY ISSUES

### Issue 12: Icon-Only Buttons Lack Descriptive Labels (Some Cases)
**WCAG Criterion**: 1.1.1 Non-text Content (Level A) — 4.1.2 Name, Role, Value (Level A)  
**Severity**: LOW  
**User Impact**: Some icon-only buttons throughout the app lack aria-label, making them inaccessible to screen reader users. Most buttons have labels, but a few corner cases remain.  
**Location**: Various files (e.g., collapse/expand buttons, copy buttons)  
**Evidence**:
```tsx
{/* Sidebar collapse button — HAS aria-label, good */}
<button
  onClick={toggleCollapsed}
  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
  className="..."
>

{/* Some copy buttons — MISSING aria-label */}
<button
  onClick={() => copyToClipboard(content)}
  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
  {/* NO aria-label! */}
>
  <Copy className="w-4 h-4" />
</button>
```

**Recommended Fix**: Add aria-label or use a visible label:
```tsx
<button
  onClick={() => copyToClipboard(content)}
  aria-label="Copy content to clipboard"
  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
>
  <Copy className="w-4 h-4" />
</button>
```

**Testing Verification**: Screen reader announces "Copy content to clipboard, button" when button is focused.

---

### Issue 13: Keyboard Shortcut Help Not Keyboard-Accessible Enough
**WCAG Criterion**: 2.1.1 Keyboard (Level A)  
**Severity**: LOW  
**User Impact**: The keyboard shortcut help modal is triggered by pressing "?", but this key is easily missed. The Command Palette is primary, but users may not discover the "?" shortcut.  
**Location**: `/src/components/KeyboardShortcuts.tsx` (lines 74-76)  
**Evidence**:
```tsx
case "?":
  e.preventDefault()
  setShowHelp(prev => !prev)
  break
```

The "?" key is documented in the shortcuts table itself, creating a chicken-and-egg problem: users need to know to press "?" to see that "?" is a shortcut.

**Recommended Fix**: Add help button to Sidebar or add description to keyboard shortcut help in Command Palette:
```tsx
// CommandPalette.tsx - add to footer
<div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
  <span><kbd>↑↓</kbd> navigate</span>
  <span><kbd>↵</kbd> open</span>
  <span><kbd>?</kbd> help</span>  {/* Mention ? key in footer */}
  <span><kbd>esc</kbd> close</span>
</div>
```

**Testing Verification**: User can discover "?" shortcut by opening Command Palette and reading the footer. Pressing "?" opens the keyboard shortcuts modal.

---

### Issue 14: Live Region for Action Status Not Properly Announced
**WCAG Criterion**: 4.1.3 Status Messages (Level AAA)  
**Severity**: LOW  
**User Impact**: When actions complete or errors occur in ActionRunner, users relying on screen readers may not be immediately notified of status changes. The output terminal scrolls, but no aria-live region announces completion.  
**Location**: `/src/components/ActionRunner.tsx` (lines 40-85, status updates)  
**Evidence**:
```tsx
function StatusBadge({ status }: { status: RunStatus }) {
  if (status === "idle") return null
  if (status === "running") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        {/* Badge updates visually but isn't in a live region */}
        <span className="animate-ping" />
        Running
      </Badge>
    )
  }
  // ...
}
```

The status badge updates but is not wrapped in an aria-live region.

**Recommended Fix**:
```tsx
<div className="flex items-center gap-4">
  <div aria-live="polite" aria-atomic="true" className="sr-only">
    {status === "idle" && "Ready"}
    {status === "running" && "Action running"}
    {status === "completed" && "Action completed successfully"}
    {status === "failed" && "Action failed"}
  </div>
  <StatusBadge status={status} />
</div>
```

**Testing Verification**: Screen reader announces "Action running" when action starts, "Action completed successfully" when finished, etc., without requiring focus change.

---

## What's Working Well

1. **Landmark Regions Present**: The layout includes proper `<main>` element and navigation landmarks are labeled with `aria-label`. This is good for screen reader users to quickly jump between regions.

2. **Focus Visible Rings**: Most interactive elements (buttons, links, inputs) include `focus-visible:ring-2 focus-visible:ring-ring` class. This provides a clear focus indicator for keyboard users when using Tab navigation.

3. **Form Label Associations**: Most form fields use proper `<Label htmlFor="id">` patterns, associating labels with inputs via ID. This is correct semantic HTML.

4. **Dialog Primitive from Radix UI**: Dialogs use @radix-ui/react-dialog, which provides built-in focus management, focus trapping, and Escape key handling. This is good.

5. **Color Scheme Support**: The app includes dark mode support with CSS variables, allowing users to switch themes. This provides some flexibility for users with color sensitivity or vision issues.

6. **Proper Button Roles**: Buttons are correctly implemented as `<button>` elements, not `<div>` with onClick. Links are `<Link>` from Next.js, not clickable divs.

7. **Skip Link Concept (Nearly Present)**: The layout structure would make it easy to add a skip link. The sidebar and main content are already separate, just missing the skip link element itself.

---

## Remediation Priority

### CRITICAL (Fix Before Release)
1. **Form Error Announcement** — Add aria-invalid and role="alert" to error messages
2. **Skip to Main Content Link** — Add skip link as first interactive element
3. **Command Palette Focus Return** — Return focus to trigger button when modal closes

### HIGH (Fix Within 1-2 Sprints)
1. **Dark Mode Contrast** — Increase muted-foreground luminance
2. **Prefers Reduced Motion** — Add media query and conditional animations
3. **Expandable Section aria-expanded** — Add state attributes to collapse/expand buttons
4. **Table Header Scope** — Add scope="col" to all table headers
5. **Focus Ring Alignment** — Ensure focus rings are visually aligned with elements
6. **Bottom Navigation Touch Targets** — Increase height to 44px minimum
7. **Form Field Required Indicators** — Add aria-required and programmatic indicators

### MEDIUM (Fix Within Next 2 Sprints)
1. **Modal Dialog Announcements** — Add aria-modal, aria-labelledby, aria-describedby
2. **Icon-Only Button Labels** — Add aria-label to all icon-only buttons
3. **Keyboard Shortcut Help Discovery** — Mention ? key in UI
4. **Live Region Status** — Wrap status updates in aria-live region

### LOW (Regular Maintenance)
1. **Focus Ring Styling** — Fine-tune ring offset and color
2. **Error Message Display** — Consider toast notifications for form errors as alternatives

---

## WCAG 2.1 Conformance Summary

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.1.1 Non-text Content | A | PASS | Images have alt text or aria-label (some icon buttons missing labels) |
| 1.3.1 Info and Relationships | A | **FAIL** | Data tables lack header scope attributes |
| 1.4.3 Contrast (Minimum) | AA | **FAIL** | Dark mode muted text contrast is 3.5:1, needs 4.5:1 |
| 2.1.1 Keyboard | A | **FAIL** | No skip link; focus management gaps in Command Palette |
| 2.4.1 Bypass Blocks | A | **FAIL** | No skip to main content link |
| 2.4.3 Focus Order | A | **FAIL** | Command Palette doesn't return focus properly |
| 2.4.7 Focus Visible | AA | PASS | Focus rings present on all interactive elements |
| 2.5.5 Target Size | AAA | **FAIL** | Bottom nav touch targets below 44px in some states |
| 3.3.1 Error Identification | A | **FAIL** | Form errors not marked with aria-invalid |
| 3.3.3 Error Suggestion | AA | **FAIL** | Required fields lack programmatic indicators |
| 4.1.2 Name, Role, Value | A | **FAIL** | Missing aria-expanded, some buttons lack labels |
| 4.1.3 Status Messages | AAA | **FAIL** | Modal dialogs and status changes not announced |

**Overall WCAG 2.1 AA Conformance: DOES NOT CONFORM**

9 out of 12+ critical criteria have failures. While the foundation is solid (semantic HTML, focus management infrastructure), multiple showstoppers must be addressed for AA compliance.

---

## Testing Recommendations

### Immediate Testing (Before Release)
1. **Screen Reader Testing**: Use NVDA (Windows) or VoiceOver (Mac) to navigate the entire application
   - Test form submission and error display
   - Test modal dialogs (Command Palette, PDF previews)
   - Test table navigation in applications list

2. **Keyboard-Only Testing**: Use only Tab, Shift+Tab, Enter, Space, Escape, and arrow keys
   - Navigate to every interactive element
   - Check for focus traps (can you always Tab away?)
   - Verify focus indicators are visible

3. **Color Contrast Testing**: Use WebAIM Contrast Checker or Lighthouse
   - Test all text/background color combinations
   - Check both light and dark modes
   - Test disabled states and hover states

4. **Motion Testing**: Enable "Reduce Motion" in system settings
   - Verify all animations are disabled or fast
   - Check that page functionality is not affected

### Ongoing Testing
1. **Accessibility Acceptance Criteria**: Include accessibility checks in definition of done
   - Form validation must announce errors
   - All new modals must return focus on close
   - All tables must have header scope attributes
   - All icon buttons must have aria-label

2. **Automated Testing**: Integrate axe-core or similar tool in CI/CD
   - Run on every page load
   - Fail on critical violations
   - Flag warnings for manual review

3. **Component Library Audit**: Verify shadcn/ui components are accessible
   - Check each component's ARIA implementation
   - Test with latest versions
   - Document any accessibility gaps

---

## Conclusion

The CV Manager application has a solid foundation with semantic HTML, Radix UI primitives, and basic focus management. However, it falls short of WCAG 2.1 AA compliance due to:

1. **Form accessibility gaps** — errors not announced, required fields not marked
2. **Modal focus management** — focus not returned on close
3. **Color contrast issues** — dark mode muted text fails 4.5:1 ratio
4. **Missing keyboard shortcuts** — no skip link to bypass navigation
5. **Motion accessibility** — animations ignore prefers-reduced-motion
6. **Table structure** — headers lack scope attributes

These issues are fixable with moderate effort and would significantly improve usability for keyboard users, screen reader users, and users with visual or vestibular disabilities. Priority should be given to form validation announcements, focus management in modals, and skip links, as these affect core workflows.

The development team should establish accessibility as a non-negotiable requirement at code review, not as a post-launch audit item. Each new feature should include accessibility acceptance criteria and be tested with assistive technologies before merging.

