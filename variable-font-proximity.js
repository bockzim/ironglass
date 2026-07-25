/**
 * Variable Font Cursor Proximity — versão JS puro (adaptada do componente
 * original em React/Framer Motion).
 *
 * O texto de um elemento é quebrado em letras individuais (dentro de spans
 * por palavra, pra não quebrar palavra no meio da linha). A cada frame,
 * medimos a distância de cada letra até o cursor e interpolamos o eixo
 * `wght` (peso) da fonte variável entre `fromWeight` (repouso) e
 * `toWeight` (no cursor), com suavização baseada em `duration`.
 *
 * Requer uma fonte VARIÁVEL carregada (ver @font-face em
 * variable-font-proximity.css) — em fontes estáticas o wght não muda.
 */
(function () {
  "use strict";

  // Alcance máximo (px) da proximidade quando strength = 100.
  const MAX_REACH = 800;

  function wrapLettersPreservingWords(el) {
    const text = el.textContent;
    el.textContent = "";
    el.classList.add("vf-proximity");

    const letterEls = [];
    const words = text.split(" ");

    words.forEach((word, wi) => {
      const wordSpan = document.createElement("span");
      wordSpan.className = "vf-word";

      Array.from(word).forEach((letter) => {
        const letterSpan = document.createElement("span");
        letterSpan.className = "vf-letter";
        letterSpan.textContent = letter;
        wordSpan.appendChild(letterSpan);
        letterEls.push(letterSpan);
      });

      el.appendChild(wordSpan);

      // Espaço entre palavras (preserva quebra de linha natural).
      if (wi < words.length - 1) {
        const space = document.createElement("span");
        space.className = "vf-space";
        space.innerHTML = "&nbsp;";
        el.appendChild(space);
      }
    });

    return letterEls;
  }

  /**
   * Inicia o efeito em um ou mais elementos.
   * @param {string|Element|NodeList|Element[]} target - seletor CSS ou elemento(s)
   * @param {object} [options]
   * @param {number} [options.fromWeight=400] - peso em repouso
   * @param {number} [options.toWeight=900] - peso quando o cursor está sobre a letra
   * @param {number} [options.strength=25] - 1-100, alcance da proximidade
   * @param {number} [options.duration=0.3] - segundos, suavidade da transição
   */
  function initVariableFontProximity(target, options) {
    const opts = Object.assign(
      { fromWeight: 400, toWeight: 900, strength: 25, duration: 0.3 },
      options || {}
    );

    let elements;
    if (typeof target === "string") {
      elements = Array.from(document.querySelectorAll(target));
    } else if (target instanceof Element) {
      elements = [target];
    } else {
      elements = Array.from(target);
    }

    if (elements.length === 0) return;

    // Respeita usuários que preferem menos movimento.
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const reach = Math.max(
      1,
      (Math.max(1, Math.min(100, opts.strength)) / 100) * MAX_REACH
    );
    const fromSettings = `'wght' ${opts.fromWeight}`;

    const mouse = { x: -99999, y: -99999 };

    // Coordenadas em "página" (incluem o scroll), não em "viewport" —
    // assim dá pra cachear a posição das letras sem precisar remedir a
    // cada frame, mesmo se a página rolar.
    function updateMouse(pageX, pageY) {
      mouse.x = pageX;
      mouse.y = pageY;
    }

    window.addEventListener("mousemove", (ev) => {
      updateMouse(ev.pageX, ev.pageY);
    });
    window.addEventListener(
      "touchmove",
      (ev) => {
        if (ev.touches.length === 0) return;
        updateMouse(ev.touches[0].pageX, ev.touches[0].pageY);
      },
      { passive: true }
    );

    const instances = elements.map((el) => ({
      el,
      letters: wrapLettersPreservingWords(el),
      factors: [],
      positions: [], // cache: {cx, cy} de cada letra, em coordenadas de página
    }));

    // Mede a posição de cada letra UMA VEZ (não a cada frame). Ler
    // getBoundingClientRect() dentro do loop de animação força o
    // navegador a recalcular o layout a cada letra, a cada frame — é
    // isso que deixa a animação travada/pouco fluida. Medindo só aqui
    // e guardando em cache, o loop vira matemática pura.
    function measurePositions() {
      instances.forEach((inst) => {
        inst.positions = inst.letters.map((letterEl) => {
          const rect = letterEl.getBoundingClientRect();
          return {
            cx: rect.left + rect.width / 2 + window.scrollX,
            cy: rect.top + rect.height / 2 + window.scrollY,
          };
        });
      });
    }

    measurePositions();

    // Remede quando a fonte variável termina de carregar (o texto pode
    // reposicionar levemente) e quando a janela é redimensionada.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        measurePositions();
        const loaded = document.fonts.check('900 16px "InterVariableIronglass"');
        if (!loaded) {
          console.warn(
            '[variable-font-proximity] A fonte variável "InterVariableIronglass" não carregou — ' +
            "o efeito não vai mudar visualmente o peso das letras (a interação/JS continua rodando " +
            "normalmente). Verifique a aba Network do DevTools pela requisição a rsms.me, e se algum " +
            "bloqueador de anúncio/privacidade não está travando o download."
          );
        }
      });
    }

    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(measurePositions, 150);
    });

    let lastFrame = 0;
    const tau = Math.max(0.016, opts.duration);

    function frame(now) {
      const dtSec = Math.min(0.1, Math.max(0, (now - (lastFrame || now)) / 1000));
      lastFrame = now;
      const a = 1 - Math.exp(-dtSec / tau);

      instances.forEach((inst) => {
        inst.letters.forEach((letterEl, i) => {
          const pos = inst.positions[i];
          if (!pos) return;
          const dx = mouse.x - pos.cx;
          const dy = mouse.y - pos.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const targetFactor = Math.min(Math.max(1 - dist / reach, 0), 1);
          const prev = inst.factors[i] || 0;
          const f = prev + (targetFactor - prev) * a;
          inst.factors[i] = f;

          if (f < 0.001) {
            if (letterEl.style.fontVariationSettings !== fromSettings) {
              letterEl.style.fontVariationSettings = fromSettings;
            }
            return;
          }

          const w = Math.round(
            opts.fromWeight + (opts.toWeight - opts.fromWeight) * f
          );
          letterEl.style.fontVariationSettings = `'wght' ${w}`;
        });
      });

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  window.initVariableFontProximity = initVariableFontProximity;
})();
