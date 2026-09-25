// Plantilla inicial del formulario. Reproduce el documento del proyecto
// "Prevalencia y factores relacionados al parto pretérmino en un servicio de obstetricia en Cali 2026":
//   - Tabla 4 (definición operacional de las variables): nombres, opciones y rangos tal cual.
//   - Tablas 1, 2 y 3 (EEP-10, PHQ-9, GAD-7): texto de los ítems, opciones, puntos y puntos de corte.
// Las secciones siguen la Tabla 4: Social, Psicológico (una sección por escala) y Biológico,
// con las variables en el mismo orden del documento.
// Lo único que no viene del documento es el número de documento (solicitado para identificar a la paciente).
// La doctora puede modificar todo desde la pestaña "Preguntas" de la app.

const op = (...etiquetas) => etiquetas.map((e, i) => ({ id: 'o' + (i + 1), etiqueta: e }));
const opPuntos = (pares) => pares.map(([e, puntos], i) => ({ id: 'o' + i, etiqueta: e, puntos }));
const SI_NO = [{ id: 'si', etiqueta: 'Sí' }, { id: 'no', etiqueta: 'No' }];

const num = (id, etiqueta, extra = {}) => ({ id, etiqueta, tipo: 'numero', decimales: 0, ...extra });
const unica = (id, etiqueta, opciones, extra = {}) => ({ id, etiqueta, tipo: 'unica', opciones, ...extra });
const siNo = (id, etiqueta, extra = {}) => unica(id, etiqueta, SI_NO, extra);
const imc = (id, etiqueta, peso) => ({
  id, etiqueta, tipo: 'calculo', formula: `${peso} / talla ^ 2`, decimales: 1, unidad: 'kg/m²',
  ayuda: 'Se calcula automáticamente con el peso y la talla.'
});

// Tabla 1 — EEP-10. Los ítems 4, 5, 7 y 8 se califican de manera inversa.
const EEP = ['Nunca', 'Casi nunca', 'De vez en cuando', 'A menudo', 'Muy a menudo'];
const eep = (n, texto, inversa = false) => unica(`eep_${n}`, `${n}. ${texto}`,
  opPuntos(EEP.map((e, i) => [e, inversa ? 4 - i : i])), { obligatoria: true });

// Tablas 2 y 3 — PHQ-9 y GAD-7.
const FRECUENCIA = ['Ningún día', 'Varios días', 'Más de la mitad de los días', 'Casi todos los días'];
const frec = (id, texto, alerta) => unica(id, texto,
  opPuntos(FRECUENCIA.map((e, i) => [e, i])).map((o, i) => (alerta && i > 0 ? { ...o, alerta } : o)),
  { obligatoria: true });

