import * as React from 'react';

import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-base ring-offset-background transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:border-gold/50 focus-visible:ring-2 focus-visible:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
