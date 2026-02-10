import * as React from 'react';
import { cn } from './utils';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className,
  ...props
}) => {
  return (
    <img
      src={src}
      alt={alt}
      className={cn('', className)}
      {...props}
    />
  );
};
