import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/src/lib/utils"
import { selectStyles as styles } from "./select.styles"
import { useTheme } from "@/src/context/theme"
import "./select.css"
import {
  SelectProps,
  SelectGroupProps,
  SelectValueProps,
  SelectTriggerProps,
  SelectScrollUpButtonProps,
  SelectScrollDownButtonProps,
  SelectContentProps,
  SelectLabelProps,
  SelectItemProps,
  SelectSeparatorProps,
} from "./select.types"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, ...props }, ref) => {
  const { theme } = useTheme();
  
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(styles.trigger, className, "select-trigger")}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className={cn(styles.chevronIcon, "select-icon")} aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
})
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  SelectScrollUpButtonProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(styles.scrollButton, className, "select-icon")}
    {...props}
  >
    <ChevronUp className="h-4 w-4" aria-hidden="true" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  SelectScrollDownButtonProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(styles.scrollButton, className, "select-icon")}
    {...props}
  >
    <ChevronDown className="h-4 w-4" aria-hidden="true" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = "popper", ...props }, ref) => {
  const { theme } = useTheme();
  
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          styles.content,
          position === "popper" && styles.contentPopper,
          className,
          "select-content"
        )}
        position={position}
        style={{ zIndex: 300 }} // Ensure higher z-index than form-page
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            styles.viewport,
            position === "popper" && styles.viewportPopper
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  SelectLabelProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(styles.label, className, "select-label")}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(styles.item, className, "select-item")}
    {...props}
  >
    <span className={cn(styles.itemIndicatorWrapper, "select-icon")}>
      <SelectPrimitive.ItemIndicator>
        <Check className={cn(styles.checkIcon, "select-check-icon")} aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  SelectSeparatorProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn(styles.separator, className, "select-separator")}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
