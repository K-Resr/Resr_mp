import React, {useState} from 'react';
import {Disc3, Music2} from 'lucide-react';

interface TrackThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  isLocal?: boolean;
}

export const TrackThumbnail: React.FC<TrackThumbnailProps> = ({
  src,
  alt,
  className = 'w-11 h-11',
  isLocal = false,
}) => {
  const [hasError, setHasError] = useState(false);

  if (isLocal || hasError || !src) {
    return (
      <div
        className={`${className} rounded-lg ${
          isLocal
            ? 'bg-gradient-to-br from-[#0F2347] via-[#0B1733] to-[#060C1A] border border-[#3B82F6]/35'
            : 'bg-gradient-to-br from-[#13203B] to-[#080F20] border border-sky-200/10'
        } flex items-center justify-center shrink-0`}
        aria-label={alt}
      >
        {isLocal ? (
          <Music2 className="w-5 h-5 text-[#60A5FA]" />
        ) : (
          <Disc3 className="w-5 h-5 text-[#8CA1C4]" />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`${className} rounded-lg object-cover bg-[#13203B] shrink-0`}
    />
  );
};
