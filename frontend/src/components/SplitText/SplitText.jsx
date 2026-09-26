import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

const SplitText = ({
  text = '',
  className = '',
  delay = 30,
  duration = 0.6,
  ease = 'power2.out',
  splitType = 'chars',
  textAlign = 'left',
  tag: Tag = 'span',
  onComplete
}) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !text) return;

    const el = containerRef.current;
    const targets = el.querySelectorAll('.split-unit');

    if (targets.length === 0) return;

    // Smooth entrance animation that guarantees visibility
    gsap.fromTo(
      targets,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration,
        ease,
        stagger: delay / 1000,
        overwrite: 'auto',
        onComplete: () => {
          onComplete?.();
        }
      }
    );

    // Failsafe: Ensure text is always 100% visible even if animation is interrupted
    const timer = setTimeout(() => {
      targets.forEach(t => {
        t.style.opacity = '1';
        t.style.transform = 'none';
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [text, delay, duration, ease, onComplete]);

  if (!text) return null;

  const words = text.split(' ');

  return (
    <Tag
      ref={containerRef}
      className={`split-text-container ${className}`}
      style={{
        display: 'inline-block',
        textAlign,
        wordWrap: 'break-word'
      }}
    >
      {words.map((word, wordIdx) => {
        if (splitType === 'words') {
          return (
            <span
              key={`word-${wordIdx}`}
              className="split-unit"
              style={{ display: 'inline-block', marginRight: '0.28em', willChange: 'transform, opacity' }}
            >
              {word}
            </span>
          );
        }

        const chars = word.split('');
        return (
          <span
            key={`word-${wordIdx}`}
            style={{ display: 'inline-block', whiteSpace: 'nowrap', marginRight: '0.28em' }}
          >
            {chars.map((char, charIdx) => (
              <span
                key={`char-${wordIdx}-${charIdx}`}
                className="split-unit"
                style={{ display: 'inline-block', willChange: 'transform, opacity' }}
              >
                {char}
              </span>
            ))}
          </span>
        );
      })}
    </Tag>
  );
};

export default SplitText;
