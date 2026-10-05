import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-4 right-4 z-[200] flex max-h-screen w-full flex-col gap-2 p-0 sm:max-w-[380px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border p-4 pr-10 shadow-2xl backdrop-blur-xl transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full",
  {
    variants: {
      variant: {
        default: "border-border/30 bg-card/95 text-card-foreground shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.15)]",
        destructive:
          "border-red-500/30 bg-[hsl(0_60%_8%/0.95)] text-red-50 shadow-[0_8px_32px_-8px_hsl(0_80%_50%/0.3)]",
        success:
          "border-emerald-500/30 bg-[hsl(150_40%_8%/0.95)] text-emerald-50 shadow-[0_8px_32px_-8px_hsl(150_80%_40%/0.3)]",
        warning:
          "border-amber-500/30 bg-[hsl(40_60%_8%/0.95)] text-amber-50 shadow-[0_8px_32px_-8px_hsl(40_80%_50%/0.3)]",
        info:
          "border-[#374DA4]/30 bg-[hsl(220_50%_8%/0.95)] text-[#F0F2FE] shadow-[0_8px_32px_-8px_hsl(220_80%_50%/0.3)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const variantIcons: Record<string, React.ReactNode> = {
  default: <Info className="h-5 w-5 shrink-0 text-primary" />,
  destructive: <XCircle className="h-5 w-5 shrink-0 text-red-400" />,
  success: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />,
  warning: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />,
  info: <Info className="h-5 w-5 shrink-0 text-[#5A74D1]" />,
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background/50 px-3 text-xs font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-3 top-3 rounded-full p-1 text-current/40 opacity-0 transition-all hover:text-current hover:bg-white/10 focus:opacity-100 focus:outline-none group-hover:opacity-100",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold leading-tight", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs opacity-80 leading-relaxed", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  variantIcons,
}
