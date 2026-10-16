    // ===================== RESPALDO DE LIBRERIAS EXTERNAS =====================
    // Si ningun CDN de Chart.js cargo (red corporativa restrictiva), se instala un
    // sustituto inofensivo: los graficos muestran un aviso y el resto de la app
    // (registro de arqueos, tablas, solicitudes) sigue funcionando con normalidad.
    if (typeof window.Chart === 'undefined') {
      console.warn('[Arqueos] Chart.js no disponible: graficos deshabilitados en este equipo.');
      window.Chart = function (canvas) {
        try {
          const c = (typeof canvas === 'string') ? document.getElementById(canvas) : (canvas && canvas.canvas) || canvas;
          if (c && c.parentNode) {
            const aviso = document.createElement('div');
            aviso.className = 'flex items-center justify-center text-center text-xs font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6';
            aviso.innerHTML = '<i class="fa-solid fa-chart-simple mr-2"></i>Gráfico no disponible: tu red bloquea la librería de gráficos.';
            c.style.display = 'none';
            c.parentNode.insertBefore(aviso, c);
          }
        } catch (e) { /* sin efecto */ }
        return { destroy: function () {}, update: function () {}, data: { labels: [], datasets: [] } };
      };
    }

    // ===================== ESTADO Y UTILIDADES =====================
    var currentUser=null, charts={}, mesActual=null;
    var FMT = { EFECTIVO:'FOR-GOR-020-09', CHEQUES:'FOR-GOR-048-01', ATM:'FOR-GOR-099-02' };
    // Denominaciones por defecto de las gavetas del ATM (incluye el billete de
    // $100.000; cada gaveta se puede cambiar o eliminar segun el cajero).
    var DENOM_DEFECTO = [10000, 20000, 50000, 100000];
    var DENOMINACIONES = [2000, 5000, 10000, 20000, 50000, 100000];
    var MAX_GAVETAS = 8;
    // Estados de gestion (deben coincidir con el backend)
    var REV = { NOVEDAD:'NOVEDAD SOPORTE', CORREGIDO:'CORREGIDO', OK:'OK' };
    var DIFE = { PENDIENTE:'PENDIENTE EXPLICACION', RECUPERADO:'RECUPERADO', NO_RECUPERADO:'NO RECUPERADO', CRUZADO:'CRUZADO / COMPENSADO', NO_CRUZADO:'NO COMPENSADO' };
    var TIPOLOGIAS = [];
    var PENDIENTES = { total:0, items:[], pendientesLider:0, pendientesAnalista:0 };

    // ===================== MEMORIA DE CONSULTAS EN EL NAVEGADOR =====================
    // Evita repetir consultas al cambiar de pestaña. Se vacía después de cualquier
    // registro o gestión, y con el botón Actualizar. El servidor además tiene su
    // propia caché por versión de datos.
    var FCACHE = {};
    var FCACHE_TTL = 180000; // 3 min
    function llamar(clave, fn, args, ok, fallo){
      const h = FCACHE[clave];
      if(h && (Date.now()-h.t) < FCACHE_TTL){ ok(h.v); return; }
      google.script.run.withSuccessHandler(v=>{
        if(v!==null && v!==undefined && !(v && (v.error || v.success===false))) FCACHE[clave] = { t:Date.now(), v:v };
        ok(v);
      }).withFailureHandler(fallo || (()=>{}))[fn].apply(null, args);
    }
    function invalidarFront(){ FCACHE = {}; }
    /** Después de cualquier escritura: memoria limpia y pendientes al día. */
    function trasEscritura(){ invalidarFront(); cargarPendientes(false); }
    var MAX_MB_TIRILLA = 8;
    // Tope de formatos FOR-GOR-099-02 que la interfaz puede desplegar por oficina.
    // Debe coincidir con MAX_ATM_POR_OFICINA del backend.
    var MAX_ATM_UI = 6;
    // Fecha de hoy segun el servidor (hora de Colombia). La llena getContextoArqueo.
    var HOY_SERVIDOR = '';

    /**
     * Fecha local de un Date como 'yyyy-MM-dd'.
     * NO usar toISOString(): devuelve UTC y en Colombia (GMT-5) adelanta el dia
     * a partir de las 7:00 p.m., generando fechas futuras.
     */
    function fechaLocalISO(d){
      const z=n=>String(n).padStart(2,'0');
      return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());
    }

    // Estado del formulario de arqueo
    var ARQ = { oficinas:[], ofi:null, modalidad:'', cheques:{ items:[] }, atms:[], visita:null, sel:{ efectivo:true, cheques:true, atm:true } };

    var fmt = n => '$' + (Number(n)||0).toLocaleString('es-CO');
    var el = id => document.getElementById(id);
    var spinner = `<div class="flex items-center justify-center py-20"><div class="loader" style="border-color:#cbd5e1;border-top-color:#25294F;display:block;width:32px;height:32px"></div></div>`;
    function errorBox(msg){ return `<div class="bg-red-50 border-l-4 border-red-500 p-5 rounded-r-xl"><p class="text-sm font-black text-red-600"><i class="fa-solid fa-circle-exclamation mr-2"></i>Error del sistema</p><p class="text-xs font-bold text-red-500 mt-1">${msg}</p><p class="text-xs text-slate-500 mt-2">Verifica que ejecutaste <b>inicializarBaseDeDatos()</b> y que el script tenga acceso a la BD del Directorio Nacional.</p></div>`; }
    function fail(c){ return e => { c.innerHTML = errorBox(e && e.message ? e.message : String(e)); }; }
    function togglePass(){ const p=el('l-pass'), i=el('icon-pass');
      if(p.type==='password'){p.type='text';i.className='fa-solid fa-eye-slash';}else{p.type='password';i.className='fa-solid fa-eye';} }
    function cerrarModal(){ el('modal').classList.add('hidden'); }
    function abrirModal(html, ancho){ const b=el('modal-box'); b.className='relative bg-white rounded-[1.5rem] shadow-2xl w-full '+(ancho||'max-w-lg')+' p-6 slide-up max-h-[85vh] overflow-y-auto'; b.innerHTML=html; el('modal').classList.remove('hidden'); }
    function semColor(s){ return s==='verde'?'#3D8A44':(s==='amarillo'?'#F6CF46':'#ef4444'); }
    function semBadge(s,txt){ const map={verde:'bg-green-100 text-multival-green border-green-200',amarillo:'bg-yellow-100 text-yellow-700 border-yellow-200',rojo:'bg-red-100 text-red-700 border-red-200'};
      return `<span class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${map[s]||map.rojo}">${txt}</span>`; }
    function kpiCard(label,val,sub,color,icon){ return `<div class="bg-white p-5 rounded-2xl shadow-soft border border-slate-100 relative overflow-hidden transition-transform hover:-translate-y-1">
      <div class="absolute -right-3 -top-3 w-14 h-14 rounded-full" style="background:${color}12"></div>
      <div class="flex items-center gap-2 mb-1"><i class="fa-solid ${icon} text-xs" style="color:${color}"></i><p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">${label}</p></div>
      <p class="text-2xl font-black" style="color:${color}">${val}</p>${sub?`<p class="text-[11px] font-bold text-slate-400 mt-0.5">${sub}</p>`:''}</div>`; }
    function ringSVG(pct,color,size){ size=size||140; const r=(size/2)-12, cir=2*Math.PI*r, off=cir-(Math.min(pct,100)/100)*cir;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="-rotate-90">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#eef2f7" stroke-width="12"/>
        <circle class="ring-progress" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${cir}" stroke-dashoffset="${off}"/></svg>`; }
    function mesNombre(mes){ const [y,m]=mes.split('-'); const nom=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']; return nom[parseInt(m)-1]+' '+y; }
    function destruir(id){ if(charts[id]){charts[id].destroy(); delete charts[id];} }
    function esc(v){ return String(v===null||v===undefined?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function n(v){ const x=parseFloat(String(v===undefined||v===null?'':v).replace(/[^0-9.\-]/g,'')); return isNaN(x)?0:x; }

    function selectorMes(onchangeFn){
      return `<select id="sel-mes" onchange="${onchangeFn}" class="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-black text-multival-navy outline-none focus:ring-2 focus:ring-multival-green/20 cursor-pointer"><option>Cargando...</option></select>`;
    }
    function poblarMeses(){
      llamar('meses', 'obtenerMesesDisponibles', [currentUser.idUsuario, currentUser.rol], meses=>{
        const s=el('sel-mes'); if(!s || !meses) return;
        s.innerHTML = meses.map(m=>`<option value="${m}" ${m===mesActual?'selected':''}>${mesNombre(m)}</option>`).join('');
      });
    }

    // ===================== LOGIN / APP =====================
    document.addEventListener('DOMContentLoaded', () => {
      if (urlUser && urlLlave) {
        el('login-msg').innerText = 'Validando llave de acceso desde el aplicativo...';
        el('login-msg').className = 'text-center text-sm font-bold text-multival-navy h-5';
        el('login-loader').style.display = 'block';
        el('btn-login').disabled = true;

        google.script.run.withSuccessHandler(res => {
          el('login-loader').style.display = 'none';
          if(res.success){ currentUser = res; iniciarApp(); }
          else {
            el('login-msg').innerText = res.message;
            el('login-msg').className = 'text-center text-sm font-bold text-red-500 h-5';
            el('btn-login').disabled = false;
          }
        }).withFailureHandler(e => {
          el('login-loader').style.display = 'none';
          el('login-msg').innerText = 'Error de conexión con el aplicativo central.';
          el('btn-login').disabled = false;
        }).validarEmbebido(urlUser, urlLlave);
      }
    });

    function handleLogin(){
      const u=el('l-email').value.trim(), p=el('l-pass').value.trim();
      if(!u||!p){ el('login-msg').innerText='Ingresa usuario y contraseña.'; return; }
      el('btn-login').disabled=true; el('login-text').innerText='Verificando...'; el('login-loader').style.display='block'; el('login-msg').innerText='';
      google.script.run.withSuccessHandler(res=>{
        el('btn-login').disabled=false; el('login-text').innerText='Ingresar'; el('login-loader').style.display='none';
        if(res.success){ currentUser=res; iniciarApp(); } else el('login-msg').innerText=res.message||'Credenciales inválidas';
      }).withFailureHandler(e=>{ el('btn-login').disabled=false; el('login-text').innerText='Ingresar'; el('login-loader').style.display='none'; el('login-msg').innerText='Error de conexión: '+e.message; })
      .validarLogin(u,p);
    }
    function logout(){ location.reload(); }

    function iniciarApp(){
      el('login-screen').style.display='none'; el('app').classList.remove('hidden');
      el('hdr-nombre').innerText=currentUser.nombre; el('hdr-rol').innerText=currentUser.rol;
      const d0=new Date(); mesActual = d0.getFullYear()+'-'+String(d0.getMonth()+1).padStart(2,'0');
      const upd=()=>{ const d=new Date(); el('hdr-reloj').innerText=d.toLocaleDateString('es-CO',{weekday:'short',day:'2-digit',month:'short'})+' · '+d.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}); };
      upd(); setInterval(upd,30000);
      construirNav();
      google.script.run.withSuccessHandler(t=>{ TIPOLOGIAS = t||[]; }).withFailureHandler(()=>{}).getTipologias();
      cargarPendientes(true);
      setInterval(()=>cargarPendientes(false), 300000); // refresco de alertas cada 5 min
      irA(currentUser.rol==='Lider'?'cargar':'dashboard');
    }

    // ===================== ALERTAS PERSISTENTES DE NOVEDADES =====================
    // Se consultan al iniciar y en cada cambio de pestaña: la alerta permanece
    // visible hasta que el líder responda (o el analista confirme el OK).
    function cargarPendientes(mostrarModal){
      google.script.run.withSuccessHandler(p=>{
        PENDIENTES = p && p.success ? p : { total:0, items:[], pendientesLider:0, pendientesAnalista:0 };
        pintarAlertaPendientes();
        if(mostrarModal && currentUser.rol==='Lider' && PENDIENTES.pendientesLider>0) modalPendientes();
      }).withFailureHandler(()=>{}).obtenerPendientes(currentUser.idUsuario, currentUser.rol);
    }

    function pintarAlertaPendientes(){
      const box=el('alerta-pendientes'); if(!box) return;
      const P=PENDIENTES;
      // Badge en la pestaña de arqueos
      const btn=document.querySelector('.nav-btn[data-tab="historial"]');
      if(btn){ const old=btn.querySelector('.nav-badge'); if(old) old.remove();
        if(P.total>0) btn.insertAdjacentHTML('beforeend',`<span class="nav-badge">${P.total}</span>`); }
      if(!P.total){ box.innerHTML=''; return; }
      if(currentUser.rol==='Lider'){
        box.innerHTML=`<div class="alerta-pend">
          <div class="num">${P.pendientesLider}</div>
          <div class="flex-1">
            <p class="text-sm font-black"><i class="fa-solid fa-bell mr-1"></i>Tienes ${P.pendientesLider} novedad(es) de arqueo pendiente(s) por responder</p>
            <p class="text-xs font-bold text-red-100">${P.items.slice(0,3).map(i=>esc(i.oficina)+' · '+esc(i.fechaReal)+' ('+i.tipos.map(t=>t==='SOPORTE'?'corregir soporte':'explicar diferencia').join(' + ')+')').join(' · ')}${P.items.length>3?' · …':''}</p>
            <p class="text-[10px] font-bold text-red-200 mt-0.5">Esta alerta permanecerá activa hasta que respondas todas las novedades.</p>
          </div>
          <button onclick="modalPendientes()" class="bg-white text-red-700 font-black text-xs px-4 py-2 rounded-xl hover:bg-red-50 shrink-0">Responder ahora</button>
        </div>`;
      } else {
        box.innerHTML=`<div class="alerta-pend suave">
          <div class="num">${P.total}</div>
          <div class="flex-1">
            <p class="text-sm font-black"><i class="fa-solid fa-clipboard-check mr-1 text-multival-gold"></i>${P.pendientesAnalista} respuesta(s) de líderes pendientes de confirmar OK · ${P.pendientesLider} novedad(es) esperando respuesta del líder</p>
            <p class="text-[10px] font-bold text-blue-200 mt-0.5">Los líderes reciben alerta persistente en pantalla y correo diario hasta responder.</p>
          </div>
          <button onclick="HIST_FILTRO_SIG='pend';irA('historial')" class="bg-white text-multival-navy font-black text-xs px-4 py-2 rounded-xl hover:bg-slate-50 shrink-0">Ver en la matriz</button>
        </div>`;
      }
    }

    function modalPendientes(){
      const P=PENDIENTES;
      const items=P.items.filter(i=>currentUser.rol==='Lider'? i.quien==='LIDER' : true);
      abrirModal(`
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center"><i class="fa-solid fa-bell"></i></div>
          <div><h3 class="font-black text-multival-navy">Novedades pendientes</h3>
          <p class="text-xs text-slate-500">${currentUser.rol==='Lider'?'Debes responder cada una para que la alerta desaparezca.':'Estado de la gestión de novedades.'}</p></div></div>
        <div class="space-y-2 scroll-y">
          ${items.length? items.map(i=>`
          <div class="border border-slate-200 rounded-xl p-3 ${i.quien==='LIDER'?'bg-red-50':'bg-slate-50'}">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div><p class="text-xs font-black text-multival-navy">${esc(i.oficina)} · ${esc(i.fechaReal)}</p>
              <p class="text-[10px] font-bold text-slate-500">${esc(i.formato)} · ${esc(i.novedad||'')} ${i.diferencia!==''&&i.diferencia!=='Pendiente N8N'?'· '+(i.formato===FMT.CHEQUES?i.diferencia:fmt(i.diferencia)):''}${currentUser.rol!=='Lider'?' · líder '+esc(i.nombreLider):''}</p></div>
              <div class="flex gap-1 flex-wrap">${i.tipos.map(t=>`<span class="badge ${t==='CONFIRMAR OK'?'badge-info':'badge-pend'}">${t}</span>`).join('')}</div>
            </div>
            ${i.obsAnalista?`<p class="text-[11px] text-slate-600 mt-2 bg-white rounded-lg p-2 border border-slate-100"><b>Analista:</b> ${esc(i.obsAnalista)}</p>`:''}
            <div class="flex justify-end mt-2">
              ${i.quien==='LIDER' && currentUser.rol==='Lider'
                ? `<button onclick="cerrarModal();abrirRespuesta('${i.id}')" class="bg-multival-navy text-white text-[11px] font-black px-3 py-1.5 rounded-lg">Responder</button>`
                : (currentUser.rol!=='Lider' ? `<button onclick="cerrarModal();abrirGestion('${i.id}')" class="bg-multival-navy text-white text-[11px] font-black px-3 py-1.5 rounded-lg">Gestionar</button>`:'')}
            </div>
          </div>`).join('')
          : '<p class="text-center text-slate-400 font-bold py-6">Sin novedades pendientes.</p>'}
        </div>
        <div class="flex justify-end mt-4"><button onclick="cerrarModal()" class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-multival-navy">Cerrar</button></div>`,'max-w-xl');
    }

    function construirNav(){
      let tabs=[];
      if(currentUser.rol==='Lider') tabs=[
        {id:'cargar',ic:'fa-file-circle-plus',txt:'Cargar Arqueo'},
        {id:'dashboard',ic:'fa-gauge-high',txt:'Mi Cumplimiento'},
        {id:'historial',ic:'fa-list-check',txt:'Mis Arqueos'},
        {id:'clientes',ic:'fa-building-columns',txt:'Mis Oficinas'},
        {id:'novedades',ic:'fa-triangle-exclamation',txt:'Faltantes / Sobrantes'},
        {id:'normalizaciones',ic:'fa-rotate-left',txt:'Mis Solicitudes'}];
      else if(currentUser.rol==='Regional') tabs=[
        {id:'dashboard',ic:'fa-gauge-high',txt:'Dashboard Regional'},
        {id:'lideres',ic:'fa-ranking-star',txt:'Cumplimiento por Líder'},
        {id:'clientes',ic:'fa-building-columns',txt:'Por Cliente / Oficina'},
        {id:'regional',ic:'fa-map',txt:'Regional y Zona'},
        {id:'analitica',ic:'fa-chart-pie',txt:'Analítica'},
        {id:'novedades',ic:'fa-triangle-exclamation',txt:'Faltantes / Sobrantes'},
        {id:'tendencias',ic:'fa-chart-line',txt:'Tendencias'},
        {id:'historial',ic:'fa-database',txt:'Matriz de Arqueos'},
        {id:'normalizaciones',ic:'fa-stamp',txt:'Aprobaciones'}];
      else tabs=[
        {id:'dashboard',ic:'fa-gauge-high',txt:'Dashboard Global'},
        {id:'lideres',ic:'fa-ranking-star',txt:'Cumplimiento por Líder'},
        {id:'clientes',ic:'fa-building-columns',txt:'Por Cliente / Oficina'},
        {id:'regional',ic:'fa-map',txt:'Regional y Zona'},
        {id:'analitica',ic:'fa-chart-pie',txt:'Analítica'},
        {id:'novedades',ic:'fa-triangle-exclamation',txt:'Faltantes / Sobrantes'},
        {id:'tendencias',ic:'fa-chart-line',txt:'Tendencias'},
        {id:'historial',ic:'fa-database',txt:'Matriz de Arqueos'},
        {id:'normalizaciones',ic:'fa-clipboard-check',txt:'Log Normalizaciones'}];
      el('nav-tabs').innerHTML = tabs.map(t=>`<button data-tab="${t.id}" onclick="irA('${t.id}')" class="nav-btn shrink-0 px-4 py-2.5 text-sm font-bold rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-multival-navy transition-all flex items-center gap-2"><i class="fa-solid ${t.ic}"></i>${t.txt}</button>`).join('');
    }

    function irA(tab){
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
      const c=el('content'); c.className='fade-in';
      ({cargar:renderCargar, dashboard:renderDashboard, lideres:renderLideres,
        novedades:renderNovedades, historial:renderHistorial, clientes:renderClientes,
        regional:renderRegional, analitica:renderAnalitica,
        tendencias:renderTendencias, normalizaciones:renderNormalizaciones}[tab])(c);
      pintarAlertaPendientes(); // la alerta persiste en todas las pestañas sin volver a consultar
    }

    function conDashboard(c, cb){
      llamar('dash|'+mesActual, 'obtenerDashboard', [currentUser.idUsuario, currentUser.rol, mesActual], d=>{
        if(d && d.error){ c.innerHTML = errorBox(d.error); return; }
        cb(d);
      }, fail(c));
    }
    function cambiarMes(){ mesActual = el('sel-mes').value; renderDashboard(el('content')); }

    // ==========================================================
    // VISTA: CARGAR ARQUEO (LIDER)
    // ==========================================================
    function renderCargar(c){
      ARQ = { oficinas:[], ofi:null, modalidad:'', cheques:{ items:[] }, atms:[], visita:null, sel:{ efectivo:true, cheques:true, atm:true } };

      c.innerHTML = `
      <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6 md:p-10 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-multival-green to-multival-gold"></div>

        <div class="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-6 gap-4">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl bg-multival-navy/5 flex items-center justify-center text-multival-navy"><i class="fa-solid fa-file-invoice-dollar text-lg"></i></div>
            <div><h2 class="text-xl font-black text-multival-navy">Registrar Arqueo</h2>
            <p class="text-xs text-slate-500">Los formatos exigidos se determinan automáticamente desde el Directorio Nacional según la oficina que elijas.</p></div>
          </div>
          <div class="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button onclick="setTab('digital')" id="tab-digital" class="px-4 py-2 text-sm font-bold rounded-lg bg-white text-multival-navy shadow-sm flex items-center gap-2"><i class="fa-solid fa-keyboard text-multival-green"></i>Diligenciar</button>
            <button onclick="setTab('manual')" id="tab-manual" class="px-4 py-2 text-sm font-bold rounded-lg text-slate-500 flex items-center gap-2"><i class="fa-solid fa-cloud-arrow-up"></i>Adjuntar soporte</button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div><label class="block text-xs font-bold text-slate-600 mb-1.5">Oficina <span class="text-red-500">*</span></label>
            <select id="f-oficina" onchange="onOficinaChange()" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-multival-navy focus:ring-2 focus:ring-multival-green/20 outline-none"><option value="">Cargando oficinas...</option></select></div>
          <div><label class="block text-xs font-bold text-slate-600 mb-1.5">Fecha real del arqueo <span class="text-red-500">*</span></label>
            <input type="date" id="f-fecha" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-multival-navy focus:ring-2 focus:ring-multival-green/20 outline-none">
            <p class="text-[10px] text-slate-400 mt-1">+2 días hábiles = extemporáneo (no cuenta a la meta, normalizable).</p>
            <p id="f-fecha-nota" class="text-[10px] font-bold text-slate-400 mt-0.5"></p></div>
          <div><label class="block text-xs font-bold text-slate-600 mb-1.5">Hora del arqueo <span class="text-red-500">*</span></label>
            <input type="time" id="f-hora" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-multival-navy focus:ring-2 focus:ring-multival-green/20 outline-none"></div>
        </div>

        <div class="mb-5">
          <label class="block text-xs font-bold text-slate-600 mb-1.5">¿Cómo se realizó este arqueo? <span class="text-red-500">*</span></label>
          <div class="flex gap-3">
            <button type="button" id="modo-PRESENCIAL" onclick="setModalidad('PRESENCIAL')" class="modo-btn">
              <i class="fa-solid fa-person-walking-luggage mr-2 text-multival-green"></i>Presencial
              <span class="block text-[10px] font-bold text-slate-400 mt-0.5">Estuve en la oficina contando el efectivo</span>
            </button>
            <button type="button" id="modo-VIRTUAL" onclick="setModalidad('VIRTUAL')" class="modo-btn">
              <i class="fa-solid fa-video mr-2 text-multival-navy"></i>Virtual
              <span class="block text-[10px] font-bold text-slate-400 mt-0.5">Lo supervisé por videollamada o de forma remota</span>
            </button>
          </div>
          <p id="msg-modalidad" class="text-[11px] font-bold text-red-500 mt-1 h-4"></p>
        </div>

        <div id="req-panel" class="mb-6"></div>

        <div id="form-digital" class="fade-in">
          <div id="zona-formatos" class="space-y-6"></div>

          <div class="flex flex-col sm:flex-row justify-end items-center gap-4 pt-6 mt-6 border-t border-dashed border-slate-300">
            <span id="msg-dig" class="text-sm font-bold text-right"></span>
            <button onclick="enviarArqueo()" id="btn-dig" class="bg-multival-navy hover:bg-multival-navyHover text-white font-bold py-3 px-8 rounded-xl shadow-soft transition-all flex items-center gap-2">
              <i class="fa-solid fa-file-pdf text-multival-gold"></i><span>Guardar arqueo y generar PDF</span><div id="loader-dig" class="loader"></div></button>
          </div>
        </div>

        <div id="form-manual" class="hidden fade-in space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label class="block text-xs font-bold text-slate-600 mb-1.5">Formato del soporte</label>
              <select id="m-formato" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-multival-navy outline-none">
                <option value="${FMT.EFECTIVO}">${FMT.EFECTIVO} · Efectivo</option>
                <option value="${FMT.CHEQUES}">${FMT.CHEQUES} · Títulos valor</option>
                <option value="${FMT.ATM}">${FMT.ATM} · Cajeros automáticos</option></select></div>
            <div><label class="block text-xs font-bold text-slate-600 mb-1.5">Elemento</label>
              <select id="m-elemento" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-multival-navy outline-none"><option value="Bóveda">Bóveda</option><option value="Caja">Caja</option><option value="Títulos Valor">Títulos Valor</option><option value="ATM">Cajero ATM</option></select></div>
            <div><label class="block text-xs font-bold text-slate-600 mb-1.5">Número (Caja / ATM / Acta)</label>
              <input type="text" id="m-numero" placeholder="Ej. 01" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-multival-navy outline-none"></div>
          </div>
          <div class="bg-amber-50 border-l-4 border-multival-gold p-4 rounded-r-lg">
            <p class="text-xs font-bold text-multival-navy"><i class="fa-solid fa-robot text-multival-gold mr-2"></i>Usa esta opción solo si diligenciaste el formato en papel. Adjunta el documento firmado (PDF o foto); el robot N8N hará OCR y extraerá montos y diferencia.</p>
          </div>
          <div class="border-2 border-dashed border-slate-300 bg-slate-50 rounded-xl p-8 text-center">
            <input type="file" id="f-archivo" class="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-multival-navy file:text-white cursor-pointer">
          </div>
          <div class="flex justify-end items-center gap-4">
            <span id="msg-man" class="text-sm font-bold"></span>
            <button onclick="enviarManual()" id="btn-man" class="bg-multival-navy hover:bg-multival-navyHover text-white font-bold py-3 px-8 rounded-xl shadow-soft transition-all flex items-center gap-2"><span>Subir soporte</span><div id="loader-man" class="loader"></div></button>
          </div>
        </div>
      </div>`;

      // La fecha local se calcula con los componentes locales, NO con
      // toISOString(): ese metodo devuelve UTC y despues de las 7 p.m. en
      // Colombia ya reporta el dia siguiente, lo que hacia que el formulario se
      // autollenara con una fecha futura. El servidor la corrige mas abajo.
      const hoy=new Date();
      el('f-fecha').value=fechaLocalISO(hoy);
      el('f-fecha').max=fechaLocalISO(hoy);
      el('f-hora').value=hoy.toTimeString().slice(0,5);
      el('f-fecha').addEventListener('change',()=>{ syncEncabezado(); consultarVisita(); });
      el('f-hora').addEventListener('change',syncEncabezado);

      el('req-panel').innerHTML = `<div class="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-bold text-slate-500"><i class="fa-solid fa-circle-notch fa-spin mr-2 text-multival-green"></i>Consultando el Directorio Nacional...</div>`;

      google.script.run.withSuccessHandler(ctx=>{
        if(!ctx.success){ el('req-panel').innerHTML = errorBox(ctx.message||'No fue posible leer el Directorio Nacional.'); return; }
        ARQ.oficinas = ctx.oficinas||[];
        currentUser.nombreLider = ctx.nombreLider || currentUser.nombre;
        if(Array.isArray(ctx.denominacionesATM) && ctx.denominacionesATM.length) DENOMINACIONES = ctx.denominacionesATM.slice();

        // La fecha de hoy la define el SERVIDOR en hora de Colombia. Asi el
        // formulario no depende del reloj ni de la zona del equipo del lider.
        if(ctx.hoy){
          HOY_SERVIDOR = ctx.hoy;
          const f=el('f-fecha');
          f.max = ctx.hoy;
          if(!f.value || f.value > ctx.hoy) f.value = ctx.hoy;
          if(el('f-fecha-nota')){
            el('f-fecha-nota').innerHTML = `Hoy en Colombia: <b class="text-multival-navy">${esc(ctx.hoy)}</b>`;
          }
        }
        const s=el('f-oficina');
        if(!ARQ.oficinas.length){
          s.innerHTML='<option value="">Sin oficinas asignadas</option>';
          el('req-panel').innerHTML = `<div class="bg-amber-50 border-l-4 border-multival-gold p-5 rounded-r-xl">
            <p class="text-sm font-black text-multival-navy"><i class="fa-solid fa-triangle-exclamation mr-2 text-multival-gold"></i>No tienes oficinas asignadas en el Directorio Nacional</p>
            <p class="text-xs font-bold text-slate-600 mt-1">La columna <b>LÍDER DE EXCELENCIA</b> del directorio no registra tu nombre. Solicita a Gestión Administrativa la actualización del directorio o el registro de tu alias en la hoja <b>Alias_Lideres</b>.</p></div>`;
          el('zona-formatos').innerHTML='';
          return;
        }
        s.innerHTML='<option value="">Selecciona la oficina...</option>'+
          ARQ.oficinas.map((o,i)=>`<option value="${i}">${esc(o.oficina)}</option>`).join('');
        el('req-panel').innerHTML = `<div class="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-bold text-slate-500">
          <i class="fa-solid fa-building-columns mr-2 text-multival-green"></i>Tienes <b class="text-multival-navy">${ARQ.oficinas.length}</b> oficina(s) asignada(s). Selecciona una para ver los formatos que debes diligenciar.</div>`;
      }).withFailureHandler(e=>{ el('req-panel').innerHTML = errorBox(e.message); })
      .getContextoArqueo(currentUser.idUsuario, currentUser.rol);
    }

    function setTab(t){
      el('form-digital').classList.toggle('hidden',t!=='digital');
      el('form-manual').classList.toggle('hidden',t!=='manual');
      const on='px-4 py-2 text-sm font-bold rounded-lg bg-white text-multival-navy shadow-sm flex items-center gap-2';
      const off='px-4 py-2 text-sm font-bold rounded-lg text-slate-500 flex items-center gap-2';
      el('tab-digital').className = t==='digital'?on:off;
      el('tab-manual').className  = t==='manual' ?on:off;
    }

    function setModalidad(m){
      ARQ.modalidad=m;
      ['PRESENCIAL','VIRTUAL'].forEach(k=>el('modo-'+k).classList.toggle('sel',k===m));
      el('msg-modalidad').innerText='';
      syncEncabezado();
    }

    // ---------- Selección de oficina y armado de formatos ----------
    function onOficinaChange(){
      const idx = el('f-oficina').value;
      if(idx===''){ ARQ.ofi=null; ARQ.visita=null; el('zona-formatos').innerHTML=''; el('req-panel').innerHTML=''; return; }
      ARQ.ofi = ARQ.oficinas[parseInt(idx,10)];
      consultarVisita();
    }

    /**
     * Pregunta al servidor si el arqueo sera la PRIMERA visita del mes a la
     * oficina (formatos obligatorios) o una VISITA ADICIONAL (formatos a
     * eleccion del lider, sin sumar a la meta).
     */
    function consultarVisita(){
      if(!ARQ.ofi) return;
      const fecha = el('f-fecha') ? el('f-fecha').value : '';
      if(!fecha) return;

      el('req-panel').innerHTML = `<div class="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-bold text-slate-500"><i class="fa-solid fa-circle-notch fa-spin mr-2 text-multival-green"></i>Verificando visitas del mes a esta oficina...</div>`;

      google.script.run.withSuccessHandler(v=>{
        if(!v || !v.success){
          // Sin poder verificar, se asume primera visita: todo obligatorio.
          ARQ.visita = { esAdicional:false, tipoVisita:'PRIMERA VISITA', visitasPrevias:0, cuentaMeta:true, error:(v&&v.message)||'' };
        } else {
          ARQ.visita = v;
        }
        ARQ.sel = ARQ.visita.esAdicional
          ? { efectivo:false, cheques:false, atm:false }   // el líder elige
          : { efectivo:true,  cheques:true,  atm:true  };  // todo obligatorio
        pintarRequisitos();
        construirFormatos();
        syncEncabezado();
      }).withFailureHandler(e=>{
        ARQ.visita = { esAdicional:false, tipoVisita:'PRIMERA VISITA', visitasPrevias:0, cuentaMeta:true, error:e.message };
        ARQ.sel = { efectivo:true, cheques:true, atm:true };
        pintarRequisitos(); construirFormatos(); syncEncabezado();
      }).verificarVisitaMes(currentUser.idUsuario, currentUser.rol, ARQ.ofi.oficina, fecha);
    }

    /** Marca/desmarca un formato opcional en una visita adicional. */
    function toggleFormato(cual, activo){
      ARQ.sel[cual] = !!activo;
      construirFormatos();
      pintarRequisitos();
    }

    /** Etiqueta legible del requisito ATM: código si es uno, cantidad si son varios. */
    function etiquetaATM(r){
      if(!r.atm) return 'Sin cajero';
      const cods = Array.isArray(r.codigosATM) ? r.codigosATM.filter(c=>String(c).trim()) : [];
      if(cods.length > 1) return 'ATM x'+cods.length+' ('+esc(cods.join(', '))+')';
      if(cods.length === 1 && !/^cajero/i.test(cods[0])) return 'Cajero '+esc(cods[0]);
      return 'Cajero automático';
    }

    function pintarRequisitos(){
      const o=ARQ.ofi, r=o.requiere;
      const v=ARQ.visita||{esAdicional:false};
      const adicional = !!v.esAdicional;

      const chip=(activo,txt,ico,col)=>`<span class="req-chip ${activo?col:'bg-slate-100 text-slate-400'}"><i class="fa-solid ${activo?ico:'fa-minus'}"></i>${txt}</span>`;

      const aviso = r.sinParametrizar
        ? `<div class="mt-3 bg-amber-50 border-l-4 border-multival-gold p-3 rounded-r-lg text-xs font-bold text-multival-navy">
            <i class="fa-solid fa-circle-info text-multival-gold mr-1"></i>Esta oficina no tiene <b>MEDIO DE PAGO</b> parametrizado en el Directorio Nacional (valor: "${esc(o.medioPago)}"). El arqueo de efectivo queda habilitado como opcional; reporta la novedad a Gestión Administrativa para que actualicen la BD.</div>` : '';

      // Banda de estado de la visita del mes.
      const atmYa = v.atmArqueadosMes || {};
      const atmYaTxt = Object.keys(atmYa).length
        ? `<p class="text-[11px] font-bold text-amber-700 mt-1"><i class="fa-solid fa-building-columns mr-1"></i>Cajero(s) con arqueo válido este mes: ${Object.keys(atmYa).map(k=>esc(k)+' ('+esc(atmYa[k])+')').join(', ')}. Puedes volver a arquearlos, pero <b>el ATM solo suma a la meta una vez al mes</b>.</p>`
        : '';
      const banda = adicional
        ? `<div class="mb-4 bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-xl">
            <p class="text-sm font-black text-purple-900"><i class="fa-solid fa-rotate-right mr-2"></i>VISITA ADICIONAL DEL MES · esta será la visita N.° ${(v.visitasPrevias||0)+1}</p>
            <p class="text-xs font-bold text-purple-800 mt-1">
              Esta oficina ya tuvo su primera visita del mes${v.primeraFecha?' el <b>'+esc(v.primeraFecha)+'</b>':''}, donde se diligenciaron todos los formatos exigidos.
              Por eso <b>ningún formato es obligatorio ahora</b>: elige abajo cuáles deseas realizar.
              <b>El arqueo de efectivo de esta visita SÍ suma a tu meta de 30</b>; el arqueo ATM solo suma si el cajero aún no tiene arqueo válido en el mes.
            </p>${atmYaTxt}
          </div>`
        : `<div class="mb-4 bg-green-50 border-l-4 border-multival-green p-4 rounded-r-xl">
            <p class="text-sm font-black text-multival-navy"><i class="fa-solid fa-flag-checkered mr-2 text-multival-green"></i>PRIMERA VISITA DEL MES a esta oficina</p>
            <p class="text-xs font-bold text-slate-600 mt-1">Debes diligenciar <b>todos</b> los formatos parametrizados en el Directorio Nacional. El arqueo de efectivo y el de cada cajero ATM <b>suman a tu meta</b> del mes (el de títulos valor es complementario).</p>${atmYaTxt}
          </div>`;

      // En visita adicional los chips se vuelven interruptores.
      const sw=(cual,exigido,txt,ico,col)=>{
        if(!exigido) return chip(false,txt,ico,col);
        if(!adicional) return chip(true,txt,ico,col);
        const on=!!ARQ.sel[cual];
        return `<label class="req-chip cursor-pointer select-none ${on?col:'bg-slate-100 text-slate-400'}">
          <input type="checkbox" ${on?'checked':''} onchange="toggleFormato('${cual}',this.checked)" class="mr-1 accent-multival-green align-middle">
          <i class="fa-solid ${on?ico:'fa-minus'}"></i>${txt}</label>`;
      };

      el('req-panel').innerHTML = banda + `
      <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-soft">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">${adicional?'Formatos disponibles (opcionales)':'Formatos exigidos para esta oficina'}</p>
            <p class="text-lg font-black text-multival-navy leading-tight">${esc(o.oficina)}</p>
            <p class="text-[11px] font-bold text-slate-400">Medio de pago: <b class="text-multival-navy">${esc(o.medioPago)}</b> · ATM: <b class="text-multival-navy">${esc(o.atmValor||'—')}</b></p>
          </div>
          <div class="flex flex-wrap gap-2">
            ${sw('efectivo', r.efectivo||r.sinParametrizar, FMT.EFECTIVO+' · Efectivo','fa-money-bill-wave','bg-green-100 text-multival-green')}
            ${sw('cheques',  r.cheques, FMT.CHEQUES+' · Títulos valor','fa-money-check','bg-blue-100 text-blue-700')}
            ${sw('atm',      r.atm, FMT.ATM+' · '+etiquetaATM(r),'fa-building-columns','bg-amber-100 text-amber-700')}
          </div>
        </div>${aviso}
      </div>`;
    }

    function construirFormatos(){
      const r=ARQ.ofi.requiere;
      const adicional = !!(ARQ.visita && ARQ.visita.esAdicional);
      // Un formato se muestra si el Directorio lo exige Y (es primera visita del
      // mes O el lider lo eligio en esta visita adicional).
      const activo = cual => (adicional ? !!ARQ.sel[cual] : true);

      const verEfectivo = (r.efectivo || r.sinParametrizar) && activo('efectivo');
      const verCheques  = r.cheques && activo('cheques');
      const verAtm      = r.atm && activo('atm');

      let html='';
      if(verEfectivo) html += bloqueEfectivo(r.sinParametrizar || adicional);
      if(verCheques){ ARQ.cheques={items:[filaChequeVacia(),filaChequeVacia(),filaChequeVacia()]}; html += bloqueCheques(adicional); }
      else ARQ.cheques={items:[]};

      if(verAtm){
        // La columna BB del Directorio trae el CODIGO del cajero, no una cantidad.
        // codigosATM manda; numATM es solo su longitud. Tope duro de seguridad.
        const codigos = Array.isArray(r.codigosATM) && r.codigosATM.length ? r.codigosATM : [''];
        const total = Math.min(codigos.length, MAX_ATM_UI);
        ARQ.atms=[];
        for(let i=0;i<total;i++) ARQ.atms.push(atmVacio(i+1, codigos[i]));
        html += bloqueAtm(adicional);
      } else ARQ.atms=[];

      if(!html){
        html = adicional
          ? `<div class="bg-purple-50 border border-purple-200 rounded-2xl p-8 text-center">
              <i class="fa-solid fa-hand-pointer text-3xl text-purple-400"></i>
              <p class="text-sm font-black text-purple-900 mt-3">Elige arriba qué formatos deseas diligenciar</p>
              <p class="text-xs font-bold text-purple-700 mt-1">Ninguno es obligatorio en esta visita adicional, pero debes marcar al menos uno para poder registrar el arqueo.</p>
            </div>`
          : `<div class="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-400 font-bold">Esta oficina no exige ningún formato según el Directorio Nacional.</div>`;
      }
      el('zona-formatos').innerHTML = html;
      if(verCheques) pintarFilasCheques();
      if(verAtm) ARQ.atms.forEach((a,i)=>calcAtm(i));
      syncEncabezado();
      if(el('r1-nom') && !el('r1-nom').value) el('r1-nom').value = currentUser.nombreLider || currentUser.nombre || '';
    }

    // ---------- A. FOR-GOR-020-09 ----------
    function bloqueEfectivo(opcional){
      return `
      <div class="formato-seccion" id="blk-efectivo">
        <div class="formato-seccion-titulo flex items-center justify-between">
          <span><i class="fa-solid fa-money-bill-wave mr-2"></i>Arqueo de efectivo · ${FMT.EFECTIVO}</span>
          <span class="text-[10px] ${opcional?'text-blue-200':'text-multival-gold'}">${opcional?'OPCIONAL':'OBLIGATORIO'}</span>
        </div>
        <div class="p-5 space-y-5">
          ${opcional?`<label class="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200"><input type="checkbox" id="ef-incluir" class="radio-multival"> Incluir el arqueo de efectivo en este registro</label>`:''}
          <div class="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-sm text-slate-600 leading-relaxed">
            Siendo las <span id="lbl-hora" class="font-black text-multival-navy">—</span> horas del
            <span id="lbl-fecha" class="font-black text-multival-navy">—</span> en la oficina
            <span id="lbl-oficina" class="font-black text-multival-green uppercase">—</span>,
            se efectuó el arqueo de efectivo en modalidad <span id="lbl-modalidad" class="font-black text-multival-navy">—</span>, según las siguientes especificaciones:
          </div>

          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div class="md:col-span-3 text-xs font-black text-slate-500 uppercase">Elemento de Arqueo</div>
            <div class="md:col-span-9 flex flex-wrap gap-x-6 gap-y-3 items-center text-sm font-bold text-multival-navy">
              <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="r-elemento" value="Bóveda" checked class="radio-multival"> Bóveda</label>
              <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="r-elemento" value="Caja" class="radio-multival"> Caja No. <input type="text" id="d-caja-no" class="formato-linea w-14"></label>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div class="md:col-span-3 text-xs font-black text-slate-500 uppercase">Tipo de Arqueo</div>
            <div class="md:col-span-9 flex flex-wrap gap-x-6 gap-y-3 items-center text-sm font-bold text-multival-navy">
              <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="r-tipo" value="Arqueo de Control" checked class="radio-multival"> Arqueo de Control</label>
              <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="r-tipo" value="Arqueo Fin de Mes" class="radio-multival"> Arqueo Fin de Mes</label>
              <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="r-tipo" value="Arqueo de Supervisión" class="radio-multival"> Arqueo de Supervisión</label>
            </div>
          </div>

          <div class="border-t border-dashed border-slate-200 pt-5 space-y-3">
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm font-black text-multival-navy w-40">Billete</span>
              <span class="flex-1 border-b border-dashed border-slate-300"></span>
              <div class="flex items-center border border-slate-300 rounded-lg overflow-hidden w-48 bg-white"><span class="px-3 py-2 bg-slate-100 text-slate-500 font-black text-sm border-r border-slate-300">$</span><input type="number" id="d-billete" oninput="calcDif()" class="w-full text-right outline-none px-3 py-2 text-sm font-bold text-multival-navy"></div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm font-black text-multival-navy w-40">Moneda</span>
              <span class="flex-1 border-b border-dashed border-slate-300"></span>
              <div class="flex items-center border border-slate-300 rounded-lg overflow-hidden w-48 bg-white"><span class="px-3 py-2 bg-slate-100 text-slate-500 font-black text-sm border-r border-slate-300">$</span><input type="number" id="d-moneda" oninput="calcDif()" class="w-full text-right outline-none px-3 py-2 text-sm font-bold text-multival-navy"></div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm font-black text-multival-navy w-40">Total Efectivo Físico</span>
              <span class="flex-1 border-b border-dashed border-slate-300"></span>
              <div class="flex items-center border-2 border-multival-navy rounded-lg overflow-hidden w-48 bg-slate-50"><span class="px-3 py-2 bg-multival-navy text-multival-gold font-black text-sm">$</span><input type="text" id="d-total" readonly class="w-full text-right outline-none px-3 py-2 text-sm font-black text-multival-navy bg-slate-50" value="0"></div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm font-black text-multival-navy w-40">Saldo Según Sistema</span>
              <span class="flex-1 border-b border-dashed border-slate-300"></span>
              <div class="flex items-center border border-slate-300 rounded-lg overflow-hidden w-48 bg-white"><span class="px-3 py-2 bg-slate-100 text-slate-500 font-black text-sm border-r border-slate-300">$</span><input type="number" id="d-teorico" oninput="calcDif()" class="w-full text-right outline-none px-3 py-2 text-sm font-bold text-multival-navy"></div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm font-black text-multival-navy w-40">Diferencia</span>
              <div class="flex items-center gap-5 text-sm font-bold text-multival-navy">
                <label class="flex items-center gap-1.5"><input type="checkbox" id="check-faltante" disabled class="radio-multival"> Faltante</label>
                <label class="flex items-center gap-1.5"><input type="checkbox" id="check-sobrante" disabled class="radio-multival"> Sobrante</label>
              </div>
              <span class="flex-1 border-b border-dashed border-slate-300"></span>
              <div id="d-dif-box" class="flex items-center border border-slate-300 rounded-lg overflow-hidden w-48 bg-slate-50"><span class="px-3 py-2 bg-slate-100 text-slate-500 font-black text-sm border-r border-slate-300">$</span><input type="text" id="d-diferencia" readonly class="w-full text-right outline-none px-3 py-2 text-sm font-black text-slate-400 bg-transparent" value="0"></div>
            </div>
          </div>

          <div class="border-t border-dashed border-slate-200 pt-5">
            <label class="flex items-center gap-2 text-xs font-black text-multival-navy cursor-pointer"><input type="checkbox" id="ef-usd-incluir" class="radio-multival" ${(ARQ.ofi&&ARQ.ofi.usd)?'checked':''} onchange="toggleUsd()"> <i class="fa-solid fa-dollar-sign text-multival-green"></i> Esta oficina también maneja moneda extranjera (dólares USD)</label>
            <div id="usd-box" class="usd-box mt-3 space-y-3 ${(ARQ.ofi&&ARQ.ofi.usd)?'':'hidden'}">
              <p class="lbl-sec">1.1 Arqueo de moneda extranjera (USD)</p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><span class="text-[10px] font-bold text-slate-400 uppercase">Dólares físicos (USD)</span>
                  <div class="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white"><span class="px-3 py-2 bg-slate-100 text-slate-500 font-black text-sm border-r border-slate-300">US$</span><input type="number" step="0.01" id="d-usd-fisico" oninput="calcUsd()" class="w-full text-right outline-none px-3 py-2 text-sm font-bold text-multival-navy"></div></div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase">Saldo USD según sistema</span>
                  <div class="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white"><span class="px-3 py-2 bg-slate-100 text-slate-500 font-black text-sm border-r border-slate-300">US$</span><input type="number" step="0.01" id="d-usd-sistema" oninput="calcUsd()" class="w-full text-right outline-none px-3 py-2 text-sm font-bold text-multival-navy"></div></div>
                <div><span class="text-[10px] font-bold text-slate-400 uppercase">Tasa de referencia (COP por USD, opcional)</span>
                  <div class="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white"><span class="px-3 py-2 bg-slate-100 text-slate-500 font-black text-sm border-r border-slate-300">$</span><input type="number" id="d-usd-tasa" oninput="calcUsd()" class="w-full text-right outline-none px-3 py-2 text-sm font-bold text-multival-navy"></div></div>
              </div>
              <div class="flex items-center justify-between gap-4 flex-wrap">
                <span class="text-sm font-black text-multival-navy">Diferencia USD</span>
                <div id="d-usd-dif-box" class="flex items-center border border-slate-300 rounded-lg overflow-hidden w-48 bg-white"><span class="px-3 py-2 bg-slate-100 text-slate-500 font-black text-sm border-r border-slate-300">US$</span><input type="text" id="d-usd-dif" readonly value="0.00" class="w-full text-right outline-none px-3 py-2 text-sm font-black text-slate-400 bg-transparent"></div>
                <span id="d-usd-nov" class="badge badge-gray">Sin novedad</span>
                <span id="d-usd-cop" class="text-[11px] font-bold text-slate-400"></span>
              </div>
              <textarea id="d-usd-obs" rows="2" placeholder="Observaciones del arqueo en dólares (si hay diferencia, justifícala aquí)" class="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-multival-navy outline-none"></textarea>
            </div>
          </div>

          <div class="border-t border-dashed border-slate-200 pt-5">
            <p class="text-xs font-black text-slate-500 uppercase mb-2">2. Observaciones</p>
            <textarea id="d-obs" rows="3" placeholder="SIN NOVEDAD (se completa automático si la diferencia es $0. Si hay faltante/sobrante, justifica aquí)" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-multival-navy outline-none focus:ring-2 focus:ring-multival-green/20"></textarea>
            <div class="mt-3 flex items-center gap-2">
              <span class="text-xs font-black text-slate-500 uppercase shrink-0">Verificación de Sistemas:</span>
              <input type="text" id="d-sistemas" placeholder="Funcionario de Sistemas que verificó saldos (si aplica)" class="formato-linea flex-1 text-left text-sm">
            </div>
          </div>

          <div class="border-t border-dashed border-slate-200 pt-5">
            <p class="text-xs font-black text-slate-500 uppercase mb-3">3. Responsables</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              ${cajaResponsable('r1','Quien practicó el arqueo','(Líder / funcionario que realiza el conteo)')}
              ${cajaResponsable('r2','Quien acompañó el arqueo','(Testigo / segundo funcionario)')}
              ${cajaResponsable('r3','A quien se le practicó','(Persona responsable del efectivo)')}
            </div>
            <p class="text-right text-[10px] font-mono font-black text-slate-400 pt-3">${FMT.EFECTIVO}</p>
          </div>
        </div>
      </div>`;
    }

    function cajaResponsable(pref,titulo,sub){
      return `<div class="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <h5 class="text-xs font-black text-multival-navy uppercase mb-1">${titulo}</h5>
        <p class="text-[10px] text-slate-400 mb-3">${sub}</p>
        <div class="space-y-3">
          <div><span class="text-[10px] font-bold text-slate-400 uppercase">Nombre (legible)</span><input type="text" id="${pref}-nom" class="formato-linea w-full text-sm"></div>
          <div><span class="text-[10px] font-bold text-slate-400 uppercase">Cargo</span><input type="text" id="${pref}-car" class="formato-linea w-full text-sm"></div>
          <label class="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer pt-1"><input type="checkbox" id="${pref}-fir" class="radio-multival"> Firmar digitalmente</label>
        </div>
      </div>`;
    }

    function syncEncabezado(){
      if(el('lbl-hora')) el('lbl-hora').innerText = el('f-hora').value || '—';
      if(el('lbl-fecha')) el('lbl-fecha').innerText = el('f-fecha').value ? new Date(el('f-fecha').value+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}) : '—';
      if(el('lbl-oficina')) el('lbl-oficina').innerText = ARQ.ofi ? ARQ.ofi.oficina : '—';
      if(el('lbl-modalidad')) el('lbl-modalidad').innerText = ARQ.modalidad || '—';
      if(el('ch-oficina')) el('ch-oficina').innerText = ARQ.ofi ? ARQ.ofi.oficina : '—';
      if(el('ch-fecha')) el('ch-fecha').innerText = (el('f-fecha').value||'—')+' · '+(el('f-hora').value||'—');
      document.querySelectorAll('.atm-fecha').forEach(x=>x.innerText=el('f-fecha').value||'—');
      document.querySelectorAll('.atm-hora').forEach(x=>x.innerText=el('f-hora').value||'—');
      document.querySelectorAll('.atm-oficina').forEach(x=>x.innerText=ARQ.ofi?ARQ.ofi.oficina:'—');
    }

    function calcDif(){
      if(!el('d-billete')) return;
      const b=parseFloat(el('d-billete').value)||0, m=parseFloat(el('d-moneda').value)||0, t=parseFloat(el('d-teorico').value)||0;
      const fisico=b+m, dif=fisico-t;
      el('d-total').value=fisico.toLocaleString('es-CO');
      el('d-diferencia').value=dif.toLocaleString('es-CO');
      el('check-faltante').checked = dif<0;
      el('check-sobrante').checked = dif>0;
      const lbl=el('d-diferencia'), box=el('d-dif-box');
      if(dif<0){ lbl.className='w-full text-right outline-none px-3 py-2 text-sm font-black text-red-600 bg-transparent'; box.className='flex items-center border-2 border-red-300 rounded-lg overflow-hidden w-48 bg-red-50'; }
      else if(dif>0){ lbl.className='w-full text-right outline-none px-3 py-2 text-sm font-black text-yellow-600 bg-transparent'; box.className='flex items-center border-2 border-yellow-300 rounded-lg overflow-hidden w-48 bg-yellow-50'; }
      else { lbl.className='w-full text-right outline-none px-3 py-2 text-sm font-black text-multival-green bg-transparent'; box.className='flex items-center border-2 border-green-300 rounded-lg overflow-hidden w-48 bg-green-50'; }
      if(dif===0 && (el('d-billete').value!==''||el('d-teorico').value!=='')){ if(!el('d-obs').value.trim()) el('d-obs').value='SIN NOVEDAD'; }
      else if(el('d-obs').value==='SIN NOVEDAD') el('d-obs').value='';
    }

    function toggleUsd(){ const on=el('ef-usd-incluir').checked; el('usd-box').classList.toggle('hidden',!on); }
    function calcUsd(){
      if(!el('d-usd-fisico')) return;
      const f=parseFloat(el('d-usd-fisico').value)||0, sis=parseFloat(el('d-usd-sistema').value)||0, tasa=parseFloat(el('d-usd-tasa').value)||0;
      const dif=+(f-sis).toFixed(2);
      el('d-usd-dif').value=dif.toFixed(2);
      const nv=el('d-usd-nov'), box=el('d-usd-dif-box'), lbl=el('d-usd-dif');
      if(dif<0){ nv.className='badge badge-pend'; nv.innerText='Faltante USD'; lbl.className='w-full text-right outline-none px-3 py-2 text-sm font-black text-red-600 bg-transparent'; box.className='flex items-center border-2 border-red-300 rounded-lg overflow-hidden w-48 bg-red-50'; }
      else if(dif>0){ nv.className='badge badge-warn'; nv.innerText='Sobrante USD'; lbl.className='w-full text-right outline-none px-3 py-2 text-sm font-black text-yellow-600 bg-transparent'; box.className='flex items-center border-2 border-yellow-300 rounded-lg overflow-hidden w-48 bg-yellow-50'; }
      else { nv.className='badge badge-ok'; nv.innerText='Sin novedad'; lbl.className='w-full text-right outline-none px-3 py-2 text-sm font-black text-multival-green bg-transparent'; box.className='flex items-center border-2 border-green-300 rounded-lg overflow-hidden w-48 bg-green-50'; }
      el('d-usd-cop').innerText = tasa>0 && dif!==0 ? 'Equivale a '+fmt(dif*tasa)+' COP' : '';
    }

    function radioVal(name){ const r=document.querySelector(`input[name="${name}"]:checked`); return r?r.value:''; }

    // ---------- B. FOR-GOR-048-01 ----------
    function filaChequeVacia(){ return { tipoTitulo:'', rangoInicial:'', rangoFinal:'', cant:'', invCont:'', observacion:'' }; }

    function bloqueCheques(opcional){
      return `
      <div class="formato-seccion" id="blk-cheques">
        <div class="formato-seccion-titulo flex items-center justify-between">
          <span><i class="fa-solid fa-money-check mr-2"></i>Arqueo títulos valor · ${FMT.CHEQUES}</span>
          <span class="text-[10px] ${opcional?'text-purple-300':'text-multival-gold'}">${opcional?'OPCIONAL · VISITA ADICIONAL':'OBLIGATORIO'}</span>
        </div>
        <div class="p-5 space-y-4">
          <div class="bg-multival-navy rounded-xl p-4 text-center">
            <p class="text-multival-gold font-black uppercase tracking-widest text-sm">Arqueo Titulos Valor</p>
            <p class="text-blue-200 text-[10px] font-bold mt-1 font-mono">${FMT.CHEQUES} · Vigente a partir de: 31 de Enero de 2.011</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100"><span class="text-[10px] font-black text-slate-400 uppercase">Oficina</span><p id="ch-oficina" class="text-sm font-black text-multival-navy">—</p></div>
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100"><span class="text-[10px] font-black text-slate-400 uppercase">Fecha</span><p id="ch-fecha" class="text-sm font-black text-multival-navy">—</p></div>
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100"><span class="text-[10px] font-black text-slate-400 uppercase">Acta Nº</span><input type="text" id="ch-acta" placeholder="Ej. 015" class="formato-linea w-full text-sm text-left"></div>
          </div>

          <div class="overflow-x-auto border border-slate-200 rounded-xl">
            <table class="grid-of">
              <thead><tr>
                <th style="width:6%">CAJERO</th><th style="width:24%">TIPO DE TITULO</th>
                <th style="width:13%">RANGO<br>INICIAL</th><th style="width:13%">RANGO<br>FINAL</th>
                <th style="width:9%">CANT</th><th style="width:10%">INV&nbsp;&nbsp;CONT</th>
                <th style="width:7%">DIF</th><th style="width:16%">OBSERVACIÓN</th><th style="width:2%"></th>
              </tr></thead>
              <tbody id="ch-body"></tbody>
              <tfoot><tr class="celda-ro">
                <td colspan="4" class="text-center" style="padding:.5rem;font-weight:800;color:#25294F;font-size:.7rem">TOTALES</td>
                <td id="ch-tot-cant" class="text-right" style="padding:.5rem;font-weight:800;color:#25294F">0</td>
                <td id="ch-tot-inv" class="text-right" style="padding:.5rem;font-weight:800;color:#25294F">0</td>
                <td id="ch-tot-dif" class="text-right" style="padding:.5rem;font-weight:800">0</td>
                <td colspan="2"></td>
              </tr></tfoot>
            </table>
          </div>
          <button type="button" onclick="agregarFilaCheque()" class="text-xs font-black text-multival-green hover:text-multival-navy"><i class="fa-solid fa-plus mr-1"></i>Agregar título</button>

          <div>
            <span class="text-xs font-black text-slate-500 uppercase">Anexos</span>
            <textarea id="ch-anexos" rows="2" placeholder="Ej: Arqueo control, con cheques sin custodia y cinco cheques con la primera firma." class="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-multival-navy outline-none focus:ring-2 focus:ring-multival-green/20"></textarea>
          </div>
          <p class="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">Se hace constar que los titulos verificados por los funcionarios que practicaron el arqueo fueron devueltos en su totalidad, a entera satisfacción.</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><span class="text-[10px] font-bold text-slate-400 uppercase">Quien realiza el arqueo (nombre legible)</span><input type="text" id="ch-nom" class="formato-linea w-full text-sm"></div>
            <div><span class="text-[10px] font-bold text-slate-400 uppercase">Cargo</span><input type="text" id="ch-car" class="formato-linea w-full text-sm"></div>
          </div>
          <label class="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer"><input type="checkbox" id="ch-fir" class="radio-multival"> Firmar digitalmente</label>
          <p class="text-[10px] text-slate-400">Nota: Este documento es propiedad intelectual de REVAL, se prohíbe su reproducción total o parcial sin previa autorización escrita de su propietario.</p>
        </div>
      </div>`;
    }

    function pintarFilasCheques(){
      const b=el('ch-body'); if(!b) return;
      b.innerHTML = ARQ.cheques.items.map((it,i)=>{
        const dif = n(it.invCont)-n(it.cant);
        const col = dif<0?'#dc2626':(dif>0?'#ca8a04':'#3D8A44');
        return `<tr>
          <td class="celda-ro text-center" style="text-align:center">${i+1}</td>
          <td><input type="text" value="${esc(it.tipoTitulo)}" oninput="setCheque(${i},'tipoTitulo',this.value)" placeholder="Ej. CHEQUES HABILITADOS"></td>
          <td><input type="text" value="${esc(it.rangoInicial)}" oninput="setCheque(${i},'rangoInicial',this.value)" style="text-align:center"></td>
          <td><input type="text" value="${esc(it.rangoFinal)}" oninput="setCheque(${i},'rangoFinal',this.value)" style="text-align:center"></td>
          <td><input type="number" value="${esc(it.cant)}" oninput="setCheque(${i},'cant',this.value)" style="text-align:right"></td>
          <td><input type="number" value="${esc(it.invCont)}" oninput="setCheque(${i},'invCont',this.value)" style="text-align:right"></td>
          <td class="celda-ro" style="text-align:right;color:${col}">${dif}</td>
          <td><input type="text" value="${esc(it.observacion)}" oninput="setCheque(${i},'observacion',this.value)"></td>
          <td style="text-align:center">${ARQ.cheques.items.length>1?`<button type="button" onclick="quitarFilaCheque(${i})" class="text-slate-300 hover:text-red-500"><i class="fa-solid fa-xmark"></i></button>`:''}</td>
        </tr>`;
      }).join('');
      totalizarCheques();
    }

    function setCheque(i,campo,val){
      ARQ.cheques.items[i][campo]=val;
      if(campo==='cant'||campo==='invCont'){ pintarFilasCheques(); }
      else totalizarCheques();
    }
    function agregarFilaCheque(){ if(ARQ.cheques.items.length>=50) return; ARQ.cheques.items.push(filaChequeVacia()); pintarFilasCheques(); }
    function quitarFilaCheque(i){ ARQ.cheques.items.splice(i,1); pintarFilasCheques(); }
    function totalizarCheques(){
      let tc=0, ti=0;
      ARQ.cheques.items.forEach(it=>{ tc+=n(it.cant); ti+=n(it.invCont); });
      const dif=ti-tc;
      if(el('ch-tot-cant')) el('ch-tot-cant').innerText=tc;
      if(el('ch-tot-inv'))  el('ch-tot-inv').innerText=ti;
      const d=el('ch-tot-dif');
      if(d){ d.innerText=dif; d.style.color = dif<0?'#dc2626':(dif>0?'#ca8a04':'#3D8A44'); }
    }

    // ---------- C. FOR-GOR-099-02 ----------
    function gavetasDefecto(){ return DENOM_DEFECTO.map(d=>({denominacion:d, cantidad:''})); }
    function atmVacio(no, codigo){
      // Si el Directorio trae un codigo numerico se precarga; los valores
      // genericos ("Cajero", "Cajero 1") se dejan en blanco para diligenciar.
      const cod = String(codigo||'').trim();
      const precargar = cod && !/^cajero/i.test(cod) && !/^atm$/i.test(cod);
      return { cajeroNo:(precargar?cod:''), zona:'', nombreCajero:'', directorServicios:(currentUser.nombreLider||currentUser.nombre||''),
        tipoArqueo:'Arqueo de Control',
        gavetasEfectivo:gavetasDefecto(), gavetaPurga:gavetasDefecto(),
        gavetasDispensado:gavetasDefecto(), aprovisionamiento:gavetasDefecto(),
        observaciones:'', novedadesTecnicas:'',
        practico:{nombre:(currentUser.nombreLider||currentUser.nombre||''),cargo:'',firmado:false},
        practicadoA:{nombre:'',cargo:'',firmado:false},
        tirillas:[] };
    }

    function bloqueAtm(opcional){
      return ARQ.atms.map((a,i)=>`
      <div class="formato-seccion" id="blk-atm-${i}">
        <div class="formato-seccion-titulo flex items-center justify-between">
          <span><i class="fa-solid fa-building-columns mr-2"></i>Arqueo cajero automático ${ARQ.atms.length>1?('#'+(i+1)+' de '+ARQ.atms.length):''} · ${FMT.ATM}</span>
          <span class="text-[10px] ${opcional?'text-purple-300':'text-multival-gold'}">${opcional?'OPCIONAL · VISITA ADICIONAL':'OBLIGATORIO'}</span>
        </div>
        <div class="p-5 space-y-4">
          ${atmYaArqueado(a.cajeroNo)?`<div class="bg-amber-50 border-l-4 border-multival-gold p-3 rounded-r-lg text-xs font-bold text-multival-navy"><i class="fa-solid fa-circle-info text-multival-gold mr-1"></i>Este cajero ya tiene arqueo válido el <b>${esc(atmYaArqueado(a.cajeroNo))}</b>. Puedes registrar un nuevo arqueo de control, pero <b>no sumará de nuevo a tu meta</b> (el ATM cuenta una vez al mes).</div>`:''}
          <div class="bg-multival-navy rounded-xl p-4 text-center">
            <p class="text-multival-gold font-black uppercase tracking-widest text-sm">Reporte de Arqueo Cajeros Automaticos</p>
            <p class="text-blue-200 text-[10px] font-bold mt-1 font-mono">MULTIPAGAS - REVAL · ${FMT.ATM} · Vigencia a partir de: 30 de Octubre 2025</p>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100"><span class="text-[10px] font-black text-slate-400 uppercase">Fecha</span><p class="atm-fecha text-sm font-black text-multival-navy">—</p></div>
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100"><span class="text-[10px] font-black text-slate-400 uppercase">Hora</span><p class="atm-hora text-sm font-black text-multival-navy">—</p></div>
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100"><span class="text-[10px] font-black text-slate-400 uppercase">Oficina</span><p class="atm-oficina text-sm font-black text-multival-navy">—</p></div>
            <div><span class="text-[10px] font-black text-slate-400 uppercase">Director de Servicios</span><input type="text" value="${esc(a.directorServicios)}" oninput="setAtm(${i},'directorServicios',this.value)" class="formato-linea w-full text-sm text-left"></div>
            <div><span class="text-[10px] font-black text-slate-400 uppercase">Cajero (responsable)</span><input type="text" value="${esc(a.nombreCajero)}" oninput="setAtm(${i},'nombreCajero',this.value)" class="formato-linea w-full text-sm text-left"></div>
            <div><span class="text-[10px] font-black text-slate-400 uppercase">Zona</span><input type="text" value="${esc(a.zona)}" oninput="setAtm(${i},'zona',this.value)" class="formato-linea w-full text-sm text-left"></div>
          </div>

          <div class="border-t border-dashed border-slate-200 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div class="flex items-center gap-3"><span class="text-xs font-black text-slate-500 uppercase shrink-0">Cajero Automático No.</span>
              <input type="text" value="${esc(a.cajeroNo)}" oninput="setAtm(${i},'cajeroNo',this.value)" class="formato-linea flex-1 text-sm" placeholder="Ej. 3596"></div>
            <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-multival-navy">
              ${['Arqueo de Control','Arqueo Fin de Mes','Arqueo de Supervisión'].map(t=>`
              <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="atm-tipo-${i}" value="${t}" ${a.tipoArqueo===t?'checked':''} onchange="setAtm(${i},'tipoArqueo',this.value)" class="radio-multival">${t}</label>`).join('')}
            </div>
          </div>

          ${tablaGavetas(i,'gavetasEfectivo','Gavetas de efectivo',true)}
          ${tablaGavetas(i,'gavetaPurga','Gaveta de purga',false)}
          ${tablaGavetas(i,'gavetasDispensado','Gavetas dispensado',true)}
          ${tablaGavetas(i,'aprovisionamiento','2. Aprovisionamiento',true)}

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-dashed border-slate-200 pt-4">
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-200"><p class="text-[10px] font-black text-slate-400 uppercase">Total arqueo físico</p><p id="atm-tf-${i}" class="text-lg font-black text-multival-navy">$0</p></div>
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-200"><p class="text-[10px] font-black text-slate-400 uppercase">Total cajero automático</p><p id="atm-tc-${i}" class="text-lg font-black text-multival-navy">$0</p></div>
            <div id="atm-box-${i}" class="bg-green-50 rounded-xl p-3 border border-green-200"><p class="text-[10px] font-black text-slate-400 uppercase">Diferencia</p><p id="atm-df-${i}" class="text-lg font-black text-multival-green">$0</p>
              <p id="atm-nv-${i}" class="text-[10px] font-black text-multival-green uppercase">Sin novedad</p></div>
          </div>

          <div>
            <span class="text-xs font-black text-slate-500 uppercase">Observaciones · diferencias respecto a la tirilla entregada por el ATM</span>
            <textarea rows="2" oninput="setAtm(${i},'observaciones',this.value)" class="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-multival-navy outline-none focus:ring-2 focus:ring-multival-green/20">${esc(a.observaciones)}</textarea>
          </div>
          <div>
            <span class="text-xs font-black text-slate-500 uppercase">Novedades adicionales</span>
            <p class="text-[10px] text-slate-400 mb-1">Billetes rotos o presuntamente falsos, y novedades técnicas de MI ATM con número de radicado de servicio técnico (no se imputan a la oficina, para no afectar el UPTIME).</p>
            <textarea rows="2" oninput="setAtm(${i},'novedadesTecnicas',this.value)" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-multival-navy outline-none focus:ring-2 focus:ring-multival-green/20">${esc(a.novedadesTecnicas)}</textarea>
          </div>

          <div class="border-t border-dashed border-slate-200 pt-4">
            <p class="text-xs font-black text-slate-500 uppercase mb-3">3. Firmas de responsables</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              ${cajaFirmaAtm(i,'practico','Quien practicó el arqueo','')}
              ${cajaFirmaAtm(i,'practicadoA','A quien se le practicó el arqueo','(Persona responsable del efectivo)')}
            </div>
          </div>

          <div class="border-t border-dashed border-slate-200 pt-4">
            <p class="text-xs font-black text-slate-500 uppercase mb-1">Tirillas del cajero <span class="text-red-500">*</span></p>
            <p class="text-[10px] text-slate-400 mb-2">Obligatorio: adjunta las tirillas del ATM en formato PDF (máx. ${MAX_MB_TIRILLA} MB por archivo).</p>
            <div class="border-2 border-dashed border-slate-300 bg-slate-50 rounded-xl p-5 text-center">
              <input type="file" accept="application/pdf,.pdf" multiple onchange="cargarTirillas(${i}, this)" class="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-multival-navy file:text-white cursor-pointer">
              <div id="atm-tir-${i}" class="mt-3 text-xs font-bold text-slate-500"></div>
            </div>
          </div>
        </div>
      </div>`).join('');
    }

    /** Fecha del arqueo válido del mes para un cajero, si ya existe. */
    function atmYaArqueado(cajeroNo){
      const ya=(ARQ.visita&&ARQ.visita.atmArqueadosMes)||{};
      const k=String(cajeroNo||'').toUpperCase().replace(/^CAJERO\s*/,'').replace(/^ATM\s*/,'').trim()||'1';
      return ya[k]||'';
    }

    function cajaFirmaAtm(i,campo,titulo,sub){
      const p=ARQ.atms[i][campo];
      return `<div class="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <h5 class="text-xs font-black text-multival-navy uppercase mb-1">${titulo}</h5>
        <p class="text-[10px] text-slate-400 mb-3">${sub||'&nbsp;'}</p>
        <div class="space-y-3">
          <div><span class="text-[10px] font-bold text-slate-400 uppercase">Nombre (legible)</span><input type="text" value="${esc(p.nombre)}" oninput="setAtmFirma(${i},'${campo}','nombre',this.value)" class="formato-linea w-full text-sm"></div>
          <div><span class="text-[10px] font-bold text-slate-400 uppercase">Cargo</span><input type="text" value="${esc(p.cargo)}" oninput="setAtmFirma(${i},'${campo}','cargo',this.value)" class="formato-linea w-full text-sm"></div>
          <label class="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer pt-1"><input type="checkbox" ${p.firmado?'checked':''} onchange="setAtmFirma(${i},'${campo}','firmado',this.checked)" class="radio-multival"> Firmar digitalmente</label>
        </div></div>`;
    }

    function tablaGavetas(i,grupo,titulo,conEtiqueta){
      const arr=ARQ.atms[i][grupo];
      return `
      <div class="border border-slate-200 rounded-xl overflow-hidden">
        <div class="bg-slate-100 px-4 py-2 text-[11px] font-black text-multival-navy uppercase tracking-wide">${titulo}</div>
        <div class="overflow-x-auto"><table class="grid-of">
          <thead><tr><th style="width:34%"></th><th style="width:22%">DENOMINACION</th><th style="width:20%">CANTIDAD</th><th style="width:24%">VALOR</th></tr></thead>
          <tbody>
            ${arr.map((g,k)=>`<tr>
              <td class="celda-ro" style="padding-left:.7rem">${conEtiqueta?('GAVETA '+(k+1)):'&nbsp;'}</td>
              <td><select onchange="setGaveta(${i},'${grupo}',${k},'denominacion',this.value)" style="text-align:center">
                ${DENOMINACIONES.map(d=>`<option value="${d}" ${n(g.denominacion)===d?'selected':''}>$ ${d.toLocaleString('es-CO')}</option>`).join('')}
                ${DENOMINACIONES.indexOf(n(g.denominacion))<0 && n(g.denominacion)>0?`<option value="${n(g.denominacion)}" selected>$ ${n(g.denominacion).toLocaleString('es-CO')}</option>`:''}
              </select></td>
              <td><input type="number" min="0" value="${esc(g.cantidad)}" oninput="setGaveta(${i},'${grupo}',${k},'cantidad',this.value)" style="text-align:center"></td>
              <td class="celda-ro" style="text-align:right;white-space:nowrap"><span id="val-${i}-${grupo}-${k}">$0</span>
                ${arr.length>1?`<button type="button" title="Quitar gaveta" onclick="quitarGaveta(${i},'${grupo}',${k})" class="text-slate-300 hover:text-red-500 ml-2"><i class="fa-solid fa-xmark"></i></button>`:''}</td>
            </tr>`).join('')}
            <tr class="celda-ro"><td colspan="3" style="text-align:right;padding-right:.7rem;font-size:.7rem">SUBTOTAL</td><td id="sub-${i}-${grupo}" style="text-align:right;color:#25294F">$0</td></tr>
          </tbody>
        </table></div>
        <div class="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span class="text-[10px] text-slate-400 font-bold">Elige la denominación de cada gaveta según el cajero (incluye $100.000). Deja en blanco las que no apliquen.</span>
          ${arr.length<MAX_GAVETAS?`<button type="button" onclick="agregarGaveta(${i},'${grupo}')" class="text-[11px] font-black text-multival-green hover:text-multival-navy"><i class="fa-solid fa-plus mr-1"></i>Agregar gaveta</button>`:''}
        </div>
      </div>`;
    }

    function setAtm(i,campo,val){ ARQ.atms[i][campo]=val; }
    function setAtmFirma(i,campo,sub,val){ ARQ.atms[i][campo][sub]=val; }
    function setGaveta(i,grupo,k,campo,val){ ARQ.atms[i][grupo][k][campo]=val; calcAtm(i); }
    function agregarGaveta(i,grupo){
      if(ARQ.atms[i][grupo].length>=MAX_GAVETAS) return;
      ARQ.atms[i][grupo].push({denominacion:DENOMINACIONES[DENOMINACIONES.length-1], cantidad:''});
      repintarAtm(i);
    }
    function quitarGaveta(i,grupo,k){ ARQ.atms[i][grupo].splice(k,1); repintarAtm(i); }
    /** Redibuja un solo bloque ATM conservando el estado (incluidas las tirillas ya leídas). */
    function repintarAtm(i){
      const adicional = !!(ARQ.visita && ARQ.visita.esAdicional);
      const blk=el('blk-atm-'+i); if(!blk) return;
      const tmp=document.createElement('div'); tmp.innerHTML=bloqueAtm(adicional);
      const nuevo=tmp.querySelector('#blk-atm-'+i);
      blk.replaceWith(nuevo);
      calcAtm(i); syncEncabezado();
      const cont=el('atm-tir-'+i);
      if(cont && ARQ.atms[i].tirillas.length) cont.innerHTML = ARQ.atms[i].tirillas.map(t=>`<span class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 mr-1 mb-1"><i class="fa-solid fa-file-pdf text-red-500"></i>${esc(t.fileName)}</span>`).join('');
    }

    function calcAtm(i){
      const a=ARQ.atms[i]; if(!a) return;
      const suma=(grupo)=>{
        let s=0;
        a[grupo].forEach((g,k)=>{
          const v=n(g.denominacion)*n(g.cantidad); s+=v;
          const c=el('val-'+i+'-'+grupo+'-'+k); if(c) c.innerText=fmt(v);
        });
        const sc=el('sub-'+i+'-'+grupo); if(sc) sc.innerText=fmt(s);
        return s;
      };
      const ef=suma('gavetasEfectivo'), pu=suma('gavetaPurga'), di=suma('gavetasDispensado'), ap=suma('aprovisionamiento');
      const tf=ef+pu, tc=ap-di, df=tf-tc;
      if(el('atm-tf-'+i)) el('atm-tf-'+i).innerText=fmt(tf);
      if(el('atm-tc-'+i)) el('atm-tc-'+i).innerText=fmt(tc);
      const d=el('atm-df-'+i), nv=el('atm-nv-'+i), box=el('atm-box-'+i);
      if(d){
        d.innerText=fmt(df);
        if(df<0){ d.className='text-lg font-black text-red-600'; nv.innerText='Faltante'; nv.className='text-[10px] font-black text-red-600 uppercase'; box.className='bg-red-50 rounded-xl p-3 border border-red-200'; }
        else if(df>0){ d.className='text-lg font-black text-yellow-600'; nv.innerText='Sobrante'; nv.className='text-[10px] font-black text-yellow-600 uppercase'; box.className='bg-yellow-50 rounded-xl p-3 border border-yellow-200'; }
        else { d.className='text-lg font-black text-multival-green'; nv.innerText='Sin novedad'; nv.className='text-[10px] font-black text-multival-green uppercase'; box.className='bg-green-50 rounded-xl p-3 border border-green-200'; }
      }
    }

    function cargarTirillas(i, input){
      const cont=el('atm-tir-'+i);
      const files=Array.from(input.files||[]);
      if(!files.length){ ARQ.atms[i].tirillas=[]; cont.innerHTML=''; return; }
      const invalidos=files.filter(f=> f.type.indexOf('pdf')<0 && f.name.toLowerCase().slice(-4)!=='.pdf');
      if(invalidos.length){ cont.innerHTML=`<span class="text-red-500">Solo se aceptan archivos PDF. Revisa: ${invalidos.map(f=>esc(f.name)).join(', ')}</span>`; input.value=''; ARQ.atms[i].tirillas=[]; return; }
      const pesados=files.filter(f=> f.size > MAX_MB_TIRILLA*1024*1024);
      if(pesados.length){ cont.innerHTML=`<span class="text-red-500">Archivo demasiado pesado (máx. ${MAX_MB_TIRILLA} MB): ${pesados.map(f=>esc(f.name)).join(', ')}</span>`; input.value=''; ARQ.atms[i].tirillas=[]; return; }

      cont.innerHTML='<i class="fa-solid fa-circle-notch fa-spin mr-1 text-multival-green"></i>Preparando archivos...';
      ARQ.atms[i].tirillas=[];
      let leidos=0;
      files.forEach(f=>{
        const rd=new FileReader();
        rd.onload=e=>{
          ARQ.atms[i].tirillas.push({ fileName:f.name, mimeType:f.type||'application/pdf', base64:e.target.result.split(',')[1] });
          if(++leidos===files.length){
            cont.innerHTML = ARQ.atms[i].tirillas.map(t=>`<span class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 mr-1 mb-1"><i class="fa-solid fa-file-pdf text-red-500"></i>${esc(t.fileName)}</span>`).join('');
          }
        };
        rd.onerror=()=>{ cont.innerHTML='<span class="text-red-500">No fue posible leer '+esc(f.name)+'</span>'; };
        rd.readAsDataURL(f);
      });
    }

    // ---------- Envío ----------
    function enviarArqueo(){
      const msg=el('msg-dig');
      const err=x=>{ msg.innerHTML='<span class="text-red-500">'+x+'</span>'; };
      msg.innerHTML='';

      if(!ARQ.ofi) return err('Selecciona la oficina.');
      if(!el('f-fecha').value) return err('Indica la fecha real del arqueo.');
      if(HOY_SERVIDOR && el('f-fecha').value > HOY_SERVIDOR){
        return err('La fecha del arqueo no puede ser futura. Hoy en Colombia es '+HOY_SERVIDOR+'.');
      }
      if(!el('f-hora').value)  return err('Indica la hora del arqueo.');
      if(!ARQ.modalidad){ el('msg-modalidad').innerText='Selecciona si el arqueo fue presencial o virtual.'; return err('Falta indicar la modalidad del arqueo.'); }

      const r=ARQ.ofi.requiere;
      const adicional = !!(ARQ.visita && ARQ.visita.esAdicional);
      const elegido = cual => (adicional ? !!ARQ.sel[cual] : true);

      if(adicional && !ARQ.sel.efectivo && !ARQ.sel.cheques && !ARQ.sel.atm){
        return err('Esta es una visita adicional del mes: marca arriba al menos un formato para diligenciar.');
      }

      const payload = {
        idUsuario: currentUser.idUsuario, rol: currentUser.rol,
        nombreLider: currentUser.nombreLider || currentUser.nombre,
        oficina: ARQ.ofi.oficina, fechaArqueo: el('f-fecha').value, hora: el('f-hora').value,
        modalidad: ARQ.modalidad, efectivo:null, cheques:null, atms:[]
      };

      // --- Efectivo ---
      // En visita adicional el checkbox interno no aplica: el chip de arriba decide.
      const incluirEf = elegido('efectivo') &&
        (r.efectivo || adicional || (r.sinParametrizar && el('ef-incluir') && el('ef-incluir').checked));
      if(incluirEf){
        const b=parseFloat(el('d-billete').value)||0, m=parseFloat(el('d-moneda').value)||0, t=el('d-teorico').value;
        if(t===''||(el('d-billete').value===''&&el('d-moneda').value==='')) return err('Arqueo de efectivo: ingresa el saldo del sistema y el conteo físico.');
        const dif=(b+m)-parseFloat(t);
        if(dif!==0 && (!el('d-obs').value.trim()||el('d-obs').value==='SIN NOVEDAD')) return err('Arqueo de efectivo: justifica el faltante/sobrante en Observaciones.');
        if(!el('r1-nom').value.trim()||!el('r3-nom').value.trim()) return err('Arqueo de efectivo: completa quién practicó y a quién se le practicó.');
        if(!el('r1-fir').checked||!el('r3-fir').checked) return err('Arqueo de efectivo: faltan las firmas digitales de los responsables.');
        const elemento=radioVal('r-elemento');
        const numeroElem = elemento==='Caja'?el('d-caja-no').value:'';
        if(elemento==='Caja' && !numeroElem.trim()) return err('Arqueo de efectivo: indica el número de Caja.');

        let usd=null;
        if(el('ef-usd-incluir') && el('ef-usd-incluir').checked){
          const uf=el('d-usd-fisico').value, us=el('d-usd-sistema').value;
          if(uf===''||us==='') return err('Moneda extranjera: ingresa los dólares físicos y el saldo USD según sistema (o desmarca la opción).');
          const udif=(parseFloat(uf)||0)-(parseFloat(us)||0);
          if(udif!==0 && !el('d-usd-obs').value.trim()) return err('Moneda extranjera: justifica la diferencia en dólares.');
          usd={ fisico:uf, sistema:us, tasa:el('d-usd-tasa').value, observaciones:el('d-usd-obs').value };
        }
        payload.efectivo = {
          elemento, numeroElem, tipoArqueo: radioVal('r-tipo'),
          montoBilletes:b, montoMonedas:m, montoTeorico:t, usd: usd,
          observaciones: el('d-obs').value || 'SIN NOVEDAD', sistemas: el('d-sistemas').value,
          practico:{nombre:el('r1-nom').value,cargo:el('r1-car').value,firmado:el('r1-fir').checked},
          acompano:{nombre:el('r2-nom').value,cargo:el('r2-car').value,firmado:el('r2-fir').checked},
          practicadoA:{nombre:el('r3-nom').value,cargo:el('r3-car').value,firmado:el('r3-fir').checked}
        };
      }

      // --- Cheques ---
      if(r.cheques && elegido('cheques')){
        const items = ARQ.cheques.items.filter(it=>String(it.tipoTitulo||'').trim()!=='' || n(it.cant)!==0 || n(it.invCont)!==0);
        if(!items.length) return err('Arqueo de títulos valor: registra al menos un título.');
        for(let i=0;i<items.length;i++){
          if(!String(items[i].tipoTitulo||'').trim()) return err('Arqueo de títulos valor: la fila '+(i+1)+' no tiene tipo de título.');
        }
        if(!el('ch-nom').value.trim()) return err('Arqueo de títulos valor: indica quién realiza el arqueo.');
        if(!el('ch-fir').checked) return err('Arqueo de títulos valor: falta la firma digital de quien realiza el arqueo.');
        payload.cheques = {
          actaNo: el('ch-acta').value, items: items, anexos: el('ch-anexos').value,
          tipoArqueo: 'Arqueo de Control',
          quienRealiza:{nombre:el('ch-nom').value,cargo:el('ch-car').value,firmado:el('ch-fir').checked}
        };
      }

      // --- ATM ---
      if(r.atm && elegido('atm')){
        for(let i=0;i<ARQ.atms.length;i++){
          const a=ARQ.atms[i];
          if(!String(a.cajeroNo||'').trim()) return err('Cajero #'+(i+1)+': indica el número del cajero automático.');
          if(!a.practico.nombre.trim() || !a.practicadoA.nombre.trim()) return err('Cajero #'+(i+1)+': completa las firmas de responsables.');
          if(!a.practico.firmado || !a.practicadoA.firmado) return err('Cajero #'+(i+1)+': faltan las firmas digitales.');
          if(!a.tirillas.length) return err('Cajero #'+(i+1)+': adjunta las tirillas en PDF (obligatorio).');
          const totCant = a.gavetasEfectivo.concat(a.gavetaPurga,a.gavetasDispensado,a.aprovisionamiento).reduce((s,g)=>s+n(g.cantidad),0);
          if(totCant===0) return err('Cajero #'+(i+1)+': no registraste cantidades en ninguna gaveta.');
          payload.atms.push(a);
        }
      }

      if(!payload.efectivo && !payload.cheques && !payload.atms.length) return err('No hay ningún formato diligenciado para guardar.');

      el('btn-dig').disabled=true; el('loader-dig').style.display='block';
      msg.innerHTML='<span class="text-slate-500">Guardando y generando PDF...</span>';

      google.script.run.withSuccessHandler(res=>{
        el('btn-dig').disabled=false; el('loader-dig').style.display='none';
        if(res.success){ msg.innerHTML=''; trasEscritura(); modalResultado(res); }
        else err(String(res.message||'No fue posible guardar el arqueo.').replace(/\n/g,'<br>'));
      }).withFailureHandler(e=>{ el('btn-dig').disabled=false; el('loader-dig').style.display='none'; err('Error de conexión: '+e.message); })
      .procesarArqueoIntegral(payload);
    }

    function modalResultado(res){
      const ext = res.extemporaneo==='SÍ';
      abrirModal(`
      <div class="text-center">
        <div class="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${ext?'bg-amber-100 text-multival-gold':'bg-green-100 text-multival-green'} mb-3">
          <i class="fa-solid ${ext?'fa-clock':'fa-circle-check'} text-2xl"></i></div>
        <h3 class="text-lg font-black text-multival-navy">${ext?'Arqueo registrado como extemporáneo':'Arqueo registrado'}</h3>
        <p class="text-xs font-bold text-slate-500 mt-1">${esc(res.message)}</p>
        <div class="flex flex-wrap justify-center gap-2 mt-3">
          ${res.tipoVisita==='VISITA ADICIONAL'
            ? `<span class="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[10px] font-black uppercase px-3 py-1.5 rounded-full"><i class="fa-solid fa-rotate-right"></i>Visita adicional N.° ${res.visitaNroMes||''}</span>`
            : `<span class="inline-flex items-center gap-1 bg-green-100 text-multival-green text-[10px] font-black uppercase px-3 py-1.5 rounded-full"><i class="fa-solid fa-flag-checkered"></i>Primera visita del mes</span>`}
          ${ext ? `<span class="badge badge-pend">Extemporáneo · no suma hasta normalizar</span>`
               : `<span class="badge ${(res.sumanMeta||0)>0?'badge-ok':'badge-gray'}"><i class="fa-solid fa-bullseye"></i>Suma ${res.sumanMeta||0} a tu meta</span>`}
          ${(res.atmRepetidos||0)>0?`<span class="badge badge-warn">${res.atmRepetidos} ATM ya contado este mes</span>`:''}
        </div>
      </div>
      <div class="mt-5 space-y-2">
        ${res.resultados.map(r=>`
        <a href="${r.url}" target="_blank" class="flex items-center justify-between gap-3 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl p-3 transition-colors">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0"><i class="fa-solid fa-file-pdf"></i></div>
            <div class="min-w-0"><p class="text-xs font-black text-multival-navy truncate">${esc(r.nombre)}</p>
            <p class="text-[10px] font-bold text-slate-400">${esc(r.formato)} · ${esc(r.idArqueo)}</p></div>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span class="text-[10px] font-black uppercase ${r.novedad==='FALTANTE'?'text-red-500':(r.novedad==='SOBRANTE'?'text-yellow-600':'text-multival-green')}">${esc(r.novedad)}${r.usd&&r.usd.novedad!=='SIN NOVEDAD'?' · USD '+esc(r.usd.novedad):''}</span>
            <span class="text-[9px] font-black uppercase ${r.cuentaMeta?'text-multival-green':'text-slate-400'}">${r.cuentaMeta?'Suma a la meta':(r.formato===FMT.CHEQUES?'Complementario':'ATM ya contado')}</span>
          </div>
        </a>`).join('')}
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button onclick="cerrarModal();irA('historial')" class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-multival-navy">Ver mis arqueos</button>
        <button onclick="cerrarModal();irA('cargar')" class="bg-multival-navy hover:bg-multival-navyHover text-white font-bold py-2 px-6 rounded-xl text-sm">Registrar otro</button>
      </div>`, 'max-w-xl');
    }

    function enviarManual(){
      const fi=el('f-archivo'), msg=el('msg-man');
      if(!ARQ.ofi){ msg.innerText='Selecciona la oficina.'; msg.className='text-sm font-bold text-red-500'; return; }
      if(!ARQ.modalidad){ msg.innerText='Indica si el arqueo fue presencial o virtual.'; msg.className='text-sm font-bold text-red-500'; return; }
      if(!fi.files.length){ msg.innerText='Adjunta el documento.'; msg.className='text-sm font-bold text-red-500'; return; }
      const file=fi.files[0], reader=new FileReader();
      el('btn-man').disabled=true; el('loader-man').style.display='block';
      msg.innerText='Subiendo a Drive...'; msg.className='text-sm font-bold text-slate-500';
      reader.onload=e=>{
        google.script.run.withSuccessHandler(res=>{
          el('btn-man').disabled=false; el('loader-man').style.display='none';
          if(res.success){ trasEscritura(); msg.innerText=res.message; msg.className=res.extemporaneo==='SÍ'?'text-sm font-bold text-multival-gold':'text-sm font-bold text-multival-green'; fi.value=''; }
          else{ msg.innerText=res.message; msg.className='text-sm font-bold text-red-500'; }
          setTimeout(()=>msg.innerText='',8000);
        }).withFailureHandler(er=>{ el('btn-man').disabled=false; el('loader-man').style.display='none'; msg.innerText='Error: '+er.message; msg.className='text-sm font-bold text-red-500'; })
        .procesarArqueo({
          tipo:'manual', idUsuario:currentUser.idUsuario, rol:currentUser.rol, oficina:ARQ.ofi.oficina,
          modalidad:ARQ.modalidad, formato:el('m-formato').value,
          elemento:el('m-elemento').value, numeroElem:el('m-numero').value, tipoArqueo:'Arqueo de Control',
          fechaArqueo:el('f-fecha').value, fileName:file.name, mimeType:file.type, base64:e.target.result.split(',')[1]
        });
      };
      reader.readAsDataURL(file);
    }

    // ===================== DASHBOARDS =====================
    function renderDashboard(c){
      c.innerHTML=spinner;
      conDashboard(c, d=>{
        if(currentUser.rol==='Lider') renderDashLider(c,d);
        else renderDashGlobal(c,d);
        poblarMeses();
      });
    }

    function renderDashLider(c,d){
      const L=d.lideres.find(x=>x.idLider===currentUser.idUsuario)||{validos:0,extemporaneos:0,normalizados:0,complementarios:0,visitasAdicionales:0,total:0,faltantes:0,sobrantes:0,montoFaltante:0,montoSobrante:0,virtuales:0,presenciales:0,pct:0,pctReal:0,faltanParaMeta:d.meta,proyeccion:0,requeridoPorDia:0,estado:'CRÍTICO',semaforo:'rojo',oficinas:0,oficinasATM:0};
      const col=semColor(L.semaforo);
      c.innerHTML=`
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div><h2 class="text-2xl font-black text-multival-navy">Mi Cumplimiento — ${mesNombre(d.mes)}</h2>
        <p class="text-sm text-slate-500">Meta: <b>${d.meta} arqueos válidos</b> · Días hábiles: ${d.habiles.transcurridos}/${d.habiles.total} · ${d.habiles.restantes} restantes.</p></div>
        ${selectorMes('cambiarMes()')}
      </div>
      ${asesorPanel(consejosLider(L,d))}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-8 flex flex-col items-center justify-center relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-1" style="background:${col}"></div>
          <div class="relative flex items-center justify-center">${ringSVG(L.pct,col,170)}
            <div class="absolute text-center"><p class="text-4xl font-black text-multival-navy">${L.validos}</p><p class="text-xs font-bold text-slate-400">de ${d.meta}</p></div></div>
          <div class="mt-4 text-center">${semBadge(L.semaforo,L.estado)}</div>
          <p class="text-xs font-bold text-slate-500 mt-3 text-center">${L.faltanParaMeta>0?`Te faltan <b class="text-multival-navy">${L.faltanParaMeta}</b> arqueos válidos`:'¡Meta cumplida! 🎉'}</p>
          ${L.normalizados>0?`<p class="text-[10px] font-bold text-multival-green mt-1">${L.normalizados} normalizado(s) incluidos</p>`:''}
          ${L.complementarios>0?`<p class="text-[10px] font-bold text-slate-400 mt-1">${L.complementarios} arqueo(s) de títulos valor registrados (complementarios)</p>`:''}
          ${(L.visitasAdicionales||0)>0?`<p class="text-[10px] font-bold text-purple-600 mt-1"><i class="fa-solid fa-rotate-right mr-1"></i>${L.visitasAdicionales} arqueo(s) en visitas adicionales (el efectivo sí suma a la meta)</p>`:''}
          ${(L.atmRepetidos||0)>0?`<p class="text-[10px] font-bold text-amber-700 mt-1"><i class="fa-solid fa-building-columns mr-1"></i>${L.atmRepetidos} arqueo(s) ATM repetido(s): el cajero cuenta una vez al mes</p>`:''}
          ${(L.pendientesGestion||0)>0?`<p class="text-[10px] font-bold text-red-600 mt-1"><i class="fa-solid fa-bell mr-1"></i>${L.pendientesGestion} novedad(es) pendiente(s) por responder</p>`:''}
        </div>
        <div class="lg:col-span-2 bg-white rounded-[2rem] shadow-soft border border-slate-100 p-8">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-1"><i class="fa-solid fa-chart-line text-multival-green mr-1"></i> ¿Vas a llegar a la meta?</h3>
          <p class="text-xs text-slate-500 mb-5">Proyección según tu ritmo actual por día hábil.</p>
          <div class="grid grid-cols-2 gap-4 mb-5">
            <div class="bg-slate-50 rounded-xl p-4 border border-slate-100"><p class="text-[10px] font-black text-slate-400 uppercase">Proyección fin de mes</p>
              <p class="text-3xl font-black mt-1" style="color:${col}">${L.proyeccion}</p><p class="text-[11px] font-bold text-slate-400">arqueos válidos estimados</p></div>
            <div class="bg-slate-50 rounded-xl p-4 border border-slate-100"><p class="text-[10px] font-black text-slate-400 uppercase">Ritmo requerido</p>
              <p class="text-3xl font-black text-multival-navy mt-1">${L.requeridoPorDia>=999?'—':L.requeridoPorDia}</p><p class="text-[11px] font-bold text-slate-400">arqueos/día hábil para lograrlo</p></div>
          </div>
          <div class="relative w-full bg-slate-100 rounded-full h-4 overflow-hidden"><div class="h-full rounded-full transition-all duration-1000" style="width:${Math.min(Math.round((L.proyeccion/d.meta)*100),100)}%;background:${col}"></div></div>
          <div class="flex justify-between mt-2 text-[10px] font-bold text-slate-400"><span>Proyección: ${L.proyeccion}</span><span>Meta: ${d.meta}</span></div>
          <div class="mt-5 p-3 rounded-xl text-xs font-bold ${L.semaforo==='verde'?'bg-green-50 text-multival-green':(L.semaforo==='amarillo'?'bg-yellow-50 text-yellow-700':'bg-red-50 text-red-600')}">
            <i class="fa-solid ${L.semaforo==='verde'?'fa-circle-check':(L.semaforo==='amarillo'?'fa-triangle-exclamation':'fa-circle-xmark')} mr-1"></i>${mensajeProyeccion(L,d)}</div>
        </div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        ${kpiCard('Válidos (cuentan)',L.validos,'Incluye normalizados','#3D8A44','fa-circle-check')}
        ${kpiCard('Extemporáneos',L.extemporaneos,'Normalizables','#ef4444','fa-clock')}
        ${kpiCard('Faltantes',L.faltantes,fmt(L.montoFaltante),'#dc2626','fa-arrow-down')}
        ${kpiCard('Sobrantes',L.sobrantes,fmt(L.montoSobrante),'#F6CF46','fa-arrow-up')}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-4"><i class="fa-solid fa-chart-area text-multival-green mr-1"></i> Avance acumulado del mes</h3>
          <canvas id="chart-tendencia" height="110"></canvas></div>
        <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-4"><i class="fa-solid fa-building-columns text-multival-green mr-1"></i> Mis oficinas</h3>
          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl mb-2"><span class="text-xs font-bold text-slate-500">Oficinas a cargo</span><span class="text-lg font-black text-multival-navy">${L.oficinas}</span></div>
          <div class="flex items-center justify-between p-3 bg-green-50 rounded-xl mb-2"><span class="text-xs font-bold text-slate-500">Con arqueo este mes</span><span class="text-lg font-black text-multival-green">${L.oficinasVisitadas||0}</span></div>
          <div class="flex items-center justify-between p-3 bg-red-50 rounded-xl mb-2"><span class="text-xs font-bold text-slate-500">Pendientes por arquear</span><span class="text-lg font-black text-red-600">${L.oficinasPendientes||0}</span></div>
          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl mb-2"><span class="text-xs font-bold text-slate-500">Con ATM (cuenta 1 vez/mes)</span><span class="text-lg font-black text-multival-gold">${L.oficinasATM}</span></div>
          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl mb-2"><span class="text-xs font-bold text-slate-500">Arqueos presenciales</span><span class="text-lg font-black text-multival-green">${L.presenciales}</span></div>
          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl"><span class="text-xs font-bold text-slate-500">Arqueos virtuales</span><span class="text-lg font-black text-multival-navy">${L.virtuales}</span></div>
        </div>
      </div>`;
      dibujarTendencia(d.serie,d.meta);
    }

    function mensajeProyeccion(L,d){
      if(L.validos>=d.meta) return 'Meta cumplida. Mantén el ritmo y evita extemporáneos.';
      if(d.habiles.restantes===0&&d.habiles.transcurridos>0) return 'El mes cerró sin alcanzar la meta con arqueos válidos.';
      if(L.semaforo==='verde') return `Vas en ruta. Con ${L.requeridoPorDia} arqueos/día hábil llegas a la meta.`;
      if(L.semaforo==='amarillo') return `En riesgo. Sube el ritmo a ${L.requeridoPorDia} arqueos/día hábil en los ${d.habiles.restantes} días restantes.`;
      return `Crítico. Proyectas ${L.proyeccion}. Requieres ${L.requeridoPorDia}/día hábil; revisa extemporáneos normalizables.`;
    }

    function renderDashGlobal(c,d){
      const g=d.global;
      const titulo = currentUser.rol==='Regional'?'Dashboard Regional':'Dashboard Global';
      c.innerHTML=`
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div><h2 class="text-2xl font-black text-multival-navy">${titulo} — ${mesNombre(d.mes)}</h2>
        <p class="text-sm text-slate-500">Control 100% de la operación. ${d.habiles.transcurridos}/${d.habiles.total} días hábiles · ${d.habiles.restantes} restantes.</p></div>
        <div class="flex items-center gap-2">${selectorMes('cambiarMes()')}
        <button onclick="invalidarFront();renderDashboard(el('content'))" title="Actualizar" class="bg-white border border-slate-200 text-slate-600 hover:text-multival-navy px-4 py-2 font-bold rounded-lg shadow-sm text-sm"><i class="fa-solid fa-rotate-right"></i></button></div>
      </div>
      ${asesorPanel(consejosGlobal(d))}
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div class="bg-gradient-to-br from-multival-navy to-multival-navyHover rounded-[2rem] shadow-soft p-6 text-white flex flex-col justify-between relative overflow-hidden">
          <div class="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/5"></div>
          <p class="text-[10px] font-black uppercase tracking-wider text-blue-200">Cumplimiento ${currentUser.rol==='Regional'?'de mi regional':'global'}</p>
          <p class="text-5xl font-black mt-2">${g.pctGlobal}%</p>
          <p class="text-xs font-bold text-blue-200 mt-1">${g.validos} / ${g.metaGlobal} arqueos válidos</p>
          <div class="w-full bg-white/10 rounded-full h-2 mt-3"><div class="h-full rounded-full bg-multival-gold" style="width:${Math.min(g.pctGlobal,100)}%"></div></div>
        </div>
        <div class="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          ${kpiCard('Líderes en meta',g.cumplenMeta+'/'+g.totalLideres,'Cumplen los '+d.meta,'#3D8A44','fa-trophy')}
          ${kpiCard('En riesgo',g.enRiesgo,'Requieren atención','#F6CF46','fa-triangle-exclamation')}
          ${kpiCard('Críticos',g.criticos,'No proyectan meta','#ef4444','fa-circle-exclamation')}
          ${kpiCard('Extemporáneos',g.extemporaneos,g.normalizados+' normalizados','#94a3b8','fa-clock')}
        </div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        ${kpiCard('Total arqueos',g.totalArqueos,(g.complementarios||0)+' complementarios · '+(g.atmRepetidos||0)+' ATM repetidos','#25294F','fa-inbox')}
        ${kpiCard('Faltantes',g.faltantes,fmt(g.montoFaltante),'#dc2626','fa-arrow-down')}
        ${kpiCard('Sobrantes',g.sobrantes,fmt(g.montoSobrante),'#F6CF46','fa-arrow-up')}
        ${kpiCard('Diferencia neta',(g.montoNeto>=0?'+':'−')+fmt(Math.abs(g.montoNeto)).slice(1),'Sobrantes − Faltantes',g.montoNeto<0?'#dc2626':'#3D8A44','fa-scale-balanced')}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div class="lg:col-span-2 bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-4"><i class="fa-solid fa-chart-column text-multival-green mr-1"></i> Válidos por líder vs meta</h3>
          <canvas id="chart-lideres" height="120"></canvas></div>
        <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-4"><i class="fa-solid fa-chart-pie text-multival-green mr-1"></i> Estado de novedades</h3>
          <canvas id="chart-novedades" height="120"></canvas></div>
      </div>
      <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider"><i class="fa-solid fa-ranking-star text-multival-green mr-1"></i> Semáforo de líderes</h3>
          <button onclick="irA('lideres')" class="text-xs font-bold text-multival-green hover:text-multival-navy">Ver detalle completo</button></div>
        <div class="overflow-x-auto"><table><thead><tr><th>Líder</th><th>Válidos</th><th>Proyección</th><th>Avance</th><th>Estado</th></tr></thead><tbody>
        ${d.lideres.length? d.lideres.map(l=>`<tr>
          <td class="font-bold text-multival-navy">${l.nombre}</td>
          <td><span class="font-black">${l.validos}</span><span class="text-slate-400">/${l.meta}</span></td>
          <td class="font-bold" style="color:${semColor(l.semaforo)}">${l.proyeccion}</td>
          <td><div class="flex items-center gap-2"><div class="w-24 bg-slate-100 rounded-full h-2"><div class="h-full rounded-full" style="width:${l.pct}%;background:${semColor(l.semaforo)}"></div></div><span class="text-xs font-bold text-slate-500">${l.pctReal}%</span></div></td>
          <td>${semBadge(l.semaforo,l.estado)}</td></tr>`).join('') : '<tr><td colspan="5" class="text-center py-8 text-slate-400 font-bold">No hay líderes configurados. Verifica la hoja Usuarios (llave_arqueos = Lider).</td></tr>'}
        </tbody></table></div>
      </div>`;
      dibujarLideres(d.lideres,d.meta); dibujarNovedadesPie(g);
    }

    // ===================== CUMPLIMIENTO POR LIDER =====================
    function renderLideres(c){
      c.innerHTML=spinner;
      conDashboard(c, d=>{
        c.innerHTML=`
        <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div><h2 class="text-2xl font-black text-multival-navy">Cumplimiento por Líder — ${mesNombre(d.mes)}</h2>
          <p class="text-sm text-slate-500">Detalle individual, proyección y control de diferencias. Meta ${d.meta} arqueos válidos.</p></div>
          ${selectorMes("mesActual=el(&quot;sel-mes&quot;).value;irA(&quot;lideres&quot;)")}
        </div>
        ${d.lideres.length? `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">${d.lideres.map(l=>tarjetaLider(l,d)).join('')}</div>`
        : errorBox('No hay líderes visibles. Revisa que la hoja <b>Usuarios</b> tenga líderes con la llave_arqueos "Lider" y que su nombre cruce con la columna <b>LÍDER DE EXCELENCIA</b> del Directorio Nacional.')}`;
        poblarMeses();
      });
    }

    function tarjetaLider(l,d){
      const col=semColor(l.semaforo);
      return `<div class="bg-white rounded-[2rem] shadow-soft shadow-hover border border-slate-100 p-6 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-1" style="background:${col}"></div>
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black" style="background:${col}">${String(l.nombre).charAt(0)}</div>
            <div><p class="font-black text-multival-navy leading-tight">${l.nombre}</p>
            <p class="text-[11px] font-bold text-slate-400">${l.oficinas} oficinas · ${l.oficinasATM} con ATM</p></div>
          </div>${semBadge(l.semaforo,l.estado)}</div>
        <div class="flex items-center gap-5">
          <div class="relative flex items-center justify-center shrink-0">${ringSVG(l.pct,col,110)}
            <div class="absolute text-center"><p class="text-xl font-black text-multival-navy">${l.validos}</p><p class="text-[10px] font-bold text-slate-400">/${l.meta}</p></div></div>
          <div class="flex-1 space-y-2">
            <div class="flex justify-between text-xs"><span class="font-bold text-slate-500">Proyección fin mes</span><span class="font-black" style="color:${col}">${l.proyeccion}</span></div>
            <div class="flex justify-between text-xs"><span class="font-bold text-slate-500">Ritmo requerido/día</span><span class="font-black text-multival-navy">${l.requeridoPorDia>=999?'—':l.requeridoPorDia}</span></div>
            <div class="flex justify-between text-xs"><span class="font-bold text-slate-500">Extemporáneos</span><span class="font-black text-slate-400">${l.extemporaneos}</span></div>
            <div class="flex justify-between text-xs"><span class="font-bold text-slate-500">Presencial / Virtual</span><span class="font-black text-multival-navy">${l.presenciales||0} / ${l.virtuales||0}</span></div>
            <div class="flex justify-between text-xs"><span class="font-bold text-slate-500">Faltan p/meta</span><span class="font-black text-multival-navy">${l.faltanParaMeta}</span></div>
          </div></div>
        <div class="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
          <div class="bg-red-50 rounded-lg p-2 text-center"><p class="text-[10px] font-bold text-red-500 uppercase">Faltantes</p><p class="text-sm font-black text-red-600">${l.faltantes}</p><p class="text-[10px] font-bold text-red-400">${fmt(l.montoFaltante)}</p></div>
          <div class="bg-yellow-50 rounded-lg p-2 text-center"><p class="text-[10px] font-bold text-yellow-600 uppercase">Sobrantes</p><p class="text-sm font-black text-yellow-600">${l.sobrantes}</p><p class="text-[10px] font-bold text-yellow-500">${fmt(l.montoSobrante)}</p></div>
        </div></div>`;
    }

    // ===================== NOVEDADES =====================
    function renderNovedades(c){
      c.innerHTML=spinner;
      conDashboard(c, d=>{
        const g=d.global, esSuper=currentUser.rol!=='Lider';
        c.innerHTML=`
        <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div><h2 class="text-2xl font-black text-multival-navy">Faltantes y Sobrantes — ${mesNombre(d.mes)}</h2>
          <p class="text-sm text-slate-500">Control riguroso de diferencias operativas identificadas.</p></div>
          ${selectorMes("mesActual=el(&quot;sel-mes&quot;).value;irA(&quot;novedades&quot;)")}
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          ${kpiCard('Casos faltante',g.faltantes,fmt(g.montoFaltante),'#dc2626','fa-arrow-down')}
          ${kpiCard('Casos sobrante',g.sobrantes,fmt(g.montoSobrante),'#F6CF46','fa-arrow-up')}
          ${kpiCard('Total novedades',g.faltantes+g.sobrantes,'Este mes','#25294F','fa-triangle-exclamation')}
          ${kpiCard('Impacto neto',(g.montoNeto>=0?'+':'−')+fmt(Math.abs(g.montoNeto)).slice(1),'Sobr − Falt',g.montoNeto<0?'#dc2626':'#3D8A44','fa-scale-balanced')}
        </div>
        <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-4"><i class="fa-solid fa-magnifying-glass-dollar text-multival-green mr-1"></i> Detalle de diferencias (mayor a menor)</h3>
          <div class="overflow-x-auto"><table><thead><tr><th>Fecha</th><th>Oficina</th>${esSuper?'<th>Líder</th>':''}<th>Formato</th><th>Elemento</th><th>Novedad</th><th class="text-right">Diferencia</th><th>Gestión de la diferencia</th><th>Soporte</th><th>Acción</th></tr></thead><tbody>
          ${d.novedades.length? d.novedades.map(nv=>{
            const estDif = nv.estadoDiferencia && nv.estadoDiferencia!==DIFE.PENDIENTE
              ? `<span class="badge ${nv.estadoDiferencia===DIFE.RECUPERADO||nv.estadoDiferencia===DIFE.CRUZADO?'badge-ok':'badge-warn'}">${esc(nv.estadoDiferencia)}</span>${nv.tipologia?' <span class="badge badge-purple">'+esc(nv.tipologia)+'</span>':''}`
              : (nv.explicacionSolicitada ? '<span class="badge badge-pend"><i class="fa-solid fa-bell"></i>Explicación pendiente</span>' : '<span class="badge badge-gray">Sin solicitar</span>');
            const acc = esSuper
              ? `<button onclick="abrirGestion('${nv.id}')" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-multival-navy text-white hover:bg-multival-navyHover uppercase"><i class="fa-solid fa-comment-dots mr-1"></i>${nv.explicacionSolicitada?'Gestionar':'Solicitar explicación'}</button>`
              : (nv.explicacionSolicitada && (!nv.estadoDiferencia||nv.estadoDiferencia===DIFE.PENDIENTE)
                  ? `<button onclick="abrirRespuesta('${nv.id}')" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-red-600 text-white hover:bg-red-700 uppercase"><i class="fa-solid fa-reply mr-1"></i>Explicar</button>`
                  : `<button onclick="abrirDetalle('${nv.id}')" class="text-[10px] font-black text-slate-400 hover:text-multival-navy uppercase"><i class="fa-solid fa-eye mr-1"></i>Detalle</button>`);
            return `<tr>
            <td class="font-medium">${nv.fecha}</td><td class="font-bold text-multival-navy">${esc(nv.oficina)}</td>
            ${esSuper?`<td class="text-xs">${esc(nv.lider)}</td>`:''}
            <td class="text-[10px] font-mono font-bold text-slate-500">${nv.formato||'—'}</td>
            <td class="text-xs">${esc(nv.elemento||'—')}</td>
            <td>${nv.novedad==='FALTANTE'?'<span class="px-2 py-1 rounded-md text-[10px] font-black bg-red-100 text-red-700">FALTANTE</span>':'<span class="px-2 py-1 rounded-md text-[10px] font-black bg-yellow-100 text-yellow-700">SOBRANTE</span>'}</td>
            <td class="text-right font-black ${nv.novedad==='FALTANTE'?'text-red-600':'text-yellow-600'}">${nv.novedad==='FALTANTE'?'−':'+'}${nv.formato===FMT.CHEQUES?Math.abs(nv.diferencia):fmt(Math.abs(nv.diferencia))}</td>
            <td>${estDif}</td>
            <td>${nv.url&&nv.url!=='Arqueo Digital'?`<a href="${nv.url}" target="_blank" class="text-xs font-bold text-multival-green hover:underline"><i class="fa-solid fa-file-pdf mr-1"></i>PDF</a>`:'<span class="text-xs text-slate-400">—</span>'}</td>
            <td>${acc}</td></tr>`; }).join('')
          : `<tr><td colspan="10" class="text-center py-8 text-slate-400 font-bold"><i class="fa-solid fa-circle-check text-multival-green mr-1"></i>Sin faltantes ni sobrantes este mes.</td></tr>`}
          </tbody></table></div></div>`;
        poblarMeses();
      });
    }

    // ===================== HISTORIAL / MATRIZ =====================
    var HIST=[], histFiltro='todos', HIST_MES='', HIST_LIMITE=100, HIST_FILTRO_SIG='';
    var HIST_PAGINA=100;
    function renderHistorial(c){
      if(!HIST_MES) HIST_MES = mesActual;
      histFiltro = HIST_FILTRO_SIG || 'todos'; HIST_FILTRO_SIG='';
      c.innerHTML=spinner;
      llamar('hist|'+HIST_MES, 'obtenerHistorial', [currentUser.idUsuario, currentUser.rol, HIST_MES], data=>{
        HIST=(data||[]).map(r=>{ r._txt=[r.oficina,r.nombreLider,r.lider,r.formato,r.modalidad,r.elemento,r.numeroElem,r.novedad,r.fechaReal,r.fechaCarga,r.id,r.tipologia,r.estadoRevision,r.estadoDiferencia,r.tipoVisita].join(' ').toLowerCase(); return r; });
        HIST_LIMITE=HIST_PAGINA;
        const esSuper=currentUser.rol!=='Lider';
        const pendL=HIST.filter(r=>r.pendienteLider&&r.pendienteLider.length).length;
        const pendA=HIST.filter(r=>r.pendienteAnalista).length;
        const mesHoy=mesActual;
        c.innerHTML=`
        <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div><h2 class="text-2xl font-black text-multival-navy">${esSuper?'Matriz de Arqueos':'Mis Arqueos'}</h2>
          <p class="text-sm text-slate-500"><span id="hist-total">${HIST.length}</span> registros ${HIST_MES==='TODOS'?'históricos':'de '+mesNombre(HIST_MES)+' (más las novedades abiertas de otros meses)'}. Cada fila tiene su PDF de soporte y su estado de gestión.</p></div>
          <div class="flex items-center gap-2 flex-wrap">
            <select id="sel-mes-hist" class="sel-mini" onchange="HIST_MES=this.value;renderHistorial(el('content'))">
              <option value="${HIST_MES}">${HIST_MES==='TODOS'?'Todos los meses':mesNombre(HIST_MES)}</option>
            </select>
            <div class="tabs-mini" id="hist-tabs">
              <button class="${histFiltro==='todos'?'on':''}" onclick="filtrarHistPend('todos')">Todos</button>
              <button class="${histFiltro==='mes'?'on':''}" onclick="filtrarHistPend('mes')">Este mes</button>
              <button class="${histFiltro==='pend'?'on':''}" onclick="filtrarHistPend('pend')">${esSuper?'Con novedad':'Pendientes'} ${(esSuper?pendL+pendA:pendL)?`<span class="nav-badge">${esSuper?pendL+pendA:pendL}</span>`:''}</button>
              <button class="${histFiltro==='dif'?'on':''}" onclick="filtrarHistPend('dif')">Faltantes / Sobrantes</button>
              <button class="${histFiltro==='ok'?'on':''}" onclick="filtrarHistPend('ok')">OK</button>
            </div>
            <input type="text" id="buscar-hist" oninput="filtrarHist()" placeholder="Buscar oficina, formato, líder..." class="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-multival-navy outline-none focus:ring-2 focus:ring-multival-green/20">
          </div>
        </div>
        ${!esSuper?`<div id="hist-oficinas" class="mb-6"></div>`:''}
        <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <div class="overflow-x-auto"><table id="tabla-hist"><thead><tr>
            <th>Carga Sistema</th><th>Oficina</th>${esSuper?'<th>Líder</th>':''}<th>Fecha Física</th><th>Formato</th><th>Modalidad</th><th>Elemento</th><th>Estado</th><th>Novedad</th><th class="text-right">Diferencia</th><th>Gestión</th><th>Soporte</th><th>Acción</th>
          </tr></thead><tbody id="hist-body"></tbody></table></div>
          <div id="hist-mas" class="text-center mt-4"></div>
        </div>`;
        pintarTablaHist();
        poblarMesesHist();
        if(!esSuper) pintarOficinasLider(mesHoy);
      }, fail(c));
    }

    function poblarMesesHist(){
      llamar('meses', 'obtenerMesesDisponibles', [currentUser.idUsuario, currentUser.rol], meses=>{
        const s=el('sel-mes-hist'); if(!s || !meses) return;
        s.innerHTML = meses.map(m=>`<option value="${m}" ${m===HIST_MES?'selected':''}>${mesNombre(m)}</option>`).join('') +
          `<option value="TODOS" ${HIST_MES==='TODOS'?'selected':''}>Todos los meses</option>`;
      });
    }

    function histFiltrados(){
      const q=(el('buscar-hist')?el('buscar-hist').value:'').toLowerCase().trim();
      return HIST.filter(r=>{
        if(q && r._txt.indexOf(q)<0) return false;
        if(histFiltro==='mes') return r.mes===mesActual;
        if(histFiltro==='pend') return (r.pendienteLider&&r.pendienteLider.length) || r.pendienteAnalista;
        if(histFiltro==='dif') return r.novedad==='FALTANTE'||r.novedad==='SOBRANTE';
        if(histFiltro==='ok') return !!r.gestionOK;
        return true;
      });
    }

    /** Pinta solo las primeras filas (paginación): con miles de registros el navegador no se bloquea. */
    function pintarTablaHist(){
      const body=el('hist-body'); if(!body) return;
      const esSuper=currentUser.rol!=='Lider';
      const lista=histFiltrados();
      const vis=lista.slice(0,HIST_LIMITE);
      body.innerHTML = vis.length ? vis.map(r=>filaHist(r,esSuper)).join('')
        : `<tr><td colspan="13" class="text-center py-8 text-slate-400 font-bold">${HIST.length?'No hay registros para este filtro.':'Aún no hay arqueos registrados.'}</td></tr>`;
      const resto=lista.length-vis.length;
      el('hist-mas').innerHTML = resto>0
        ? `<button onclick="HIST_LIMITE+=HIST_PAGINA;pintarTablaHist()" class="bg-slate-100 hover:bg-slate-200 text-multival-navy font-black text-xs px-5 py-2.5 rounded-xl">Mostrar ${Math.min(resto,HIST_PAGINA)} más · ${resto} restante(s)</button>`
        : (lista.length>HIST_PAGINA?`<span class="text-[11px] font-bold text-slate-400">${lista.length} registros mostrados</span>`:'');
      if(el('hist-total')) el('hist-total').textContent = lista.length===HIST.length ? HIST.length : lista.length+' de '+HIST.length;
    }

    /** Panel "Mis Arqueos": nombres de las oficinas con arqueo cargado este mes y las pendientes. */
    function pintarOficinasLider(mes){
      const box=el('hist-oficinas'); if(!box) return;
      box.innerHTML=`<div class="bg-white rounded-[1.5rem] shadow-soft border border-slate-100 p-5 text-xs font-bold text-slate-400"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Consultando oficinas con arqueo del mes...</div>`;
      llamar('cli|'+mes+'|', 'obtenerDashboardClientes', [currentUser.idUsuario, currentUser.rol, mes, ''], d=>{
        if(!d||!d.success){ box.innerHTML=''; return; }
        const con=d.oficinas.filter(o=>o.conArqueo), sin=d.oficinas.filter(o=>!o.conArqueo);
        box.innerHTML=`<div class="bg-white rounded-[1.5rem] shadow-soft border border-slate-100 p-5">
          <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider"><i class="fa-solid fa-building-columns text-multival-green mr-1"></i> Oficinas con arqueo cargado — ${mesNombre(mes)}</h3>
            <div class="flex gap-2"><span class="badge badge-ok">${con.length} con arqueo</span><span class="badge badge-pend">${sin.length} pendientes</span><span class="badge badge-gray">${d.oficinas.length} a cargo</span></div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div><p class="lbl-sec mb-1">Con arqueo este mes</p><div>${con.length?con.map(o=>`<span class="pill-ofi ok" title="${esc(o.estadoGeneral)}"><i class="fa-solid fa-circle-check"></i>${esc(o.oficina)}<span class="text-[9px] font-black opacity-70">${o.visitas} visita(s)${o.exige.atm?' · ATM '+o.atmHechos+'/'+o.atmTotal:''}${o.exige.cheques?' · CHQ '+(o.estadoCheques==='OK'?'✓':'✗'):''}${o.pendientes.length?' · falta '+o.pendientes.join('/'):''}</span></span>`).join(''):'<span class="text-xs text-slate-400">Aún no has cargado arqueos este mes.</span>'}</div></div>
            <div><p class="lbl-sec mb-1">Pendientes por arquear</p><div>${sin.length?sin.map(o=>`<span class="pill-ofi pend"><i class="fa-regular fa-circle"></i>${esc(o.oficina)}${o.exige.atm?'<span class="text-[9px] font-black opacity-70">ATM</span>':''}${o.exige.cheques?'<span class="text-[9px] font-black opacity-70">CHQ</span>':''}</span>`).join(''):'<span class="text-xs text-multival-green font-bold">¡Todas tus oficinas tienen arqueo este mes!</span>'}</div></div>
          </div></div>`;
      }, ()=>{ box.innerHTML=''; });
    }

    function badgesGestion(r){
      const b=[];
      if(r.estadoRevision===REV.NOVEDAD) b.push('<span class="badge badge-pend" title="'+esc(r.obsAnalista)+'"><i class="fa-solid fa-file-circle-exclamation"></i>Soporte con novedad</span>');
      else if(r.estadoRevision===REV.CORREGIDO) b.push('<span class="badge badge-info"><i class="fa-solid fa-file-arrow-up"></i>Corregido · pendiente OK</span>');
      else if(r.estadoRevision===REV.OK) b.push('<span class="badge badge-ok"><i class="fa-solid fa-circle-check"></i>OK</span>');
      if(r.explicacionSolicitada){
        if(!r.estadoDiferencia||r.estadoDiferencia===DIFE.PENDIENTE) b.push('<span class="badge badge-pend"><i class="fa-solid fa-comment-dots"></i>Explicación pendiente</span>');
        else b.push('<span class="badge '+(r.estadoDiferencia===DIFE.RECUPERADO||r.estadoDiferencia===DIFE.CRUZADO?'badge-ok':'badge-warn')+'">'+esc(r.estadoDiferencia)+'</span>');
      } else if(r.estadoDiferencia && r.estadoDiferencia!==DIFE.PENDIENTE) b.push('<span class="badge badge-ok">'+esc(r.estadoDiferencia)+'</span>');
      if(r.tipologia) b.push('<span class="badge badge-purple" title="Tipología">'+esc(r.tipologia)+'</span>');
      if(r.obsAnalista && r.estadoRevision!==REV.NOVEDAD) b.push('<span class="badge badge-gray" title="'+esc(r.obsAnalista)+'"><i class="fa-solid fa-note-sticky"></i>Obs.</span>');
      if(r.usdDiferencia!==null && r.usdDiferencia!==undefined) b.push('<span class="badge '+(r.usdDiferencia<0?'badge-pend':(r.usdDiferencia>0?'badge-warn':'badge-ok'))+'">USD '+(r.usdDiferencia>0?'+':'')+Number(r.usdDiferencia).toFixed(2)+'</span>');
      return b.length? '<div class="flex flex-wrap gap-1">'+b.join('')+'</div>' : '<span class="text-xs text-slate-300">—</span>';
    }

    function filaHist(r,esSuper){
      let badge;
      if(r.extemporaneo==='SÍ') badge='<span class="px-2 py-1 rounded-md text-[10px] font-black border bg-red-100 text-red-700 border-red-200">Extemporáneo</span>';
      else if(r.extemporaneo==='NORMALIZADO') badge='<span class="px-2 py-1 rounded-md text-[10px] font-black border bg-blue-100 text-blue-700 border-blue-200">Normalizado ✓</span>';
      else badge='<span class="px-2 py-1 rounded-md text-[10px] font-black border bg-green-100 text-multival-green border-green-200">A Tiempo</span>';

      let nov='<span class="text-xs text-slate-400">—</span>';
      if(r.novedad==='FALTANTE') nov='<span class="px-2 py-1 rounded text-[10px] font-black bg-red-100 text-red-700">FALTANTE</span>';
      else if(r.novedad==='SOBRANTE') nov='<span class="px-2 py-1 rounded text-[10px] font-black bg-yellow-100 text-yellow-700">SOBRANTE</span>';
      else if(r.novedad==='PENDIENTE') nov='<span class="px-2 py-1 rounded text-[10px] font-black bg-slate-100 text-slate-500">PENDIENTE</span>';
      else if(r.novedad==='SIN NOVEDAD') nov='<span class="px-2 py-1 rounded text-[10px] font-black bg-green-50 text-multival-green">OK</span>';

      let difHtml='<span class="text-slate-400 text-xs">'+r.diferencia+'</span>';
      if(r.diferencia!=='Pendiente N8N'&&r.diferencia!==''){ const v=parseFloat(r.diferencia);
        if(!isNaN(v)) difHtml=`<span class="font-black ${v<0?'text-red-600':(v>0?'text-yellow-600':'text-multival-green')}">${v>0?'+':''}${r.formato===FMT.CHEQUES?v:fmt(v)}</span>`; }

      const pdf = r.urlPdf || r.url;
      let sop = (pdf && pdf!=='Arqueo Digital')
        ? `<a href="${pdf}" target="_blank" class="text-xs font-bold text-multival-green hover:underline"><i class="fa-solid fa-file-pdf mr-1"></i>PDF</a>`
        : '<span class="text-xs font-bold text-slate-400">—</span>';
      if(r.urlTirillas) sop += ` <a href="${String(r.urlTirillas).split(' | ')[0]}" target="_blank" class="text-xs font-bold text-multival-navy hover:underline ml-2"><i class="fa-solid fa-receipt mr-1"></i>Tirillas</a>`;
      if(r.urlCorreccion) sop += ` <a href="${String(r.urlCorreccion).split(' | ').pop()}" target="_blank" class="text-xs font-bold text-blue-700 hover:underline ml-2" title="Soporte corregido"><i class="fa-solid fa-file-arrow-up mr-1"></i>Corregido</a>`;

      const modChip = r.modalidad==='VIRTUAL'
        ? '<span class="px-2 py-1 rounded text-[10px] font-black bg-slate-100 text-multival-navy"><i class="fa-solid fa-video mr-1"></i>Virtual</span>'
        : (r.modalidad==='PRESENCIAL'?'<span class="px-2 py-1 rounded text-[10px] font-black bg-green-50 text-multival-green"><i class="fa-solid fa-person-walking mr-1"></i>Presencial</span>':'<span class="text-xs text-slate-300">—</span>');

      const pendL = r.pendienteLider && r.pendienteLider.length;
      let accion='';
      if(currentUser.rol==='Lider'){
        if(pendL) accion+=`<button onclick="abrirRespuesta('${r.id}')" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-red-600 text-white hover:bg-red-700 uppercase mb-1"><i class="fa-solid fa-reply mr-1"></i>Responder</button><br>`;
        if(r.extemporaneo==='SÍ'){
          if(r.estadoNorm==='PENDIENTE') accion+='<span class="text-[10px] font-black text-multival-gold uppercase"><i class="fa-solid fa-hourglass-half mr-1"></i>En revisión</span>';
          else if(r.estadoNorm==='RECHAZADA') accion+=`<button onclick="modalNormalizar('${r.id}')" class="text-[10px] font-black text-red-500 hover:text-multival-navy uppercase"><i class="fa-solid fa-rotate-left mr-1"></i>Rechazada · Reintentar</button>`;
          else accion+=`<button onclick="modalNormalizar('${r.id}')" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-multival-navy text-white hover:bg-multival-navyHover uppercase"><i class="fa-solid fa-rotate-left mr-1"></i>Normalizar</button>`;
        }
        if(!accion) accion=`<button onclick="abrirDetalle('${r.id}')" class="text-[10px] font-black text-slate-400 hover:text-multival-navy uppercase"><i class="fa-solid fa-eye mr-1"></i>Detalle</button>`;
      } else {
        accion=`<button onclick="abrirGestion('${r.id}')" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black ${r.pendienteAnalista?'bg-blue-700':'bg-multival-navy'} text-white hover:bg-multival-navyHover uppercase"><i class="fa-solid fa-clipboard-check mr-1"></i>${r.pendienteAnalista?'Confirmar':'Gestionar'}</button>`;
      }

      const clasesFila = 'hist-row'+(pendL?' fila-pend':'')+(r.atmRepetido?' fila-atm-rep':'');
      const dataAttrs = `data-id="${r.id}" data-mes="${r.mes}" data-pend="${pendL||r.pendienteAnalista?'1':'0'}" data-dif="${r.novedad==='FALTANTE'||r.novedad==='SOBRANTE'?'1':'0'}" data-ok="${r.gestionOK?'1':'0'}"`;
      return `<tr class="${clasesFila}" ${dataAttrs}><td class="font-medium text-xs">${r.fechaCarga}</td>
        <td class="font-bold text-multival-navy">${esc(r.oficina)}</td>
        ${esSuper?`<td class="text-xs">${esc(r.nombreLider||r.lider)}</td>`:''}
        <td class="text-xs">${r.fechaReal}</td>
        <td class="text-[10px] font-mono font-bold text-slate-500">${r.formato||'—'}${
          r.tipoVisita==='VISITA ADICIONAL' ? '<br><span class="text-[9px] font-black text-purple-600 uppercase">visita adicional</span>' : ''}${
          r.atmRepetido ? '<br><span class="text-[9px] font-black text-amber-700 uppercase" title="El cajero ya contó el '+esc(r.atmPrimero)+'">ATM ya contado</span>'
          : (r.cuentaMeta?'<br><span class="text-[9px] font-black text-multival-green uppercase">suma a la meta</span>':'<br><span class="text-[9px] text-slate-400">complementario</span>')}</td>
        <td>${modChip}</td>
        <td class="text-xs">${esc(r.elemento||'—')}${r.numeroElem?' '+esc(r.numeroElem):''}</td>
        <td>${badge}</td><td>${nov}</td>
        <td class="text-right">${difHtml}</td>
        <td>${badgesGestion(r)}</td>
        <td>${sop}</td><td>${accion}</td></tr>`;
    }

    function filtrarHistPend(tipo){
      histFiltro=tipo; HIST_LIMITE=HIST_PAGINA;
      document.querySelectorAll('#hist-tabs button').forEach(b=>b.classList.toggle('on', b.getAttribute('onclick').indexOf("'"+tipo+"'")>=0));
      pintarTablaHist();
    }
    var _tBusq=null;
    function filtrarHist(){ clearTimeout(_tBusq); _tBusq=setTimeout(()=>{ HIST_LIMITE=HIST_PAGINA; pintarTablaHist(); },180); }

    // ===================== GESTION DE NOVEDADES (analista / regional) =====================
    function histPorId(id){ return HIST.find(x=>String(x.id)===String(id)); }
    /** Garantiza que el arqueo este cargado en memoria (HIST) antes de abrir un modal. */
    function conArqueo(id, cb){
      const r=histPorId(id); if(r){ cb(r); return; }
      abrirModal(`<div class="text-center py-6 text-sm font-bold text-slate-500"><i class="fa-solid fa-circle-notch fa-spin mr-2 text-multival-green"></i>Cargando arqueo...</div>`);
      google.script.run.withSuccessHandler(x=>{ if(x){ HIST.push(x); cb(x); } else { cerrarModal(); alert('Arqueo no encontrado.'); } })
        .withFailureHandler(e=>{ cerrarModal(); alert('Error: '+e.message); }).obtenerArqueo(id, currentUser.idUsuario, currentUser.rol);
    }

    function resumenArqueoHtml(r){
      return `<div class="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs">
        <div class="flex flex-wrap gap-x-4 gap-y-1">
          <span><b class="text-multival-navy">${esc(r.oficina)}</b> · ${esc(r.fechaReal)}</span>
          <span class="font-mono">${esc(r.formato)}</span>
          <span>${esc(r.elemento||'')} ${esc(r.numeroElem||'')}</span>
          <span>${currentUser.rol!=='Lider'?'Líder: <b>'+esc(r.nombreLider||r.lider)+'</b>':''}</span>
          <span>Novedad: <b class="${r.novedad==='FALTANTE'?'text-red-600':(r.novedad==='SOBRANTE'?'text-yellow-600':'text-multival-green')}">${esc(r.novedad||'—')}</b> ${r.diferencia!==''&&r.diferencia!=='Pendiente N8N'?(r.formato===FMT.CHEQUES?r.diferencia:fmt(r.diferencia)):''}</span>
          ${r.usdDiferencia!==null&&r.usdDiferencia!==undefined?`<span>USD: <b>${Number(r.usdDiferencia).toFixed(2)}</b></span>`:''}
        </div>
        <div class="mt-1 flex flex-wrap gap-3">
          ${(r.urlPdf||r.url)&&(r.urlPdf||r.url)!=='Arqueo Digital'?`<a href="${r.urlPdf||r.url}" target="_blank" class="font-bold text-multival-green hover:underline"><i class="fa-solid fa-file-pdf mr-1"></i>Ver PDF</a>`:''}
          ${r.urlTirillas?`<a href="${String(r.urlTirillas).split(' | ')[0]}" target="_blank" class="font-bold text-multival-navy hover:underline"><i class="fa-solid fa-receipt mr-1"></i>Tirillas</a>`:''}
          ${r.urlCorreccion?String(r.urlCorreccion).split(' | ').map((u,i)=>`<a href="${u}" target="_blank" class="font-bold text-blue-700 hover:underline"><i class="fa-solid fa-file-arrow-up mr-1"></i>Corrección ${i+1}</a>`).join(''):''}
        </div>
        ${r.observaciones?`<p class="mt-2 text-slate-500"><b>Obs. del líder en el formato:</b> ${esc(r.observaciones)}</p>`:''}
      </div>`;
    }

    function historialGestionHtml(r){
      return `
        ${r.obsAnalista?`<div class="mt-3 bg-amber-50 border-l-4 border-multival-gold p-3 rounded-r-lg text-xs"><b class="text-multival-navy">Observación / mensaje del analista${r.revisor?' ('+esc(r.revisor)+(r.fechaRevision?' · '+esc(r.fechaRevision):'')+')':''}:</b><br>${esc(r.obsAnalista)}</div>`:''}
        ${r.respuestaLider?`<div class="mt-2 bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg text-xs"><b class="text-multival-navy">Respuesta del líder${r.fechaCorreccion?' ('+esc(r.fechaCorreccion)+')':''}:</b><br>${esc(r.respuestaLider)}</div>`:''}
        ${r.explicacionLider?`<div class="mt-2 bg-purple-50 border-l-4 border-purple-500 p-3 rounded-r-lg text-xs"><b class="text-multival-navy">Explicación de la diferencia${r.fechaExplicacion?' ('+esc(r.fechaExplicacion)+')':''}:</b><br>${esc(r.explicacionLider)}<br><span class="badge badge-purple mt-1">${esc(r.tipologia||'Sin tipología')}</span> <span class="badge ${r.estadoDiferencia===DIFE.RECUPERADO||r.estadoDiferencia===DIFE.CRUZADO?'badge-ok':'badge-warn'} mt-1">${esc(r.estadoDiferencia||'')}</span></div>`:''}
        <div id="bitacora-box" class="mt-2 text-[11px] text-slate-400"><i class="fa-solid fa-circle-notch fa-spin mr-1"></i>Cargando bitácora...</div>`;
    }
    function cargarBitacora(id){
      google.script.run.withSuccessHandler(ev=>{
        const b=el('bitacora-box'); if(!b) return;
        b.innerHTML = ev.length ? `<p class="lbl-sec mt-2 mb-1">Bitácora de gestión</p><div class="scroll-y space-y-1">${ev.map(e=>`<div class="flex gap-2 text-[11px]"><span class="text-slate-400 shrink-0">${esc(e.fecha)}</span><span class="font-black text-multival-navy shrink-0">${esc(e.accion)}</span><span class="text-slate-500">${esc(e.actor)} (${esc(e.rol)})${e.detalle?': '+esc(e.detalle):''}${e.notificado==='SI'?' · <i class="fa-solid fa-envelope"></i> notificado':''}</span></div>`).join('')}</div>` : '<span>Sin eventos de gestión registrados.</span>';
      }).withFailureHandler(()=>{ const b=el('bitacora-box'); if(b) b.innerHTML=''; }).obtenerBitacoraArqueo(id);
    }

    /** Modal del ANALISTA / REGIONAL: observaciones, novedad de soporte, solicitud de explicación, OK. */
    function abrirGestion(id){ conArqueo(id, r=>abrirGestionR(r)); }
    function abrirGestionR(r){
      const id=r.id;
      const tieneDif = r.novedad==='FALTANTE'||r.novedad==='SOBRANTE'||(r.usdDiferencia&&r.usdDiferencia!==0);
      abrirModal(`
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-multival-navy/5 flex items-center justify-center text-multival-navy"><i class="fa-solid fa-clipboard-check"></i></div>
          <div><h3 class="font-black text-multival-navy">Gestionar arqueo</h3><p class="text-xs text-slate-500">${esc(r.id)}</p></div>
          <div style="margin-left:auto">${badgesGestion(r)}</div>
        </div>
        ${resumenArqueoHtml(r)}
        ${historialGestionHtml(r)}
        <div class="mt-4 border-t border-dashed border-slate-200 pt-4 space-y-3">
          <p class="lbl-sec">Acción</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label class="flex items-start gap-2 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50"><input type="radio" name="g-accion" value="OBSERVACION" checked class="radio-multival mt-0.5"><span class="text-xs"><b class="text-multival-navy block">Observación general</b><span class="text-slate-500">Registra un comentario sobre el arqueo. No genera pendiente al líder.</span></span></label>
            <label class="flex items-start gap-2 p-3 rounded-xl border border-red-200 cursor-pointer hover:bg-red-50"><input type="radio" name="g-accion" value="NOVEDAD_SOPORTE" class="radio-multival mt-0.5"><span class="text-xs"><b class="text-red-700 block">Novedad en el soporte</b><span class="text-slate-500">Inconsistencia en el PDF / tirillas. Notifica al líder, habilita la corrección y recarga del soporte.</span></span></label>
            <label class="flex items-start gap-2 p-3 rounded-xl border ${tieneDif?'border-yellow-300 cursor-pointer hover:bg-yellow-50':'border-slate-100 opacity-50'}"><input type="radio" name="g-accion" value="SOLICITAR_EXPLICACION" ${tieneDif?'':'disabled'} class="radio-multival mt-0.5"><span class="text-xs"><b class="text-yellow-700 block">Solicitar explicación del ${r.novedad==='SOBRANTE'?'sobrante':'faltante'}</b><span class="text-slate-500">El líder debe explicar, indicar tipología y si fue ${r.novedad==='SOBRANTE'?'cruzado / compensado':'recuperado'}. Alerta persistente hasta responder.</span></span></label>
            <label class="flex items-start gap-2 p-3 rounded-xl border border-green-200 cursor-pointer hover:bg-green-50"><input type="radio" name="g-accion" value="OK" class="radio-multival mt-0.5"><span class="text-xs"><b class="text-multival-green block">Marcar OK</b><span class="text-slate-500">Novedad subsanada: la información queda lista para consolidación.</span></span></label>
          </div>
          <textarea id="g-texto" rows="3" placeholder="Mensaje para el líder / observación (obligatorio para novedad de soporte)" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-multival-navy outline-none focus:ring-2 focus:ring-multival-green/20">${esc(r.obsAnalista||'')}</textarea>
          <p id="g-msg" class="text-xs font-bold h-4"></p>
          <div class="flex justify-between items-center flex-wrap gap-2">
            ${r.estadoRevision===REV.OK?`<button onclick="enviarGestion('${r.id}','REABRIR')" class="text-[11px] font-black text-slate-400 hover:text-red-600 uppercase"><i class="fa-solid fa-lock-open mr-1"></i>Reabrir registro</button>`:'<span></span>'}
            <div class="flex gap-2">
              <button onclick="cerrarModal()" class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-multival-navy">Cancelar</button>
              <button id="btn-g" onclick="enviarGestion('${r.id}')" class="bg-multival-navy hover:bg-multival-navyHover text-white font-bold py-2 px-6 rounded-xl text-sm"><i class="fa-solid fa-paper-plane mr-1 text-multival-gold"></i>Aplicar</button>
            </div>
          </div>
        </div>`,'max-w-xl');
      cargarBitacora(id);
    }

    function enviarGestion(id, accionForzada){
      const accion = accionForzada || radioVal('g-accion');
      const texto = el('g-texto')?el('g-texto').value:'';
      const m=el('g-msg');
      if(accion==='NOVEDAD_SOPORTE' && !texto.trim()){ m.innerText='Describe la inconsistencia del soporte.'; m.className='text-xs font-bold text-red-500 h-4'; return; }
      if(accion==='OBSERVACION' && !texto.trim()){ m.innerText='Escribe la observación.'; m.className='text-xs font-bold text-red-500 h-4'; return; }
      if(el('btn-g')) el('btn-g').disabled=true;
      m.innerText='Aplicando...'; m.className='text-xs font-bold text-slate-500 h-4';
      google.script.run.withSuccessHandler(res=>{
        if(el('btn-g')) el('btn-g').disabled=false;
        m.innerText=res.message; m.className='text-xs font-bold '+(res.success?'text-multival-green':'text-red-500')+' h-4';
        if(res.success){ trasEscritura(); setTimeout(()=>{ cerrarModal(); irA('historial'); },900); }
      }).withFailureHandler(e=>{ if(el('btn-g')) el('btn-g').disabled=false; m.innerText='Error: '+e.message; m.className='text-xs font-bold text-red-500 h-4'; })
      .gestionarArqueo(id, accion, { texto: texto }, currentUser.idUsuario, currentUser.rol);
    }

    /** Modal del LIDER: corrige el soporte y/o explica la diferencia. */
    function abrirRespuesta(id){ conArqueo(id, r=>abrirRespuestaR(r)); }
    function abrirRespuestaR(r){
      const pend=r.pendienteLider||[];
      const pideSoporte = pend.indexOf('SOPORTE')>=0;
      const pideExpl = pend.indexOf('EXPLICACION')>=0;
      const esSobrante = r.novedad==='SOBRANTE' || (r.novedad!=='FALTANTE' && r.usdDiferencia>0);
      const opcionesEstado = esSobrante
        ? [[DIFE.CRUZADO,'Sobrante cruzado / compensado'],[DIFE.NO_CRUZADO,'Sobrante NO compensado (pendiente)']]
        : [[DIFE.RECUPERADO,'Faltante recuperado'],[DIFE.NO_RECUPERADO,'Faltante NO recuperado']];
      abrirModal(`
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center"><i class="fa-solid fa-reply"></i></div>
          <div><h3 class="font-black text-multival-navy">Responder novedad</h3><p class="text-xs text-slate-500">${esc(r.id)} · la alerta se cerrará cuando respondas y el analista confirme el OK</p></div>
        </div>
        ${resumenArqueoHtml(r)}
        ${r.obsAnalista?`<div class="mt-3 bg-amber-50 border-l-4 border-multival-gold p-3 rounded-r-lg text-xs"><b class="text-multival-navy">Mensaje del analista${r.fechaRevision?' ('+esc(r.fechaRevision)+')':''}:</b><br>${esc(r.obsAnalista)}</div>`:''}
        <div class="mt-4 space-y-4">
          ${pideSoporte?`
          <div class="border border-red-200 rounded-xl p-4 bg-red-50 space-y-2">
            <p class="text-xs font-black text-red-700 uppercase"><i class="fa-solid fa-file-circle-exclamation mr-1"></i>1. Corrección del soporte</p>
            <textarea id="rp-respuesta" rows="3" placeholder="Describe la corrección realizada" class="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-multival-navy outline-none"></textarea>
            <div class="border-2 border-dashed border-slate-300 bg-white rounded-xl p-4">
              <p class="text-[10px] font-bold text-slate-500 mb-1">Volver a cargar el soporte corregido (PDF o imagen, máx. ${MAX_MB_TIRILLA} MB)</p>
              <input type="file" id="rp-archivo" accept="application/pdf,.pdf,image/*" class="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-multival-navy file:text-white cursor-pointer">
            </div>
          </div>`:''}
          ${pideExpl?`
          <div class="border border-yellow-300 rounded-xl p-4 bg-yellow-50 space-y-2">
            <p class="text-xs font-black text-yellow-700 uppercase"><i class="fa-solid fa-comment-dots mr-1"></i>${pideSoporte?'2':'1'}. Explicación del ${esSobrante?'sobrante':'faltante'}</p>
            <textarea id="rp-explicacion" rows="3" placeholder="Explica el origen de la diferencia y las acciones tomadas" class="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm text-multival-navy outline-none"></textarea>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><span class="text-[10px] font-bold text-slate-500 uppercase">Tipología <span class="text-red-500">*</span></span>
                <select id="rp-tipologia" class="sel-mini w-full mt-1" onchange="el('rp-tipologia-otra').classList.toggle('hidden',this.value!=='Otra')">
                  <option value="">Selecciona...</option>${(TIPOLOGIAS.length?TIPOLOGIAS:['Otra']).map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
                <input type="text" id="rp-tipologia-otra" placeholder="Especifica la tipología" class="sel-mini w-full mt-1 hidden"></div>
              <div><span class="text-[10px] font-bold text-slate-500 uppercase">Estado de la diferencia <span class="text-red-500">*</span></span>
                <select id="rp-estado" class="sel-mini w-full mt-1"><option value="">Selecciona...</option>${opcionesEstado.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></div>
            </div>
          </div>`:''}
          <p id="rp-msg" class="text-xs font-bold h-4"></p>
          <div class="flex justify-end gap-2">
            <button onclick="cerrarModal()" class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-multival-navy">Cancelar</button>
            <button id="btn-rp" onclick="enviarRespuesta('${r.id}',${pideSoporte},${pideExpl})" class="bg-multival-navy hover:bg-multival-navyHover text-white font-bold py-2 px-6 rounded-xl text-sm"><i class="fa-solid fa-paper-plane mr-1 text-multival-gold"></i>Enviar respuesta</button>
          </div>
        </div>`,'max-w-xl');
    }

    function enviarRespuesta(id, pideSoporte, pideExpl){
      const m=el('rp-msg');
      const errm=t=>{ m.innerText=t; m.className='text-xs font-bold text-red-500 h-4'; };
      const datos={};
      if(pideSoporte){
        datos.respuesta = el('rp-respuesta').value.trim();
        const f = el('rp-archivo').files[0];
        if(!datos.respuesta && !f) return errm('Describe la corrección y/o adjunta el soporte corregido.');
        if(f && f.size > MAX_MB_TIRILLA*1024*1024) return errm('El archivo supera '+MAX_MB_TIRILLA+' MB.');
        datos._file=f||null;
      }
      if(pideExpl){
        datos.explicacion = el('rp-explicacion').value.trim();
        let tip = el('rp-tipologia').value;
        if(tip==='Otra' && el('rp-tipologia-otra').value.trim()) tip = 'Otra: '+el('rp-tipologia-otra').value.trim();
        datos.tipologia = tip; datos.estadoDiferencia = el('rp-estado').value;
        if(!datos.explicacion) return errm('Escribe la explicación de la diferencia.');
        if(!datos.tipologia) return errm('Selecciona la tipología.');
        if(!datos.estadoDiferencia) return errm('Indica el estado de la diferencia.');
      }
      el('btn-rp').disabled=true; m.innerText='Enviando...'; m.className='text-xs font-bold text-slate-500 h-4';
      const enviar=()=>{
        google.script.run.withSuccessHandler(res=>{
          el('btn-rp').disabled=false;
          m.innerText=res.message; m.className='text-xs font-bold '+(res.success?'text-multival-green':'text-red-500')+' h-4';
          if(res.success){ trasEscritura(); setTimeout(()=>{ cerrarModal(); irA('historial'); },1100); }
        }).withFailureHandler(e=>{ el('btn-rp').disabled=false; errm('Error: '+e.message); })
        .responderNovedad(id, datos, currentUser.idUsuario, currentUser.rol);
      };
      if(datos._file){
        const f=datos._file; delete datos._file;
        const rd=new FileReader();
        rd.onload=e=>{ datos.archivo={ fileName:f.name, mimeType:f.type||'application/pdf', base64:e.target.result.split(',')[1] }; enviar(); };
        rd.onerror=()=>{ el('btn-rp').disabled=false; errm('No fue posible leer el archivo.'); };
        rd.readAsDataURL(f);
      } else { delete datos._file; enviar(); }
    }

    /** Detalle de gestión (solo lectura). */
    function abrirDetalle(id){ conArqueo(id, r=>abrirDetalleR(r)); }
    function abrirDetalleR(r){
      const id=r.id;
      abrirModal(`
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-multival-navy/5 flex items-center justify-center text-multival-navy"><i class="fa-solid fa-eye"></i></div>
          <div><h3 class="font-black text-multival-navy">Detalle del arqueo</h3><p class="text-xs text-slate-500">${esc(r.id)}</p></div>
          <div style="margin-left:auto">${badgesGestion(r)}</div>
        </div>
        ${resumenArqueoHtml(r)}
        ${historialGestionHtml(r)}
        <div class="flex justify-end mt-4"><button onclick="cerrarModal()" class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-multival-navy">Cerrar</button></div>`,'max-w-xl');
      cargarBitacora(id);
    }

    // ===================== NORMALIZACIONES =====================
    function modalNormalizar(idArqueo){
      abrirModal(`
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-multival-navy/5 flex items-center justify-center text-multival-navy"><i class="fa-solid fa-rotate-left"></i></div>
          <div><h3 class="font-black text-multival-navy">Solicitar Normalización</h3>
          <p class="text-xs text-slate-500">Arqueo ${idArqueo} · Tu Regional revisará la solicitud.</p></div></div>
        <p class="text-xs font-bold text-slate-500 mb-2">Justificación del reporte extemporáneo <span class="text-red-500">*</span></p>
        <textarea id="norm-just" rows="4" placeholder="Ej: El arqueo se realizó el lunes en sitio, pero la oficina no tenía conexión a internet. Se reporta al recuperar señal..." class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-multival-navy outline-none focus:ring-2 focus:ring-multival-green/20"></textarea>
        <p id="norm-msg" class="text-xs font-bold h-4 mt-2"></p>
        <div class="flex justify-end gap-2 mt-3">
          <button onclick="cerrarModal()" class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-multival-navy">Cancelar</button>
          <button onclick="enviarNormalizacion('${idArqueo}')" id="btn-norm" class="bg-multival-navy hover:bg-multival-navyHover text-white font-bold py-2 px-6 rounded-xl text-sm">Enviar solicitud</button>
        </div>`);
    }

    function enviarNormalizacion(idArqueo){
      const j=el('norm-just').value, m=el('norm-msg');
      if(!j.trim()){ m.innerText='La justificación es obligatoria.'; m.className='text-xs font-bold text-red-500 h-4 mt-2'; return; }
      el('btn-norm').disabled=true; m.innerText='Enviando...'; m.className='text-xs font-bold text-slate-500 h-4 mt-2';
      google.script.run.withSuccessHandler(res=>{
        el('btn-norm').disabled=false;
        m.innerText=res.message; m.className='text-xs font-bold '+(res.success?'text-multival-green':'text-red-500')+' h-4 mt-2';
        if(res.success){ trasEscritura(); setTimeout(()=>{ cerrarModal(); irA('historial'); },1200); }
      }).withFailureHandler(e=>{ el('btn-norm').disabled=false; m.innerText='Error: '+e.message; m.className='text-xs font-bold text-red-500 h-4 mt-2'; })
      .solicitarNormalizacion(idArqueo, currentUser.idUsuario, j);
    }

    function renderNormalizaciones(c){
      c.innerHTML=spinner;
      google.script.run.withSuccessHandler(data=>{
        const rol=currentUser.rol;
        const titulo = rol==='Lider'?'Mis Solicitudes de Normalización':(rol==='Regional'?'Aprobaciones de Normalización':'Log de Normalizaciones');
        const pendientes=data.filter(x=>x.estado==='PENDIENTE').length;
        c.innerHTML=`
        <div class="mb-6"><h2 class="text-2xl font-black text-multival-navy">${titulo}</h2>
        <p class="text-sm text-slate-500">${rol==='Lider'?'Extemporáneos que solicitaste contar a tu meta.':(rol==='Regional'?'Solicitudes de tus líderes. Al aprobar, el arqueo cuenta a la meta.':'Registro de auditoría completo de solicitudes y decisiones.')} ${pendientes?`<b class="text-multival-gold">${pendientes} pendiente(s)</b>`:''}</p></div>
        <div class="space-y-4">
        ${data.length? data.map(nz=>tarjetaNorm(nz,rol)).join('')
        : `<div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-10 text-center text-slate-400 font-bold"><i class="fa-solid fa-inbox text-2xl mb-2 block"></i>No hay solicitudes de normalización.</div>`}
        </div>`;
      }).withFailureHandler(fail(c)).listarNormalizaciones(currentUser.idUsuario, currentUser.rol);
    }

    function tarjetaNorm(nz,rol){
      const est = nz.estado==='PENDIENTE'?semBadge('amarillo','Pendiente'):(nz.estado==='APROBADA'?semBadge('verde','Aprobada'):semBadge('rojo','Rechazada'));
      const puedeDecidir = rol==='Regional' && nz.estado==='PENDIENTE';
      return `<div class="bg-white rounded-[1.5rem] shadow-soft border border-slate-100 p-5">
        <div class="flex items-start justify-between flex-wrap gap-3 mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-multival-navy/5 flex items-center justify-center text-multival-navy font-black">${String(nz.lider).charAt(0)}</div>
            <div><p class="font-black text-multival-navy text-sm">${nz.lider} · ${nz.oficina}</p>
            <p class="text-[11px] font-bold text-slate-400">${nz.formato} · Arqueo del ${nz.fechaReal} · ${nz.diasHabiles} días hábiles · Solicitado ${nz.fechaSolicitud}
            ${nz.urlPdf?` · <a href="${nz.urlPdf}" target="_blank" class="text-multival-green hover:underline"><i class="fa-solid fa-file-pdf"></i> Ver soporte</a>`:''}</p></div>
          </div>${est}</div>
        <div class="bg-slate-50 rounded-xl p-3 mb-3">
          <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Justificación del líder</p>
          <p class="text-xs text-slate-600 font-medium">${nz.justificacion}</p></div>
        ${nz.estado!=='PENDIENTE'?`<div class="text-[11px] font-bold text-slate-400">Decidido por <b class="text-multival-navy">${nz.aprobador}</b> el ${nz.fechaDecision}${nz.comentario?` · "${nz.comentario}"`:''}</div>`:''}
        ${puedeDecidir?`
        <div class="flex flex-col sm:flex-row gap-2 mt-2">
          <input type="text" id="com-${nz.idSolicitud}" placeholder="Comentario (opcional)" class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-multival-navy outline-none">
          <button onclick="decidir('${nz.idSolicitud}','APROBAR')" class="px-4 py-2 rounded-lg text-xs font-black bg-multival-green text-white hover:bg-multival-greenHover"><i class="fa-solid fa-check mr-1"></i>Aprobar</button>
          <button onclick="decidir('${nz.idSolicitud}','RECHAZAR')" class="px-4 py-2 rounded-lg text-xs font-black bg-red-500 text-white hover:bg-red-600"><i class="fa-solid fa-xmark mr-1"></i>Rechazar</button>
        </div>`:''}</div>`;
    }

    function decidir(idSol,decision){
      const com=el('com-'+idSol)?el('com-'+idSol).value:'';
      google.script.run.withSuccessHandler(res=>{
        if(res.success){ trasEscritura(); irA('normalizaciones'); }
        else alert(res.message);
      }).withFailureHandler(e=>alert('Error: '+e.message))
      .decidirNormalizacion(idSol, decision, com, currentUser.idUsuario, currentUser.rol);
    }

    // ===================== DASHBOARD POR CLIENTE / OFICINA =====================
    var CLI = { data:null, cliente:'', filtro:'todas' };
    function renderClientes(c){
      c.innerHTML=spinner;
      llamar('cli|'+mesActual+'|'+CLI.cliente, 'obtenerDashboardClientes', [currentUser.idUsuario, currentUser.rol, mesActual, CLI.cliente], d=>{
        if(!d||!d.success){ c.innerHTML=errorBox((d&&d.message)||'No fue posible calcular el estado de las oficinas.'); return; }
        CLI.data=d; CLI.filtro='todas';
        pintarClientes(c);
        poblarMeses();
      }, fail(c));
    }
    function cambiarCliente(v){ CLI.cliente=v; renderClientes(el('content')); }
    function filtrarOficinas(f){ CLI.filtro=f; pintarClientes(el('content')); }

    function estadoChip(est, extra){
      const map={ 'OK':'badge-ok', 'PENDIENTE':'badge-pend', 'EXTEMPORANEO':'badge-warn', 'PARCIAL':'badge-warn', 'N/A':'badge-gray' };
      const ic ={ 'OK':'fa-circle-check', 'PENDIENTE':'fa-circle-xmark', 'EXTEMPORANEO':'fa-clock', 'PARCIAL':'fa-circle-half-stroke', 'N/A':'fa-minus' };
      return `<span class="badge ${map[est]||'badge-gray'}"><i class="fa-solid ${ic[est]||'fa-minus'}"></i>${est==='N/A'?'No aplica':est}${extra?' · '+extra:''}</span>`;
    }
    function estadoGeneralChip(g){
      const map={ 'AL DIA':'badge-ok', 'CUMPLE CON EXTEMPORANEO':'badge-warn', 'PARCIAL':'badge-warn', 'SIN ARQUEO':'badge-pend' };
      return `<span class="badge ${map[g]||'badge-gray'}">${g}</span>`;
    }

    function pintarClientes(c){
      const d=CLI.data, t=d.totales, esLider=currentUser.rol==='Lider';
      let lista=d.oficinas.slice();
      const f=CLI.filtro;
      if(f==='conArqueo') lista=lista.filter(o=>o.conArqueo);
      else if(f==='pendientes') lista=lista.filter(o=>!o.cumple);
      else if(f==='atm') lista=lista.filter(o=>o.exige.atm);
      else if(f==='cheques') lista=lista.filter(o=>o.exige.cheques);
      else if(f==='alDia') lista=lista.filter(o=>o.aTiempo);
      else if(f==='gestion') lista=lista.filter(o=>o.pendientesGestion>0);
      const tab=(id,txt,n)=>`<button class="${f===id?'on':''}" onclick="filtrarOficinas('${id}')">${txt}${n!==undefined?` <span class="${f===id?'text-multival-gold':'text-slate-400'}">${n}</span>`:''}</button>`;

      c.innerHTML=`
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div><h2 class="text-2xl font-black text-multival-navy">${esLider?'Mis Oficinas':'Cumplimiento por Cliente y Oficina'} — ${mesNombre(d.mes)}</h2>
        <p class="text-sm text-slate-500">Oficinas con arqueo ejecutado o pendiente, servicios ATM y cheques Porvenir, y cumplimiento a tiempo (ATM válido una vez al mes).</p></div>
        <div class="flex items-center gap-2 flex-wrap">
          <select class="sel-mini" onchange="cambiarCliente(this.value)">
            <option value="">Todos los clientes</option>
            ${d.clientes.map(x=>`<option value="${esc(x.cliente)}" ${norm(x.cliente)===norm(d.cliente)?'selected':''}>${esc(x.cliente)} (${x.oficinas})</option>`).join('')}
          </select>
          ${selectorMes("mesActual=el(&quot;sel-mes&quot;).value;irA(&quot;clientes&quot;)")}
        </div>
      </div>

      ${!esLider?`<div class="flex gap-2 overflow-x-auto pb-2 mb-6">
        ${d.clientes.map(x=>`<button onclick="cambiarCliente('${esc(x.cliente)}')" class="shrink-0 text-left bg-white border ${norm(x.cliente)===norm(d.cliente)?'border-multival-navy':'border-slate-200'} rounded-2xl p-3 shadow-sm hover:shadow-soft" style="min-width:12rem">
          <p class="text-[10px] font-black text-slate-400 uppercase truncate">${esc(x.cliente)}</p>
          <p class="text-xl font-black ${x.pct>=90?'text-multival-green':(x.pct>=60?'text-yellow-600':'text-red-600')}">${x.pct}% <span class="text-xs text-slate-400 font-bold">${x.cumplen}/${x.oficinas}</span></p>
          <p class="text-[10px] font-bold text-slate-400">${x.pendientes} pend. · ${x.conATM} ATM · ${x.conCheques} cheques</p>
        </button>`).join('')}
      </div>`:''}

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        ${kpiCard('Oficinas'+(d.cliente?' · '+esc(d.cliente):''),t.oficinas,t.propias+' propias','#25294F','fa-building-columns')}
        ${kpiCard('Con arqueo ejecutado',t.conArqueo,t.cumplen+' completas · '+t.parciales+' parciales','#3D8A44','fa-circle-check')}
        ${kpiCard('Pendientes de arqueo',t.sinArqueo,'Sin ningún formato en el mes','#ef4444','fa-circle-xmark')}
        ${kpiCard('Al día (a tiempo)',t.pctAlDia+'%',t.alDia+' de '+t.oficinas+' · '+t.extemporaneas+' con extemporáneos','#3D8A44','fa-stopwatch')}
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        ${kpiCard('Oficinas con ATM',t.conATM,t.atmTotal+' cajeros parametrizados','#F6CF46','fa-building-columns')}
        ${kpiCard('ATM con arqueo del mes',t.atmHechos+'/'+t.atmTotal,t.pctATM+'% · válido 1 vez al mes','#F6CF46','fa-money-bill-transfer')}
        ${kpiCard('Oficinas con cheques Porvenir',t.conCheques,t.chequesOK+' con arqueo de cheques','#25294F','fa-money-check')}
        ${kpiCard('Cheques pendientes',t.chequesPend,t.pctCheques+'% cumplimiento','#ef4444','fa-money-check')}
      </div>

      <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider"><i class="fa-solid fa-list-check text-multival-green mr-1"></i> Detalle por oficina</h3>
          <div class="tabs-mini">
            ${tab('todas','Todas',d.oficinas.length)}${tab('conArqueo','Con arqueo',t.conArqueo)}${tab('pendientes','Con pendientes',d.oficinas.length-t.cumplen)}${tab('alDia','Al día',t.alDia)}${tab('atm','Con ATM',t.conATM)}${tab('cheques','Cheques Porvenir',t.conCheques)}${tab('gestion','Novedades abiertas',d.oficinas.filter(o=>o.pendientesGestion>0).length)}
          </div>
        </div>
        <div class="overflow-x-auto"><table><thead><tr>
          <th>Oficina</th><th>Cliente</th><th>Regional / Zona</th>${esLider?'':'<th>Líder</th>'}<th>Servicios</th><th>Arqueo oficina</th><th>Cheques Porvenir</th><th>ATM</th><th>Visitas</th><th>Oportunidad</th><th>Estado</th><th>Pendiente</th>
        </tr></thead><tbody>
        ${lista.length? lista.map(o=>`<tr>
          <td class="font-bold text-multival-navy">${esc(o.oficina)}${o.pendientesGestion?` <span class="nav-badge" title="Novedades pendientes de respuesta">${o.pendientesGestion}</span>`:''}</td>
          <td class="text-xs">${esc(o.cliente)}${o.propia?' <span class="badge badge-navy">Propia</span>':''}</td>
          <td class="text-xs">${esc(o.regional)}<br><span class="text-slate-400">${esc(o.zona)}</span></td>
          ${esLider?'':`<td class="text-xs">${esc(o.lider)}</td>`}
          <td><div class="flex flex-wrap gap-1">${o.exige.oficina?'<span class="badge badge-gray">Efectivo</span>':''}${o.exige.cheques?'<span class="badge badge-info"><i class="fa-solid fa-money-check"></i>Cheques Porvenir</span>':''}${o.exige.atm?`<span class="badge badge-warn"><i class="fa-solid fa-building-columns"></i>ATM ×${o.atmTotal}</span>`:''}${o.usd?'<span class="badge badge-purple">USD</span>':''}</div></td>
          <td>${estadoChip(o.estadoOficina, o.fechaOficina)}</td>
          <td>${estadoChip(o.estadoCheques, o.fechaCheques)}</td>
          <td>${o.exige.atm?estadoChip(o.estadoATM, o.atmHechos+'/'+o.atmTotal):estadoChip('N/A')}</td>
          <td class="text-center font-black text-multival-navy">${o.visitas}${o.arqueosValidos?`<br><span class="text-[9px] text-slate-400 font-bold">${o.arqueosValidos} válidos</span>`:''}</td>
          <td>${o.extemporaneos?`<span class="badge badge-warn"><i class="fa-solid fa-clock"></i>${o.extemporaneos} extemp.</span>`:(o.conArqueo?'<span class="badge badge-ok"><i class="fa-solid fa-stopwatch"></i>A tiempo</span>':'<span class="text-xs text-slate-300">—</span>')}</td>
          <td>${estadoGeneralChip(o.estadoGeneral)}${(o.faltantes||o.sobrantes)?`<br><span class="text-[9px] font-black ${o.faltantes?'text-red-600':'text-yellow-600'}">${o.faltantes?o.faltantes+' faltante(s)':''}${o.faltantes&&o.sobrantes?' · ':''}${o.sobrantes?o.sobrantes+' sobrante(s)':''}</span>`:''}</td>
          <td class="text-xs font-bold ${o.pendientes.length?'text-red-600':'text-multival-green'}">${o.pendientes.length?o.pendientes.join(' + '):'Ninguno'}</td>
        </tr>`).join('') : '<tr><td colspan="12" class="text-center py-8 text-slate-400 font-bold">No hay oficinas para este filtro.</td></tr>'}
        </tbody></table></div>
        <p class="text-[10px] text-slate-400 mt-3">* Oficina = arqueo de efectivo FOR-GOR-020-09 · Cheques Porvenir = FOR-GOR-048-01 (oficinas con medio de pago EFECTIVO Y CHEQUE) · ATM = FOR-GOR-099-02, cada cajero cuenta una vez al mes. "Al día" = todos los formatos exigidos registrados y sin extemporáneos.</p>
      </div>`;
    }
    function norm(v){ return String(v===null||v===undefined?'':v).trim().toUpperCase(); }

    // ===================== RESUMEN POR REGIONAL Y ZONA =====================
    function renderRegional(c){
      c.innerHTML=spinner;
      llamar('reg|'+mesActual, 'obtenerResumenRegional', [currentUser.idUsuario, currentUser.rol, mesActual], d=>{
        if(!d||!d.success){ c.innerHTML=errorBox((d&&d.message)||'No fue posible calcular el resumen regional.'); return; }
        pintarRegional(c,d);
        poblarMeses();
      }, fail(c));
    }

    function heat(p){ const col=p>=90?'#dcfce7;color:#166534':(p>=60?'#fef9c3;color:#854d0e':'#fee2e2;color:#991b1b'); return `<span class="heat" style="background:${col}">${p}%</span>`; }

    function pintarRegional(c,d){
      const T=d.total;
      const filaZona=g=>`<tr>
        <td class="font-bold text-multival-navy">${esc(g.regional)}</td><td class="text-xs">${esc(g.zona)}</td>
        <td class="text-center">${g.oficinas}</td><td class="text-center">${g.propias}</td>
        <td class="text-center font-black text-multival-navy">${g.arqueosEjecutados}<br><span class="text-[9px] text-slate-400 font-bold">${g.numLideres} líder(es) · meta ${g.metaMinima}</span></td>
        <td class="text-center">${heat(g.pctMeta)}</td>
        <td class="text-center font-black">${g.arqueosPropias}</td>
        <td class="text-center font-black ${g.oficinasPendientes?'text-red-600':'text-multival-green'}">${g.oficinasPendientes}</td>
        <td class="text-center font-black text-multival-navy">${g.promedioVisitas}</td>
        <td class="text-center">${heat(g.pctOficinas)}</td>
        <td class="text-center">${g.chequesTotal?heat(g.pctCheques):'<span class="text-xs text-slate-300">—</span>'}</td>
        <td class="text-center">${g.atmTotal?heat(g.pctATM):'<span class="text-xs text-slate-300">—</span>'}</td>
        <td class="text-center">${heat(g.pctAlDia)}</td>
      </tr>`;
      const filaTotal=(g,label)=>`<tr class="celda-ro">
        <td class="font-black text-multival-navy" colspan="2">${label}</td>
        <td class="text-center font-black">${g.oficinas}</td><td class="text-center font-black">${g.propias}</td>
        <td class="text-center font-black">${g.arqueosEjecutados}<br><span class="text-[9px] text-slate-400 font-bold">${g.numLideres} líder(es) · meta ${g.metaMinima}</span></td>
        <td class="text-center">${heat(g.pctMeta)}</td><td class="text-center font-black">${g.arqueosPropias}</td>
        <td class="text-center font-black">${g.oficinasPendientes}</td><td class="text-center font-black">${g.promedioVisitas}</td>
        <td class="text-center">${heat(g.pctOficinas)}</td><td class="text-center">${g.chequesTotal?heat(g.pctCheques):'—'}</td>
        <td class="text-center">${g.atmTotal?heat(g.pctATM):'—'}</td><td class="text-center">${heat(g.pctAlDia)}</td></tr>`;
      const cab=`<thead><tr><th>Regional</th><th>Zona</th><th class="text-center">Oficinas</th><th class="text-center">Propias</th><th class="text-center">Arqueos ejecutados</th><th class="text-center">% meta (30/líder)</th><th class="text-center">Arqueos of. propias</th><th class="text-center">Ofi. pendientes</th><th class="text-center">Prom. visitas</th><th class="text-center">% Oficinas</th><th class="text-center">% Cheques</th><th class="text-center">% ATM</th><th class="text-center">% Al día</th></tr></thead>`;

      c.innerHTML=`
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div><h2 class="text-2xl font-black text-multival-navy">Resumen por Regional y Zona — ${mesNombre(d.mes)}</h2>
        <p class="text-sm text-slate-500">Reporte de arqueos parciales: ejecutados a la fecha (mínimo ${d.meta} por líder al mes), oficinas propias, pendientes, promedio de visitas y red de cajeros ATM.</p></div>
        ${selectorMes("mesActual=el(&quot;sel-mes&quot;).value;irA(&quot;regional&quot;)")}
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        ${kpiCard('Arqueos ejecutados',T.arqueosEjecutados||0,'Meta mínima '+(T.metaMinima||0)+' ('+(T.pctMeta||0)+'%)','#3D8A44','fa-circle-check')}
        ${kpiCard('Oficinas con arqueo',(T.oficinasConArqueo||0)+'/'+(T.oficinas||0),(T.oficinasPendientes||0)+' pendientes · '+(T.pctOficinas||0)+'%','#25294F','fa-building-columns')}
        ${kpiCard('Promedio de visitas',T.promedioVisitas||0,'por oficina en el mes','#F6CF46','fa-route')}
        ${kpiCard('ATM con arqueo',(T.atmConArqueo||0)+'/'+(T.atmTotal||0),(T.atmSinArqueo||0)+' sin arqueo · '+(T.pctATM||0)+'%','#F6CF46','fa-money-bill-transfer')}
      </div>

      <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6 mb-6">
        <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-4"><i class="fa-solid fa-table-list text-multival-green mr-1"></i> Tabla resumen por regional y zona · oficinas</h3>
        <div class="overflow-x-auto"><table>${cab}<tbody>
          ${d.zonas.map(filaZona).join('')}
          ${filaTotal(T,'TOTAL RED')}
        </tbody></table></div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-1"><i class="fa-solid fa-chart-column text-multival-green mr-1"></i> Arqueos parciales por regional</h3>
          <p class="text-xs text-slate-500 mb-4">Barras apiladas: oficinas con arqueo vs. pendientes a la fecha.</p>
          <canvas id="chart-reg-ofi" height="150"></canvas></div>
        <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-1"><i class="fa-solid fa-building-columns text-multival-green mr-1"></i> Red de cajeros ATM por regional</h3>
          <p class="text-xs text-slate-500 mb-4">Barras apiladas: cajeros con arqueo (cuenta 1 vez/mes) vs. sin arqueo.</p>
          <canvas id="chart-reg-atm" height="150"></canvas></div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-4"><i class="fa-solid fa-table-cells text-multival-green mr-1"></i> Matriz de cumplimiento · oficinas</h3>
          <div class="overflow-x-auto"><table class="tbl-datos"><thead><tr><th>Regional</th><th>Zonas</th><th>Oficinas</th><th>Con arqueo</th><th>% Oficinas</th><th>% Cheques</th><th>% Al día</th><th>Ejecutados / meta</th><th>% Meta</th></tr></thead><tbody>
            ${d.regionales.map(R=>`<tr><td class="font-black">${esc(R.regional)}</td><td class="num">${R.zonas}</td><td class="num">${R.oficinas}</td><td class="num">${R.oficinasConArqueo}</td><td>${heat(R.pctOficinas)}</td><td>${R.chequesTotal?heat(R.pctCheques):'—'}</td><td>${heat(R.pctAlDia)}</td><td class="num">${R.arqueosEjecutados} / ${R.metaMinima}</td><td>${heat(R.pctMeta)}</td></tr>`).join('')}
            <tr><td>TOTAL</td><td class="num">${d.zonas.length}</td><td class="num">${T.oficinas||0}</td><td class="num">${T.oficinasConArqueo||0}</td><td>${heat(T.pctOficinas||0)}</td><td>${T.chequesTotal?heat(T.pctCheques):'—'}</td><td>${heat(T.pctAlDia||0)}</td><td class="num">${T.arqueosEjecutados||0} / ${T.metaMinima||0}</td><td>${heat(T.pctMeta||0)}</td></tr>
          </tbody></table></div>
        </div>
        <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-4"><i class="fa-solid fa-table-cells text-multival-green mr-1"></i> Matriz de cumplimiento · cajeros ATM</h3>
          <div class="overflow-x-auto"><table class="tbl-datos"><thead><tr><th>Regional</th><th>Cajeros</th><th>Con arqueo</th><th>Sin arqueo</th><th>% ATM</th></tr></thead><tbody>
            ${d.regionales.map(R=>`<tr><td class="font-black">${esc(R.regional)}</td><td class="num">${R.atmTotal}</td><td class="num">${R.atmConArqueo}</td><td class="num">${R.atmSinArqueo}</td><td>${R.atmTotal?heat(R.pctATM):'—'}</td></tr>`).join('')}
            <tr><td>TOTAL</td><td class="num">${T.atmTotal||0}</td><td class="num">${T.atmConArqueo||0}</td><td class="num">${T.atmSinArqueo||0}</td><td>${T.atmTotal?heat(T.pctATM):'—'}</td></tr>
          </tbody></table></div>
          <div class="overflow-x-auto mt-4"><p class="lbl-sec mb-1">Detalle ATM por zona</p><table class="tbl-datos"><thead><tr><th>Regional</th><th>Zona</th><th>Cajeros</th><th>Con arqueo</th><th>Sin arqueo</th><th>% ATM</th></tr></thead><tbody>
            ${d.zonas.filter(g=>g.atmTotal).map(g=>`<tr><td>${esc(g.regional)}</td><td>${esc(g.zona)}</td><td class="num">${g.atmTotal}</td><td class="num">${g.atmConArqueo}</td><td class="num">${g.atmSinArqueo}</td><td>${heat(g.pctATM)}</td></tr>`).join('')||'<tr><td colspan="6">Sin cajeros parametrizados.</td></tr>'}
            <tr><td colspan="2">TOTAL</td><td class="num">${T.atmTotal||0}</td><td class="num">${T.atmConArqueo||0}</td><td class="num">${T.atmSinArqueo||0}</td><td>${T.atmTotal?heat(T.pctATM):'—'}</td></tr>
          </tbody></table></div>
        </div>
      </div>`;

      const labels=d.regionales.map(R=>R.regional);
      const optsStack={responsive:true,plugins:{legend:{labels:{font:{size:11,weight:'bold'},usePointStyle:true}}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{precision:0}}}};
      destruir('regOfi');
      charts.regOfi=new Chart(el('chart-reg-ofi'),{type:'bar',data:{labels,datasets:[
        {label:'Oficinas con arqueo',data:d.regionales.map(R=>R.oficinasConArqueo),backgroundColor:'#3D8A44',borderRadius:4},
        {label:'Pendientes',data:d.regionales.map(R=>R.oficinasPendientes),backgroundColor:'#ef4444',borderRadius:4}]},options:optsStack});
      destruir('regAtm');
      charts.regAtm=new Chart(el('chart-reg-atm'),{type:'bar',data:{labels,datasets:[
        {label:'ATM con arqueo',data:d.regionales.map(R=>R.atmConArqueo),backgroundColor:'#F6CF46',borderRadius:4},
        {label:'ATM sin arqueo',data:d.regionales.map(R=>R.atmSinArqueo),backgroundColor:'#25294F',borderRadius:4}]},options:optsStack});
    }

    // ===================== ANALITICA (10 graficos con interpretacion y tablas) =====================
    var PALETA=['#3D8A44','#dc2626','#F6CF46','#25294F','#7c3aed','#0ea5e9','#f97316','#14b8a6','#64748b','#a3e635','#e11d48','#facc15'];
    function renderAnalitica(c){
      c.innerHTML=spinner;
      llamar('ana|'+mesActual, 'obtenerAnalitica', [currentUser.idUsuario, currentUser.rol, mesActual], d=>{
        if(!d||!d.success){ c.innerHTML=errorBox((d&&d.message)||'No fue posible calcular la analítica.'); return; }
        pintarAnalitica(c,d);
        poblarMeses();
      }, fail(c));
    }

    function tablaDatos(t){
      if(!t||!t.filas||!t.filas.length) return '<p class="text-xs text-slate-400 font-bold">Sin datos para el periodo.</p>';
      return `<div class="overflow-x-auto scroll-y"><table class="tbl-datos"><thead><tr>${t.columnas.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
        ${t.filas.map(f=>`<tr>${f.map((v,i)=>`<td class="${i>0&&(typeof v==='number'||/^[\$\d]/.test(String(v)))?'num':''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    function cardGrafico(k,g,i){
      return `<div class="card-graf">
        <div class="flex items-start justify-between gap-3 mb-3">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider"><span class="badge badge-navy mr-2">${i}</span>${esc(g.titulo)}</h3>
          <span class="badge badge-gray"><i class="fa-solid ${g.tipo==='pie'?'fa-chart-pie':'fa-chart-column'}"></i>${g.tipo==='pie'?'Circular':'Barras agrupadas'}</span>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div><div style="position:relative;height:260px"><canvas id="an-${k}"></canvas></div></div>
          <div>
            <p class="lbl-sec mb-1">Interpretación</p>
            <div class="interp mb-3">${esc(g.interpretacion)}</div>
            <p class="lbl-sec mb-1">Tabla de datos</p>
            ${tablaDatos(g.tabla)}
            ${g.detalle&&g.detalle.filas&&g.detalle.filas.length?`<details class="mt-2"><summary class="text-[11px] font-black text-multival-green cursor-pointer">Ver detalle (${g.detalle.filas.length})</summary><div class="mt-2">${tablaDatos(g.detalle)}</div></details>`:''}
          </div>
        </div>
      </div>`;
    }

    function pintarAnalitica(c,d){
      const orden=['oficinasNovedad','faltantesRegional','sobrantesRegional','sobrantesMayores','faltantesMenores','recuperadoMayores','recuperadoMenores','faltantesLider','atmArqueo','cumplimientoRegional'];
      c.innerHTML=`
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div><h2 class="text-2xl font-black text-multival-navy">Analítica de Arqueos — ${mesNombre(d.mes)}</h2>
        <p class="text-sm text-slate-500">${d.totales.oficinas} oficinas visibles · ${d.totales.arqueos} arqueos en el mes. Cada gráfico incluye su interpretación y su tabla de datos.</p></div>
        ${selectorMes("mesActual=el(&quot;sel-mes&quot;).value;irA(&quot;analitica&quot;)")}
      </div>
      <div class="space-y-6">${orden.map((k,i)=>d.graficos[k]?cardGrafico(k,d.graficos[k],i+1):'').join('')}</div>`;

      orden.forEach(k=>{
        const g=d.graficos[k]; if(!g) return;
        const ctx=el('an-'+k); if(!ctx) return;
        destruir('an-'+k);
        if(!g.labels.length || !g.series.some(s=>s.data.some(v=>v>0))){
          ctx.parentNode.innerHTML='<div class="flex items-center justify-center h-full text-xs font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">Sin datos para graficar en este mes</div>';
          return;
        }
        if(g.tipo==='pie'){
          charts['an-'+k]=new Chart(ctx,{type:'pie',data:{labels:g.labels,datasets:[{data:g.series[0].data,backgroundColor:g.labels.map((_,i)=>PALETA[i%PALETA.length]),borderWidth:2,borderColor:'#fff'}]},
            options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11,weight:'bold'},usePointStyle:true,padding:10}},
              tooltip:{callbacks:{label:x=>{ const tot=x.dataset.data.reduce((s,v)=>s+v,0); return x.label+': '+x.parsed+' ('+(tot?Math.round(x.parsed/tot*100):0)+'%)'; }}}}}});
        } else {
          const dual=g.series.some(s=>s.eje==='y1');
          const datasets=g.series.map((s,i)=>({label:s.name,data:s.data,backgroundColor:PALETA[(k==='recuperadoMayores'||k==='recuperadoMenores')?[0,1,8][i]:(i+ (k==='cumplimientoRegional'?3:0))%PALETA.length],borderRadius:6,yAxisID:s.eje||'y'}));
          const scales={x:{grid:{display:false},ticks:{font:{size:10,weight:'bold'}}},y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{precision:0},title:{display:dual,text:'Casos'}}};
          if(dual) scales.y1={beginAtZero:true,position:'right',grid:{drawOnChartArea:false},title:{display:true,text:'Millones $'}};
          if(k==='cumplimientoRegional') scales.y.max=100;
          charts['an-'+k]=new Chart(ctx,{type:'bar',data:{labels:g.labels,datasets},
            options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{size:11,weight:'bold'},usePointStyle:true}}},scales}});
        }
      });
    }

    // ===================== TENDENCIAS =====================
    var tendData=null, tendMesSel='TODOS';
    function renderTendencias(c, anio){
      c.innerHTML=spinner;
      llamar('tend|'+(anio||''), 'obtenerTendencias', [currentUser.idUsuario, currentUser.rol, anio||null], d=>{
        if(d && d.error){ c.innerHTML=errorBox(d.error); return; }
        tendData=d; tendMesSel='TODOS';
        pintarTendencias(c);
      }, fail(c));
    }

    function pintarTendencias(c){
      const d=tendData;
      const nomMes=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const totF=d.meses.reduce((s,m)=>s+m.faltCasos,0), totS=d.meses.reduce((s,m)=>s+m.sobCasos,0);
      const totFM=d.meses.reduce((s,m)=>s+m.faltMonto,0), totSM=d.meses.reduce((s,m)=>s+m.sobMonto,0);
      c.innerHTML=`
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div><h2 class="text-2xl font-black text-multival-navy">Tendencias de Diferencias Operativas — ${d.anio}</h2>
        <p class="text-sm text-slate-500">Evolución anual de faltantes y sobrantes e índice de incidencia por oficina.</p></div>
        <div class="flex items-center gap-2">
          <select id="sel-anio" onchange="renderTendencias(el('content'), this.value)" class="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-black text-multival-navy outline-none cursor-pointer">
            ${d.anios.map(a=>`<option value="${a}" ${a===d.anio?'selected':''}>${a}</option>`).join('')}</select>
          <select id="sel-mes-tend" onchange="tendMesSel=this.value;pintarHistograma()" class="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-black text-multival-navy outline-none cursor-pointer">
            <option value="TODOS">Todo el año</option>
            ${nomMes.map((nm,i)=>`<option value="${i}">${nm} ${d.anio}</option>`).join('')}</select>
        </div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        ${kpiCard('Faltantes '+d.anio, totF, fmt(totFM), '#dc2626','fa-arrow-down')}
        ${kpiCard('Sobrantes '+d.anio, totS, fmt(totSM), '#F6CF46','fa-arrow-up')}
        ${kpiCard('Oficinas con novedades', d.oficinas.length, 'Al menos 1 diferencia', '#25294F','fa-building-circle-exclamation')}
        ${kpiCard('Impacto neto anual', (totSM-totFM>=0?'+':'−')+fmt(Math.abs(totSM-totFM)).slice(1), 'Sobr − Falt', totSM-totFM<0?'#dc2626':'#3D8A44','fa-scale-balanced')}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-4"><i class="fa-solid fa-chart-line text-multival-green mr-1"></i> Casos por mes (faltantes vs sobrantes)</h3>
          <canvas id="chart-t-casos" height="140"></canvas></div>
        <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
          <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-4"><i class="fa-solid fa-sack-dollar text-multival-green mr-1"></i> Monto por mes ($)</h3>
          <canvas id="chart-t-montos" height="140"></canvas></div>
      </div>

      <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6 mb-6">
        <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-1"><i class="fa-solid fa-chart-simple text-multival-green mr-1"></i> Histograma: oficinas con mayor índice de diferencias</h3>
        <p class="text-xs text-slate-500 mb-4" id="hist-sub">Casos de faltante/sobrante por oficina.</p>
        <canvas id="chart-t-hist" height="130"></canvas></div>

      <div class="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-6">
        <h3 class="text-sm font-black text-multival-navy uppercase tracking-wider mb-4"><i class="fa-solid fa-list-ol text-multival-green mr-1"></i> Ranking de oficinas por incidencia (${d.anio})</h3>
        <div class="overflow-x-auto"><table><thead><tr><th>#</th><th>Oficina</th><th>Casos</th><th>Faltantes</th><th>Sobrantes</th><th class="text-right">Monto Falt.</th><th class="text-right">Monto Sobr.</th><th>Índice incidencia</th></tr></thead><tbody>
        ${d.oficinas.length? d.oficinas.map((o,i)=>`<tr>
          <td class="font-black text-slate-400">${i+1}</td>
          <td class="font-bold text-multival-navy">${o.oficina}</td>
          <td class="font-black">${o.casos}</td>
          <td class="text-red-600 font-bold">${o.faltCasos}</td>
          <td class="text-yellow-600 font-bold">${o.sobCasos}</td>
          <td class="text-right font-bold text-red-600">${fmt(o.faltMonto)}</td>
          <td class="text-right font-bold text-yellow-600">${fmt(o.sobMonto)}</td>
          <td><div class="flex items-center gap-2"><div class="w-24 bg-slate-100 rounded-full h-2"><div class="h-full rounded-full ${o.indice>=30?'bg-red-500':(o.indice>=15?'bg-multival-gold':'bg-multival-green')}" style="width:${Math.min(o.indice,100)}%"></div></div><span class="text-xs font-black ${o.indice>=30?'text-red-500':(o.indice>=15?'text-yellow-600':'text-multival-green')}">${o.indice}%</span></div></td></tr>`).join('')
        : '<tr><td colspan="8" class="text-center py-8 text-slate-400 font-bold"><i class="fa-solid fa-circle-check text-multival-green mr-1"></i>Sin diferencias operativas en el año.</td></tr>'}
        </tbody></table></div>
        <p class="text-[10px] text-slate-400 mt-3">* Índice de incidencia = casos con diferencia ÷ arqueos realizados en la oficina.</p></div>`;

      const labels=nomMes;
      destruir('tCasos');
      charts.tCasos=new Chart(el('chart-t-casos'),{type:'line',
        data:{labels,datasets:[
          {label:'Faltantes',data:d.meses.map(m=>m.faltCasos),borderColor:'#dc2626',backgroundColor:'rgba(220,38,38,.08)',fill:true,tension:.3,borderWidth:3,pointRadius:3},
          {label:'Sobrantes',data:d.meses.map(m=>m.sobCasos),borderColor:'#F6CF46',backgroundColor:'rgba(246,207,70,.12)',fill:true,tension:.3,borderWidth:3,pointRadius:3}]},
        options:{responsive:true,plugins:{legend:{labels:{font:{size:11,weight:'bold'},usePointStyle:true}}},scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{precision:0}},x:{grid:{display:false}}}}});
      destruir('tMontos');
      charts.tMontos=new Chart(el('chart-t-montos'),{type:'bar',
        data:{labels,datasets:[
          {label:'Monto faltante',data:d.meses.map(m=>m.faltMonto),backgroundColor:'#dc2626',borderRadius:6},
          {label:'Monto sobrante',data:d.meses.map(m=>m.sobMonto),backgroundColor:'#F6CF46',borderRadius:6}]},
        options:{responsive:true,plugins:{legend:{labels:{font:{size:11,weight:'bold'},usePointStyle:true}},
          tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+fmt(ctx.parsed.y)}}},
          scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{callback:v=>'$'+(v>=1e6?(v/1e6)+'M':v.toLocaleString('es-CO'))}},x:{grid:{display:false}}}}});
      pintarHistograma();
    }

    function pintarHistograma(){
      const d=tendData; if(!d) return;
      const nomMes=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      let datos;
      if(tendMesSel==='TODOS'){
        datos=d.oficinas.map(o=>({oficina:o.oficina,casos:o.casos}));
        el('hist-sub').innerText='Casos de faltante/sobrante por oficina · Todo el año '+d.anio+'.';
      } else {
        const idx=parseInt(tendMesSel,10);
        datos=d.oficinas.map(o=>({oficina:o.oficina,casos:o.porMes[idx]})).filter(x=>x.casos>0).sort((a,b)=>b.casos-a.casos);
        el('hist-sub').innerText='Casos de faltante/sobrante por oficina · '+nomMes[idx]+' '+d.anio+'.';
      }
      datos=datos.slice(0,15);
      destruir('tHist');
      charts.tHist=new Chart(el('chart-t-hist'),{type:'bar',
        data:{labels:datos.map(x=>x.oficina),datasets:[{label:'Casos con diferencia',data:datos.map(x=>x.casos),
          backgroundColor:datos.map((x,i)=>i<3?'#dc2626':(i<7?'#F6CF46':'#3D8A44')),borderRadius:8,barThickness:26}]},
        options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false}},
          scales:{x:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{precision:0}},y:{grid:{display:false},ticks:{font:{size:11,weight:'bold'}}}}}});
    }

    // ===================== GRAFICOS DASHBOARD =====================
    function dibujarTendencia(serie,meta){
      const ctx=el('chart-tendencia'); if(!ctx)return; destruir('tendencia');
      charts.tendencia=new Chart(ctx,{type:'line',
        data:{labels:serie.map(s=>s.dia),datasets:[
          {label:'Acumulado válidos',data:serie.map(s=>s.acumulado),borderColor:'#3D8A44',backgroundColor:'rgba(61,138,68,.1)',fill:true,tension:.3,borderWidth:3,pointRadius:0},
          {label:'Meta',data:serie.map(()=>meta),borderColor:'#25294F',borderDash:[6,4],borderWidth:2,pointRadius:0,fill:false}]},
        options:{responsive:true,plugins:{legend:{labels:{font:{size:11,weight:'bold'},usePointStyle:true}}},
          scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{precision:0}},x:{grid:{display:false}}}}});
    }
    function dibujarLideres(lideres,meta){
      const ctx=el('chart-lideres'); if(!ctx)return; destruir('lideres');
      charts.lideres=new Chart(ctx,{type:'bar',
        data:{labels:lideres.map(l=>l.nombre),datasets:[
          {label:'Válidos',data:lideres.map(l=>l.validos),backgroundColor:lideres.map(l=>semColor(l.semaforo)),borderRadius:6,barThickness:26},
          {label:'Extemporáneos',data:lideres.map(l=>l.extemporaneos),backgroundColor:'#cbd5e1',borderRadius:6,barThickness:26}]},
        options:{responsive:true,plugins:{legend:{labels:{font:{size:11,weight:'bold'},usePointStyle:true}},
          tooltip:{callbacks:{afterBody:()=>'Meta: '+meta}}},
          scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{precision:0}},x:{grid:{display:false}}}}});
    }
    function dibujarNovedadesPie(g){
      const ctx=el('chart-novedades'); if(!ctx)return; destruir('nov');
      const sin=Math.max(g.validos-g.faltantes-g.sobrantes,0);
      charts.nov=new Chart(ctx,{type:'doughnut',
        data:{labels:['Sin novedad','Faltantes','Sobrantes','Pendientes'],
          datasets:[{data:[sin,g.faltantes,g.sobrantes,g.pendientes],backgroundColor:['#3D8A44','#dc2626','#F6CF46','#94a3b8'],borderWidth:2,borderColor:'#fff'}]},
        options:{responsive:true,cutout:'62%',plugins:{legend:{position:'bottom',labels:{font:{size:11,weight:'bold'},usePointStyle:true,padding:12}}}}});
    }

    // ===================== ASESOR COI =====================
    function asesorPanel(consejos){
      if(!consejos.length) return '';
      const sevStyle = {
        rojo:    {bg:'bg-red-50',    bord:'border-red-200',    ic:'text-red-500'},
        amarillo:{bg:'bg-yellow-50', bord:'border-yellow-200', ic:'text-yellow-600'},
        verde:   {bg:'bg-green-50',  bord:'border-green-200',  ic:'text-multival-green'},
        info:    {bg:'bg-slate-50',  bord:'border-slate-200',  ic:'text-multival-navy'}
      };
      return `
      <div class="bg-gradient-to-br from-multival-navy to-multival-navyHover rounded-[2rem] shadow-soft p-6 mb-6 relative overflow-hidden">
        <div class="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-multival-gold/10"></div>
        <div class="absolute -left-6 -bottom-10 w-32 h-32 rounded-full bg-multival-green/10"></div>
        <div class="flex items-center gap-3 mb-4 relative z-10">
          <div class="w-11 h-11 rounded-xl bg-multival-gold flex items-center justify-center text-multival-navy shadow-lg"><i class="fa-solid fa-robot text-lg"></i></div>
          <div><h3 class="text-white font-black text-lg leading-tight">Asesor COI</h3>
          <p class="text-[11px] font-bold text-blue-200">Recomendaciones inteligentes basadas en tus métricas del mes</p></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 relative z-10">
          ${consejos.map(cj=>{ const s=sevStyle[cj.sev]||sevStyle.info; return `
          <div class="${s.bg} ${s.bord} border rounded-xl p-4 flex gap-3 items-start">
            <div class="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 ${s.ic}"><i class="fa-solid ${cj.ic} text-sm"></i></div>
            <div><p class="text-xs font-black text-multival-navy leading-tight">${cj.titulo}</p>
            <p class="text-[11px] font-medium text-slate-600 mt-1 leading-relaxed">${cj.texto}</p></div>
          </div>`; }).join('')}
        </div>
      </div>`;
    }

    function consejosLider(L,d){
      const cs=[], rest=d.habiles.restantes, trans=d.habiles.transcurridos;
      const ritmoActual = trans>0 ? +(L.validos/trans).toFixed(1) : 0;

      if(L.validos>=d.meta){
        cs.push({sev:'verde',ic:'fa-trophy',titulo:'¡Meta cumplida con '+L.validos+' arqueos válidos!',
          texto:'Superaste la meta de '+d.meta+'. Mantén la disciplina de reporte oportuno: cada arqueo a tiempo protege tu indicador del próximo mes.'});
      } else if(rest===0 && trans>0){
        cs.push({sev:'rojo',ic:'fa-flag-checkered',titulo:'Mes cerrado en '+L.pctReal+'%',
          texto:'Cerraste con '+L.validos+' de '+d.meta+'. Si tienes '+L.extemporaneos+' extemporáneo(s) con causa justificada, solicita su normalización para recuperar indicador.'});
      } else if(L.semaforo==='verde'){
        cs.push({sev:'verde',ic:'fa-chart-line',titulo:'Vas en ruta: proyectas '+L.proyeccion+' arqueos',
          texto:'Tu ritmo actual es '+ritmoActual+'/día hábil. Sostén '+ (L.requeridoPorDia>=999?'el ritmo':L.requeridoPorDia+'/día') +' durante los '+rest+' días restantes y cierras en meta.'});
      } else if(L.semaforo==='amarillo'){
        cs.push({sev:'amarillo',ic:'fa-triangle-exclamation',titulo:'Riesgo: proyectas '+L.proyeccion+' de '+d.meta,
          texto:'Llevas ritmo de '+ritmoActual+'/día y necesitas '+L.requeridoPorDia+'/día hábil. Te faltan '+L.faltanParaMeta+' válidos en '+rest+' días: prioriza las oficinas con menos arqueos.'});
      } else {
        cs.push({sev:'rojo',ic:'fa-circle-exclamation',titulo:'Crítico: al ritmo actual no llegas',
          texto:'Proyección de '+L.proyeccion+' vs meta de '+d.meta+'. Requieres '+ (L.requeridoPorDia>=999?'más días hábiles':L.requeridoPorDia+' arqueos/día hábil') +'. Agenda bloques diarios de arqueo y reporta el mismo día.'});
      }

      if(L.extemporaneos>0){
        const potencial = L.validos + L.extemporaneos;
        cs.push({sev:'amarillo',ic:'fa-rotate-left',titulo:L.extemporaneos+' extemporáneo(s) no están sumando',
          texto:'Si tienen causa justificada (sin señal, contingencia), solicita normalización en "Mis Arqueos": pasarías de '+L.validos+' a hasta '+potencial+' válidos.'});
      } else if(trans>0 && L.total>0){
        cs.push({sev:'verde',ic:'fa-stopwatch',titulo:'Cero extemporáneos: excelente disciplina',
          texto:'Todos tus arqueos se reportaron dentro de los 2 días hábiles. Este hábito es el que más protege tu cumplimiento.'});
      }

      if(L.faltantes>0){
        cs.push({sev:'rojo',ic:'fa-arrow-down',titulo:L.faltantes+' faltante(s) por '+fmt(L.montoFaltante),
          texto:'Verifica doble conteo antes de cerrar, concilia contra el sistema en sitio y documenta la justificación en el formato. Los faltantes recurrentes activan auditoría.'});
      }
      if(L.sobrantes>0){
        cs.push({sev:'amarillo',ic:'fa-arrow-up',titulo:L.sobrantes+' sobrante(s) por '+fmt(L.montoSobrante),
          texto:'Un sobrante también es diferencia operativa: revisa consignaciones sin registrar y transacciones pendientes de aplicar en el sistema.'});
      }
      if(L.faltantes===0 && L.sobrantes===0 && L.total>0){
        cs.push({sev:'verde',ic:'fa-scale-balanced',titulo:'Cero diferencias operativas',
          texto:'Todos tus arqueos del mes cuadraron contra sistema. Control de efectivo impecable.'});
      }

      if(L.oficinasATM>0){
        cs.push({sev:'info',ic:'fa-building-columns',titulo:L.oficinasATM+' oficina(s) con cajero automático',
          texto:'En esas oficinas el sistema exige además el FOR-GOR-099-02 con las tirillas en PDF. Cada ATM suma a tu meta una sola vez al mes, aunque lo arquees varias veces. Las segundas visitas a una oficina sí suman con el arqueo de efectivo.'});
      }
      if((L.virtuales||0) > (L.presenciales||0) && L.total>0){
        cs.push({sev:'amarillo',ic:'fa-video',titulo:'Predominan los arqueos virtuales ('+L.virtuales+' de '+L.total+')',
          texto:'La modalidad virtual es válida, pero el control presencial detecta más novedades. Balancea tu programación para sostener la calidad del arqueo.'});
      }
      return cs.slice(0,6);
    }

    function consejosGlobal(d){
      const g=d.global, cs=[], rest=d.habiles.restantes, trans=d.habiles.transcurridos;
      const criticos=d.lideres.filter(l=>l.semaforo==='rojo'&&l.validos<d.meta);
      const riesgo=d.lideres.filter(l=>l.semaforo==='amarillo');
      const ambito = currentUser.rol==='Regional'?'tu regional':'la operación';

      if(g.pctGlobal>=100){
        cs.push({sev:'verde',ic:'fa-trophy',titulo:'Cumplimiento de '+ambito+' al '+g.pctGlobal+'%',
          texto:'Los '+g.totalLideres+' líderes suman '+g.validos+' arqueos válidos sobre la meta global de '+g.metaGlobal+'. Reconoce públicamente a los primeros del ranking.'});
      } else {
        const faltanGlobal=Math.max(g.metaGlobal-g.validos,0);
        const reqDia = rest>0? Math.ceil(faltanGlobal/rest) : 0;
        cs.push({sev:g.pctGlobal>=70?'amarillo':'rojo',ic:'fa-gauge-high',titulo:'Cumplimiento de '+ambito+': '+g.pctGlobal+'%',
          texto:'Van '+g.validos+' de '+g.metaGlobal+' arqueos válidos ('+g.cumplenMeta+'/'+g.totalLideres+' líderes en meta). '+(rest>0?'Se requieren ~'+reqDia+' arqueos/día hábil entre todos en los '+rest+' días restantes.':'El mes cerró: analiza causas con los líderes fuera de meta.')});
      }

      if(criticos.length){
        const nombres=criticos.slice(0,3).map(l=>l.nombre+' ('+l.validos+'/'+d.meta+')').join(', ');
        cs.push({sev:'rojo',ic:'fa-user-xmark',titulo:criticos.length+' líder(es) en estado crítico',
          texto:'Prioriza seguimiento a: '+nombres+(criticos.length>3?' y '+(criticos.length-3)+' más':'')+'. Agenda llamada esta semana y define plan de choque con ritmo diario.'});
      }
      if(riesgo.length){
        cs.push({sev:'amarillo',ic:'fa-user-clock',titulo:riesgo.length+' líder(es) en riesgo de no cumplir',
          texto:riesgo.slice(0,3).map(l=>l.nombre+' proyecta '+l.proyeccion).join(', ')+'. Un empujón temprano evita cierres críticos: aún hay '+rest+' días hábiles.'});
      }
      if(!criticos.length && !riesgo.length && trans>0 && g.totalLideres>0){
        cs.push({sev:'verde',ic:'fa-users',titulo:'Todos los líderes en verde',
          texto:'Ningún líder en riesgo ni crítico. Aprovecha para auditar la calidad de los PDF de soporte generados este mes.'});
      }

      if(g.extemporaneos>0){
        cs.push({sev:'amarillo',ic:'fa-clock',titulo:g.extemporaneos+' arqueo(s) extemporáneo(s) sin sumar',
          texto:'Revisa el módulo de '+(currentUser.rol==='Regional'?'Aprobaciones':'Normalizaciones')+': los que tengan causa válida pueden normalizarse y recuperar indicador. '+(g.normalizados>0?'Ya se normalizaron '+g.normalizados+' este mes.':'')});
      }

      if(g.faltantes>0){
        const topF=d.novedades.filter(nv=>nv.novedad==='FALTANTE')[0];
        cs.push({sev:'rojo',ic:'fa-arrow-down',titulo:g.faltantes+' faltante(s) por '+fmt(g.montoFaltante),
          texto:(topF?'El mayor es en '+topF.oficina+' por '+fmt(Math.abs(topF.diferencia))+' ('+topF.lider+'). ':'')+'Cruza contra el módulo de Tendencias para detectar oficinas reincidentes y activar auditoría focalizada.'});
      }
      if(g.sobrantes>0){
        cs.push({sev:'amarillo',ic:'fa-arrow-up',titulo:g.sobrantes+' sobrante(s) por '+fmt(g.montoSobrante),
          texto:'Impacto neto del mes: '+(g.montoNeto>=0?'+':'−')+fmt(Math.abs(g.montoNeto))+'. Los sobrantes suelen indicar transacciones sin aplicar: verifica cortes de sistema con Operaciones.'});
      }
      if(g.faltantes===0 && g.sobrantes===0 && g.totalArqueos>0){
        cs.push({sev:'verde',ic:'fa-scale-balanced',titulo:'Cero diferencias operativas en el mes',
          texto:g.totalArqueos+' arqueos recibidos y todos cuadraron contra sistema. Indicador ejemplar para el comité.'});
      }
      if(g.pendientes>0){
        cs.push({sev:'info',ic:'fa-robot',titulo:g.pendientes+' soporte(s) manual(es) pendientes de OCR',
          texto:'El robot N8N aún no extrae montos de estos documentos. Hasta entonces no reflejan diferencias: monitorea que el flujo procese la cola.'});
      }
      return cs.slice(0,6);
    }
