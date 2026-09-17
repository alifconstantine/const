"use client";

// Inspired by react-hot-toast library
import * as React from "react";

import { CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";

import type {
  ToastActionElement,
  ToastProps,
} from "@const/ui/components/ui/toast";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 1000000;

export type ToastActionType =
  | ToastActionElement
  | {
      label: React.ReactNode;
      onClick: (event: React.MouseEvent<HTMLElement>) => void;
      altText?: string;
    };

export type ToasterToast = Omit<ToastProps, "title"> & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionType;
  icon?: React.ReactNode;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function isToastObject(input: any): input is Toast {
  return (
    input !== null &&
    typeof input === "object" &&
    !React.isValidElement(input)
  );
}

function createToast(
  input: Toast | React.ReactNode,
  options?: Partial<Toast>,
): {
  id: string;
  dismiss: () => void;
  update: (props: ToasterToast) => void;
} {
  const id = genId();

  let props: Toast;
  if (isToastObject(input)) {
    props = {
      ...input,
      ...options,
    };
  } else {
    props = {
      title: input,
      ...options,
    };
  }

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

export interface ToastFn {
  (input: Toast | React.ReactNode, options?: Partial<Toast>): {
    id: string;
    dismiss: () => void;
    update: (props: ToasterToast) => void;
  };
  success: (
    message: React.ReactNode,
    options?: Partial<Toast>,
  ) => {
    id: string;
    dismiss: () => void;
    update: (props: ToasterToast) => void;
  };
  error: (
    message: React.ReactNode,
    options?: Partial<Toast>,
  ) => {
    id: string;
    dismiss: () => void;
    update: (props: ToasterToast) => void;
  };
  info: (
    message: React.ReactNode,
    options?: Partial<Toast>,
  ) => {
    id: string;
    dismiss: () => void;
    update: (props: ToasterToast) => void;
  };
  warning: (
    message: React.ReactNode,
    options?: Partial<Toast>,
  ) => {
    id: string;
    dismiss: () => void;
    update: (props: ToasterToast) => void;
  };
  dismiss: (toastId?: string) => void;
}

const toast: ToastFn = Object.assign(
  (input: Toast | React.ReactNode, options?: Partial<Toast>) =>
    createToast(input, options),
  {
    success: (message: React.ReactNode, options?: Partial<Toast>) => {
      const baseProps: Toast = isToastObject(message) ? message : { title: message };
      return createToast(
        { ...baseProps, variant: "success" },
        {
          icon: React.createElement(CheckCircle2, {
            className: "h-4 w-4 text-emerald-500 shrink-0",
          }),
          ...options,
        },
      );
    },
    error: (message: React.ReactNode, options?: Partial<Toast>) => {
      const baseProps: Toast = isToastObject(message) ? message : { title: message };
      return createToast(
        { ...baseProps, variant: "destructive" },
        {
          icon: React.createElement(AlertCircle, {
            className: "h-4 w-4 text-destructive shrink-0",
          }),
          ...options,
        },
      );
    },
    info: (message: React.ReactNode, options?: Partial<Toast>) => {
      const baseProps: Toast = isToastObject(message) ? message : { title: message };
      return createToast(
        { ...baseProps, variant: "info" },
        {
          icon: React.createElement(Info, {
            className: "h-4 w-4 text-sky-500 shrink-0",
          }),
          ...options,
        },
      );
    },
    warning: (message: React.ReactNode, options?: Partial<Toast>) => {
      const baseProps: Toast = isToastObject(message) ? message : { title: message };
      return createToast(
        { ...baseProps, variant: "warning" },
        {
          icon: React.createElement(AlertTriangle, {
            className: "h-4 w-4 text-amber-500 shrink-0",
          }),
          ...options,
        },
      );
    },
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  },
);

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };
