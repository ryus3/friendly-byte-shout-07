import React, { useState, useEffect } from "react"

const TOAST_LIMIT = 1

let count = 0
function generateId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

const toastStore = {
  state: {
    toasts: [],
  },
  listeners: [],
  
  getState: () => toastStore.state,
  
  setState: (nextState) => {
    if (typeof nextState === 'function') {
      toastStore.state = nextState(toastStore.state)
    } else {
      toastStore.state = { ...toastStore.state, ...nextState }
    }
    
    toastStore.listeners.forEach(listener => listener(toastStore.state))
  },
  
  subscribe: (listener) => {
    toastStore.listeners.push(listener)
    return () => {
      toastStore.listeners = toastStore.listeners.filter(l => l !== listener)
    }
  }
}

export const toast = ({ ...props }) => {
  const id = generateId()

  const update = (props) =>
    toastStore.setState((state) => ({
      ...state,
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, ...props } : t
      ),
    }))

  const dismiss = () => toastStore.setState((state) => ({
    ...state,
    toasts: state.toasts.filter((t) => t.id !== id),
  }))

  toastStore.setState((state) => ({
    ...state,
    toasts: [
      { ...props, id, dismiss },
      ...state.toasts,
    ].slice(0, TOAST_LIMIT),
  }))

  return {
    id,
    dismiss,
    update,
  }
}

export function useToast() {
  // فحص إذا كنا داخل React component قبل استخدام hooks
  if (typeof React === 'undefined' || typeof React.useState !== 'function') {
    console.warn('useToast: React hooks not available, returning fallback');
    return {
      toast,
      toasts: [],
    };
  }
  
  // حماية من null React context  
  let state, setState;
  
  try {
    [state, setState] = useState(() => toastStore.getState());
  } catch (error) {
    console.warn('useToast hook called outside React context, using fallback');
    return {
      toast,
      toasts: [],
    };
  }
  
  useEffect(() => {
    if (!setState) return;
    
    const unsubscribe = toastStore.subscribe((newState) => {
      setState(newState);
    });
    
    return unsubscribe;
  }, [setState]);
  
  useEffect(() => {
    if (!state || !state.toasts) return;
    
    const timeouts = [];

    state.toasts.forEach((toast) => {
      if (toast.duration === Infinity) {
        return;
      }

      const timeout = setTimeout(() => {
        if (toast.dismiss) {
          toast.dismiss();
        }
      }, toast.duration || 5000);

      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [state?.toasts]);

  return {
    toast,
    toasts: state?.toasts || [],
  };
}