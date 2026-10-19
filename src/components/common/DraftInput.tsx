/**
 * DraftInput — a text field that keeps a local draft and commits on blur or
 * Enter (Escape reverts). Unlike parse-on-every-keystroke fields, this lets
 * users type intermediate text like "0." or "${dim *" without it being
 * rewritten mid-typing.
 */

import React, { useEffect, useState } from 'react';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onCommit: (text: string) => void;
}

export default function DraftInput({ value, onCommit, onBlur, onKeyDown, ...rest }: Props) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      type="text"
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        if (draft !== value) onCommit(draft);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          // Let blur see the reverted draft on the next render.
          setTimeout(() => (e.target as HTMLInputElement).blur(), 0);
        }
        onKeyDown?.(e);
      }}
    />
  );
}
