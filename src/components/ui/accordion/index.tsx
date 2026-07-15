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
 * AccordionItem context for sharing item state with trigger and content
 */
const AccordionItemContext = React.createContext<{
  value: string;
  isExpanded: boolean;
  triggerId: string | undefined;
  contentId: string | undefined;
}>({
  value: "",
  isExpanded: false,
  triggerId: undefined,
  contentId: undefined,
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
    const baseId = React.useId();

    // Check if this item is expanded
    const isExpanded = context.type === "multiple"
      ? Boolean(context.value && context.value.split(',').includes(value))
      : context.value === value;

    // Context value shared with AccordionTrigger and AccordionContent
    const itemContextValue = React.useMemo(() => ({
      value,
      isExpanded,
      triggerId: `${baseId}-trigger`,
      contentId: `${baseId}-content`,
    }), [value, isExpanded, baseId]);

    return (
      <AccordionItemContext.Provider value={itemContextValue}>
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
      </AccordionItemContext.Provider>
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
    const accordionContext = React.useContext(AccordionContext);
    const itemContext = React.useContext(AccordionItemContext);
    const { value, isExpanded, triggerId, contentId } = itemContext;

    const handleClick = () => {
      accordionContext.onValueChange(value);
    };

    return (
      <button
        ref={ref}
        type="button"
        id={triggerId}
        aria-controls={contentId}
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
          aria-hidden="true"
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
    const { isExpanded, triggerId, contentId } = React.useContext(AccordionItemContext);

    return (
      <div
        ref={ref}
        id={contentId}
        role={isExpanded ? "region" : undefined}
        aria-labelledby={triggerId}
        aria-hidden={!isExpanded || undefined}
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
