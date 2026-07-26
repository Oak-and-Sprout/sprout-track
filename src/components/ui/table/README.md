# Table Component

A comprehensive table component system with modern styling, dark mode support, enhanced features, and full TypeScript support. Built with clean, rounded edges and consistent theming that matches the application design.

## Features

- Modern, clean design with soft rounded edges
- Full dark mode support
- Responsive design with horizontal scrolling
- Hover effects and selection states
- TypeScript support with proper type definitions
- Accessible markup with proper ARIA attributes
- Modular component structure
- **Enhanced features:**
  - Search functionality with real-time filtering
  - Pagination with customizable page sizes
  - Page size selector with configurable options
  - Smart page number generation
  - **Tab navigation with badge counts**
  - Loading and disabled states

## Components

The Table system consists of twelve main components:

### Core Table Components
1. `Table` - The main table container with overflow handling
2. `TableHeader` - The header section (`<thead>`)
3. `TableBody` - The body section (`<tbody>`)
4. `TableFooter` - The footer section (`<tfoot>`)
5. `TableRow` - Table rows (`<tr>`)
6. `TableHead` - Header cells (`<th>`)
7. `TableCell` - Data cells (`<td>`)
8. `TableCaption` - Table caption

### Enhanced Table Components
9. `TableSearch` - Search input with icon and filtering capabilities
10. `TableTabs` - Tab navigation with badge counts and state management
11. `TablePagination` - Full pagination controls with navigation buttons
12. `TablePageSize` - Page size selector dropdown

## Basic Usage

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

export function BasicTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>John Doe</TableCell>
          <TableCell>john@example.com</TableCell>
          <TableCell>Admin</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Jane Smith</TableCell>
          <TableCell>jane@example.com</TableCell>
          <TableCell>User</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
```

## Enhanced Table with Tabs, Search and Pagination

```tsx
import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSearch,
  TableTabs,
  TablePagination,
  TablePageSize,
} from "@/src/components/ui/table";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
}

