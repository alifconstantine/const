"use client";

import * as React from "react";
import { useToast } from "@const/ui/hooks/use-toast";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastPosition,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@const/ui/components/ui/toast";

export interface ToasterProps {
  position?: ToastPosition;
  swipeDirection?: "right" | "left" | "up" | "down";
  richColors?: boolean;
  closeButton?: boolean;
  [key: string]: any;
}

export function Toaster({
  position = "bottom-right",
  swipeDirection = position.includes("left") ? "left" : "right",
  ...props
}: ToasterProps = {}) {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection={swipeDirection}>
      {toasts.map(function ({ id, title, description, action, icon, ...toastProps }) {
        const renderAction = () => {
          if (!action) return null;
          if (React.isValidElement(action)) return action;
          if (typeof action === "object" && "label" in action) {
            return (
              <ToastAction
                altText={
                  action.altText ||
                  (typeof action.label === "string" ? action.label : "Action")
                }
                onClick={action.onClick}
              >
                {action.label}
              </ToastAction>
            );
          }
          return null;
        };

        return (
          <Toast key={id} {...toastProps}>
            <div className="flex items-start gap-3 w-full">
              {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
              <div className="grid gap-1 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {renderAction()}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport position={position} />
    </ToastProvider>
  );
}
