// Emblema "red COI": el núcleo COI conectado con los 16 clientes sobre anillos concéntricos.
// Geometría fija y sobria; solo los arcos de marca giran lentamente y un nodo a la vez se ilumina.
const CLIENTS = 16;
const C = 300;

const polar = (r, deg) => {
  const a = (deg - 90) * Math.PI / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

export default function CoiEmblem({ className = '' }) {
  const nodes = Array.from({ length: CLIENTS }, (_, i) => i * (360 / CLIENTS));
  const ticks = Array.from({ length: 96 }, (_, i) => i * 3.75);
  return (
    <svg className={'lx-emblem ' + className} viewBox="0 0 600 600" aria-hidden="true" focusable="false">
      {/* Graduación exterior */}
      <g className="lx-em-ticks">
        {ticks.map((deg, i) => {
          const [x1, y1] = polar(i % 4 === 0 ? 278 : 283, deg);
          const [x2, y2] = polar(290, deg);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={i % 4 === 0 ? 'major' : ''} />;
        })}
      </g>
      {/* Anillos */}
      <g className="lx-em-rings">
        <circle cx={C} cy={C} r="262" />
        <circle cx={C} cy={C} r="206" />
        <circle cx={C} cy={C} r="146" />
        <circle cx={C} cy={C} r="86" />
      </g>
      {/* Conexiones núcleo–clientes */}
      <g className="lx-em-spokes">
        {nodes.map((deg) => {
          const [x1, y1] = polar(52, deg);
          const [x2, y2] = polar(199, deg);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      {/* Arcos de marca */}
      <g className="lx-em-arc lx-em-arc-c"><circle cx={C} cy={C} r="262" pathLength="100" strokeDasharray="14 86" /></g>
      <g className="lx-em-arc lx-em-arc-g"><circle cx={C} cy={C} r="146" pathLength="100" strokeDasharray="22 78" /></g>
      {/* Clientes */}
      <g className="lx-em-nodes">
        {nodes.map((deg, i) => {
          const [x, y] = polar(206, deg);
          return <circle key={deg} cx={x} cy={y} r="5.5" style={{ animationDelay: (i * 1.5) + 's' }} />;
        })}
      </g>
      {/* Núcleo */}
      <circle className="lx-em-core-ring" cx={C} cy={C} r="52" />
      <circle className="lx-em-core" cx={C} cy={C} r="44" />
      <text className="lx-em-text" x={C} y={C + 9} textAnchor="middle">COI</text>
    </svg>
  );
}
