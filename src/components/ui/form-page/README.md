# Form Page Component

A full-screen form page component that slides in from the right side of the screen, providing a dedicated space for form interactions.

## Features

- Smooth slide-in/out animation from the right side of the screen
- Responsive design that works on both mobile and desktop
- Form fields span the full panel content width (same as tabbed forms)
- Keyboard accessibility (Escape key closes the form page)
- Focus management for improved accessibility
- Fixed footer for action buttons (like save and cancel)
- Scrollable content area for forms of any length
- Same styling as modals for visual consistency
- **NEW**: Optional tabbed interface with icons and labels
- **NEW**: Support for both Lucide icons and custom images
- **NEW**: Clean, soft button styling for tabs
- **NEW**: Both controlled and uncontrolled tab modes

## Components

The Form Page system consists of four main components:

1. `FormPage` - The main container that slides in from the right
2. `FormPageHeader` - The header section with title, description, and close button
3. `FormPageContent` - The scrollable content area for the form
4. `FormPageFooter` - The fixed footer for action buttons

## Props

### FormPage Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | Required | Whether the form page is open |
| `onClose` | `() => void` | Required | Function to call when the form page should be closed |
| `title` | `string` | Required | The title displayed in the header |
| `description` | `string` | `undefined` | Optional description displayed below the title |
| `children` | `ReactNode` | `undefined` | Content of the form page (used when tabs are not provided) |
| `tabs` | `FormPageTab[]` | `undefined` | Optional tabs configuration for tabbed form views |
| `activeTab` | `string` | `undefined` | Active tab ID (controlled mode) |
| `onTabChange` | `(tabId: string) => void` | `undefined` | Callback when tab changes (controlled mode) |
| `defaultActiveTab` | `string` | `undefined` | Default active tab ID (uncontrolled mode) |
| `className` | `string` | `undefined` | Additional CSS classes to apply to the form page |

### FormPageTab Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | Required | Unique identifier for the tab |
| `label` | `string` | Required | Label text for the tab |
| `icon` | `LucideIcon` | `undefined` | Optional Lucide icon for the tab |
| `imageSrc` | `string` | `undefined` | Optional image source for custom icon |
| `imageAlt` | `string` | `undefined` | Optional alt text for image icon |
| `notificationCount` | `number` | `undefined` | Optional notification count to display as a red badge |
| `content` | `ReactNode` | Required | Content to display when this tab is active |

### FormPageHeader Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | Required | The title displayed in the header |
| `description` | `string` | `undefined` | Optional description displayed below the title |
| `onClose` | `() => void` | `undefined` | Optional function to call when the form page should be closed (not used in the header anymore) |
| `className` | `string` | `undefined` | Additional CSS classes for the header |

### FormPageContent Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | Required | Content of the form page |
| `className` | `string` | `undefined` | Additional CSS classes for the content area |

### FormPageFooter Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | Required | Content of the footer (typically action buttons) |
| `className` | `string` | `undefined` | Additional CSS classes for the footer |

## Usage Examples

### Basic Usage

```tsx
import { useState } from 'react';
import { FormPage, FormPageContent, FormPageFooter } from '@/src/components/ui/form-page';
import { Button } from '@/src/components/ui/button';

export function MyForm() {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission
    setIsOpen(false);
  };
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Form
      </Button>
      
      <FormPage
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="My Form"
        description="Please fill out the form below"
      >
        <FormPageContent>
          <form onSubmit={handleSubmit}>
            {/* Form fields go here */}
            <div className="space-y-4">
              <div>
                <label>Name</label>
                <input type="text" />
              </div>
              <div>
                <label>Email</label>
                <input type="email" />
              </div>
            </div>
          </form>
        </FormPageContent>
        
        <FormPageFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit}>
            Save
          </Button>
        </FormPageFooter>
      </FormPage>
    </>
  );
}
```

### Tabbed Usage (Uncontrolled)

