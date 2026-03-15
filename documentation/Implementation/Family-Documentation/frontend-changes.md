# Frontend Changes for Multi-Family Support

This document outlines the necessary changes to the frontend application to support multi-family functionality. These changes will enable users to select and switch between families, and ensure that all UI components display family-specific data.

## Core Changes

### 1. Family Context Provider

Create a new context provider to manage family state across the application:

```tsx
// app/context/family.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Family } from '@prisma/client';

interface FamilyContextType {
  selectedFamily: Family | null;
  setSelectedFamily: (family: Family | null) => void;
  families: Family[];
  setFamilies: (families: Family[]) => void;
  isLoading: boolean;
}

const FamilyContext = createContext<FamilyContextType>({
  selectedFamily: null,
  setSelectedFamily: () => {},
  families: [],
  setFamilies: () => {},
  isLoading: true,
});

interface FamilyProviderProps {
  children: React.ReactNode;
}

export function FamilyProvider({ children }: FamilyProviderProps) {
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedFamily');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });

  const [families, setFamilies] = useState<Family[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch available families for the current user
  useEffect(() => {
    const fetchFamilies = async () => {
      try {
        setIsLoading(true);
        const authToken = localStorage.getItem('authToken');
        
        if (!authToken) return;
        
        const response = await fetch('/api/families', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setFamilies(data.data);
            
            // If no family is selected and we have families, select the first one
            if (!selectedFamily && data.data.length > 0) {
              setSelectedFamily(data.data[0]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching families:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFamilies();
  }, []);

  // Persist selected family
  useEffect(() => {
    if (selectedFamily) {
      localStorage.setItem('selectedFamily', JSON.stringify(selectedFamily));
      
      // Update URL when selected family changes
      const url = new URL(window.location.href);
      const pathParts = url.pathname.split('/');
      
      // If the path already has a family slug, replace it
      if (pathParts.length > 1 && pathParts[1] !== '') {
        pathParts[1] = selectedFamily.slug;
      } else {
        // Otherwise, add the family slug
        pathParts.splice(1, 0, selectedFamily.slug);
      }
      
      const newPath = pathParts.join('/');
      window.history.replaceState({}, '', `${newPath}${url.search}`);
    }
  }, [selectedFamily]);

  return (
    <FamilyContext.Provider value={{ 
      selectedFamily, 
      setSelectedFamily, 
      families, 
      setFamilies,
      isLoading
    }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}
```

### 2. Update Auth Flow

Modify the authentication flow to include family selection:

```tsx
// src/components/LoginSecurity/index.tsx
// Add family selection after successful authentication

// After successful login
const handleSuccessfulLogin = async (data) => {
  // Store auth token and caretaker info as before
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('caretakerId', data.id);
  localStorage.setItem('unlockTime', Date.now().toString());
  
  // Fetch available families
  try {
    const familiesResponse = await fetch('/api/families', {
      headers: {
        'Authorization': `Bearer ${data.token}`
      }
    });
    
    if (familiesResponse.ok) {
      const familiesData = await familiesResponse.json();
      
      if (familiesData.success && familiesData.data.length > 0) {
        // If user has only one family, select it automatically
        if (familiesData.data.length === 1) {
          localStorage.setItem('selectedFamily', JSON.stringify(familiesData.data[0]));
          onUnlock(data.id);
        } else {
          // Show family selection UI
          setFamilies(familiesData.data);
          setShowFamilySelection(true);
        }
      } else {
        // No families available, redirect to family creation
        setShowFamilyCreation(true);
      }
    }
  } catch (error) {
    console.error('Error fetching families:', error);
    // Continue with login anyway
    onUnlock(data.id);
  }
};

// Add family selection UI
{showFamilySelection && (
  <div className="family-selection">
    <h3>Select a Family</h3>
    <div className="family-list">
      {families.map(family => (
        <button
          key={family.id}
          className="family-item"
          onClick={() => {
            localStorage.setItem('selectedFamily', JSON.stringify(family));
            setShowFamilySelection(false);
            onUnlock(caretakerId);
          }}
        >
          {family.name}
        </button>
      ))}
    </div>
  </div>
)}

// Add family creation UI
{showFamilyCreation && (
  <div className="family-creation">
    <h3>Create a Family</h3>
    <form onSubmit={handleFamilyCreate}>
      <input
        type="text"
        placeholder="Family Name"
        value={familyName}
        onChange={(e) => setFamilyName(e.target.value)}
        required
      />
      <button type="submit">Create Family</button>
    </form>
  </div>
)}
```

### 3. Family Selector Component

