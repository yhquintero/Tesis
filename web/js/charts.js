const PALETA = ['#1B5E20', '#2E7D32', '#66BB6A', '#C9A227', '#1D4ED8', '#00897B', '#B3261E', '#6D4C41'];

function preparar(lienzo, alto = 220) {
  const dpr = window.devicePixelRatio || 1;
  const ancho = lienzo.clientWidth || lienzo.parentElement?.clientWidth || 320;
  lienzo.style.height = `${alto}px`;
  lienzo.width = Math.round(ancho * dpr);
  lienzo.height = Math.round(alto * dpr);
  const ctx = lienzo.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);
  return { ctx, ancho, alto };
}

export function color(indice) {
  return PALETA[indice % PALETA.length];
}

export function donut(lienzo, datos, { centro = '', alto = 220 } = {}) {
  const total = datos.reduce((suma, item) => suma + Number(item.valor || 0), 0);
  const pintar = () => {
    const { ctx, ancho, alto: hh } = preparar(lienzo, alto);
    const cx = ancho / 2;
    const cy = hh / 2;
    const radio = Math.min(ancho, hh) / 2 - 18;
    const grosor = Math.max(16, radio * 0.38);
    let inicio = -Math.PI / 2;
    if (total <= 0) {
      ctx.beginPath();
      ctx.strokeStyle = '#E7EEE7';
      ctx.lineWidth = grosor;
      ctx.arc(cx, cy, radio, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      datos.forEach((item, i) => {
        const valor = Number(item.valor || 0);
        if (valor <= 0) return;
        const angulo = (valor / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.strokeStyle = item.color || color(i);
        ctx.lineWidth = grosor;
        ctx.lineCap = 'butt';
        ctx.arc(cx, cy, radio, inicio + 0.012, inicio + angulo - 0.012);
        ctx.stroke();
        inicio += angulo;
      });
    }
    ctx.fillStyle = '#1B5E20';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(centro || String(total), cx, cy - 4);
    ctx.fillStyle = '#5F6B62';
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('TOTAL', cx, cy + 16);
  };
  pintar();
  observar(lienzo, pintar);
  lienzo.setAttribute(
    'aria-label',
    `Distribución: ${datos.map((d) => `${d.etiqueta}: ${d.valor}`).join(', ')}`,
  );
  return pintar;
}

export function barrasHorizontales(lienzo, datos, { alto = 240, sufijo = '' } = {}) {
  const pintar = () => {
    const { ctx, ancho, alto: hh } = preparar(lienzo, alto);
    const maximo = Math.max(1, ...datos.map((d) => Number(d.valor || 0)));
    const margenIzq = Math.min(150, ancho * 0.38);
    const margenDer = 54;
    const disponible = ancho - margenIzq - margenDer;
    const filas = Math.max(1, datos.length);
    const altoFila = Math.min(34, (hh - 16) / filas);
    const grosor = Math.max(10, altoFila - 14);
    datos.forEach((item, i) => {
      const y = 12 + i * altoFila;
      ctx.fillStyle = '#5F6B62';
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const etiqueta = item.etiqueta.length > 20 ? `${item.etiqueta.slice(0, 19)}…` : item.etiqueta;
      ctx.fillText(etiqueta, margenIzq - 10, y + grosor / 2);
      ctx.fillStyle = '#EDF3ED';
      redondear(ctx, margenIzq, y, disponible, grosor, grosor / 2);
      ctx.fill();
      const longitud = Math.max(3, (Number(item.valor || 0) / maximo) * disponible);
      ctx.fillStyle = item.color || color(i);
      redondear(ctx, margenIzq, y, longitud, grosor, grosor / 2);
      ctx.fill();
      ctx.fillStyle = '#18201A';
      ctx.textAlign = 'left';
      ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
      const etiquetaValor = formato ? formato(Number(item.valor || 0)) : `${item.valor}${sufijo}`;
      ctx.fillText(etiquetaValor, margenIzq + longitud + 8, y + grosor / 2);
    });
  };
  pintar();
  observar(lienzo, pintar);
  lienzo.setAttribute(
    'aria-label',
    datos
      .map((d) => `${d.etiqueta}: ${formato ? formato(Number(d.valor || 0)) : `${d.valor}${sufijo}`}`)
      .join(', '),
  );
  return pintar;
}

function redondear(ctx, x, y, ancho, alto, radio) {
  const r = Math.min(radio, ancho / 2, alto / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + ancho - r, y);
  ctx.quadraticCurveTo(x + ancho, y, x + ancho, y + r);
  ctx.lineTo(x + ancho, y + alto - r);
  ctx.quadraticCurveTo(x + ancho, y + alto, x + ancho - r, y + alto);
  ctx.lineTo(x + r, y + alto);
  ctx.quadraticCurveTo(x, y + alto, x, y + alto - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function observar(lienzo, pintar) {
  if (lienzo.dataset.observado === '1') return;
  lienzo.dataset.observado = '1';
  if (typeof ResizeObserver !== 'undefined') {
    let pendiente;
    const observador = new ResizeObserver(() => {
      clearTimeout(pendiente);
      pendiente = setTimeout(pintar, 80);
    });
    observador.observe(lienzo.parentElement || lienzo);
  }
}

export function leyenda(datos) {
  return datos.map((item, i) => ({
    etiqueta: item.etiqueta,
    color: item.color || color(i),
    valor: item.valor,
  }));
}
