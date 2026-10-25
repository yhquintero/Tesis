export function sumarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function sumarMeses(fechaISO, meses) {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const total = anio * 12 + (mes - 1) + meses;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = (total % 12) + 1;
  const ultimoDia = new Date(Date.UTC(nuevoAnio, nuevoMes, 0)).getUTCDate();
  const nuevoDia = Math.min(dia, ultimoDia);
  return `${String(nuevoAnio).padStart(4, '0')}-${String(nuevoMes).padStart(2, '0')}-${String(nuevoDia).padStart(2, '0')}`;
}

export function diasEntre(desdeISO, hastaISO) {
  const a = new Date(`${desdeISO}T00:00:00Z`).getTime();
  const b = new Date(`${hastaISO}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function moneda(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

export function formatoMoneda(valor, simbolo = '$') {
  return `${simbolo}${moneda(valor).toLocaleString('es-CU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function rangoMeses(desdeISO, hastaISO) {
  const salida = [];
  const [ai, mi] = desdeISO.split('-').map(Number);
  const [af, mf] = hastaISO.split('-').map(Number);
  let anio = ai;
  let mes = mi;
  while (anio < af || (anio === af && mes <= mf)) {
    salida.push(`${anio}-${String(mes).padStart(2, '0')}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
    if (salida.length > 120) break;
  }
  return salida;
}
