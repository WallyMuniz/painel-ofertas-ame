(function () {
  const storageKey = "portal_theme";
  const darkTheme = "dark";
  const lightTheme = "light";

  function getStoredTheme() {
    try {
      return window.localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch (error) {
      // LocalStorage pode estar indisponivel em navegadores restritos.
    }
  }

  function applyTheme(theme, options = {}) {
    const selectedTheme = theme === darkTheme ? darkTheme : lightTheme;
    const previousTheme = document.documentElement.dataset.portalTheme || "";
    document.documentElement.dataset.portalTheme = selectedTheme;
    document.body?.classList.toggle("theme-dark", selectedTheme === darkTheme);
    document.body?.classList.toggle("theme-light", selectedTheme !== darkTheme);

    const button = document.querySelector("[data-portal-theme-toggle]");
    if (!button) return;

    const icon = button.querySelector("[data-theme-icon]");
    const label = button.querySelector("[data-theme-label]");
    const isDark = selectedTheme === darkTheme;

    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("title", isDark ? "Usar modo claro" : "Usar modo escuro");
    if (label) label.textContent = isDark ? "Claro" : "Escuro";
    if (icon) {
      icon.innerHTML = isDark
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 13.1A8.5 8.5 0 1 1 10.9 3a6.6 6.6 0 0 0 10.1 10.1z"/></svg>';
    }

    if (options.emit && previousTheme !== selectedTheme) {
      window.dispatchEvent(new CustomEvent("portal-theme-change", {
        detail: { theme: selectedTheme, previousTheme }
      }));
    }
  }

  function bindToggle(button) {
    if (!button || button.dataset.portalThemeBound === "true") return;
    button.dataset.portalThemeBound = "true";

    button.addEventListener("click", () => {
      const current = document.documentElement.dataset.portalTheme === darkTheme
        ? darkTheme
        : lightTheme;
      const next = current === darkTheme ? lightTheme : darkTheme;

      document.documentElement.classList.remove("theme-transition");
      void document.documentElement.offsetWidth;
      document.documentElement.classList.add("theme-transition");

      storeTheme(next);
      applyTheme(next, { emit: true });

      window.setTimeout(() => {
        document.documentElement.classList.remove("theme-transition");
      }, 650);
    });
  }

  function createToggle() {
    const existingButton = document.querySelector("[data-portal-theme-toggle]");
    if (existingButton) {
      bindToggle(existingButton);
      applyTheme(document.documentElement.dataset.portalTheme || getStoredTheme() || lightTheme);
      return;
    }

    const topbar = document.querySelector(".topbar-inner");
    if (!topbar) return;

    const button = document.createElement("button");
    button.className = "portal-theme-toggle";
    button.type = "button";
    button.setAttribute("data-portal-theme-toggle", "true");
    button.innerHTML = `
      <span class="portal-theme-toggle-icon" data-theme-icon></span>
      <span class="portal-theme-toggle-label" data-theme-label>Escuro</span>
    `;

    const userbar = topbar.querySelector(".central-userbar, .indicator-notification");
    if (userbar) {
      topbar.insertBefore(button, userbar);
    } else {
      topbar.appendChild(button);
    }

    bindToggle(button);
    applyTheme(document.documentElement.dataset.portalTheme || getStoredTheme() || lightTheme);
  }

  applyTheme(getStoredTheme() || lightTheme);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createToggle);
  } else {
    createToggle();
  }
})();
