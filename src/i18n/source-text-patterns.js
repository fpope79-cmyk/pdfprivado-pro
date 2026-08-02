/** Patrones seguros para textos dinámicos simples. */
export const SOURCE_TEXT_PATTERNS = Object.freeze([
  {
    "key": "diagnostics.text.value1MediaValue2MaxValue3LentasValue4ErrValue5",
    "source": "${stats.count} · media ${formatDuration(stats.averageMs)} · máx. ${formatDuration(stats.maximumMs)} · lentas ${stats.slowCount} · err. ${stats.errors}",
    "pattern": "^(.+?)\\ ·\\ media\\ (.+?)\\ ·\\ máx\\.\\ (.+?)\\ ·\\ lentas\\ (.+?)\\ ·\\ err\\.\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2",
      "value3",
      "value4",
      "value5"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 619
  },
  {
    "key": "diagnostics.text.tareasLargasValue1TotalValue2MaximoValue3",
    "source": "Tareas largas: ${run.longTasks.count} · total ${formatDuration(run.longTasks.totalMs)} · máximo ${formatDuration(run.longTasks.maximumMs)}",
    "pattern": "^Tareas\\ largas:\\ (.+?)\\ ·\\ total\\ (.+?)\\ ·\\ máximo\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 691
  },
  {
    "key": "languages.text.elTamanoDelPaqueteDeValue1NoCoincideEsperadoValue2BytesRecibidoValue3Bytes",
    "source": "El tamaño del paquete de ${language.label} no coincide. Esperado: ${language.modelBytes} bytes; recibido: ${normalized.byteLength} bytes.",
    "pattern": "^El\\ tamaño\\ del\\ paquete\\ de\\ (.+?)\\ no\\ coincide\\.\\ Esperado:\\ (.+?)\\ bytes;\\ recibido:\\ (.+?)\\ bytes\\.$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/ocr-language-package.js",
    "lineFirst": 82
  },
  {
    "key": "tools.text.value1PreparadoValue2PaginasYValue3PosiblesPaginasBlancasDetectadas",
    "source": "${file.name} preparado: ${state.pageCount} páginas y ${state.blankPages.size} posibles páginas blancas detectadas.",
    "pattern": "^(.+?)\\ preparado:\\ (.+?)\\ páginas\\ y\\ (.+?)\\ posibles\\ páginas\\ blancas\\ detectadas\\.$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 514
  },
  {
    "key": "languages.text.languagePackageSha256MismatchExpectedValue1ReceivedValue2",
    "source": "Language package SHA-256 mismatch: expected ${normalizedManifest.translationsSha256}, received ${actualSha256}.",
    "pattern": "^Language\\ package\\ SHA\\-256\\ mismatch:\\ expected\\ (.+?),\\ received\\ (.+?)\\.$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/i18n/language-package-contract.js",
    "lineFirst": 194
  },
  {
    "key": "tools.text.paginasRepetidasIntencionadamenteOPorSolapamientoValue1",
    "source": "Páginas repetidas intencionadamente o por solapamiento: ${summarizePages(state.planAnalysis.duplicatedPages)}.",
    "pattern": "^Páginas\\ repetidas\\ intencionadamente\\ o\\ por\\ solapamiento:\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 723
  },
  {
    "key": "languages.text.soloSePuedenCombinarHastaValue1IdiomasPorReconocimiento",
    "source": "Solo se pueden combinar hasta ${OCR_LANGUAGE_LIMITS.maximumSelectedLanguages} idiomas por reconocimiento.",
    "pattern": "^Solo\\ se\\ pueden\\ combinar\\ hasta\\ (.+?)\\ idiomas\\ por\\ reconocimiento\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-language-manager.js",
    "lineFirst": 51
  },
  {
    "key": "diagnostics.text.value1PicoValue2",
    "source": "${formatBytes(session.memory.currentUsedBytes)} / pico ${formatBytes(session.memory.peakUsedBytes)}",
    "pattern": "^(.+?)\\ /\\ pico\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 609
  },
  {
    "key": "tools.text.paginasQueNoApareceranEnNingunResultadoValue1",
    "source": "Páginas que no aparecerán en ningún resultado: ${summarizePages(state.planAnalysis.missingPages)}.",
    "pattern": "^Páginas\\ que\\ no\\ aparecerán\\ en\\ ningún\\ resultado:\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 729
  },
  {
    "key": "app.text.paginaValue1DelResultadoValue2PaginaValue3",
    "source": "Página ${index + 1} del resultado. ${card.dataset.sourceName}, página ${card.dataset.sourcePage}.",
    "pattern": "^Página\\ (.+?)\\ del\\ resultado\\.\\ (.+?),\\ página\\ (.+?)\\.$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 1088
  },
  {
    "key": "viewer.text.analizando0DeValue1PaginasLosResultadosApareceranProgresivamente",
    "source": "Analizando 0 de ${state.pageCount} páginas. Los resultados aparecerán progresivamente.",
    "pattern": "^Analizando\\ 0\\ de\\ (.+?)\\ páginas\\.\\ Los\\ resultados\\ aparecerán\\ progresivamente\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 1781
  },
  {
    "key": "tools.text.value1EstaProtegidoConContrasenaOCifradoYNoPuedeDividirseEnEstaVersion",
    "source": "${name} está protegido con contraseña o cifrado y no puede dividirse en esta versión.",
    "pattern": "^(.+?)\\ está\\ protegido\\ con\\ contraseña\\ o\\ cifrado\\ y\\ no\\ puede\\ dividirse\\ en\\ esta\\ versión\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 199
  },
  {
    "key": "viewer.text.seGuardanLasPrimerasValue1CoincidenciasParaProtegerElRendimiento",
    "source": "Se guardan las primeras ${results.length} coincidencias para proteger el rendimiento.",
    "pattern": "^Se\\ guardan\\ las\\ primeras\\ (.+?)\\ coincidencias\\ para\\ proteger\\ el\\ rendimiento\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 1673
  },
  {
    "key": "diagnostics.text.value1ComprobacionesValue2Fallos",
    "source": "${session.stateChecks.count} comprobaciones · ${session.stateChecks.failures} fallos",
    "pattern": "^(.+?)\\ comprobaciones\\ ·\\ (.+?)\\ fallos$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 615
  },
  {
    "key": "ocr.text.elMotorOcrAdmiteComoMaximoValue1IdiomasSimultaneos",
    "source": "El motor OCR admite como máximo ${MAXIMUM_LANGUAGES_PER_WORKER} idiomas simultáneos.",
    "pattern": "^El\\ motor\\ OCR\\ admite\\ como\\ máximo\\ (.+?)\\ idiomas\\ simultáneos\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-worker.js",
    "lineFirst": 34
  },
  {
    "key": "tools.text.noSePudoLeerValue1PuedeEstarDanadoOUsarUnaEstructuraPdfNoCompatible",
    "source": "No se pudo leer ${name}. Puede estar dañado o usar una estructura PDF no compatible.",
    "pattern": "^No\\ se\\ pudo\\ leer\\ (.+?)\\.\\ Puede\\ estar\\ dañado\\ o\\ usar\\ una\\ estructura\\ PDF\\ no\\ compatible\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 201
  },
  {
    "key": "diagnostics.text.vistaValue1DprValue2",
    "source": "Vista: ${report.environment.viewport} · DPR ${report.environment.devicePixelRatio}",
    "pattern": "^Vista:\\ (.+?)\\ ·\\ DPR\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 715
  },
  {
    "key": "viewer.text.value1InstaladosValue2DisponiblesComoPaquetesOffline",
    "source": "${installedCount} instalados · ${availableCount} disponibles como paquetes offline",
    "pattern": "^(.+?)\\ instalados\\ ·\\ (.+?)\\ disponibles\\ como\\ paquetes\\ offline$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2160
  },
  {
    "key": "tools.text.elPlanCrearaValue1ArchivosPuedeRequerirBastanteTiempoYEspacioLibre",
    "source": "El plan creará ${total} archivos. Puede requerir bastante tiempo y espacio libre.",
    "pattern": "^El\\ plan\\ creará\\ (.+?)\\ archivos\\.\\ Puede\\ requerir\\ bastante\\ tiempo\\ y\\ espacio\\ libre\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 743
  },
  {
    "key": "tools.text.value1DeValue2PaginasRecibiranLaMarcaValue3",
    "source": "${selectedNow.size} de ${state.pageCount} páginas recibirán la marca${coverText}.",
    "pattern": "^(.+?)\\ de\\ (.+?)\\ páginas\\ recibirán\\ la\\ marca(.+?)\\.$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/watermark.js",
    "lineFirst": 728
  },
  {
    "key": "app.text.generandoMiniaturaValue1DeValue2Value3",
    "source": "Generando miniatura ${pageNumber} de ${pdfDocument.numPages} · ${item.file.name}",
    "pattern": "^Generando\\ miniatura\\ (.+?)\\ de\\ (.+?)\\ ·\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 1578
  },
  {
    "key": "diagnostics.text.value1MaxValue2",
    "source": "${session.longTasks.count} · máx. ${formatDuration(session.longTasks.maximumMs)}",
    "pattern": "^(.+?)\\ ·\\ máx\\.\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 610
  },
  {
    "key": "diagnostics.text.construccionLecturaContinuaValue1",
    "source": "Construcción lectura continua: ${formatDuration(timings.continuousListBuildMs)}",
    "pattern": "^Construcción\\ lectura\\ continua:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 672
  },
  {
    "key": "viewer.text.preparandoUnaPruebaAisladaDeLaPaginaValue1EnValue2",
    "source": "Preparando una prueba aislada de la página ${pageNumber} en ${language.label}…",
    "pattern": "^Preparando\\ una\\ prueba\\ aislada\\ de\\ la\\ página\\ (.+?)\\ en\\ (.+?)…$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2381
  },
  {
    "key": "viewer.text.pruebaAisladaTerminadaEnValue1ElResultadoNoSeHaGuardado",
    "source": "Prueba aislada terminada en ${language.label}. El resultado no se ha guardado.",
    "pattern": "^Prueba\\ aislada\\ terminada\\ en\\ (.+?)\\.\\ El\\ resultado\\ no\\ se\\ ha\\ guardado\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2440
  },
  {
    "key": "languages.text.elModeloLocalDeValue1NoSuperaLaVerificacionDeIntegridad",
    "source": "El modelo local de ${language.label} no supera la verificación de integridad.",
    "pattern": "^El\\ modelo\\ local\\ de\\ (.+?)\\ no\\ supera\\ la\\ verificación\\ de\\ integridad\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-language-storage.js",
    "lineFirst": 259
  },
  {
    "key": "tools.text.100Value1PaginasVisualesValue2PaginasEditables",
    "source": "100% · ${renderedPages} páginas visuales · ${editablePages} páginas editables",
    "pattern": "^100%\\ ·\\ (.+?)\\ páginas\\ visuales\\ ·\\ (.+?)\\ páginas\\ editables$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 2026
  },
  {
    "key": "tools.text.100Value1Value2PaginasCompletadas",
    "source": "100% · ${resolved.pages.length}/${resolved.pages.length} páginas completadas",
    "pattern": "^100%\\ ·\\ (.+?)/(.+?)\\ páginas\\ completadas$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1635
  },
  {
    "key": "tools.text.riesgoOriginalValue1Value2100",
    "source": "Riesgo original: ${beforeRisk.level.toUpperCase()} (${beforeRisk.score}/100)",
    "pattern": "^Riesgo\\ original:\\ (.+?)\\ \\((.+?)/100\\)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/metadata-core.js",
    "lineFirst": 264
  },
  {
    "key": "tools.text.value1PaginaValue2Value3ReconstruccionEditable",
    "source": "${percent}% · página ${pageNumber}/${pages.length} · reconstrucción editable",
    "pattern": "^(.+?)%\\ ·\\ página\\ (.+?)/(.+?)\\ ·\\ reconstrucción\\ editable$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1955
  },
  {
    "key": "app.text.leyendoPdfValue1DeValue2Value3",
    "source": "Leyendo PDF ${fileIndex + 1} de ${selectedFiles.length} · ${item.file.name}",
    "pattern": "^Leyendo\\ PDF\\ (.+?)\\ de\\ (.+?)\\ ·\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 1667
  },
  {
    "key": "tools.text.riesgoResultadoValue1Value2100",
    "source": "Riesgo resultado: ${afterRisk.level.toUpperCase()} (${afterRisk.score}/100)",
    "pattern": "^Riesgo\\ resultado:\\ (.+?)\\ \\((.+?)/100\\)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/metadata-core.js",
    "lineFirst": 265
  },
  {
    "key": "tools.text.value1PaginasSeleccionadasMedianteElIntervaloEscrito",
    "source": "${parsed.pages.length} páginas seleccionadas mediante el intervalo escrito.",
    "pattern": "^(.+?)\\ páginas\\ seleccionadas\\ mediante\\ el\\ intervalo\\ escrito\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 605
  },
  {
    "key": "tools.text.value1PreservandoDisenoDeLaPaginaValue2Value3",
    "source": "${percent}% · preservando diseño de la página ${pageNumber}/${pages.length}",
    "pattern": "^(.+?)%\\ ·\\ preservando\\ diseño\\ de\\ la\\ página\\ (.+?)/(.+?)$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 2002
  },
  {
    "key": "tools.text.value1AnalizandoDisenoDeLaPaginaValue2Value3",
    "source": "${percent}% · analizando diseño de la página ${pageNumber}/${pages.length}",
    "pattern": "^(.+?)%\\ ·\\ analizando\\ diseño\\ de\\ la\\ página\\ (.+?)/(.+?)$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1924
  },
  {
    "key": "diagnostics.text.primeraTarjetaOrganizarValue1",
    "source": "Primera tarjeta Organizar: ${formatDuration(timings.firstOrganizeCardMs)}",
    "pattern": "^Primera\\ tarjeta\\ Organizar:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 676
  },
  {
    "key": "diagnostics.text.construccionMiniaturasValue1",
    "source": "Construcción miniaturas: ${formatDuration(timings.thumbnailListBuildMs)}",
    "pattern": "^Construcción\\ miniaturas:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 671
  },
  {
    "key": "languages.text.value1FormaParteDeLaAplicacionYNoPuedeDesinstalarse",
    "source": "${language.label} forma parte de la aplicación y no puede desinstalarse.",
    "pattern": "^(.+?)\\ forma\\ parte\\ de\\ la\\ aplicación\\ y\\ no\\ puede\\ desinstalarse\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-language-storage.js",
    "lineFirst": 273
  },
  {
    "key": "app.text.noSeAnadieronLosValue1ArchivosPorqueYaEstabanEnLaLista",
    "source": "No se añadieron los ${ignored} archivos porque ya estaban en la lista.",
    "pattern": "^No\\ se\\ añadieron\\ los\\ (.+?)\\ archivos\\ porque\\ ya\\ estaban\\ en\\ la\\ lista\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 710
  },
  {
    "key": "diagnostics.text.construccionOrganizarValue1",
    "source": "Construcción Organizar: ${formatDuration(timings.organizeGridBuildMs)}",
    "pattern": "^Construcción\\ Organizar:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 673
  },
  {
    "key": "languages.text.unsupportedLanguagePackageSchemaVersionValue1",
    "source": "Unsupported language package schema version: ${manifest.schemaVersion}",
    "pattern": "^Unsupported\\ language\\ package\\ schema\\ version:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/i18n/language-package-contract.js",
    "lineFirst": 83
  },
  {
    "key": "diagnostics.text.primeraPaginaVisibleValue1",
    "source": "Primera página visible: ${formatDuration(timings.firstVisiblePageMs)}",
    "pattern": "^Primera\\ página\\ visible:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 675
  },
  {
    "key": "languages.text.languageTagMismatchForValue1ExpectedValue2",
    "source": "Language tag mismatch for ${code}: expected ${supported.languageTag}.",
    "pattern": "^Language\\ tag\\ mismatch\\ for\\ (.+?):\\ expected\\ (.+?)\\.$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/i18n/language-package-contract.js",
    "lineFirst": 65
  },
  {
    "key": "viewer.text.modeloVerificadoIniciandoLaPruebaAisladaEnValue1",
    "source": "Modelo verificado. Iniciando la prueba aislada en ${language.label}…",
    "pattern": "^Modelo\\ verificado\\.\\ Iniciando\\ la\\ prueba\\ aislada\\ en\\ (.+?)…$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2407
  },
  {
    "key": "viewer.text.pruebaAisladaTerminadaEnValue1SinTextoUtilizable",
    "source": "Prueba aislada terminada en ${language.label}, sin texto utilizable.",
    "pattern": "^Prueba\\ aislada\\ terminada\\ en\\ (.+?),\\ sin\\ texto\\ utilizable\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2441
  },
  {
    "key": "languages.text.todaviaNoHayUnPaqueteOficialValidableParaValue1",
    "source": "Todavía no hay un paquete oficial validable para ${language.label}.",
    "pattern": "^Todavía\\ no\\ hay\\ un\\ paquete\\ oficial\\ validable\\ para\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-language-package.js",
    "lineFirst": 76
  },
  {
    "key": "tools.text.copiaGuardadaLocalmenteValue1",
    "source": "Copia guardada localmente: ${ String(chosen).split(/[\\\\/]/).pop() }",
    "pattern": "^Copia\\ guardada\\ localmente:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 2099
  },
  {
    "key": "viewer.text.noSePudoCargarElModeloBaseValue1IncluidoEnLaAplicacion",
    "source": "No se pudo cargar el modelo base ${code} incluido en la aplicación.",
    "pattern": "^No\\ se\\ pudo\\ cargar\\ el\\ modelo\\ base\\ (.+?)\\ incluido\\ en\\ la\\ aplicación\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2789
  },
  {
    "key": "tools.text.tiempoAgotadoAlInspeccionarLaPaginaValue1",
    "source": "Tiempo agotado al inspeccionar la página ${pageRecord.pageNumber}.",
    "pattern": "^Tiempo\\ agotado\\ al\\ inspeccionar\\ la\\ página\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1794
  },
  {
    "key": "tools.text.value1PrimeraPasadaValue2Value3",
    "source": "${percent}% · primera pasada ${completed}/${resolved.pages.length}",
    "pattern": "^(.+?)%\\ ·\\ primera\\ pasada\\ (.+?)/(.+?)$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1414
  },
  {
    "key": "tools.text.value1NNVistaPreviaRecortada",
    "source": "${preview.slice(0, previewLimit)}\\n\\n[… vista previa recortada …]",
    "pattern": "^(.+?)\\\\n\\\\n\\[…\\ vista\\ previa\\ recortada\\ …\\]$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1123
  },
  {
    "key": "viewer.text.cargandoElModeloLocalDeValue1EnElMotorAislado",
    "source": "Cargando el modelo local de ${languageLabel} en el motor aislado…",
    "pattern": "^Cargando\\ el\\ modelo\\ local\\ de\\ (.+?)\\ en\\ el\\ motor\\ aislado…$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2343
  },
  {
    "key": "viewer.text.seUsara1TareaResolvedReasonValue1",
    "source": "Se usará 1 tarea${resolved.reason ? `: ${resolved.reason}` : \".\"}",
    "pattern": "^Se\\ usará\\ 1\\ tarea\\$\\{resolved\\.reason\\ \\?\\ `:\\ (.+?)`\\ :\\ \"\\.\"\\}$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3302
  },
  {
    "key": "app.text.value1MovidoALaPosicionValue2",
    "source": "${draggedItem.file.name} movido a la posición ${finalIndex + 1}.",
    "pattern": "^(.+?)\\ movido\\ a\\ la\\ posición\\ (.+?)\\.$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 531
  },
  {
    "key": "languages.text.elModeloLocalDeValue1TieneUnTamanoInesperado",
    "source": "El modelo local de ${language.label} tiene un tamaño inesperado.",
    "pattern": "^El\\ modelo\\ local\\ de\\ (.+?)\\ tiene\\ un\\ tamaño\\ inesperado\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-language-storage.js",
    "lineFirst": 251
  },
  {
    "key": "tools.text.value1PaginasValue2",
    "source": "${pdf.numPages} páginas · ${formatBytes(sourceBytes.byteLength)}",
    "pattern": "^(.+?)\\ páginas\\ ·\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 578
  },
  {
    "key": "tools.text.value1PresetsPersonalizadosExportados",
    "source": "${state.customPresets.length} presets personalizados exportados.",
    "pattern": "^(.+?)\\ presets\\ personalizados\\ exportados\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/page-numbering.js",
    "lineFirst": 309
  },
  {
    "key": "app.text.arrastrarPaginaValue1DeValue2",
    "source": "Arrastrar página ${pageItem.pageNumber} de ${pageItem.fileName}",
    "pattern": "^Arrastrar\\ página\\ (.+?)\\ de\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 1128
  },
  {
    "key": "languages.text.laHuellaSha256DelPaqueteDeValue1NoCoincide",
    "source": "La huella SHA-256 del paquete de ${language.label} no coincide.",
    "pattern": "^La\\ huella\\ SHA\\-256\\ del\\ paquete\\ de\\ (.+?)\\ no\\ coincide\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-language-package.js",
    "lineFirst": 88
  },
  {
    "key": "tools.text.100Value1PaginasEditablesDisenoValue2",
    "source": "100% · ${pages.length} páginas editables · diseño ${layoutMode}",
    "pattern": "^100%\\ ·\\ (.+?)\\ páginas\\ editables\\ ·\\ diseño\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1910
  },
  {
    "key": "tools.text.copiaGuardadaPeroAlgunosCamposNecesitanRevisionValue1",
    "source": "Copia guardada, pero algunos campos necesitan revisión: ${path}",
    "pattern": "^Copia\\ guardada,\\ pero\\ algunos\\ campos\\ necesitan\\ revisión:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/metadata.js",
    "lineFirst": 375
  },
  {
    "key": "tools.text.disenoActualizadoInstantaneamenteEnValue1PaginasOcr",
    "source": "Diseño actualizado instantáneamente en ${ocrPages} páginas OCR.",
    "pattern": "^Diseño\\ actualizado\\ instantáneamente\\ en\\ (.+?)\\ páginas\\ OCR\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 2405
  },
  {
    "key": "viewer.text.desinstalarElModeloOcrDeValue1DeEsteEquipo",
    "source": "¿Desinstalar el modelo OCR de ${language.label} de este equipo?",
    "pattern": "^¿Desinstalar\\ el\\ modelo\\ OCR\\ de\\ (.+?)\\ de\\ este\\ equipo\\?$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2502
  },
  {
    "key": "diagnostics.text.pdfListoParaUsarValue1",
    "source": "PDF listo para usar: ${formatDuration(timings.pdfOpenReadyMs)}",
    "pattern": "^PDF\\ listo\\ para\\ usar:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 668
  },
  {
    "key": "diagnostics.text.primeraMiniaturaValue1",
    "source": "Primera miniatura: ${formatDuration(timings.firstThumbnailMs)}",
    "pattern": "^Primera\\ miniatura:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 674
  },
  {
    "key": "languages.text.elArchivoDebeTerminarEnValue1",
    "source": "El archivo debe terminar en ${OCR_LANGUAGE_PACKAGE_EXTENSION}.",
    "pattern": "^El\\ archivo\\ debe\\ terminar\\ en\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-language-package.js",
    "lineFirst": 27
  },
  {
    "key": "viewer.text.paginaValue1VistaDeUnaPaginaDentroDelModoDoble",
    "source": "Página ${pages[0]} · vista de una página dentro del modo doble",
    "pattern": "^Página\\ (.+?)\\ ·\\ vista\\ de\\ una\\ página\\ dentro\\ del\\ modo\\ doble$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 823
  },
  {
    "key": "tools.text.value1RevisionValue2Value3",
    "source": "${percent}% · revisión ${retryIndex + 1}/${retryQueue.length}",
    "pattern": "^(.+?)%\\ ·\\ revisión\\ (.+?)/(.+?)$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1583
  },
  {
    "key": "languages.text.elIdiomaOcrValue1NoEstaInstaladoEnEstaCompilacion",
    "source": "El idioma OCR ${code} no está instalado en esta compilación.",
    "pattern": "^El\\ idioma\\ OCR\\ (.+?)\\ no\\ está\\ instalado\\ en\\ esta\\ compilación\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-language-manager.js",
    "lineFirst": 41
  },
  {
    "key": "tools.text.100Value1PaginasRecuperadasDeCache",
    "source": "100% · ${resolved.pages.length} páginas recuperadas de caché",
    "pattern": "^100%\\ ·\\ (.+?)\\ páginas\\ recuperadas\\ de\\ caché$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1632
  },
  {
    "key": "viewer.text.picoJsValue1Mb",
    "source": "· pico JS ${formatBenchmarkNumber(peakHeap / 1048576, 1)} MB",
    "pattern": "^·\\ pico\\ JS\\ (.+?)\\ MB$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3739
  },
  {
    "key": "viewer.text.value1DeValue2Paginas",
    "source": "${state.search.processedPages} de ${state.pageCount} páginas",
    "pattern": "^(.+?)\\ de\\ (.+?)\\ páginas$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 1610
  },
  {
    "key": "app.text.paginaEnBlancoAnadidaEnLaPosicionValue1",
    "source": "Página en blanco añadida en la posición ${insertIndex + 1}.",
    "pattern": "^Página\\ en\\ blanco\\ añadida\\ en\\ la\\ posición\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 988
  },
  {
    "key": "app.text.value1AnadidosValue2OmitidosPorEstarRepetidos",
    "source": "${added} añadidos. ${ignored} omitidos por estar repetidos.",
    "pattern": "^(.+?)\\ añadidos\\.\\ (.+?)\\ omitidos\\ por\\ estar\\ repetidos\\.$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 702
  },
  {
    "key": "diagnostics.text.limiteDeHeapValue1",
    "source": "Límite de heap: ${formatBytes(run.memory.jsHeapLimitBytes)}",
    "pattern": "^Límite\\ de\\ heap:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 689
  },
  {
    "key": "viewer.text.mostrandoPaginasValue1Value2",
    "source": "Mostrando páginas ${entries[0].page}-${entries.at(-1).page}",
    "pattern": "^Mostrando\\ páginas\\ (.+?)\\-(.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 755
  },
  {
    "key": "languages.text.localeMismatchForValue1ExpectedValue2",
    "source": "Locale mismatch for ${code}: expected ${supported.locale}.",
    "pattern": "^Locale\\ mismatch\\ for\\ (.+?):\\ expected\\ (.+?)\\.$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/i18n/language-package-contract.js",
    "lineFirst": 71
  },
  {
    "key": "viewer.text.elModeloLocalDeValue1YaNoEstaInstalado",
    "source": "El modelo local de ${language.label} ya no está instalado.",
    "pattern": "^El\\ modelo\\ local\\ de\\ (.+?)\\ ya\\ no\\ está\\ instalado\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2388
  },
  {
    "key": "diagnostics.text.guardarInformeDeDiagnosticoValue1",
    "source": "Guardar informe de diagnóstico ${extension.toUpperCase()}",
    "pattern": "^Guardar\\ informe\\ de\\ diagnóstico\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 749
  },
  {
    "key": "diagnostics.text.lecturaDelArchivoValue1",
    "source": "Lectura del archivo: ${formatDuration(timings.pdfReadMs)}",
    "pattern": "^Lectura\\ del\\ archivo:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 669
  },
  {
    "key": "languages.text.value1Value2MustBeAStringOrANestedPlainObject",
    "source": "${path}.${key} must be a string or a nested plain object.",
    "pattern": "^(.+?)\\.(.+?)\\ must\\ be\\ a\\ string\\ or\\ a\\ nested\\ plain\\ object\\.$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/i18n/language-package-contract.js",
    "lineFirst": 49
  },
  {
    "key": "tools.text.noSePudoPrepararElLienzoDeLaPaginaValue1",
    "source": "No se pudo preparar el lienzo de la página ${pageNumber}.",
    "pattern": "^No\\ se\\ pudo\\ preparar\\ el\\ lienzo\\ de\\ la\\ página\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1826
  },
  {
    "key": "viewer.text.laPaginaValue1EstaFueraDelDocumento1Value2",
    "source": "La página ${page} está fuera del documento (1-${total}).",
    "pattern": "^La\\ página\\ (.+?)\\ está\\ fuera\\ del\\ documento\\ \\(1\\-(.+?)\\)\\.$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/viewer-core.js",
    "lineFirst": 39
  },
  {
    "key": "viewer.text.noSeReconoceValue1UsaFormatosComo15812",
    "source": "No se reconoce «${token}». Usa formatos como 1-5, 8, 12.",
    "pattern": "^No\\ se\\ reconoce\\ «(.+?)»\\.\\ Usa\\ formatos\\ como\\ 1\\-5,\\ 8,\\ 12\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer-core.js",
    "lineFirst": 34
  },
  {
    "key": "diagnostics.text.heapInicialValue1",
    "source": "Heap inicial: ${formatBytes(run.memory.firstUsedBytes)}",
    "pattern": "^Heap\\ inicial:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 686
  },
  {
    "key": "tools.text.generandoMiniaturaValue1DeValue2",
    "source": "Generando miniatura ${pageNumber} de ${state.pageCount}",
    "pattern": "^Generando\\ miniatura\\ (.+?)\\ de\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 467
  },
  {
    "key": "tools.text.noSePudoAbrirElModeloOcrLocalValue1",
    "source": "No se pudo abrir el modelo OCR local ${language.label}.",
    "pattern": "^No\\ se\\ pudo\\ abrir\\ el\\ modelo\\ OCR\\ local\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 270
  },
  {
    "key": "viewer.text.elRangoValue1EstaFueraDeLasPaginas1Value2",
    "source": "El rango ${token} está fuera de las páginas 1-${total}.",
    "pattern": "^El\\ rango\\ (.+?)\\ está\\ fuera\\ de\\ las\\ páginas\\ 1\\-(.+?)\\.$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/viewer-core.js",
    "lineFirst": 26
  },
  {
    "key": "viewer.text.paginaValue1Value2DeValue3",
    "source": "Página ${pageNumber} · ${completed + 1} de ${pageTotal}",
    "pattern": "^Página\\ (.+?)\\ ·\\ (.+?)\\ de\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3235
  },
  {
    "key": "diagnostics.text.picoDeHeapValue1",
    "source": "Pico de heap: ${formatBytes(run.memory.peakUsedBytes)}",
    "pattern": "^Pico\\ de\\ heap:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 688
  },
  {
    "key": "app.text.paginaValue1DeValue2",
    "source": "Página ${pageItem.pageNumber} de ${pageItem.fileName}",
    "pattern": "^Página\\ (.+?)\\ de\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 1168
  },
  {
    "key": "tools.text.tiempoAgotadoAlRenderizarLaPaginaValue1",
    "source": "Tiempo agotado al renderizar la página ${pageNumber}.",
    "pattern": "^Tiempo\\ agotado\\ al\\ renderizar\\ la\\ página\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1843
  },
  {
    "key": "diagnostics.text.cargaPdfJsValue1",
    "source": "Carga PDF.js: ${formatDuration(timings.pdfJsLoadMs)}",
    "pattern": "^Carga\\ PDF\\.js:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 670
  },
  {
    "key": "diagnostics.text.erroresTotalesRegistradosValue1",
    "source": "Errores totales registrados: ${report.errors.length}",
    "pattern": "^Errores\\ totales\\ registrados:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 727
  },
  {
    "key": "languages.text.value1YaEstaIncluidoEnLaAplicacion",
    "source": "${language.label} ya está incluido en la aplicación.",
    "pattern": "^(.+?)\\ ya\\ está\\ incluido\\ en\\ la\\ aplicación\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-language-package.js",
    "lineFirst": 73
  },
  {
    "key": "tools.text.creandoArchivoValue1DeValue2",
    "source": "Creando archivo ${index + 1} de ${state.plan.length}",
    "pattern": "^Creando\\ archivo\\ (.+?)\\ de\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 1108
  },
  {
    "key": "tools.text.presetValue1GuardadoUnicamenteEnEsteEquipo",
    "source": "Preset “${name}” guardado únicamente en este equipo.",
    "pattern": "^Preset\\ “(.+?)”\\ guardado\\ únicamente\\ en\\ este\\ equipo\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/watermark.js",
    "lineFirst": 500
  },
  {
    "key": "tools.text.tiempoAgotadoAlCodificarLaPaginaValue1",
    "source": "Tiempo agotado al codificar la página ${pageNumber}.",
    "pattern": "^Tiempo\\ agotado\\ al\\ codificar\\ la\\ página\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1858
  },
  {
    "key": "tools.text.value1CorrectamenteEnValue2Paginas",
    "source": "${label} correctamente en ${result.applied} páginas.",
    "pattern": "^(.+?)\\ correctamente\\ en\\ (.+?)\\ páginas\\.$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/watermark.js",
    "lineFirst": 1217
  },
  {
    "key": "tools.text.value1PresetsImportadosCorrectamente",
    "source": "${imported.length} presets importados correctamente.",
    "pattern": "^(.+?)\\ presets\\ importados\\ correctamente\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/page-numbering.js",
    "lineFirst": 322
  },
  {
    "key": "languages.text.unsupportedLanguagePackageKindValue1",
    "source": "Unsupported language package kind: ${manifest.kind}",
    "pattern": "^Unsupported\\ language\\ package\\ kind:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/i18n/language-package-contract.js",
    "lineFirst": 88
  },
  {
    "key": "tools.text.tamanoResultadoValue1Bytes",
    "source": "Tamaño resultado: ${Number(outputBytes || 0)} bytes",
    "pattern": "^Tamaño\\ resultado:\\ (.+?)\\ bytes$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/metadata-core.js",
    "lineFirst": 262
  },
  {
    "key": "tools.text.value1NoEstaInstaladoEnEsteEquipo",
    "source": "${language.label} no está instalado en este equipo.",
    "pattern": "^(.+?)\\ no\\ está\\ instalado\\ en\\ este\\ equipo\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 300
  },
  {
    "key": "viewer.text.elegidaPaginaValue1DeValue2",
    "source": "Elegida: página ${targetPage} de ${state.pageCount}",
    "pattern": "^Elegida:\\ página\\ (.+?)\\ de\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2608
  },
  {
    "key": "viewer.text.fueraDelDocumentoValue1MaximoValue2",
    "source": "Fuera del documento: ${token} (máximo ${pageCount})",
    "pattern": "^Fuera\\ del\\ documento:\\ (.+?)\\ \\(máximo\\ (.+?)\\)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3064
  },
  {
    "key": "viewer.text.organizarPaginasValue1Value2",
    "source": "Organizar páginas · ${pageLabel} · ${selectedLabel}",
    "pattern": "^Organizar\\ páginas\\ ·\\ (.+?)\\ ·\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 615
  },
  {
    "key": "tools.text.copiaGuardadaYVerificadaCorrectamenteValue1",
    "source": "Copia guardada y verificada correctamente: ${path}",
    "pattern": "^Copia\\ guardada\\ y\\ verificada\\ correctamente:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/metadata.js",
    "lineFirst": 374
  },
  {
    "key": "diagnostics.text.muestrasDeMemoriaValue1",
    "source": "Muestras de memoria: ${run.memory.samples.length}",
    "pattern": "^Muestras\\ de\\ memoria:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 690
  },
  {
    "key": "diagnostics.text.pruebasDeDocumentosValue1",
    "source": "PRUEBAS DE DOCUMENTOS: ${report.documents.length}",
    "pattern": "^PRUEBAS\\ DE\\ DOCUMENTOS:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 719
  },
  {
    "key": "viewer.text.paginasValue1Value2VistaDoble",
    "source": "Páginas ${pages[0]}-${pages.at(-1)} · vista doble",
    "pattern": "^Páginas\\ (.+?)\\-(.+?)\\ ·\\ vista\\ doble$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 824
  },
  {
    "key": "tools.text.tiempoAgotadoAlAbrirLaPaginaValue1",
    "source": "Tiempo agotado al abrir la página ${pageNumber}.",
    "pattern": "^Tiempo\\ agotado\\ al\\ abrir\\ la\\ página\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1931
  },
  {
    "key": "viewer.text.eliminarTodoElOcrValue1",
    "source": "Eliminar todo el OCR (${state.ocr.records.size})",
    "pattern": "^Eliminar\\ todo\\ el\\ OCR\\ \\((.+?)\\)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2923
  },
  {
    "key": "app.text.organizarYEditarPaginasValue1",
    "source": "Organizar y editar páginas · ${pagePlan.length}",
    "pattern": "^Organizar\\ y\\ editar\\ páginas\\ ·\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 1069
  },
  {
    "key": "languages.text.elIdiomaOcrValue1NoExisteEnElCatalogo",
    "source": "El idioma OCR ${code} no existe en el catálogo.",
    "pattern": "^El\\ idioma\\ OCR\\ (.+?)\\ no\\ existe\\ en\\ el\\ catálogo\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-language-manager.js",
    "lineFirst": 42
  },
  {
    "key": "tools.text.escribeUnNumeroEntre1YValue1",
    "source": "Escribe un número entre 1 y ${state.pageCount}.",
    "pattern": "^Escribe\\ un\\ número\\ entre\\ 1\\ y\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 611
  },
  {
    "key": "tools.text.value1PaginasValue2.variant2",
    "source": "${finalName} · páginas ${summarizePages(group)}",
    "pattern": "^(.+?)\\ ·\\ páginas\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 1109
  },
  {
    "key": "viewer.text.estimadoValue1",
    "source": "· estimado ${formatOcrBatchDuration(remaining)}",
    "pattern": "^·\\ estimado\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3231
  },
  {
    "key": "tools.text.value1PaginasConRespaldoTextual",
    "source": "· ${omittedPages} páginas con respaldo textual",
    "pattern": "^·\\ (.+?)\\ páginas\\ con\\ respaldo\\ textual$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 2027
  },
  {
    "key": "tools.text.value1PreparandoPaginas",
    "source": "${formatBytes(file.size)} · preparando páginas",
    "pattern": "^(.+?)\\ ·\\ preparando\\ páginas$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 441
  },
  {
    "key": "tools.text.value1VaciasOmitidas",
    "source": "${state.adaptive.blankSkipped} vacías omitidas",
    "pattern": "^(.+?)\\ vacías\\ omitidas$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1644
  },
  {
    "key": "viewer.text.value1DeConfianzaAproximada",
    "source": "${Math.round(value)} % de confianza aproximada",
    "pattern": "^(.+?)\\ %\\ de\\ confianza\\ aproximada$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2578
  },
  {
    "key": "languages.text.unsupportedPdfprivadoLanguageCodeValue1",
    "source": "Unsupported PDFPrivado language code: ${code}",
    "pattern": "^Unsupported\\ PDFPrivado\\ language\\ code:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/i18n/language-core.js",
    "lineFirst": 110
  },
  {
    "key": "tools.text.hayRangosOCortesInvalidosValue1",
    "source": "Hay rangos o cortes inválidos (${errorText}).",
    "pattern": "^Hay\\ rangos\\ o\\ cortes\\ inválidos\\ \\((.+?)\\)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 718
  },
  {
    "key": "tools.text.paginaValue1PulsaParaSeleccionar",
    "source": "Página ${pageNumber}. Pulsa para seleccionar.",
    "pattern": "^Página\\ (.+?)\\.\\ Pulsa\\ para\\ seleccionar\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 371
  },
  {
    "key": "viewer.text.value1IdiomasCatalogados",
    "source": "${OCR_LANGUAGES.length} idiomas catalogados ·",
    "pattern": "^(.+?)\\ idiomas\\ catalogados\\ ·$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2698
  },
  {
    "key": "viewer.text.value1PaqueteOfflinePendiente",
    "source": "${language.label} · paquete offline pendiente",
    "pattern": "^(.+?)\\ ·\\ paquete\\ offline\\ pendiente$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2654
  },
  {
    "key": "viewer.text.value1PruebaAisladaCompletada",
    "source": "${language.label} · prueba aislada completada",
    "pattern": "^(.+?)\\ ·\\ prueba\\ aislada\\ completada$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2427
  },
  {
    "key": "diagnostics.text.erroresDeEstaPruebaValue1",
    "source": "ERRORES DE ESTA PRUEBA: ${run.errors.length}",
    "pattern": "^ERRORES\\ DE\\ ESTA\\ PRUEBA:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 698
  },
  {
    "key": "diagnostics.text.eventosConservadosValue1",
    "source": "Eventos conservados: ${report.events.length}",
    "pattern": "^Eventos\\ conservados:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 728
  },
  {
    "key": "tools.text.elRangoValue1QuedaFueraDe1Value2",
    "source": "El rango ${token} queda fuera de 1-${total}.",
    "pattern": "^El\\ rango\\ (.+?)\\ queda\\ fuera\\ de\\ 1\\-(.+?)\\.$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/convert-export-core.js",
    "lineFirst": 38
  },
  {
    "key": "tools.text.laPaginaValue1QuedaFueraDe1Value2",
    "source": "La página ${page} queda fuera de 1-${total}.",
    "pattern": "^La\\ página\\ (.+?)\\ queda\\ fuera\\ de\\ 1\\-(.+?)\\.$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/convert-export-core.js",
    "lineFirst": 49
  },
  {
    "key": "viewer.text.eliminarOcrDelAlcanceValue1",
    "source": "Eliminar OCR del alcance (${recordsInScope})",
    "pattern": "^Eliminar\\ OCR\\ del\\ alcance\\ \\((.+?)\\)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2918
  },
  {
    "key": "viewer.text.preparandoOcrEnValue1",
    "source": "Preparando OCR en ${languageSelection.label}",
    "pattern": "^Preparando\\ OCR\\ en\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3348
  },
  {
    "key": "tools.text.presetGuardadoLocalmenteValue1",
    "source": "Preset guardado localmente: ${preset.name}.",
    "pattern": "^Preset\\ guardado\\ localmente:\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/page-numbering.js",
    "lineFirst": 268
  },
  {
    "key": "tools.text.value1Revisadas",
    "source": "${state.adaptive.balancedRetried} revisadas",
    "pattern": "^(.+?)\\ revisadas$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1643
  },
  {
    "key": "viewer.text.value1InstaladosEnEsteEquipo",
    "source": "${installed.size} instalados en este equipo",
    "pattern": "^(.+?)\\ instalados\\ en\\ este\\ equipo$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2699
  },
  {
    "key": "diagnostics.text.plataformaValue1",
    "source": "Plataforma: ${report.environment.platform}",
    "pattern": "^Plataforma:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 712
  },
  {
    "key": "languages.text.unsupportedCatalogLanguageCodeValue1",
    "source": "Unsupported catalog language code: ${code}",
    "pattern": "^Unsupported\\ catalog\\ language\\ code:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/i18n/language-catalog-client.js",
    "lineFirst": 43
  },
  {
    "key": "ocr.text.rotacionOcrNoCompatibleValue1",
    "source": "Rotación OCR no compatible: ${rotation}°.",
    "pattern": "^Rotación\\ OCR\\ no\\ compatible:\\ (.+?)°\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-searchable-pdf.js",
    "lineFirst": 54
  },
  {
    "key": "viewer.text.value1InstaladoLocalmente",
    "source": "${installed.label} · instalado localmente",
    "pattern": "^(.+?)\\ ·\\ instalado\\ localmente$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2295
  },
  {
    "key": "viewer.text.value1PaqueteValido",
    "source": "${result.language.label} · paquete válido",
    "pattern": "^(.+?)\\ ·\\ paquete\\ válido$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2236
  },
  {
    "key": "ocr.text.faltanLosBytesDelModeloOcrValue1",
    "source": "Faltan los bytes del modelo OCR ${code}.",
    "pattern": "^Faltan\\ los\\ bytes\\ del\\ modelo\\ OCR\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-external-runtime.js",
    "lineFirst": 89
  },
  {
    "key": "tools.text.presetAplicadoAlLoteValue1",
    "source": "Preset aplicado al lote: ${preset.name}.",
    "pattern": "^Preset\\ aplicado\\ al\\ lote:\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/page-numbering.js",
    "lineFirst": 480
  },
  {
    "key": "ocr.text.codigoDeIdiomaOcrNoValidoValue1",
    "source": "Código de idioma OCR no válido: ${code}",
    "pattern": "^Código\\ de\\ idioma\\ OCR\\ no\\ válido:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/ocr-worker.js",
    "lineFirst": 29
  },
  {
    "key": "tools.text.eliminarElPresetValue1",
    "source": "¿Eliminar el preset “${existing.name}”?",
    "pattern": "^¿Eliminar\\ el\\ preset\\ “(.+?)”\\?$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/watermark.js",
    "lineFirst": 525
  },
  {
    "key": "viewer.text.idiomasPreparadosValue1",
    "source": "Idiomas preparados: ${selection.label}.",
    "pattern": "^Idiomas\\ preparados:\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2772
  },
  {
    "key": "viewer.text.value1NoEstabaInstalado",
    "source": "${language.label} · no estaba instalado",
    "pattern": "^(.+?)\\ ·\\ no\\ estaba\\ instalado$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2521
  },
  {
    "key": "app.text.value1RechazadosPorNoSerPdf",
    "source": "${rejected} rechazados por no ser PDF.",
    "pattern": "^(.+?)\\ rechazados\\ por\\ no\\ ser\\ PDF\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 703
  },
  {
    "key": "languages.text.catalogIdentityMismatchForValue1",
    "source": "Catalog identity mismatch for ${code}.",
    "pattern": "^Catalog\\ identity\\ mismatch\\ for\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/i18n/language-catalog-client.js",
    "lineFirst": 54
  },
  {
    "key": "tools.text.ocrAdaptativoCompletadoValue1",
    "source": "OCR adaptativo completado: ${details}.",
    "pattern": "^OCR\\ adaptativo\\ completado:\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1651
  },
  {
    "key": "tools.text.presetValue1Actualizado",
    "source": "Preset “${existing.name}” actualizado.",
    "pattern": "^Preset\\ “(.+?)”\\ actualizado\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/watermark.js",
    "lineFirst": 516
  },
  {
    "key": "tools.text.value1OcrPaginaValue2",
    "source": "${overall}% · OCR página ${pageNumber}",
    "pattern": "^(.+?)%\\ ·\\ OCR\\ página\\ (.+?)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1040
  },
  {
    "key": "tools.text.value1Rapidas",
    "source": "${state.adaptive.fastAccepted} rápidas",
    "pattern": "^(.+?)\\ rápidas$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1642
  },
  {
    "key": "viewer.text.value1PruebaNoIniciada",
    "source": "${language.label} · prueba no iniciada",
    "pattern": "^(.+?)\\ ·\\ prueba\\ no\\ iniciada$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2358
  },
  {
    "key": "diagnostics.text.inicioDeSesionValue1",
    "source": "Inicio de sesión: ${report.startedAt}",
    "pattern": "^Inicio\\ de\\ sesión:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 707
  },
  {
    "key": "tools.text.fechaValue1",
    "source": "Fecha: ${new Date().toLocaleString()}",
    "pattern": "^Fecha:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/metadata-core.js",
    "lineFirst": 260
  },
  {
    "key": "viewer.text.preparandoLaBusquedaDeValue1",
    "source": "Preparando la búsqueda de “${query}”…",
    "pattern": "^Preparando\\ la\\ búsqueda\\ de\\ “(.+?)”…$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 1932
  },
  {
    "key": "languages.text.invalidSemanticVersionValue1",
    "source": "Invalid semantic version: ${version}",
    "pattern": "^Invalid\\ semantic\\ version:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/i18n/language-package-contract.js",
    "lineFirst": 104
  },
  {
    "key": "tools.text.miniaturaDeLaPaginaValue1",
    "source": "Miniatura de la página ${pageNumber}",
    "pattern": "^Miniatura\\ de\\ la\\ página\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 393
  },
  {
    "key": "viewer.text.usarPaginaVisibleValue1",
    "source": "Usar página visible (${visiblePage})",
    "pattern": "^Usar\\ página\\ visible\\ \\((.+?)\\)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2882
  },
  {
    "key": "languages.text.value1MustBeANonEmptyString",
    "source": "${name} must be a non-empty string.",
    "pattern": "^(.+?)\\ must\\ be\\ a\\ non\\-empty\\ string\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/i18n/language-package-contract.js",
    "lineFirst": 23
  },
  {
    "key": "tools.text.presetActualizadoValue1",
    "source": "Preset actualizado: ${preset.name}.",
    "pattern": "^Preset\\ actualizado:\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/page-numbering.js",
    "lineFirst": 283
  },
  {
    "key": "viewer.text.mostrandoPaginaValue1",
    "source": "Mostrando página ${entries[0].page}",
    "pattern": "^Mostrando\\ página\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 755
  },
  {
    "key": "viewer.text.value1PruebaFallida",
    "source": "${language.label} · prueba fallida",
    "pattern": "^(.+?)\\ ·\\ prueba\\ fallida$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2466
  },
  {
    "key": "diagnostics.text.origenDeAperturaValue1",
    "source": "Origen de apertura: ${run.source}",
    "pattern": "^Origen\\ de\\ apertura:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 660
  },
  {
    "key": "tools.text.presetEliminadoValue1",
    "source": "Preset eliminado: ${preset.name}.",
    "pattern": "^Preset\\ eliminado:\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/page-numbering.js",
    "lineFirst": 297
  },
  {
    "key": "tools.text.presetValue1Aplicado",
    "source": "Preset “${record.name}” aplicado.",
    "pattern": "^Preset\\ “(.+?)”\\ aplicado\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/watermark.js",
    "lineFirst": 1361
  },
  {
    "key": "diagnostics.text.finDeSesionValue1",
    "source": "Fin de sesión: ${report.endedAt}",
    "pattern": "^Fin\\ de\\ sesión:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 708
  },
  {
    "key": "tools.text.elIdiomaOcrValue1NoExiste",
    "source": "El idioma OCR ${code} no existe.",
    "pattern": "^El\\ idioma\\ OCR\\ (.+?)\\ no\\ existe\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 287
  },
  {
    "key": "tools.text.presetAplicadoValue1",
    "source": "Preset aplicado: ${preset.name}.",
    "pattern": "^Preset\\ aplicado:\\ (.+?)\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/page-numbering.js",
    "lineFirst": 253
  },
  {
    "key": "viewer.text.paginaValue1ElegidaParaOcr",
    "source": "Página ${page} elegida para OCR.",
    "pattern": "^Página\\ (.+?)\\ elegida\\ para\\ OCR\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2013
  },
  {
    "key": "viewer.text.value1Desinstalado",
    "source": "${language.label} · desinstalado",
    "pattern": "^(.+?)\\ ·\\ desinstalado$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2521
  },
  {
    "key": "languages.text.value1MustBeAPlainObject",
    "source": "${path} must be a plain object.",
    "pattern": "^(.+?)\\ must\\ be\\ a\\ plain\\ object\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/i18n/language-package-contract.js",
    "lineFirst": 31
  },
  {
    "key": "viewer.text.idiomaOcrDesconocidoValue1",
    "source": "Idioma OCR desconocido: ${code}",
    "pattern": "^Idioma\\ OCR\\ desconocido:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 2805
  },
  {
    "key": "viewer.text.value1DeValue2Value3",
    "source": "${current} de ${count}${suffix}",
    "pattern": "^(.+?)\\ de\\ (.+?)(.+?)$",
    "valueNames": [
      "value1",
      "value2",
      "value3"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 1416
  },
  {
    "key": "viewer.text.value1PaginasGiradas",
    "source": "${pages.length} páginas giradas",
    "pattern": "^(.+?)\\ páginas\\ giradas$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 8475
  },
  {
    "key": "languages.text.value1ContainsAnEmptyKey",
    "source": "${path} contains an empty key.",
    "pattern": "^(.+?)\\ contains\\ an\\ empty\\ key\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/i18n/language-package-contract.js",
    "lineFirst": 36
  },
  {
    "key": "tools.text.value1DesdeCache",
    "source": "${state.cacheHits} desde caché",
    "pattern": "^(.+?)\\ desde\\ caché$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1646
  },
  {
    "key": "tools.text.quitarResultadoValue1",
    "source": "Quitar resultado ${index + 1}",
    "pattern": "^Quitar\\ resultado\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 705
  },
  {
    "key": "tools.text.ampliarPaginaValue1",
    "source": "Ampliar página ${pageNumber}",
    "pattern": "^Ampliar\\ página\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/split.js",
    "lineFirst": 381
  },
  {
    "key": "tools.text.ej1358Value1",
    "source": "Ej.: 1-3,5,8-${pdf.numPages}",
    "pattern": "^Ej\\.:\\ 1\\-3,5,8\\-(.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 580
  },
  {
    "key": "app.text.pagValue1",
    "source": "Pág. ${pageItem.pageNumber}",
    "pattern": "^Pág\\.\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 1178
  },
  {
    "key": "app.text.translateValue1PxValue2Px",
    "source": "translate(${dx}px, ${dy}px)",
    "pattern": "^translate\\((.+?)px,\\ (.+?)px\\)$",
    "valueNames": [
      "value1",
      "value2"
    ],
    "fileFirst": "src/main.js",
    "lineFirst": 1414
  },
  {
    "key": "tools.text.textoPdfEditableValue1",
    "source": "Texto PDF editable ${order}",
    "pattern": "^Texto\\ PDF\\ editable\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export-formats.js",
    "lineFirst": 2590
  },
  {
    "key": "viewer.text.formatoNoValidoValue1",
    "source": "Formato no válido: ${token}",
    "pattern": "^Formato\\ no\\ válido:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3043
  },
  {
    "key": "tools.text.noSeReconoceValue1",
    "source": "No se reconoce \"${token}\".",
    "pattern": "^No\\ se\\ reconoce\\ \"(.+?)\"\\.$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export-core.js",
    "lineFirst": 56
  },
  {
    "key": "tools.text.paginaValue1",
    "source": "Página ${variables.numero}",
    "pattern": "^Página\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/page-numbering-core.js",
    "lineFirst": 125
  },
  {
    "key": "viewer.text.paginaNoValidaValue1",
    "source": "Página no válida: ${token}",
    "pattern": "^Página\\ no\\ válida:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3056
  },
  {
    "key": "tools.text.informeGuardadoValue1",
    "source": "Informe guardado: ${path}",
    "pattern": "^Informe\\ guardado:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/metadata.js",
    "lineFirst": 397
  },
  {
    "key": "tools.text.value1Reutilizadas",
    "source": "${reusedOcr} reutilizadas",
    "pattern": "^(.+?)\\ reutilizadas$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/convert-export.js",
    "lineFirst": 1645
  },
  {
    "key": "viewer.text.value1Seleccionadas",
    "source": "${selected} seleccionadas",
    "pattern": "^(.+?)\\ seleccionadas$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 614
  },
  {
    "key": "diagnostics.text.inicioValue1",
    "source": "Inicio: ${run.startedAt}",
    "pattern": "^Inicio:\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/diagnostics.js",
    "lineFirst": 658
  },
  {
    "key": "tools.text.alternarPaginaValue1",
    "source": "Alternar página ${page}",
    "pattern": "^Alternar\\ página\\ (.+?)$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/watermark.js",
    "lineFirst": 621
  },
  {
    "key": "viewer.text.value1Correctas",
    "source": "${completed} correctas",
    "pattern": "^(.+?)\\ correctas$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3168
  },
  {
    "key": "viewer.text.value1Pendientes",
    "source": "${pending} pendientes",
    "pattern": "^(.+?)\\ pendientes$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3174
  },
  {
    "key": "viewer.text.value1Omitidas",
    "source": "${skipped} omitidas",
    "pattern": "^(.+?)\\ omitidas$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3169
  },
  {
    "key": "viewer.text.value1Fallidas",
    "source": "${failed} fallidas",
    "pattern": "^(.+?)\\ fallidas$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 3170
  },
  {
    "key": "viewer.text.value1Paginas",
    "source": "${pages} páginas",
    "pattern": "^(.+?)\\ páginas$",
    "valueNames": [
      "value1"
    ],
    "fileFirst": "src/viewer.js",
    "lineFirst": 613
  }
]);
