# Análisis: formulario de recolección, estudio de parto pretérmino (Cali 2026)

Documento fuente: *Prevalencia y factores relacionados al parto pretérmino en un servicio de obstetricia en Cali 2026*
(Universidad Libre, Esp. Ginecología y Obstetricia, grupo GIGYO).

## 1. Contexto del estudio (lo que condiciona el formulario)

| Aspecto | Dato del documento | Implicación para el formulario |
|---|---|---|
| Diseño | Observacional, corte transversal | Un registro (fila) por gestante |
| Población | Gestantes de 20.0–36.6 semanas hospitalizadas (Clínica Versalles, Cali) | Validar la edad gestacional en ese rango |
| Inclusión | Mayores de 18 años, consentimiento informado firmado | Pantalla de filtro: consentimiento y edad antes de continuar |
| Muestra | 151 gestantes | Contador de avance (n / 151) |
| Periodo | 1 jul – 31 dic 2026 | Fecha de registro automática |
| Fuentes | Historia clínica y carné prenatal (investigador) más encuestas autoadministradas (paciente) | Dos bloques: uno lo llena el investigador y otro la paciente |
| Análisis | Excel y luego SPSS | Columnas planas, códigos numéricos consistentes, una columna por variable |

## 2. Variables (Tabla 4 del documento)

### Social
| Variable | Tipo | Opciones |
|---|---|---|
| Estrato socioeconómico | Ordinal | 1 Bajo-bajo · 2 Bajo · 3 Medio-bajo · 4 Medio · 5 Medio-alto · 6 Alto |
| Nivel educativo | Ordinal | Sin educación · Primaria · Secundaria · Técnica/tecnológica · Universitaria · Posgrado |
| Estado civil | Nominal | Soltera · Casada · Unión libre · Separada/divorciada · Viuda |
| Ocupación | Nominal | Empleada · Independiente · Ama de casa · Estudiante · Desempleada |
| Etnia | Nominal | Indígena · Raizal del Archipiélago de San Andrés · Palenquero de San Basilio · Población negra, afrocolombiana o mulata · Gitano o Rom · Ninguno de los anteriores |
| Tabaquismo | Dicotómica | Fumadora · No fumadora |

### Psicológico (encuestas autoadministradas)
| Escala | Ítems | Opciones | Puntaje / corte |
|---|---|---|---|
| EEP-10 (estrés percibido, último mes) | 10 | 0 Nunca · 1 Casi nunca · 2 De vez en cuando · 3 A menudo · 4 Muy a menudo | **Ítems 4, 5, 7 y 8 se invierten.** 0–13 bajo · 14–26 moderado · 27–40 alto |
| PHQ-9 (depresión, 2 semanas) | 9 | 0 Ningún día · 1 Varios días · 2 Más de la mitad de los días · 3 Casi todos los días | 0–27. 1–4 mínima · 5–9 leve · 10–14 moderada · 15–19 moderada-severa · 20–27 severa. **Ítem 9 ≥ 1 → alerta de atención inmediata** |
| GAD-7 (ansiedad, 2 semanas) | 7 | Igual que PHQ-9 | 0–21. 0–4 mínima · 5–9 leve · 10–14 moderada · 15–21 severa |

### Biológico (historia clínica)
Edad materna · Gravidez · N.º de partos vaginales, cesáreas, abortos y ectópicos previos · Legrados (sí/no) ·
Antecedente de parto pretérmino espontáneo (sí/no) y su edad gestacional · ITU (sí/no), trimestre y n.º de episodios ·
Infección vaginal (sí/no) · Anemia (sí/no) · Hb del I, II y III trimestre · Peso del I, II y III trimestre · Talla ·
IMC del I, II y III trimestre e IMC pregestacional · Periodo intergenésico.

## 3. Hallazgos a resolver con el equipo investigador

1. **Falta la variable desenlace.** El objetivo es la prevalencia de parto pretérmino, pero la Tabla 4 no incluye
   *¿tuvo parto pretérmino? (sí/no)*, la edad gestacional al parto ni el tipo (espontáneo/iatrogénico).
   Sin esos datos no se puede calcular la prevalencia ni los OR. Hay que agregarlos.
2. **Gravidez vs. paridad.** La gravidez se define como el número de embarazos, pero las categorías que se le asignan
   (nulípara/primípara/multípara) corresponden a paridad. Propuesta: capturar el número y derivar la categoría
   (nuligesta/primigesta/multigesta).
