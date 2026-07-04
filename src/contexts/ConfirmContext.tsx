import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmContextType = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: '' });
  const [resolveFn, setResolveFn] = useState<(value: boolean) => void>();

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    return new Promise<boolean>((resolve) => {
      setOptions(typeof opts === 'string' ? { message: opts } : opts);
      setResolveFn(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolveFn) resolveFn(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolveFn) resolveFn(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleCancel();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title || 'Confirmação'}</AlertDialogTitle>
            <AlertDialogDescription>{options.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {options.cancelText || 'Cancelar'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {options.confirmText || 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
};
