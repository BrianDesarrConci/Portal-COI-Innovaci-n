// Libros de Google Sheets de COI V1 y su copia de demostración en server/src/data/coiv1.
export const BOOKS = {
  coiv1: { id: '1dr45Mglxhv-QoljLTNn37BFsrr6gtZVLZlMVCIMhk54', title: 'COI V1' },
  granja: { id: '1bPDJzCO4SoovpXbxXZfXQg4HkJMlEyf5Jkd7wGfLpmg', title: '3. GRANJA DE USUARIOS_COI' },
  directorio: { id: '1EOIb3MakuBpkXnp8nlcvQ1oTibl3VsUNqw-eaZnsMFc', title: '2. DIRECTORIO GEOREFERENCIACION' }
};
// Constantes con los mismos nombres del código V1.
export const ID_EXCEL_PRINCIPAL = BOOKS.coiv1.id;   // COI V1 (Código.gs) y SPREADSHEET_ID (Control de Arqueos)
export const ID_EXCEL_DIRECTORIO = BOOKS.granja.id; // Granja de usuarios
export const DIRECTORIO_ID = BOOKS.directorio.id;   // Directorio Nacional (Control de Arqueos)
export const bookById = (id) => Object.keys(BOOKS).find((k) => BOOKS[k].id === id) || null;
