import { memo, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export type MathFormulaProps = {
  tex: string;
  inline?: boolean;
  className?: string;
};

/** KaTeX emits both visual HTML and semantic MathML for assistive technology. */
export const MathFormula = memo(function MathFormula({ tex, inline = false, className = '' }: MathFormulaProps) {
  const markup = useMemo(() => katex.renderToString(tex, {
    displayMode: !inline,
    output: 'htmlAndMathml',
    throwOnError: false,
    trust: false,
    strict: 'warn',
  }), [tex, inline]);

  if (inline) {
    return <span className={`math-inline ${className}`} dangerouslySetInnerHTML={{ __html: markup }} />;
  }

  return <div className={`math-block ${className}`} dangerouslySetInnerHTML={{ __html: markup }} />;
});

export default MathFormula;
