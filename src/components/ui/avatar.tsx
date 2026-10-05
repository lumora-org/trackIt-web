import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'size-9 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-20 text-xl',
} as const;

export type AvatarSize = keyof typeof SIZES;

/**
 * Circular identity chip shared by the top bar and the profile page. Renders
 * the uploaded photo when present, otherwise the person's initials on the
 * brand tint.
 *
 * A plain <img> is deliberate: the source is a local data URL produced by the
 * upload flow, which next/image cannot optimise.
 */
export function Avatar({
  name,
  src,
  size = 'sm',
  className,
}: {
  /** Full display name, used for the initials fallback. */
  name: string | null;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const [first, ...rest] = (name ?? '').trim().split(/\s+/);
  return (
    <span
      className={cn(
        'bg-brand-100 text-brand-800 flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold',
        SIZES[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URLs are not optimisable by next/image
        <img src={src} alt="" className="size-full object-cover" />
      ) : name ? (
        initials(first, rest.join(' ') || null)
      ) : (
        '—'
      )}
    </span>
  );
}