export function EnhancedTableWithTabs() {
  const [data, setData] = useState<User[]>([
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'active' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'inactive' },
    // ... more data
  ]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState('all');

  // Define tabs with counts
  const tabs = [
    { 
      id: 'all', 
      label: 'All Users',
      count: data.length 
    },
    { 
      id: 'active', 
      label: 'Active',
      count: data.filter(user => user.status === 'active').length 
    },
    { 
      id: 'inactive', 
      label: 'Inactive',
      count: data.filter(user => user.status === 'inactive').length 
    },
  ];

  // Filter data based on active tab and search term
  const filteredData = useMemo(() => {
    let filtered = data;
    
    // Filter by tab
    if (activeTab === 'active') {
      filtered = filtered.filter(user => user.status === 'active');
    } else if (activeTab === 'inactive') {
      filtered = filtered.filter(user => user.status === 'inactive');
    }
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [data, activeTab, searchTerm]);

  // Calculate pagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  // Reset to first page when search term, tab, or page size changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, pageSize]);

  return (
    <div>
      {/* Tabs */}
      <TableTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Search */}
      <TableSearch
        value={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search users..."
      />

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  user.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {user.status}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination and Page Size */}
      <div className="flex items-center justify-between">
        <TablePageSize
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
        
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
```

## Props

### Core Table Components

All core table components extend their respective HTML element props:

- `Table` - Extends `React.TableHTMLAttributes<HTMLTableElement>`
- `TableHeader` - Extends `React.HTMLAttributes<HTMLTableSectionElement>`
- `TableBody` - Extends `React.HTMLAttributes<HTMLTableSectionElement>`
- `TableFooter` - Extends `React.HTMLAttributes<HTMLTableSectionElement>`
- `TableRow` - Extends `React.HTMLAttributes<HTMLTableRowElement>`
- `TableHead` - Extends `React.ThHTMLAttributes<HTMLTableCellElement>`. Also accepts `sortable?: boolean`, `sortDirection?: 'asc' | 'desc' | null`, and `onSort?: () => void`. When `sortable` is set, the header content is rendered inside a visually transparent native `<button type="button">` so sorting is keyboard-accessible (Tab + Enter/Space) with a focus-visible ring; `aria-sort` is set on the `<th>` and the sort chevron icons are `aria-hidden`. Clicking anywhere in the cell (including padding) still triggers `onSort`.
- `TableCell` - Extends `React.TdHTMLAttributes<HTMLTableCellElement>`
- `TableCaption` - Extends `React.HTMLAttributes<HTMLTableCaptionElement>`

### Enhanced Table Components

#### TableSearch Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | Required | Current search value |
| `onSearchChange` | `(value: string) => void` | Required | Callback when search value changes |
| `placeholder` | `string` | `"Search..."` | Placeholder text for the search input |
| `disabled` | `boolean` | `false` | Whether the search is disabled |
| `className` | `string` | `undefined` | Additional CSS classes |

#### TableTabs Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | `TableTab[]` | Required | Array of tab definitions |
| `activeTab` | `string` | Required | Currently active tab ID |
| `onTabChange` | `(tabId: string) => void` | Required | Callback when tab changes |
| `disabled` | `boolean` | `false` | Whether tabs are disabled |
| `className` | `string` | `undefined` | Additional CSS classes |

#### TableTab Interface

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | `string` | Required | Unique identifier for the tab |
| `label` | `string` | Required | Display label for the tab |
| `count` | `number` | `undefined` | Optional badge count to display |
| `disabled` | `boolean` | `false` | Whether the tab is disabled |

#### TablePagination Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `currentPage` | `number` | Required | Current page number (1-based) |
| `totalPages` | `number` | Required | Total number of pages |
| `totalItems` | `number` | Required | Total number of items |
| `pageSize` | `number` | Required | Number of items per page |
| `onPageChange` | `(page: number) => void` | Required | Callback when page changes |
| `disabled` | `boolean` | `false` | Whether pagination is disabled |
| `className` | `string` | `undefined` | Additional CSS classes |

#### TablePageSize Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pageSize` | `number` | Required | Current page size |
| `onPageSizeChange` | `(pageSize: number) => void` | Required | Callback when page size changes |
| `pageSizeOptions` | `number[]` | `[5, 10, 20, 50, 100]` | Available page size options |
| `disabled` | `boolean` | `false` | Whether page size selector is disabled |
| `className` | `string` | `undefined` | Additional CSS classes |

## Implementation Patterns

### Tab-Based Data Filtering

```tsx
function useTabDataFiltering<T>(
  data: T[], 
  activeTab: string, 
  filterFn: (item: T, tabId: string) => boolean
) {
  return useMemo(() => {
    return data.filter(item => filterFn(item, activeTab));
  }, [data, activeTab, filterFn]);
}

// Usage
const tabFilteredData = useTabDataFiltering(
  users, 
  activeTab, 
  (user, tabId) => {
    if (tabId === 'all') return true;
    if (tabId === 'active') return user.status === 'active';
    if (tabId === 'inactive') return user.status === 'inactive';
    return false;
  }
);
```

### Dynamic Tab Counts

```tsx
function useDynamicTabCounts<T>(data: T[], countFn: (item: T) => string) {
  return useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach(item => {
      const category = countFn(item);
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [data, countFn]);
}

// Usage
const tabCounts = useDynamicTabCounts(users, (user) => user.status);
const tabs = [
  { id: 'all', label: 'All Users', count: users.length },
  { id: 'active', label: 'Active', count: tabCounts.active || 0 },
  { id: 'inactive', label: 'Inactive', count: tabCounts.inactive || 0 },
];
```

### Data Filtering and Pagination Logic

```tsx
function useTableData<T>(data: T[], searchTerm: string, pageSize: number, currentPage: number, filterFn: (item: T, search: string) => boolean) {
  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(item => filterFn(item, searchTerm));
  }, [data, searchTerm, filterFn]);

  // Calculate pagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  return {
    filteredData,
    paginatedData,
    totalItems,
    totalPages,
  };
}
```

### Search Filter Functions

```tsx
// Generic search function for objects
const createSearchFilter = <T>(searchFields: (keyof T)[]) => 
  (item: T, searchTerm: string): boolean => {
    const search = searchTerm.toLowerCase();
    return searchFields.some(field => 
      String(item[field]).toLowerCase().includes(search)
    );
  };

// Usage
const userSearchFilter = createSearchFilter<User>(['name', 'email', 'role']);
```

## Styling

The enhanced table components use Tailwind CSS with a clean, modern design:

### Design Features
- Tab navigation with active state styling and badge counts
- Search input with search icon and proper focus states
- Pagination with first/last and previous/next navigation
- Smart page number display (shows up to 5 page numbers)
- Page size selector with dropdown
- Consistent spacing and typography
- Hover effects and disabled states
- Loading state support

### Color Scheme
- Light mode: White background with gray accents and teal highlights
- Dark mode: Dark gray background with appropriate contrast
- Tabs: Gray background with white/dark active states and teal badge highlights
- Search: Subtle borders with focus highlighting
- Pagination: Outlined buttons with active state highlighting
- Page size: Integrated dropdown styling

## Accessibility

The enhanced table components follow accessibility best practices:
- Proper semantic HTML structure
- ARIA labels and descriptions where appropriate
- Keyboard navigation for all interactive elements (including tabs)
- Focus indicators for buttons, inputs, and tab triggers
- Screen reader friendly text for pagination and tab information
- Sortable column headers use a native button with `aria-sort` on the `<th>` and keyboard activation
- Icon-only pagination buttons have localized `aria-label`s (First/Previous/Next/Last page) and `aria-current="page"` on the active page button; decorative icons are `aria-hidden`
- Sufficient color contrast in both themes
- Tab badge counts announced to screen readers

## Best Practices

1. **Always implement search and tab reset when dependencies change**
2. **Use useMemo for expensive filtering operations**
3. **Provide meaningful search placeholders**
4. **Consider server-side pagination for large datasets**
5. **Implement loading states during data fetching**
6. **Use TypeScript for type-safe filtering functions**
7. **Test keyboard navigation thoroughly (including tab switching)**
8. **Provide appropriate page size options for your use case**
9. **Keep tab counts updated when data changes**
10. **Use descriptive tab labels and consider accessibility**

## Mobile Considerations

The enhanced table features are designed with mobile in mind:
- Tab navigation is touch-friendly with appropriate touch targets
- Tab scrolling on narrow screens
- Search input is responsive and touch-friendly
- Pagination buttons have appropriate touch targets
- Page size selector works well on mobile devices
- Horizontal scrolling is maintained for the table content
- Consider showing fewer page numbers on very small screens
- Tab badges remain visible and readable on mobile

## Cross-Platform Notes

When adapting for React Native:
- Convert tab navigation to React Native pressable components
- Convert search input to React Native TextInput
- Replace pagination buttons with TouchableOpacity
- Use React Native Picker for page size selection
- Implement proper scrolling behavior for mobile
- Consider alternative navigation patterns for very small screens
- Adapt tab styling to platform-specific design patterns 