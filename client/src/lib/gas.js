// Equivalente de google.script.run para COI V1: llama la función homónima del servidor Node.
//   const res = await gas('obtenerUsuarios');
//   const r = await gas('registrarNovedad', payload);
export async function gas(fn, ...args) {
  const res = await fetch('/api/coiv1/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args }) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || 'Error ' + res.status + ' en ' + fn);
  return data.result;
}
