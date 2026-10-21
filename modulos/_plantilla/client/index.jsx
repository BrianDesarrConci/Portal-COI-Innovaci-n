import { useState } from 'react';
import { Card, Cell, Field, Icon, Kpis, Loading, PageHead, Table, fieldStyle, useOverlay, useRecurso } from '@coi/sdk';
import './estilos.css';

/** Vista principal del módulo __NOMBRE__. Recibe { sub, usuario, api } del portal. */
export default function Modulo({ usuario, api }) {
  const { toast } = useOverlay();
  const registros = useRecurso(api, '/registros');
  const [titulo, setTitulo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const crear = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post('/registros', { titulo });
      setTitulo('');
      registros.reload();
      toast('Registro creado.');
    } catch (err) { toast(err.message); } finally { setEnviando(false); }
  };

  if (!registros.data) return <Loading error={registros.error} />;
  const lista = registros.data;
  return (
    <>
      <PageHead title="__NOMBRE__" sub={`Hola, ${usuario.nombre.split(' ')[0]}. Describa aquí el propósito del módulo.`} />
      <Kpis items={[['Registros', lista.length, 'En la base del módulo', 'list'], ['Hoy', lista.filter((r) => new Date(r.creado_en).toDateString() === new Date().toDateString()).length, 'Creados hoy', 'clock']]} />
      <div className="grid g2 mt">
        <Card title="Nuevo registro" sub="Los datos quedan en la base de datos propia del módulo">
          <form className="__ID__-form" onSubmit={crear}>
            <Field label="Título"><input style={fieldStyle} value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={3} /></Field>
            <button className="btn btn-p" disabled={enviando}><Icon name="check" />{enviando ? 'Guardando…' : 'Guardar'}</button>
          </form>
        </Card>
        <Card title="Registros" sub={lista.length + ' en total'} flush>
          <Table headers={['Registro', 'Creado por']} rows={lista.map((r) => [<Cell key="c" main={r.titulo} sub={new Date(r.creado_en).toLocaleString('es-CO')} />, r.creado_por])} />
        </Card>
      </div>
    </>
  );
}