Create a component for switching between families:

```tsx
// src/components/FamilySelector/index.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFamily } from '@/app/context/family';
import { Button } from '@/src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';

export function FamilySelector() {
  const { selectedFamily, setSelectedFamily, families, isLoading } = useFamily();
  const router = useRouter();
  
  const handleFamilyChange = async (familyId: string) => {
    try {
      // Find the selected family
      const family = families.find(f => f.id === familyId);
      
      if (family) {
        // Update selected family in context
        setSelectedFamily(family);
        
        // Call API to update selected family in session
        const authToken = localStorage.getItem('authToken');
        await fetch('/api/auth/select-family', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ familyId: family.id })
        });
        
        // Redirect to the family's home page
        router.push(`/${family.slug}/log-entry`);
      }
    } catch (error) {
      console.error('Failed to switch family', error);
    }
  };
  
  if (isLoading) {
    return <div className="family-selector-loading">Loading families...</div>;
  }
  
  return (
    <div className="family-selector">
      <Select 
        value={selectedFamily?.id || ''} 
        onValueChange={handleFamilyChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select family" />
        </SelectTrigger>
        <SelectContent>
          {families.map((family) => (
            <SelectItem key={family.id} value={family.id}>
              {family.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => router.push('/settings/families')}
        className="ml-2"
      >
        Manage
      </Button>
    </div>
  );
}

export default FamilySelector;
```

### 4. Update App Layout

Modify the app layout to include the FamilyProvider and FamilySelector:

```tsx
// app/(app)/layout.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BabyProvider } from '../context/baby';
import { FamilyProvider } from '../context/family'; // Add this
import { TimezoneProvider } from '../context/timezone';
import { ThemeProvider } from '@/src/context/theme';
import FamilySelector from '@/src/components/FamilySelector'; // Add this

// ... existing imports

function AppContent({ children }: { children: React.ReactNode }) {
  // ... existing code
  
  return (
    <>
      {(isUnlocked || process.env.NODE_ENV === 'development') && (
        <div className="min-h-screen flex">
          {/* Side Navigation - non-modal on wide screens */}
          {/* ... existing code */}
          
          {/* Main content area */}
          <div className={`flex flex-col flex-1 min-h-screen ${isWideScreen ? 'w-[calc(100%-16rem)]' : 'w-full'}`}>
            <header className="w-full bg-gradient-to-r from-teal-600 to-teal-700 sticky top-0 z-40">
              <div className="mx-auto py-2">
                <div className="flex justify-between items-center h-16">
                  <div className={`flex items-center ${isWideScreen ? 'ml-8' : 'ml-4 sm:ml-6 lg:ml-8'}`}>
                    {/* ... existing code */}
                    <div className="flex flex-col">
                      {caretakerName && caretakerName !== 'System Administrator' && (
                        <span className="text-white text-xs opacity-80">
                          Hi, {caretakerName}
                        </span>
                      )}
                      <span className="text-white text-sm font-medium">
                        {window.location.pathname === '/log-entry' 
                          ? 'Log Entry' 
                          : window.location.pathname === '/calendar'
                          ? 'Calendar'
                          : 'Full Log'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center mr-4 sm:mr-6 lg:mr-8">
                    {/* Add Family Selector */}
                    <FamilySelector />
                    
                    {babies.length > 0 && (
                      <BabySelector
                        selectedBaby={selectedBaby}
                        onBabySelect={(baby) => setSelectedBaby(baby)}
                        babies={babies}
                        sleepingBabies={sleepingBabies}
                        calculateAge={calculateAge}
                        onOpenQuickStats={() => setQuickStatsOpen(true)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </header>
            
            {/* ... existing code */}
          </div>

          {/* ... existing code */}
        </div>
      )}

      {/* ... existing code */}
    </>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FamilyProvider> {/* Add this */}
      <BabyProvider>
        <TimezoneProvider>
          <ThemeProvider>
            <AppContent>{children}</AppContent>
          </ThemeProvider>
        </TimezoneProvider>
      </BabyProvider>
    </FamilyProvider>
  );
}
```

### 5. Update API Fetch Calls

Modify all API fetch calls to include the family context:

```tsx
// Example of updating an API fetch call
const fetchData = async () => {
  try {
    const { selectedFamily } = useFamily();
    
    if (!selectedFamily) return;
    
    // Add familyId to the API call
    const response = await fetch(`/api/baby?familyId=${selectedFamily.id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    
    // ... rest of the function
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};
```

### 6. Family Management UI

Create a family management interface:

```tsx
// app/(app)/settings/families/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFamily } from '@/app/context/family';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Card } from '@/src/components/ui/card';

