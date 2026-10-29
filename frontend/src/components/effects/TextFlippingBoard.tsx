import React, { useState, useEffect } from 'react';

interface TextFlippingBoardProps {
  words?: string[];
  intervalMs?: number;
  className?: string;
}

export const TextFlippingBoard: React.FC<TextFlippingBoardProps> = ({
  words = ['SIGNAL', 'PEOPLE', 'PROCESSES', 'SYSTEMS'],
  intervalMs = 3000,
  className = '',
}) => {
  const [, setWordIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [displayedWord, setDisplayedWord] = useState(words[0]);

  // Max length to pad slots evenly
  const maxLen = Math.max(...words.map((w) => w.length));

  useEffect(() => {
    const timer = setInterval(() => {
      setIsFlipping(true);
      setTimeout(() => {
        setWordIndex((prev) => {
          const next = (prev + 1) % words.length;
          setDisplayedWord(words[next]);
          return next;
        });
        setIsFlipping(false);
      }, 400); // Halfway through flip
    }, intervalMs);

    return () => clearInterval(timer);
  }, [words, intervalMs]);

  const currentChars = displayedWord.padEnd(maxLen, ' ').split('');

  return (
    <div
      className={`inline-flex items-center space-x-1 sm:space-x-1.5 select-none font-mono ${className}`}
      role="region"
      aria-label={`Current state: ${displayedWord}`}
    >
      {currentChars.map((char, idx) => (
        <div
          key={idx}
          className="relative w-7 h-10 sm:w-10 sm:h-14 bg-[#141414] border border-[#292929] rounded-[3px] flex items-center justify-center overflow-hidden shadow-sm"
          style={{ perspective: '300px' }}
        >
          {/* Top Half */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-[#171717] border-b border-[#080808]/70 flex items-center justify-center overflow-hidden">
            <span
              className={`text-[#F2F2F2] font-bold text-base sm:text-2xl leading-none translate-y-1/2 transition-transform duration-300 ${
                isFlipping ? 'scale-y-0 opacity-40' : 'scale-y-100 opacity-100'
              }`}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          </div>

          {/* Bottom Half */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#111111] flex items-center justify-center overflow-hidden">
            <span
              className={`text-[#D8D8D8] font-bold text-base sm:text-2xl leading-none -translate-y-1/2 transition-transform duration-300 ${
                isFlipping ? 'scale-y-0 opacity-40' : 'scale-y-100 opacity-100'
              }`}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          </div>

          {/* Center Seam / Mechanical Split Line */}
          <div className="absolute inset-x-0 top-1/2 h-[1px] bg-[#080808] z-10 pointer-events-none" />

          {/* Side Flap Pins */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[3px] bg-[#292929] z-20" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-[3px] bg-[#292929] z-20" />
        </div>
      ))}
    </div>
  );
};