export function formularioBase() {
  return {
    titulo: 'Encuesta de parto pretérmino',
    descripcion: 'Servicio de obstetricia · Cali 2026',
    version: 1,
    actualizado: null,
    secciones: [
      {
        id: 'identificacion',
        titulo: 'Identificación',
        descripcion: '',
        preguntas: [
          { id: 'documento', etiqueta: 'Número de documento', tipo: 'texto', obligatoria: true, unico: true,
            ayuda: 'No se permite registrar dos encuestas con el mismo documento.' }
        ]
      },
      {
        id: 'social',
        titulo: 'Social',
        descripcion: '',
        preguntas: [
          unica('estrato', 'Estrato socioeconómico',
            op('1: Bajo-bajo', '2: Bajo', '3: Medio-bajo', '4: Medio', '5: Medio-alto', '6: Alto'), { obligatoria: true }),
          unica('nivel_educativo', 'Nivel educativo',
            op('Sin educación', 'Primaria', 'Secundaria', 'Técnica/tecnológica', 'Universitaria', 'Posgrado'),
            { obligatoria: true, ayuda: 'Máximo grado de educación formal alcanzado.' }),
          unica('estado_civil', 'Estado civil',
            op('Soltera', 'Casada', 'Unión libre', 'Separada/divorciada', 'Viuda'), { obligatoria: true }),
          unica('ocupacion', 'Ocupación',
            op('Empleada', 'Independiente', 'Ama de casa', 'Estudiante', 'Desempleada'), { obligatoria: true }),
          unica('etnia', 'Etnia',
            op('Indígena', 'Raizal del Archipiélago de San Andrés', 'Palenquero de San Basilio',
              'Población negra, afrocolombiana o mulata', 'Gitano o Rom', 'Ninguno de los anteriores'),
            { obligatoria: true }),
          unica('tabaquismo', 'Tabaquismo', op('Fumador', 'No fumador'),
            { obligatoria: true, ayuda: 'Consumo de productos derivados del tabaco, especialmente cigarrillo, durante el embarazo.' })
        ]
      },
      {
        id: 'eep10',
        titulo: 'Psicológico · Estrés',
        descripcion: 'Escala de estrés percibido (EEP-10). Durante el último mes:',
        puntaje: {
          activo: true,
          rangos: [
            { min: 0, max: 13, etiqueta: 'Estrés bajo' },
            { min: 14, max: 26, etiqueta: 'Estrés moderado' },
            { min: 27, max: 40, etiqueta: 'Estrés alto' }
          ]
        },
        preguntas: [
          eep(1, '¿Con qué frecuencia ha estado afectado por algo que ha ocurrido inesperadamente?'),
          eep(2, '¿Con qué frecuencia se ha sentido incapaz de controlar las cosas importantes en su vida?'),
          eep(3, '¿Con qué frecuencia se ha sentido nervioso o estresado?'),
          eep(4, '¿Con qué frecuencia ha estado seguro sobre su capacidad para manejar sus problemas personales?', true),
          eep(5, '¿Con qué frecuencia ha sentido que las cosas le van bien?', true),
          eep(6, '¿Con qué frecuencia ha sentido que no podía afrontar todas las cosas que tenía que hacer?'),
          eep(7, '¿Con qué frecuencia ha podido controlar las dificultades de su vida?', true),
          eep(8, '¿Con qué frecuencia se ha sentido que tenía todo bajo control?', true),
          eep(9, '¿Con qué frecuencia ha estado enfadado porque las cosas que le han ocurrido estaban fuera de su control?'),
          eep(10, '¿Con qué frecuencia ha sentido que las dificultades se acumulan tanto que no puede superarlas?')
        ]
      },
      {
        id: 'phq9',
        titulo: 'Psicológico · Depresión',
        descripcion: 'Cuestionario de salud del paciente (PHQ-9). Durante las últimas 2 semanas, ¿qué tan seguido ha tenido molestias debido a los siguientes problemas?',
        puntaje: {
          activo: true,
          rangos: [
            { min: 1, max: 4, etiqueta: 'Depresión mínima' },
            { min: 5, max: 9, etiqueta: 'Depresión leve' },
            { min: 10, max: 14, etiqueta: 'Depresión moderada' },
            { min: 15, max: 19, etiqueta: 'Depresión moderada-severa' },
            { min: 20, max: 27, etiqueta: 'Depresión severa' }
          ]
        },
        preguntas: [
          frec('phq_1', '1. Poco interés o placer en hacer cosas'),
          frec('phq_2', '2. Se ha sentido decaído(a), deprimido(a) o sin esperanzas'),
          frec('phq_3', '3. Ha tenido dificultad para quedarse o permanecer dormido(a), o ha dormido demasiado'),
          frec('phq_4', '4. Se ha sentido cansado(a) o con poca energía'),
          frec('phq_5', '5. Sin apetito o ha comido en exceso'),
          frec('phq_6', '6. Se ha sentido mal con usted mismo(a) – o que es un fracaso o que ha quedado mal con usted mismo(a) o con su familia'),
          frec('phq_7', '7. Ha tenido dificultad para concentrarse en ciertas actividades, tales como leer el periódico o ver la televisión'),
          frec('phq_8', '8. ¿Se ha movido o hablado tan lento que otras personas podrían haberlo notado? o lo contrario – muy inquieto(a) o agitado(a) que ha estado moviéndose mucho más de lo normal'),
          frec('phq_9', '9. Pensamientos de que estaría mejor muerto(a) o de lastimarse de alguna manera',
            'PHQ-9 pregunta 9 con al menos un punto: la paciente debe recibir atención por parte de un profesional en salud de manera inmediata (riesgo de suicidio).')
        ]
      },
      {
        id: 'gad7',
        titulo: 'Psicológico · Ansiedad',
        descripcion: 'Escala de ansiedad generalizada (GAD-7). Durante las últimas 2 semanas, ¿qué tan seguido ha tenido molestias debido a los siguientes problemas?',
        puntaje: {
          activo: true,
          rangos: [
            { min: 0, max: 4, etiqueta: 'Ansiedad mínima' },
            { min: 5, max: 9, etiqueta: 'Ansiedad leve' },
            { min: 10, max: 14, etiqueta: 'Ansiedad moderada' },
            { min: 15, max: 21, etiqueta: 'Ansiedad severa' }
          ]
        },
        preguntas: [
          frec('gad_1', '1. Se ha sentido nervioso(a), ansioso(a) o con los nervios de punta'),
          frec('gad_2', '2. No ha sido capaz de parar o controlar su preocupación'),
          frec('gad_3', '3. Se ha preocupado demasiado por motivos diferentes'),
          frec('gad_4', '4. Ha tenido dificultad para relajarse'),
          frec('gad_5', '5. Se ha sentido tan inquieto(a) que no ha podido quedarse quieto(a)'),
          frec('gad_6', '6. Se ha molestado o irritado fácilmente'),
          frec('gad_7', '7. Ha tenido miedo de que algo terrible fuera a pasar')
        ]
      },
      {
        id: 'biologico',
        titulo: 'Biológico',
        descripcion: '',
        preguntas: [
          num('edad', 'Edad materna', { obligatoria: true, min: 0, unidad: 'años',
            ayuda: 'Años completos desde la fecha de nacimiento hasta el momento de la recolección.' }),
          unica('gravidez', 'Gravidez', op('0: nulípara', '1: primípara', '2 o más: multípara'),
            { ayuda: 'Número de veces que la mujer ha estado embarazada independientemente del resultado (parto, cesárea, aborto, embarazo ectópico).' }),
          num('partos_vaginales', 'Número de partos vaginales previos', { min: 0 }),
          num('cesareas', 'Número de cesáreas previas', { min: 0 }),
          num('abortos', 'Número de abortos', { min: 0,
            ayuda: 'Embarazos que finalizan antes de la viabilidad del feto (< 20 semanas o peso fetal < 500 gramos).' }),
          num('ectopicos', 'Número de embarazos ectópicos previos', { min: 0 }),
          siNo('legrados', 'Antecedente de legrados'),
          siNo('pretermino_previo', 'Antecedente de parto pretérmino espontáneo',
            { ayuda: 'Al menos un parto previo antes de las 37 semanas completas, con inicio espontáneo del trabajo de parto.' }),
          { id: 'eg_pretermino_previo', etiqueta: 'Edad gestacional de parto pretérmino previo', tipo: 'numero',
            decimales: 1, unidad: 'semanas', mostrarSi: { pregunta: 'pretermino_previo', valores: ['si'] },
            ayuda: 'Por fecha de última menstruación, ecografía obstétrica o examen clínico neonatal.' },
          siNo('itu', 'Infección de vías urinarias'),
          unica('itu_trimestre', 'Trimestre en el que desarrolló infección urinaria',
            op('I trimestre: 0-13.6 semanas', 'II trimestre: 14-27.6 semanas', 'III trimestre: ≥ 28 semanas'),
            { mostrarSi: { pregunta: 'itu', valores: ['si'] } }),
          num('itu_episodios', 'Número de episodios de infección urinaria', { min: 0,
            ayuda: 'Cistitis o pielonefritis.', mostrarSi: { pregunta: 'itu', valores: ['si'] } }),
          siNo('infeccion_vaginal', 'Infección vaginal'),
          siNo('anemia', 'Anemia', { ayuda: 'Hemoglobina < 11,0 g/dl en I y III trimestre; < 10,5 g/dl en II trimestre.' }),
          num('hb_1t', 'Hb primer trimestre', { decimales: 1, min: 0, unidad: 'g/dL' }),
          num('hb_2t', 'Hb segundo trimestre', { decimales: 1, min: 0, unidad: 'g/dL' }),
          num('hb_3t', 'Hb tercer trimestre', { decimales: 1, min: 0, unidad: 'g/dL' }),
          num('peso_1t', 'Peso materno I trimestre', { decimales: 1, min: 0, unidad: 'kg' }),
          num('peso_2t', 'Peso materno II trimestre', { decimales: 1, min: 0, unidad: 'kg' }),
          num('peso_3t', 'Peso materno III trimestre', { decimales: 1, min: 0, unidad: 'kg' }),
          num('talla', 'Talla', { decimales: 2, min: 0, max: 3, unidad: 'm', ayuda: 'En metros. Ejemplo: 1.62' }),
          imc('imc_1t', 'IMC I trimestre', 'peso_1t'),
          imc('imc_2t', 'IMC II trimestre', 'peso_2t'),
          imc('imc_3t', 'IMC III trimestre', 'peso_3t'),
          num('imc_pregestacional', 'IMC pregestacional', { decimales: 1, min: 0, unidad: 'kg/m²',
            ayuda: 'Peso (kg) / talla (m)² antes del inicio del embarazo o en las primeras 14 semanas de gestación.' }),
          unica('periodo_intergenesico', 'Periodo intergenésico',
            op('Corto: < 18 meses', 'Ideal: 18-24 meses', 'Prolongado: > 60 meses'),
            { ayuda: 'Intervalo en meses entre la finalización del último embarazo y el inicio del embarazo actual.' })
        ]
      }
    ]
  };
}
