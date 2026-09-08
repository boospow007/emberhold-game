'use client';
import { Children, isValidElement, type ComponentProps } from 'react';
import { X } from 'lucide-react';
import {
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';

/** One viewport-bounded shell for both bottom sheets and centered dialogs. */
export function EmberDialogContent({
  children,
  className = '',
  showCloseButton = true,
  ...props
}: ComponentProps<typeof DialogContent>) {
  const parts = Children.toArray(children);
  const isHeading = (child: (typeof parts)[number]) =>
    isValidElement(child) &&
    (child.type === DialogTitle || child.type === DialogDescription);
  return (
    <DialogContent
      {...props}
      className={`ember-popup ${typeof className === 'string' ? className : ''}`}
      showCloseButton={false}
    >
      <header className="ember-popup-header">
        <span className="sheet-grip" aria-hidden="true" />
        {parts.filter(isHeading)}
        {showCloseButton && (
          <DialogClose className="popup-close" aria-label="ปิดเมนู">
            <X size={20} />
          </DialogClose>
        )}
      </header>
      <div className="ember-popup-scroll">
        {parts.filter((child) => !isHeading(child))}
      </div>
    </DialogContent>
  );
}
