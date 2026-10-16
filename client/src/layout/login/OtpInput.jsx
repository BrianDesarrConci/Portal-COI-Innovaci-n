import { forwardRef, useImperativeHandle, useRef } from 'react';

/**
 * Código de verificación en casillas individuales.
 * `digits` es un arreglo de `length` cadenas ('' o un dígito).
 * Solo números, avance automático, pegado, retroceso y flechas. Enter envía.
 */
const OtpInput = forwardRef(function OtpInput({ digits, onChange, onSubmit, disabled, invalid, labelledBy, describedBy }, ref) {
  const length = digits.length;
  const boxes = useRef([]);
  useImperativeHandle(ref, () => ({ focus: (i = 0) => boxes.current[i]?.focus() }), []);
  const focusAt = (i) => { const el = boxes.current[Math.max(0, Math.min(length - 1, i))]; if (el) { el.focus(); el.select(); } };

  // Escribe una secuencia de dígitos desde la casilla `start` (tecleo, pegado o autocompletado).
  const fill = (start, text) => {
    const clean = String(text).replace(/\D/g, '');
    if (!clean) return;
    const next = [...digits];
    let i = start;
    for (const ch of clean) { if (i >= length) break; next[i] = ch; i += 1; }
    onChange(next);
    focusAt(i >= length ? length - 1 : i);
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) { next[i] = ''; onChange(next); }
      else if (e.key === 'Backspace' && i > 0) { next[i - 1] = ''; onChange(next); focusAt(i - 1); }
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); onSubmit?.(); }
    else if (/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); fill(i, e.key); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); } // bloquea letras y símbolos
  };

  return (
    <div className={'lx-otp' + (invalid ? ' invalid' : '')} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { boxes.current[i] = el; }}
          className={'lx-otp-box num' + (d ? ' filled' : '')}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={d}
          disabled={disabled}
          aria-label={`Dígito ${i + 1} de ${length}`}
          // Respaldo para teclados móviles y autocompletado del sistema (insertan sin keydown útil).
          onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); if (v) fill(i, v.length > 1 && d && v.startsWith(d) ? v.slice(d.length) : v); }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => { e.preventDefault(); fill(i, e.clipboardData.getData('text')); }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
});

export default OtpInput;
