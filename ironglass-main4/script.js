window.addEventListener("load", () => {
  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 100);
});

// Efeito: as letras do título e subtítulo ficam mais "gordas"
// (peso da fonte) conforme o cursor se aproxima delas.
document.addEventListener("DOMContentLoaded", () => {
  if (typeof initVariableFontProximity === "function") {
    initVariableFontProximity("#servico-titulo", {
      fromWeight: 400,
      toWeight: 800,
      strength: 30,
      duration: 0.3,
    });

    initVariableFontProximity("#servico-subtitulo", {
      fromWeight: 400,
      toWeight: 800,
      strength: 30,
      duration: 0.3,
    });
  }
});
