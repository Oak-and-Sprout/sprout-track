'use client';

import * as React from "react"
import { Menu } from 'lucide-react';
import { cn } from "@/src/lib/utils"
import { Button } from '../button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../dropdown-menu';

import { mobileMenuVariants, desktopNavVariants } from "./mobile-menu.styles"
import { MobileMenuProps } from "./mobile-menu.types"
import "./mobile-menu.css"

/**
 * Mobile Menu component with hamburger functionality
 *
 * This is a responsive navigation component that follows the project's design system.
 * It's designed to be cross-platform compatible with minimal changes required for React Native.
 *
 * Features:
 * - Hamburger menu button that appears only on mobile devices
 * - Clean dropdown menu (no modal overlay)
 * - Keyboard navigation support
 * - Click outside to close functionality
 * - Automatic closure when resizing to desktop view
 *
 * @example
 * ```tsx
 * <MobileMenu>
 *   <AccountButton label="Sign In" />
 *   <ThemeToggle />
 * </MobileMenu>
 * ```
 */
const MobileMenu = React.forwardRef<HTMLDivElement, MobileMenuProps>(
  ({ className, children, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);

    // Close menu on window resize to desktop size
    React.useEffect(() => {
      const handleResize = () => {
        if (window.innerWidth > 768) {
          setIsOpen(false);
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Convert children to array for easier handling
    const childrenArray = React.Children.toArray(children);

    return (
      <div 
        className={cn(mobileMenuVariants(), className)} 
        ref={ref}
        {...props}
      >
        {/* Mobile Dropdown Menu - only visible on mobile */}
        <div className="md:hidden">
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mobile-menu-hamburger p-2"
                aria-label="Toggle menu"
              >
                <Menu size={20} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-48 mobile-menu-dropdown"
              sideOffset={8}
            >
              {childrenArray.map((child, index) => (
                <DropdownMenuItem 
                  key={index} 
                  className="mobile-menu-item p-0"
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="w-full p-2" onClick={() => setIsOpen(false)}>
                    {child}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop Menu - hidden on mobile */}
        <div className={desktopNavVariants()}>
          {children}
        </div>
      </div>
    );
  }
)
MobileMenu.displayName = "MobileMenu"

export { MobileMenu }
export type { MobileMenuProps }
