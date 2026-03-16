import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Renders LaTeX (e.g. \\begin{pmatrix} ... \\end{pmatrix}) with KaTeX. */
const KatexBlock: React.FC<{ latex: string; className?: string }> = ({ latex, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !latex.trim()) return;
    try {
      katex.render(latex, ref.current, { displayMode: true, throwOnError: false });
    } catch {
      ref.current.textContent = latex;
    }
  }, [latex]);
  return <div ref={ref} className={className} />;
};

export default KatexBlock;
