import * as React from "react";
import { cn } from "@/src/lib/utils";
import { useTheme } from "@/src/context/theme";
import { accordionStyles } from "./accordion.styles";
import { 
  AccordionProps, 
  AccordionItemProps, 
  AccordionTriggerProps, 
  AccordionContentProps 
} from "./accordion.types";
import { ChevronDown } from "lucide-react";
import "./accordion.css";

/**
 * Accordion context for managing state between components
 */
const AccordionContext = React.createContext<{
  value: string | null;
  onValueChange: (value: string) => void;
  type: "single" | "multiple";
  collapsible: boolean;
}>({
  value: null,
  onValueChange: () => {},
  type: "single",
  collapsible: false,
});

/**
 * Accordion component for displaying collapsible content panels
 *
 * A component that follows the project's design system and allows users
 * to show and hide sections of related content.
 *
 * Features:
 * - Support for single and multiple expanded items
 * - Collapsible option to allow closing all items
 * - Accessible keyboard navigation
 * - Animated transitions
 *
 * @example
 * ```tsx
 * <Accordion type="single" collapsible>
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger>Section 1</AccordionTrigger>
 *     <AccordionContent>Content for section 1</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 * ```
 */
const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ className, type = "single", value, defaultValue, onValueChange, collapsible = false, children, ...props }, ref) => {
    const { theme } = useTheme();
    
    // Manage internal state if not controlled externally
    const [internalValue, setInternalValue] = React.useState<string | string[] | null>(
      defaultValue || (type === "multiple" ? [] : null)
    );
    
    // Use external value if provided, otherwise use internal state
    const actualValue = value !== undefined ? value : internalValue || (type === "multiple" ? [] : "");
    
    // Handle value changes
    const handleValueChange = React.useCallback((itemValue: string) => {
      if (onValueChange) {
        if (type === "multiple") {
          // For multiple type, toggle the value in the array
          const newValue = Array.isArray(actualValue) 
            ? actualValue.includes(itemValue)
              ? actualValue.filter(v => v !== itemValue)
              : [...actualValue, itemValue]
            : [itemValue];
          onValueChange(newValue);
        } else {
          // For single type, set or toggle the value
          onValueChange(actualValue === itemValue && collapsible ? "" : itemValue);
        }
      } else {
        // Update internal state if not controlled
        if (type === "multiple") {
          setInternalValue(prev => {
            const array = Array.isArray(prev) ? prev : [];
            return array.includes(itemValue)
              ? array.filter(v => v !== itemValue)
              : [...array, itemValue];
          });
        } else {
          setInternalValue(prev => prev === itemValue && collapsible ? "" : itemValue);
        }
      }
    }, [actualValue, collapsible, onValueChange, type]);
    
    // Context value to be passed to children
    const contextValue = React.useMemo(() => ({
      value: type === "multiple" 
        ? Array.isArray(actualValue) ? actualValue.join(',') : ""
        : String(actualValue || ""),
      onValueChange: handleValueChange,
      type,
      collapsible,
    }), [actualValue, handleValueChange, type, collapsible]);
    
    return (
      <AccordionContext.Provider value={contextValue}>
        <div 
          ref={ref} 
          className={cn(accordionStyles.root, className, theme === 'dark' && "accordion-dark")}
          {...props}
        >
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);

Accordion.displayName = "Accordion";

/**
 * AccordionItem component
 * 
 * An individual item within an Accordion.
 */
const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const { theme } = useTheme();
    const context = React.useContext(AccordionContext);

    // Check if this item is expanded
    const isExpanded = context.type === "multiple"
      ? context.value && context.value.split(',').includes(value)
      : context.value === value;

    return (
      <div
        ref={ref}
        data-state={isExpanded ? "open" : "closed"}
        data-value={value}
        className={cn(
          accordionStyles.item,
          className,
          theme === 'dark' && "accordion-item-dark"
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

AccordionItem.displayName = "AccordionItem";

/**
 * AccordionTrigger component
 * 
 * The clickable header of an AccordionItem.
 */
const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { theme } = useTheme();
    const itemContext = React.useContext(AccordionContext);
    
    // Find the parent AccordionItem to get its value
    const accordionItemElement = React.useRef<HTMLDivElement | null>(null);
    const buttonRef = React.useCallback((node: HTMLButtonElement | null) => {
      if (node) {
        // Find the parent AccordionItem
        let parent = node.parentElement;
        while (parent && !parent.hasAttribute('data-state')) {
          parent = parent.parentElement;
        }
        accordionItemElement.current = parent as HTMLDivElement;
      }
      
      // Forward the ref
      if (ref) {
        if (typeof ref === 'function') {
          ref(node);
        } else {
          ref.current = node;
        }
      }
    }, [ref]);
    
    const handleClick = () => {
      if (accordionItemElement.current) {
        const value = accordionItemElement.current.getAttribute('data-value') || '';
        itemContext.onValueChange(value);
      }
    };
    
    const isExpanded = accordionItemElement.current?.getAttribute('data-state') === 'open';
    
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        className={cn(
          accordionStyles.trigger,
          className,
          theme === 'dark' && "accordion-trigger-dark"
        )}
        aria-expanded={isExpanded}
        {...props}
      >
        {children}
        <ChevronDown 
          className={cn(
            accordionStyles.icon,
            isExpanded && accordionStyles.iconExpanded,
            theme === 'dark' && "accordion-icon-dark"
          )} 
        />
      </button>
    );
  }
);

AccordionTrigger.displayName = "AccordionTrigger";

/**
 * AccordionContent component
 *
 * The expandable content section of an AccordionItem.
 */
const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, ...props }, ref) => {
    const { theme } = useTheme();
    const context = React.useContext(AccordionContext);
    const [itemValue, setItemValue] = React.useState<string>('');
    const contentNodeRef = React.useRef<HTMLDivElement | null>(null);

    // Find the parent AccordionItem's value on mount
    React.useEffect(() => {
      if (contentNodeRef.current) {
        let parent = contentNodeRef.current.parentElement;
        while (parent && !parent.hasAttribute('data-value')) {
          parent = parent.parentElement;
        }
        if (parent) {
          setItemValue(parent.getAttribute('data-value') || '');
        }
      }
    }, []);

    // Determine if expanded based on context
    const isExpanded = context.type === "multiple"
      ? context.value && context.value.split(',').includes(itemValue)
      : context.value === itemValue;

    const setRef = React.useCallback((node: HTMLDivElement | null) => {
      contentNodeRef.current = node;
      if (ref) {
        if (typeof ref === 'function') {
          ref(node);
        } else {
          ref.current = node;
        }
      }
    }, [ref]);

    return (
      <div
        ref={setRef}
        className={cn(
          accordionStyles.content,
          !isExpanded && accordionStyles.contentClosed,
          className,
          theme === 'dark' && "accordion-content-dark"
        )}
        data-state={isExpanded ? "open" : "closed"}
        {...props}
      >
        <div className={accordionStyles.contentInner}>
          {children}
        </div>
      </div>
    );
  }
);

AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
