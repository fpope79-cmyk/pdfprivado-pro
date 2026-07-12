export const OCR_LANGUAGE_LIMITS = Object.freeze({
  maximumSelectedLanguages: 2,
  minimumCatalogLanguages: 15,
});

function language(definition) {
  return Object.freeze({
    direction: "ltr",
    installed: false,
    modelBytes: null,
    packageGroup: "future",
    recommendedWith: Object.freeze(["eng"]),
    ...definition,
    recommendedWith: Object.freeze([...(definition.recommendedWith || ["eng"])]),
  });
}

export const OCR_LANGUAGE_MANIFEST = Object.freeze([
  language({
    code: "spa",
    label: "Español",
    nativeName: "Español",
    file: "spa.traineddata.gz",
    script: "Latin",
    region: "Europe",
    installed: true,
    modelBytes: 2_100_190,
    packageGroup: "core",
    recommendedWith: ["eng"],
  }),
  language({
    code: "eng",
    label: "Inglés",
    nativeName: "English",
    file: "eng.traineddata.gz",
    script: "Latin",
    region: "Global",
    installed: true,
    modelBytes: 2_952_873,
    packageGroup: "core",
    recommendedWith: ["spa", "fra", "deu"],
  }),
  language({ code: "fra", label: "Francés", nativeName: "Français", file: "fra.traineddata.gz", script: "Latin", region: "Europe" }),
  language({ code: "deu", label: "Alemán", nativeName: "Deutsch", file: "deu.traineddata.gz", script: "Latin", region: "Europe" }),
  language({ code: "ita", label: "Italiano", nativeName: "Italiano", file: "ita.traineddata.gz", script: "Latin", region: "Europe" }),
  language({ code: "por", label: "Portugués", nativeName: "Português", file: "por.traineddata.gz", script: "Latin", region: "Europe" }),
  language({ code: "nld", label: "Neerlandés", nativeName: "Nederlands", file: "nld.traineddata.gz", script: "Latin", region: "Europe" }),
  language({ code: "pol", label: "Polaco", nativeName: "Polski", file: "pol.traineddata.gz", script: "Latin", region: "Europe" }),
  language({ code: "ron", label: "Rumano", nativeName: "Română", file: "ron.traineddata.gz", script: "Latin", region: "Europe" }),
  language({ code: "tur", label: "Turco", nativeName: "Türkçe", file: "tur.traineddata.gz", script: "Latin", region: "Europe" }),
  language({ code: "rus", label: "Ruso", nativeName: "Русский", file: "rus.traineddata.gz", script: "Cyrillic", region: "Europe" }),
  language({ code: "ukr", label: "Ucraniano", nativeName: "Українська", file: "ukr.traineddata.gz", script: "Cyrillic", region: "Europe" }),
  language({ code: "ara", label: "Árabe", nativeName: "العربية", file: "ara.traineddata.gz", script: "Arabic", region: "Middle East", direction: "rtl" }),
  language({ code: "chi_sim", label: "Chino simplificado", nativeName: "简体中文", file: "chi_sim.traineddata.gz", script: "Han", region: "Asia", recommendedWith: ["eng"] }),
  language({ code: "jpn", label: "Japonés", nativeName: "日本語", file: "jpn.traineddata.gz", script: "Japanese", region: "Asia", recommendedWith: ["eng"] }),
]);

export const OCR_LANGUAGE_MAP = new Map(
  OCR_LANGUAGE_MANIFEST.map((entry) => [entry.code, entry])
);
