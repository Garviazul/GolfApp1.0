import { cn } from "@/lib/utils";

interface FfIconProps {
  name: string;
  className?: string;
  title?: string;
}

export const FfIcon = ({ name, className, title }: FfIconProps) => (
  <i
    className={cn("fi inline-flex items-center justify-center leading-none", `fi-rr-${name}`, className)}
    aria-hidden={title ? undefined : true}
    aria-label={title}
  />
);

