import { useState } from 'react';
import { Card, Cell, ErrorModulo, Field, Icon, Kpis, Loading, PageHead, Table, Vacio, fieldStyle, useOverlay, useRecurso } from '@coi/sdk';
import './estilos.css';

/** Vista principal del módulo __NOMBRE__. Recibe { sub, usuario, api } del portal. */
export default function Modulo({ api }) {
  const { toast } = useOverlay();
  const resumen = useRecurso(api, '/resumen');
  const registros = useRecurso(api, '/registros');
  const [titulo, setTitulo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const crear = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post('/registros', { titulo });
      setTitulo('');
      resumen.reload(); registros.reload();
      toast('Registro creado.');
    } catch (err) { toast(err.message); } finally { setEnviando(false); }
  };

  const error = resumen.error || registros.error;
  if (error) return <><PageHead title="__NOMBRE__" /><ErrorModulo error={error} reintentar={() => { resumen.reload(); registros.reload(); }} /></>;
  if (!resumen.data || !registros.data) return <Loading />;
  const lista = registros.data;
  return (
    <>
      <PageHead title="__NOMBRE__" sub="Describa aquí, en una frase, para qué sirve el módulo." />
      <Kpis items={[['Registros', resumen.data.total, 'En la base del módulo', 'list'], ['Hoy', resumen.data.hoy, 'Creados hoy', 'clock']]} />
      <div className="grid g2 mt">
        <Card title="Nuevo registro" sub="Los datos quedan en las tablas del módulo">
          <form className="__ID__-form" onSubmit={crear}>
            <Field label="Título"><input style={fieldStyle} value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={3} /></Field>
            <button className="btn btn-p" disabled={enviando}><Icon name="check" />{enviando ? 'Guardando…' : 'Guardar'}</button>
          </form>
        </Card>
        <Card title="Registros" sub={lista.length + ' en total'} flush>
          {lista.length
            ? <Table headers={['Registro', 'Creado por']} rows={lista.map((r) => [<Cell key="c" main={r.titulo} sub={new Date(r.creado_en).toLocaleString('es-CO')} />, r.creado_por])} />
            : <Vacio titulo="Aún no hay registros" texto="Cree el primero con el formulario." />}
        </Card>
      </div>
    </>
  );
}
