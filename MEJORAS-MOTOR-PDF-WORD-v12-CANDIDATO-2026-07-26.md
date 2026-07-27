# Motor PDF → Word: v12 candidato · 2026-07-26

## Estado

Esta iteración parte exactamente de v11. Se mantiene v11 como última versión
aceptada por la puerta SSIM estricta (`0.7854564260` en 41 páginas del banco).
V12 queda como **candidato**, no como sustituto de v11, hasta repetir el render
DOCX completo y la comparación SSIM a 144 dpi.

## Cambios generales

- Nueva etapa `src/ocr-visual-feedback.js` para retroalimentación visual OCR → Word.
- Recuperación robusta del color de tinta mediante mediana ponderada de la
  diferencia entre el ráster original y la capa gráfica ya limpiada.
- Prueba local de cada variante antes de aceptar color, negrita, cursiva o
  negrita+cursiva.
- La negrita/cursiva exige confianza OCR de línea >= 55 y evidencia visual
  mínima; si falta confianza, no se adivina el estilo.
- Segunda puerta transaccional a nivel de página: si el conjunto de cambios de
  estilo no mejora el error visual simulado, se restauran todos los estilos de
  esa página.
- Se conserva intacta la estimación cromática histórica de v11 en la búsqueda
  global de escala/referencia vertical. Así, la nueva inferencia cromática solo
  puede influir cuando supera primero las puertas locales y de página.
- La calibración global admite ahora una corrección solo de escala únicamente
  con evidencia fuerte: al menos 8 líneas, cambio >= 0,04 y ganancia >= 6 %.
  La puerta histórica de corrección vertical de v11 se conserva.
- Propagación de confianza OCR palabra → línea → layout mediante media ponderada
  por longitud textual.
- El preparador de benchmark conserva la confianza OCR por línea.
- Reutilización del canvas local de variantes para reducir asignaciones durante
  la comparación de color/negrita/cursiva.
- Sin reglas por nombre de archivo, plantilla o número de página.

## Validación ejecutada en este entorno

- `npm run verify:convert-docx`: OK.
- Sintaxis de todos los JS/MJS modificados: OK.
- Compilación Python de los scripts modificados: OK.
- Smoke OCR real sobre `Maiz 2020`, página 1 a 100 dpi: 31 líneas; 31/31 con
  confianza OCR propagada (mín. 52,49; máx. 94,76).
- `test-convert-export-core.mjs`: OK.
- `test-convert-export-adaptive-ocr.mjs`: OK.
- `test-convert-export-layout-refresh-v3.mjs`: OK.

El banco de evidencia cromática reutiliza 40 páginas OCR ya preparadas. El
proxy ponderado L1 detecta evidencia de tinta en 1.678 de 1.690 líneas y reduce
el error cromático frente a tinta negra de `112,6839` a `52,3060` (-53,58 %).
**Este proxy no es SSIM ni sustituye al render de Word.** Solo demuestra que la
nueva etapa dispone de señal visual real antes de entrar en la puerta estricta.

## Puerta pendiente antes de promover v12

En este contenedor no ha sido posible reinstalar las dependencias headless del
benchmark (`docx`, `JSZip`, `@xmldom/xmldom`, `@napi-rs/canvas`) porque el
registro npm no era resoluble desde el entorno. Por ello no se inventa un nuevo
SSIM: `0,7854564260` sigue siendo el último valor global plenamente verificado,
correspondiente a v11.

Para promover este candidato a v12 estable hay que ejecutar, en el workspace
con dependencias disponibles:

1. regenerar el banco con el preparador v12 para conservar confianza OCR;
2. generar los seis DOCX;
3. renderizarlos con LibreOffice;
4. comparar las 41 páginas a 144 dpi;
5. exigir cero regresiones significativas y validar integridad/editabilidad;
6. solo entonces actualizar el resumen SSIM de v12.
