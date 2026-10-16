/** Marcas Reval y Multipagas. Si se configuran logos oficiales (VITE_LOGO_*), se usan imágenes. */
export default function BrandMarks({ size }) {
  const reval = import.meta.env.VITE_LOGO_REVAL_URL;
  const mp = import.meta.env.VITE_LOGO_MULTIPAGAS_URL;
  return (
    <div className="marks">
      {reval ? <img className="logo-img" src={reval} alt="Reval" /> : <span className={'wordmark ' + size} style={{ color: '#fff' }}>Reval<span className="dot">.</span></span>}
      <span className="brand-sep" />
      {mp ? <img className="logo-img" src={mp} alt="Multipagas" /> : <span className={'wordmark mp ' + size} style={{ color: '#fff' }}>Multipagas<span className="dot">.</span></span>}
    </div>
  );
}
