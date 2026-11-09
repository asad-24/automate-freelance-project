import * as React from "react";

// Minimal Slot: merges props onto a single child element (subset of Radix Slot).
export const Slot = React.forwardRef<HTMLElement, { children?: React.ReactNode } & Record<string, any>>(
  ({ children, ...props }, ref) => {
    if (!React.isValidElement(children)) return null;
    return React.cloneElement(children as React.ReactElement, {
      ...props,
      ...(children.props as Record<string, any>),
      className: [props.className, (children.props as any)?.className].filter(Boolean).join(" "),
      ref,
    });
  }
);
Slot.displayName = "Slot";
