// Plantilla inicial del formulario, tomada del proyecto "Prevalencia y factores relacionados
// al parto pretérmino en un servicio de obstetricia en Cali 2026" (Tabla 4 y Tablas 1-3).
// La doctora puede modificarla completa desde la pestaña "Preguntas" de la app.

import { slug } from './calc.js';

const op = (...etiquetas) => etiquetas.map((e) => ({ id: slug(e, 24), etiqueta: e }));
const opPuntos = (pares) => pares.map(([e, puntos], i) => ({ id: 'o' + i, etiqueta: e, puntos }));
const SI_NO = [{ id: 'si', etiqueta: 'Sí' }, { id: 'no', etiqueta: 'No' }];

const num = (id, etiqueta, extra = {}) => ({ id, etiqueta, tipo: 'numero', decimales: 0, ...extra });
const unica = (id, etiqueta, opciones, extra = {}) => ({ id, etiqueta, tipo: 'unica', opciones, ...extra });
const siNo = (id, etiqueta, extra = {}) => unica(id, etiqueta, SI_NO, extra);

// EEP-10: los ítems 4, 5, 7 y 8 puntúan al revés.
const EEP = ['Nunca', 'Casi nunca', 'De vez en cuando', 'A menudo', 'Muy a menudo'];
const eep = (n, texto, inversa = false) => unica(`eep_${n}`, `${n}. ${texto}`,
  opPuntos(EEP.map((e, i) => [e, inversa ? 4 - i : i])), { obligatoria: true });

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
        descripcion: 'Datos básicos de la paciente.',
        preguntas: [
          { id: 'documento', etiqueta: 'Número de documento', tipo: 'texto', obligatoria: true, unico: true,
            ayuda: 'No se permite registrar dos encuestas con el mismo documento.' },
          num('edad', 'Edad (años cumplidos)', { obligatoria: true, min: 18, max: 60, unidad: 'años' }),
          { id: 'edad_gestacional_sem', etiqueta: 'Edad gestacional actual (semanas)', tipo: 'numero',
            decimales: 0, min: 20, max: 36, unidad: 'semanas' },
          num('edad_gestacional_dias', 'Edad gestacional actual (días adicionales)', { min: 0, max: 6, unidad: 'días',
            ayuda: 'Ejemplo: 31 semanas y 6 días → 31 en semanas y 6 en días.' })
        ]
      },
      {
        id: 'sociodemografico',
        titulo: 'Datos sociodemográficos',
        descripcion: '',
        preguntas: [
          unica('estrato', 'Estrato socioeconómico', op('1 - Bajo-bajo', '2 - Bajo', '3 - Medio-bajo', '4 - Medio', '5 - Medio-alto', '6 - Alto'), { obligatoria: true }),
          unica('nivel_educativo', 'Nivel de educación (máximo alcanzado)', op('Sin educación', 'Primaria', 'Secundaria', 'Técnica / tecnológica', 'Universitaria', 'Posgrado'), { obligatoria: true }),
          unica('estado_civil', 'Estado civil', op('Soltera', 'Casada', 'Unión libre', 'Separada / divorciada', 'Viuda'), { obligatoria: true }),
          unica('ocupacion', 'Ocupación', op('Empleada', 'Independiente', 'Ama de casa', 'Estudiante', 'Desempleada'), { obligatoria: true }),
          unica('etnia', 'Etnia (autorreconocimiento)', op('Indígena', 'Raizal del Archipiélago de San Andrés', 'Palenquera de San Basilio', 'Negra, afrocolombiana o mulata', 'Gitana o Rom', 'Ninguna de las anteriores'), { obligatoria: true }),
          unica('tabaquismo', 'Tabaquismo durante el embarazo', op('Fumadora', 'No fumadora'), { obligatoria: true })
        ]
      },
      {
        id: 'antecedentes',
        titulo: 'Antecedentes obstétricos',
        descripcion: 'Según historia clínica y carné de control prenatal.',
        preguntas: [
          num('gestaciones', 'Número de embarazos (incluido el actual)', { min: 1, max: 20 }),
          num('partos_vaginales', 'Número de partos vaginales previos', { min: 0, max: 20 }),
          num('cesareas', 'Número de cesáreas previas', { min: 0, max: 20 }),
          num('abortos', 'Número de abortos', { min: 0, max: 20 }),
          num('ectopicos', 'Número de embarazos ectópicos previos', { min: 0, max: 20 }),
          siNo('legrados', 'Antecedente de legrados'),
          siNo('pretermino_previo', 'Antecedente de parto pretérmino espontáneo'),
          num('eg_pretermino_previo_sem', 'Edad gestacional del parto pretérmino previo (semanas)', {
            min: 20, max: 36, unidad: 'semanas', mostrarSi: { pregunta: 'pretermino_previo', valores: ['si'] } }),
          num('eg_pretermino_previo_dias', 'Edad gestacional del parto pretérmino previo (días adicionales)', {
            min: 0, max: 6, unidad: 'días', mostrarSi: { pregunta: 'pretermino_previo', valores: ['si'] } }),
          num('periodo_intergenesico', 'Periodo intergenésico (meses)', { min: 0, max: 360, unidad: 'meses',
            ayuda: 'Meses entre el fin del último embarazo y el inicio del actual. Dejar vacío si es el primer embarazo.' })
        ]
      },
      {
        id: 'infecciones',
        titulo: 'Infecciones y anemia',
        descripcion: '',
        preguntas: [
          siNo('itu', 'Infección de vías urinarias en este embarazo'),
          { id: 'itu_trimestre', etiqueta: 'Trimestre(s) en que presentó la infección urinaria', tipo: 'multiple',
            opciones: op('I trimestre (0 - 13,6 sem)', 'II trimestre (14 - 27,6 sem)', 'III trimestre (28 sem o más)'),
            mostrarSi: { pregunta: 'itu', valores: ['si'] } },
          num('itu_episodios', 'Número de episodios de infección urinaria', { min: 1, max: 20,
            mostrarSi: { pregunta: 'itu', valores: ['si'] } }),
          siNo('infeccion_vaginal', 'Infección vaginal en este embarazo'),
          siNo('anemia', 'Anemia en este embarazo', {
            ayuda: 'Hb < 11 g/dL en I y III trimestre, o < 10,5 g/dL en II trimestre.' }),
          num('hb_1t', 'Hemoglobina I trimestre', { decimales: 1, min: 3, max: 20, unidad: 'g/dL' }),
          num('hb_2t', 'Hemoglobina II trimestre', { decimales: 1, min: 3, max: 20, unidad: 'g/dL' }),
          num('hb_3t', 'Hemoglobina III trimestre', { decimales: 1, min: 3, max: 20, unidad: 'g/dL' })
        ]
      },
      {
        id: 'antropometria',
        titulo: 'Peso, talla e IMC',
        descripcion: 'El IMC se calcula automáticamente con el peso y la talla.',
        preguntas: [
          num('talla', 'Talla', { decimales: 2, min: 1.2, max: 2.1, unidad: 'm', ayuda: 'En metros. Ejemplo: 1,62' }),
          num('peso_pregestacional', 'Peso antes del embarazo', { decimales: 1, min: 30, max: 200, unidad: 'kg' }),
          num('peso_1t', 'Peso I trimestre', { decimales: 1, min: 30, max: 200, unidad: 'kg' }),
          num('peso_2t', 'Peso II trimestre', { decimales: 1, min: 30, max: 200, unidad: 'kg' }),
          num('peso_3t', 'Peso III trimestre', { decimales: 1, min: 30, max: 200, unidad: 'kg' }),
          { id: 'imc_pregestacional', etiqueta: 'IMC pregestacional', tipo: 'calculo', formula: 'peso_pregestacional / talla ^ 2', decimales: 1, unidad: 'kg/m²' },
          { id: 'imc_1t', etiqueta: 'IMC I trimestre', tipo: 'calculo', formula: 'peso_1t / talla ^ 2', decimales: 1, unidad: 'kg/m²' },
          { id: 'imc_2t', etiqueta: 'IMC II trimestre', tipo: 'calculo', formula: 'peso_2t / talla ^ 2', decimales: 1, unidad: 'kg/m²' },
          { id: 'imc_3t', etiqueta: 'IMC III trimestre', tipo: 'calculo', formula: 'peso_3t / talla ^ 2', decimales: 1, unidad: 'kg/m²' }
        ]
      },
      {
        id: 'eep10',
        titulo: 'Escala de estrés percibido (EEP-10)',
        descripcion: 'Durante el último mes…',
        puntaje: {
          activo: true,
          rangos: [
            { min: 0, max: 13, etiqueta: 'Estrés bajo' },
            { min: 14, max: 26, etiqueta: 'Estrés moderado' },
            { min: 27, max: 40, etiqueta: 'Estrés alto' }
          ]
        },
        preguntas: [
          eep(1, '¿Con qué frecuencia ha estado afectada por algo que ha ocurrido inesperadamente?'),
          eep(2, '¿Con qué frecuencia se ha sentido incapaz de controlar las cosas importantes en su vida?'),
          eep(3, '¿Con qué frecuencia se ha sentido nerviosa o estresada?'),
          eep(4, '¿Con qué frecuencia ha estado segura sobre su capacidad para manejar sus problemas personales?', true),
          eep(5, '¿Con qué frecuencia ha sentido que las cosas le van bien?', true),
          eep(6, '¿Con qué frecuencia ha sentido que no podía afrontar todas las cosas que tenía que hacer?'),
          eep(7, '¿Con qué frecuencia ha podido controlar las dificultades de su vida?', true),
          eep(8, '¿Con qué frecuencia se ha sentido que tenía todo bajo control?', true),
          eep(9, '¿Con qué frecuencia ha estado enfadada porque las cosas que le han ocurrido estaban fuera de su control?'),
          eep(10, '¿Con qué frecuencia ha sentido que las dificultades se acumulan tanto que no puede superarlas?')
        ]
      },
      {
        id: 'phq9',
        titulo: 'Cuestionario de salud de la paciente (PHQ-9)',
        descripcion: 'Durante las últimas 2 semanas, ¿qué tan seguido ha tenido molestias debido a los siguientes problemas?',
        puntaje: {
          activo: true,
          rangos: [
            { min: 0, max: 4, etiqueta: 'Depresión mínima' },
            { min: 5, max: 9, etiqueta: 'Depresión leve' },
            { min: 10, max: 14, etiqueta: 'Depresión moderada' },
            { min: 15, max: 19, etiqueta: 'Depresión moderada-severa' },
            { min: 20, max: 27, etiqueta: 'Depresión severa' }
          ]
        },
        preguntas: [
          frec('phq_1', '1. Poco interés o placer en hacer cosas'),
          frec('phq_2', '2. Se ha sentido decaída, deprimida o sin esperanzas'),
          frec('phq_3', '3. Ha tenido dificultad para quedarse o permanecer dormida, o ha dormido demasiado'),
          frec('phq_4', '4. Se ha sentido cansada o con poca energía'),
          frec('phq_5', '5. Sin apetito o ha comido en exceso'),
          frec('phq_6', '6. Se ha sentido mal con usted misma, o que es un fracaso, o que ha quedado mal con usted misma o con su familia'),
          frec('phq_7', '7. Ha tenido dificultad para concentrarse en ciertas actividades, tales como leer el periódico o ver la televisión'),
          frec('phq_8', '8. ¿Se ha movido o hablado tan lento que otras personas podrían haberlo notado? O lo contrario: muy inquieta o agitada, moviéndose mucho más de lo normal'),
          frec('phq_9', '9. Pensamientos de que estaría mejor muerta o de lastimarse de alguna manera',
            'PHQ-9 ítem 9 positivo: la paciente debe recibir atención inmediata por un profesional de salud.')
        ]
      },
      {
        id: 'gad7',
        titulo: 'Escala de ansiedad generalizada (GAD-7)',
        descripcion: 'Durante las últimas 2 semanas, ¿qué tan seguido ha tenido molestias debido a los siguientes problemas?',
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
          frec('gad_1', '1. Se ha sentido nerviosa, ansiosa o con los nervios de punta'),
          frec('gad_2', '2. No ha sido capaz de parar o controlar su preocupación'),
          frec('gad_3', '3. Se ha preocupado demasiado por motivos diferentes'),
          frec('gad_4', '4. Ha tenido dificultad para relajarse'),
          frec('gad_5', '5. Se ha sentido tan inquieta que no ha podido quedarse quieta'),
          frec('gad_6', '6. Se ha molestado o irritado fácilmente'),
          frec('gad_7', '7. Ha tenido miedo de que algo terrible fuera a pasar')
        ]
      },
      {
        id: 'cierre',
        titulo: 'Observaciones',
        descripcion: '',
        preguntas: [
          { id: 'observaciones', etiqueta: 'Observaciones', tipo: 'parrafo' }
        ]
      }
    ]
  };
}