```tsx
import { useState } from 'react';
import { FormPage, FormPageFooter } from '@/src/components/ui/form-page';
import { FormPageTab } from '@/src/components/ui/form-page/form-page.types';
import { Button } from '@/src/components/ui/button';
import { User, Settings, Bell } from 'lucide-react';

export function MyTabbedForm() {
  const [isOpen, setIsOpen] = useState(false);
  
  const tabs: FormPageTab[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      content: (
        <div className="space-y-4">
          <div>
            <label>Name</label>
            <input type="text" />
          </div>
          <div>
            <label>Email</label>
            <input type="email" />
          </div>
        </div>
      )
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      content: (
        <div className="space-y-4">
          <div>
            <label>Theme</label>
            <select>
              <option>Light</option>
              <option>Dark</option>
            </select>
          </div>
        </div>
      )
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      content: (
        <div className="space-y-4">
          <div>
            <input type="checkbox" id="email-notifications" />
            <label htmlFor="email-notifications">Email notifications</label>
          </div>
        </div>
      )
    }
  ];
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Tabbed Form
      </Button>
      
      <FormPage
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="User Settings"
        tabs={tabs}
        defaultActiveTab="profile"
      >
        <FormPageFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setIsOpen(false)}>
            Save Changes
          </Button>
        </FormPageFooter>
      </FormPage>
    </>
  );
}
```

### Tabbed Usage (Controlled)

```tsx
import { useState } from 'react';
import { FormPage, FormPageFooter } from '@/src/components/ui/form-page';
import { FormPageTab } from '@/src/components/ui/form-page/form-page.types';
import { Button } from '@/src/components/ui/button';
import { User, Settings } from 'lucide-react';

export function MyControlledTabbedForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  const tabs: FormPageTab[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      content: <div>Profile content...</div>
    },
    {
      id: 'settings',
      label: 'Settings',
      imageSrc: '/settings-icon.png',
      imageAlt: 'Settings',
      content: <div>Settings content...</div>
    }
  ];
  
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // You can add additional logic here, like validation
  };
  
  return (
    <FormPage
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Controlled Tabs"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      <FormPageFooter>
        <Button onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </FormPageFooter>
    </FormPage>
  );
}
```

### Tabbed Usage with Notification Badges

```tsx
import { useState } from 'react';
import { FormPage, FormPageFooter } from '@/src/components/ui/form-page';
import { FormPageTab } from '@/src/components/ui/form-page/form-page.types';
import { Button } from '@/src/components/ui/button';
import { Bell, Mail, AlertTriangle } from 'lucide-react';

export function MyNotificationForm() {
  const [isOpen, setIsOpen] = useState(false);
  
  const tabs: FormPageTab[] = [
    {
      id: 'alerts',
      label: 'Alerts',
      icon: AlertTriangle,
      notificationCount: 3, // Shows "3" in red badge
      content: <div>3 urgent alerts need attention...</div>
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: Mail,
      notificationCount: 12, // Shows "12" in red badge
      content: <div>12 unread messages...</div>
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      notificationCount: 150, // Shows "99+" in red badge (capped at 99+)
      content: <div>150 notifications...</div>
    }
  ];
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Notifications
      </Button>
      
      <FormPage
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Notification Center"
        tabs={tabs}
        defaultActiveTab="alerts"
      >
        <FormPageFooter>
          <Button onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </FormPageFooter>
      </FormPage>
    </>
  );
}
```

## Implementation Details

The Form Page component is built using:

- React's `useEffect` for handling keyboard events and body scroll locking
- Tailwind CSS for styling with smooth transitions
- Lucide React for icons
- Class Variance Authority (CVA) for style variants

The component follows a modular structure:
- `index.tsx` - Main component implementation
- `form-page.styles.ts` - Style definitions
- `form-page.types.ts` - TypeScript type definitions

## Accessibility

The Form Page component includes:
- Proper ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-label`)
- Keyboard navigation support (Escape key closes the form page)
- Focus management
- Sufficient color contrast for text and interactive elements
- Touch-friendly target sizes for mobile users

## Mobile Considerations (React Native)

When adapting this component for React Native, consider the following:

- **Animations**: Replace CSS transitions with React Native's Animated API
- **Overlay**: Use React Native's Modal component with a semi-transparent background
- **Touch Handling**: Implement gesture handling for swipe-to-close functionality
- **Keyboard Events**: Use React Native's specific keyboard event handling
- **Styling**: Convert Tailwind classes to React Native StyleSheet or NativeWind

This component follows the project's cross-platform compatibility guidelines by:
1. Keeping the core logic separate from styling
2. Using a modular structure that can be adapted for different platforms
3. Implementing touch-friendly interactions that work well on mobile
4. Providing clear documentation for platform-specific adaptations
