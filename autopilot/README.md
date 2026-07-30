# PDFPrivado Pro — PDF→Word Autopilot

Canal de control para experimentos locales del motor PDF→Word.

## Privacidad

El agente no sube PDF, DOCX, PNG, texto OCR, nombres de documentos, rutas locales ni logs completos. Solo publica JSON sanitizado con métricas, gates y estado del experimento.

## Separación

- `main`: producto/motor oficial. No lo modifica el canal de control.
- `pdfword-autopilot`: cola de experimentos, runners y resultados sanitizados.
- `.pdfword-autopilot/` en el PC: clon de control, snapshots locales, logs y estado. Se excluye mediante `.git/info/exclude`.

## Seguridad operativa

- El agente comprueba SHA-256 del runner antes de ejecutarlo.
- Comprueba que los archivos protegidos coinciden con la baseline local antes de cada prueba.
- Si un job falla o no debe conservarse, restaura la baseline local.
- Ningún job puede promover automáticamente una versión oficial, crear tag de versión ni modificar `main`.
- Las familias cerradas se registran en `autopilot/control/queue.json` y no se reejecutan.