export default function FamiliesPage() {
  const { families, setFamilies, selectedFamily, setSelectedFamily } = useFamily();
  const [newFamilyName, setNewFamilyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newFamilyName.trim()) return;
    
    setIsLoading(true);
    
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/families', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          name: newFamilyName,
          slug: newFamilyName.toLowerCase().replace(/\s+/g, '-')
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Add new family to list
          setFamilies([...families, data.data]);
          
          // Reset form
          setNewFamilyName('');
          setIsCreating(false);
        }
      }
    } catch (error) {
      console.error('Error creating family:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelectFamily = async (familyId: string) => {
    try {
      // Find the selected family
      const family = families.find(f => f.id === familyId);
      
      if (family) {
        // Update selected family in context
        setSelectedFamily(family);
        
        // Call API to update selected family in session
        const authToken = localStorage.getItem('authToken');
        await fetch('/api/auth/select-family', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ familyId: family.id })
        });
        
        // Redirect to the family's home page
        router.push(`/${family.slug}/log-entry`);
      }
    } catch (error) {
      console.error('Failed to switch family', error);
    }
  };
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Family Management</h1>
      
      <div className="grid gap-6">
        {/* Family List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Families</h2>
          <div className="grid gap-4">
            {families.map(family => (
              <Card key={family.id} className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{family.name}</h3>
                    <p className="text-sm text-gray-500">/{family.slug}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant={selectedFamily?.id === family.id ? "default" : "outline"}
                      onClick={() => handleSelectFamily(family.id)}
                    >
                      {selectedFamily?.id === family.id ? "Selected" : "Select"}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => router.push(`/settings/families/${family.slug}`)}
                    >
                      Manage
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
        
        {/* Create New Family */}
        <div>
          {isCreating ? (
            <Card className="p-4">
              <h2 className="text-xl font-semibold mb-4">Create New Family</h2>
              <form onSubmit={handleCreateFamily}>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Family Name</label>
                    <Input
                      type="text"
                      value={newFamilyName}
                      onChange={(e) => setNewFamilyName(e.target.value)}
                      placeholder="Enter family name"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreating(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={isLoading || !newFamilyName.trim()}
                    >
                      {isLoading ? "Creating..." : "Create Family"}
                    </Button>
                  </div>
                </div>
              </form>
            </Card>
          ) : (
            <Button onClick={() => setIsCreating(true)}>
              Create New Family
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 7. Family Detail Management UI

Create a family detail management interface:

```tsx
// app/(app)/settings/families/[slug]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFamily } from '@/app/context/family';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Card } from '@/src/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';

export default function FamilyDetailPage() {
  const params = useParams();
  const { slug } = params;
  const router = useRouter();
  const { families, setFamilies } = useFamily();
  
  const [family, setFamily] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: ''
  });
  const [members, setMembers] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  
  useEffect(() => {
    const fetchFamilyDetails = async () => {
      try {
        setIsLoading(true);
        const authToken = localStorage.getItem('authToken');
        
        const response = await fetch(`/api/families/${slug}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success) {
            setFamily(data.data);
            setFormData({
              name: data.data.name,
              slug: data.data.slug
            });
            
            // Extract members from family data
            if (data.data.familyMembers) {
              setMembers(data.data.familyMembers);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching family details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (slug) {
      fetchFamilyDetails();
    }
  }, [slug]);
  
  const handleUpdateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.slug.trim()) return;
    
    setIsUpdating(true);
    
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/families/${slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          name: formData.name,
          newSlug: formData.slug
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Update family in context
          setFamily(data.data);
          
          // Update families list
          setFamilies(families.map(f => 
            f.id === data.data.id ? data.data : f
          ));
          
          // Exit edit mode
          setIsEditing(false);
          
          // If slug changed, redirect to new URL
          if (formData.slug !== slug) {
            router.push(`/settings/families/${formData.slug}`);
          }
        }
      }
    } catch (error) {
      console.error('Error updating family:', error);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleDeleteFamily = async () => {
    if (!confirm('Are you sure you want to delete this family? This action cannot be undone.')) {
      return;
    }
    
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/families/${slug}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Update families list
          setFamilies(families.filter(f => f.slug !== slug));
          
          // Redirect to families list
          router.push('/settings/families');
        }
      }
    } catch (error) {
      console.error('Error deleting family:', error);
    }
  };
  
  if (isLoading) {
    return <div className="container mx-auto py-8">Loading family details...</div>;
  }
  
  if (!family) {
    return <div className="container mx-auto py-8">Family not found</div>;
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{family.name}</h1>
        <Button variant="outline" onClick={() => router.push('/settings/families')}>
          Back to Families
        </Button>
      </div>
      
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Family Details</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="mt-6">
          <Card className="p-6">
            {isEditing ? (
              <form onSubmit={handleUpdateFamily}>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Family Name</label>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter family name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">URL Slug</label>
                    <Input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                      placeholder="url-slug"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This will be used in the URL: /{formData.slug}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditing(false)}
                      disabled={isUpdating}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={isUpdating || !formData.name.trim() || !formData.slug.trim()}
                    >
                      {isUpdating ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div>
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Family Name</h3>
                    <p className="text-lg">{family.name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">URL Slug</h3>
                    <p className="text-lg">/{family.slug}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Created</h3>
                    <p className="text-lg">{new Date(family.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex justify-between mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Family
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteFamily}
                  >
                    Delete Family
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="members" className="mt-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Family Members</h2>
            
            {members.length === 0 ? (
              <p>No members found</p>
            ) : (
              <div className="grid gap-4">
                {members.map((member) => (
                  <div key={member.caretakerId} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{member.caretaker.name}</h3>
                      <p className="text-sm text-gray-500">Role: {member.role}</p>
                    </div>
                    <div>
                      <Button variant="outline" size="sm">
                        {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-6">
              <Button>Invite New Member</Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 8. Update Route Structure

Update the route structure to include family slug:

```
// Current routes
/log-entry
/calendar
/full-log

// New routes with family slug
/[familySlug]/log-entry
/[familySlug]/calendar
/[familySlug]/full-log
```

Create the necessary folder structure in the app directory:

```
app/
  (app)/
    [familySlug]/
      log-entry/
        page.tsx
      calendar/
        page.tsx
      full-log/
        page.tsx
```

### 9. Family Middleware

Create middleware to handle family-based routing:

```tsx
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for API routes and auth routes
  if (pathname.startsWith('/api') || pathname.startsWith('/login')) {
    return NextResponse.next();
  }
  
  // Check if user is authenticated
  const authToken = request.cookies.get('authToken')?.value;
  
  if (!authToken) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Check if the URL has a family slug
  const pathParts = pathname.split('/').filter(Boolean);
  
  // If the path doesn't have a family slug (root or direct access to a page)
  if (pathParts.length === 0 || (pathParts.length === 1 && !pathParts[0].startsWith('['))) {
    // Try to get the selected family from cookies
    const selectedFamily = request.cookies.get('selectedFamily')?.value;
    
    if (selectedFamily) {
      try {
        const family = JSON.parse(selectedFamily);
        
        // Redirect to the family's home page
        return NextResponse.redirect(new URL(`/${family.slug}/log-entry`, request.url));
      } catch (error) {
        console.error('Error parsing selected family:', error);
      }
    }
    
    // If no selected family, redirect to families page
    return NextResponse.redirect(new URL('/settings/families', request.url));
  }
  
  // Continue with the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - API routes (/api/*)
     * - Static files (/_next/*)
     * - Login page (/login)
     */
    '/((?!api|_next|login).*)',
  ],
};
```

## Implementation Strategy

1. **Database Changes**
   - Implement the Family model and relationships in Prisma schema
   - Create migration scripts

2. **Authentication Updates**
   - Modify the auth flow to include family selection
   - Update JWT tokens to include familyId

3. **Context & State Management**
   - Create the FamilyProvider context
   - Implement family selection and persistence

4. **API Integration**
   - Update API calls to include familyId
   - Implement family-specific data fetching

5. **UI Components**
   - Create the FamilySelector component
   - Implement family management interfaces

6. **Routing & Navigation**
   - Update route structure to include family slug
   - Implement middleware for family-based routing

7. **Testing**
   - Test family selection and switching
   - Verify data isolation between families
   - Test family management features

## Mobile Considerations

When adapting these changes for React Native:

1. **Navigation**
   - Use React Navigation's nested navigators to handle family-based routing
   - Implement a similar family selection mechanism in the navigation drawer or header

2. **Storage**
   - Replace localStorage with AsyncStorage or a similar solution
   - Ensure family selection persists across app restarts

3. **UI Components**
   - Adapt the FamilySelector and management interfaces for touch interactions
   - Ensure all components follow mobile UI patterns

4. **URL Handling**
   - Replace URL-based navigation with React Navigation's navigation system
   - Use route params instead of URL slugs

By following this implementation plan, the application will support multiple families with proper data isolation, allowing users to switch between families and manage their family settings.
