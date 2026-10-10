import Image from 'next/image';

import { cn } from '@/lib/cn';

/**
 * The official K.B.Y Global Investment badge, used as the platform logo across
 * the app (auth screens, sidebar, splash). Kept in one place so the brand mark
 * can never drift between surfaces.
 */
export function Logo({
  size = 36,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/images/kby-logo.png"
      alt="K.B.Y Global Investment"
      width={256}
      height={256}
      priority={priority}
      style={{ width: size, height: size }}
      className={cn('shrink-0 rounded-full bg-white object-contain', className)}
    />
  );
}
