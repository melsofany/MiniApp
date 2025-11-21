# Design Guidelines: ID Card Processing System

## Design Approach
**System-Based Approach** - This utility-focused application prioritizes efficiency, data clarity, and performance. Drawing from Material Design principles for data-heavy applications with custom adaptations for Arabic RTL layout and administrative workflows.

## Core Design Principles
- **Clarity First**: Every element serves a functional purpose
- **Data Hierarchy**: Clear visual separation between primary data, actions, and metadata
- **RTL-Optimized**: Full right-to-left support for Arabic interface
- **Efficiency**: Minimize clicks, maximize information density without clutter
- **Status Clarity**: Immediate visual feedback for all operations

---

## Typography System

### Font Family
- **Primary**: Cairo (Google Fonts) - excellent Arabic support with clean Latin characters
- **Monospace**: JetBrains Mono - for IDs, numbers, technical data

### Hierarchy
- **Page Titles**: text-2xl font-bold (Dashboard, إحصائيات المراكز)
- **Section Headers**: text-xl font-semibold (قائمة المندوبين, سجل البطاقات)
- **Card Titles**: text-lg font-medium
- **Body Text**: text-base font-normal
- **Metadata/Labels**: text-sm text-gray-600
- **Stats/Numbers**: text-3xl font-bold (large metrics)

---

## Layout System

### Spacing Primitives
Use Tailwind units: **2, 4, 6, 8, 12, 16** for consistent rhythm
- Component padding: p-4, p-6
- Section spacing: space-y-6, space-y-8
- Card gaps: gap-4, gap-6
- Page margins: px-4 md:px-8

### Grid Structure
- **Dashboard**: Sidebar (w-64) + Main Content (flex-1)
- **Mini App**: Single column, full-width mobile-first
- **Stats Grid**: grid-cols-1 md:grid-cols-3 (for 3 centers)
- **Tables**: Full-width with horizontal scroll on mobile

---

## Component Library

### 1. Authentication
**Login Page**
- Centered card (max-w-md mx-auto)
- Logo/title at top
- Single password field with eye icon toggle
- Primary action button (full-width)
- Minimal, focused layout

### 2. Dashboard Layout
**Sidebar Navigation** (Right side for RTL)
- Logo/system name at top
- Navigation items with icons (Heroicons)
- Active state: background highlight
- Logout at bottom

**Main Content Area**
- Top bar: Page title + user info + timestamp
- Content grid below

### 3. Statistics Cards
**Center Overview Cards** (3 cards for طما، طهطا، جهينة)
- Center name as header
- Large number (total operations)
- Trend indicator if applicable
- Subtle border, rounded corners (rounded-lg)

**Chart Container**
- Title: "العمليات اليومية حسب المراكز"
- Use Chart.js or Recharts for bar/line charts
- Color coding per center (consistent throughout)
- Legend with center names

### 4. Data Tables
**Representatives Table (قائمة المندوبين)**
Columns: USER_ID, USERNAME, المركز, STATUS, DATE_ADDED, إجراءات
- Header row: font-semibold bg-gray-50
- Zebra striping: odd:bg-white even:bg-gray-50
- Badges for center (rounded-full px-3 py-1)
- Action buttons (edit/delete) as icon buttons

**Cards Registry Table (سجل البطاقات)**
Columns: الاسم, الرقم القومي, المُدخِل, المركز, التاريخ
- Searchable/filterable by center
- Pagination controls at bottom

### 5. Forms
**Add Representative Modal/Form**
- Input: User ID (text-input)
- Input: Username (text-input)
- Dropdown: Select center (طما / طهطا / جهينة) with visual icons/colors
- Toggle: Active status
- Actions: Save (primary) + Cancel (secondary)
- Form layout: space-y-4

### 6. Mini App Interface
**Camera Capture Screen**
- Full viewport camera preview
- Capture button: Large, circular, bottom-center
- Instructions overlay at top (semi-transparent)
- Cancel/back button top-right

**Processing State**
- Centered spinner
- Progress text: "جاري معالجة الصورة..."
- Estimated time remaining

**Success/Error States**
- Success: Green checkmark icon, extracted data display
- Error: Red warning icon, retry button
- Duplicate detection: Warning message with original submitter info

### 7. Buttons & Actions
- **Primary**: Solid background, rounded-lg, px-6 py-3
- **Secondary**: Border, transparent background
- **Danger**: Red variant for delete
- **Icon Buttons**: p-2 rounded-md for compact actions

### 8. Status Indicators
- **Active User**: Green dot + "نشط"
- **Inactive**: Gray dot + "غير نشط"
- **Processing**: Yellow spinner
- **Success**: Green checkmark
- **Error**: Red X

---

## Color Strategy
*Colors not specified - to be defined later. Focus on semantic naming:*
- Primary (CTAs, active states)
- Success (completed operations)
- Warning (duplicates)
- Danger (delete, errors)
- Neutral grays (backgrounds, borders, text hierarchy)

---

## Responsive Strategy

### Dashboard (Desktop-First)
- Min-width: 1024px optimal
- Sidebar collapses to icons on md breakpoint
- Tables scroll horizontally on mobile

### Mini App (Mobile-First)
- Full viewport utilization
- Touch-friendly buttons (min 44px height)
- Stack all elements vertically
- Camera uses full available space

---

## Accessibility
- All form inputs with labels
- ARIA labels for icon-only buttons
- Keyboard navigation support
- Focus visible states on all interactive elements
- Color contrast minimum WCAG AA

---

## Performance Considerations
- Lazy load charts/heavy components
- Paginate tables (50 rows per page)
- Image compression before upload
- Skeleton loaders for async data
- Optimistic UI updates where safe