3. **PHQ-9 sin el 0.** El corte empieza en "1–4 mínima", así que un puntaje de 0 queda sin categoría. Propuesta: 0–4.
4. **Hb II y III trimestre.** En la definición dice "durante el primer trimestre" (error de copia).
5. **Periodo intergenésico con un hueco.** Corto <18, ideal 18–24 y prolongado >60 dejan sin categoría a 25–60 meses.
   Además falta "No aplica" para las primigestas. Propuesta: capturar los meses y derivar la categoría.
6. **Edades gestacionales tipo "31,6".** En obstetricia significa 31 semanas y 6 días, no 31.6 semanas.
   Se capturarán semanas y días por separado para que SPSS no las lea como decimales.
7. **Trimestre de la ITU.** Puede haber episodios en varios trimestres, así que conviene una selección múltiple.
8. **Variables derivables.** El IMC (peso/talla²), la anemia (según la Hb y el trimestre) y los puntajes y categorías
   de las escalas se pueden calcular automáticamente para evitar errores de digitación.
9. **EEP-10.** La tabla usa "A menudo / Muy a menudo" y el texto "Muchas veces / Siempre". Hay que unificar
   (se usará la versión de la tabla, que es la validada).
10. **Variables del marco teórico que no se recolectan:** consumo de marihuana u otras sustancias, malformaciones
    uterinas, violencia doméstica y red de apoyo. Queda a decisión del equipo si se agregan.

## 4. Protección de datos (importante)

El número de documento más datos de salud mental son **datos sensibles** (Ley 1581 de 2012; Res. 1995 de 1999, citada
en el propio documento). Recomendación:
- En la hoja de análisis usar un **código de participante** (p. ej. `PPT-001`), nunca el documento.
- Guardar el documento en una hoja aparte y restringida (o solo un hash) para detectar duplicados.
- Compartir el Google Sheet solo con los investigadores y no publicarlo en la web.
- El endpoint no debe permitir leer datos, solo escribir.

## 5. Arquitectura propuesta

```
[Landing / formulario (HTML+JS)] --POST--> [Google Apps Script Web App (doPost)] --appendRow--> [Google Sheet]
                                                                                          |-- Hoja "Respuestas" (1 fila por gestante)
                                                                                          |-- Hoja "Identificación" (restringida)
                                                                                          `-- Hoja "Resumen" (n, prevalencia, fórmulas)
```

- **Tiempo real:** cada envío agrega una fila al instante. El Sheet se ve actualizado sin hacer nada más.
- **Sin servidor ni costo:** Apps Script es gratuito y corre con la cuenta de Google del grupo.
- **Hosting del formulario:** la opción A es GitHub Pages (URL propia y versionada en este repo). La opción B es
  servirlo desde el mismo Apps Script (HtmlService), que es más simple y evita problemas de CORS.
- **Formulario por pasos** (wizard), pensado para tablet o celular:
  0. Filtro: consentimiento, edad ≥ 18 y edad gestacional 20.0–36.6
  1. Identificación: código, documento, edad
  2. Sociodemográficos: las 7 variables sociales
  3. Antecedentes obstétricos y biológicos (investigador)
  4. EEP-10 · 5. PHQ-9 · 6. GAD-7 (paciente; se puede "entregar la tablet")
  7. Desenlace del parto (se completa después si la paciente sigue hospitalizada)
- **Validaciones:** rangos, campos obligatorios, puntajes automáticos y alerta visible si el ítem 9 del PHQ-9 es ≥ 1.
- **Resiliencia:** si falla la conexión en la clínica, se guarda en el dispositivo y se reintenta el envío.
- **Codificación SPSS:** cada opción se guarda con su código numérico y se entrega un diccionario de variables.

## 6. Decisiones pendientes (del usuario)

1. ¿Alcance del formulario: solo las 7 preguntas sociodemográficas o todo el instrumento (Tabla 4 y las 3 escalas)?
2. ¿Quién lo diligencia: el investigador, la paciente o ambos (bloques separados)?
3. ¿Se guarda el número de documento completo o solo un código de participante?
4. ¿Hosting: GitHub Pages + Apps Script o solo Apps Script?
5. ¿Se agregan las variables de desenlace (punto 3.1) y se corrigen las inconsistencias señaladas?
