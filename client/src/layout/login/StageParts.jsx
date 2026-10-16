/** Símbolo de producto COI: anillos concéntricos con arcos verde y cian (motivo existente). */
export function CoiMark({ size = 40, className = '' }) {
  return (
    <svg className={'lx-mark ' + className} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="13.5" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.5" />
      <circle className="lx-mark-c" cx="24" cy="24" r="21" fill="none" stroke="#21BBEA" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="34 98" transform="rotate(-120 24 24)" />
      <circle className="lx-mark-g" cx="24" cy="24" r="13.5" fill="none" stroke="#048C38" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="22 63" transform="rotate(40 24 24)" />
      <circle cx="24" cy="24" r="4.2" fill="currentColor" />
    </svg>
  );
}
