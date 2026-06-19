(function () {
  const state = {
    payload: null,
    period: "all",
    municipality: "all",
    specialty: "all",
  };
  const importState = { items: [] };
  const appUtils = window.PortalAppUtils || {};
  const apiBaseUrl = window.PortalConfig?.apiBaseUrl || "";
  const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const percentFormatter = new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const elements = {
    period: document.getElementById("routePeriodFilter"),
    municipality: document.getElementById("routeMunicipalityFilter"),
    specialty: document.getElementById("routeSpecialtyFilter"),
    clear: document.getElementById("routeClearFilters"),
    showAll: document.getElementById("routeShowAllMunicipalities"),
    cityList: document.getElementById("routeCityList"),
    mapStage: document.getElementById("routeMapStage"),
    importToggle: document.getElementById("routeImportToggle"),
    importPanel: document.getElementById("routeImportPanel"),
    importAuthForm: document.getElementById("routeImportAuthForm"),
    importWorkspace: document.getElementById("routeImportWorkspace"),
    importFiles: document.getElementById("routeImportFiles"),
    analyzeImports: document.getElementById("routeAnalyzeImports"),
    confirmImports: document.getElementById("routeConfirmImports"),
    publishDashboard: document.getElementById("routePublishDashboard"),
    importPreview: document.getElementById("routeImportPreview"),
    importPreviewBody: document.getElementById("routeImportPreviewBody"),
    importFeedback: document.getElementById("routeImportFeedback"),
  };

  function sum(records) {
    return records.reduce((totals, record) => {
      totals.offered += record.offered;
      totals.scheduledOnOffer += record.scheduledOnOffer;
      totals.notScheduled += record.notScheduled;
      totals.scheduledWithPool += record.scheduledWithPool;
      totals.performed += record.performed;
      totals.absences += record.absences;
      return totals;
    }, {
      offered: 0,
      scheduledOnOffer: 0,
      notScheduled: 0,
      scheduledWithPool: 0,
      performed: 0,
      absences: 0,
    });
  }

  function rates(totals) {
    return {
      scheduledRate: totals.offered > 0 ? totals.scheduledOnOffer / totals.offered : 0,
      primaryLossRate: totals.offered > 0 ? totals.notScheduled / totals.offered : 0,
      performedRate: totals.scheduledWithPool > 0 ? totals.performed / totals.scheduledWithPool : 0,
      absenteeismRate: totals.scheduledWithPool > 0 ? totals.absences / totals.scheduledWithPool : 0,
    };
  }

  function aggregate(records) {
    const totals = sum(records);
    return { ...totals, ...rates(totals) };
  }

  function filterPeriod(records, period = state.period) {
    if (period === "q1") return records.filter((record) => record.quarter === 1);
    if (period === "q2") return records.filter((record) => record.quarter === 2);
    if (/^m\d+$/.test(period)) {
      const month = Number(period.slice(1));
      return records.filter((record) => record.month === month);
    }
    return records;
  }

  function getFilteredRecords(options = {}) {
    const useMunicipality = options.ignoreMunicipality ? "all" : state.municipality;
    const useSpecialty = options.ignoreSpecialty ? "all" : state.specialty;
    return filterPeriod(state.payload.records, options.period || state.period).filter((record) =>
      (useMunicipality === "all" || record.municipality === useMunicipality) &&
      (useSpecialty === "all" || record.specialty === useSpecialty)
    );
  }

  function groupBy(records, key) {
    const groups = new Map();
    records.forEach((record) => {
      const value = record[key];
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(record);
    });
    return groups;
  }

  function formatNumber(value) {
    return numberFormatter.format(Math.round(Number(value) || 0));
  }

  function formatPercent(value) {
    return percentFormatter.format(Number(value) || 0);
  }

  function rateClass(value) {
    if (value <= 0.15) return "route-rate-good";
    if (value <= 0.25) return "route-rate-watch";
    return "route-rate-high";
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function populateFilters() {
    const municipalities = [...new Set(state.payload.records.map((record) => record.municipality))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    const specialties = [...new Set(state.payload.records.map((record) => record.specialty))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    elements.municipality.innerHTML = '<option value="all">Todos os municípios</option>';
    elements.specialty.innerHTML = '<option value="all">Todas as especialidades</option>';
    elements.municipality.insertAdjacentHTML(
      "beforeend",
      municipalities.map((name) => `<option value="${name}">${name}</option>`).join("")
    );
    elements.specialty.insertAdjacentHTML(
      "beforeend",
      specialties.map((name) => `<option value="${name}">${name}</option>`).join("")
    );
    if (![...elements.municipality.options].some((option) => option.value === state.municipality)) state.municipality = "all";
    if (![...elements.specialty.options].some((option) => option.value === state.specialty)) state.specialty = "all";
    elements.municipality.value = state.municipality;
    elements.specialty.value = state.specialty;
  }

  function populatePeriodFilter() {
    const availableMonths = [...new Set(state.payload.records.map((record) => Number(record.month)))]
      .filter((month) => month >= 1 && month <= 12)
      .sort((a, b) => a - b);
    elements.period.innerHTML = `
      <option value="all">Todos os períodos disponíveis</option>
      <option value="q1">1º trimestre</option>
      <option value="q2">2º trimestre</option>
      ${availableMonths.map((month) => `<option value="m${month}">${monthNames[month - 1]}</option>`).join("")}
    `;
    if (![...elements.period.options].some((option) => option.value === state.period)) state.period = "all";
    elements.period.value = state.period;
  }

  function renderKpis(records) {
    const summary = aggregate(records);
    setText("routeKpiOffered", formatNumber(summary.offered));
    setText("routeKpiOfferedDetail", `${records.length} linhas consolidadas`);
    setText("routeKpiScheduled", formatNumber(summary.scheduledOnOffer));
    setText("routeKpiScheduledDetail", `${formatPercent(summary.scheduledRate)} da oferta`);
    setText("routeKpiPrimaryLoss", formatPercent(summary.primaryLossRate));
    setText("routeKpiPrimaryLossDetail", `${formatNumber(summary.notScheduled)} vagas não agendadas`);
    setText("routeKpiPool", formatNumber(summary.scheduledWithPool));
    setText("routeKpiPerformed", formatNumber(summary.performed));
    setText("routeKpiPerformedDetail", `${formatPercent(summary.performedRate)} dos agendamentos`);
    setText("routeKpiAbsenteeism", formatPercent(summary.absenteeismRate));
    setText("routeKpiAbsenteeismDetail", `${formatNumber(summary.absences)} faltas`);
  }

  function renderMap(records) {
    const summary = aggregate(records);
    const selected = state.municipality === "all" ? "Rota completa" : state.municipality;
    setText("routeSelectedTitle", selected);
    setText(
      "routeSelectedDescription",
      state.municipality === "all"
        ? "Consolidado dos sete municípios da rota assistencial."
        : "Resultado do município no período e especialidade selecionados."
    );
    setText("routeMapOffered", formatNumber(summary.offered));
    setText("routeMapPerformed", formatNumber(summary.performed));
    setText("routeMapPrimaryLoss", formatPercent(summary.primaryLossRate));
    setText("routeMapAbsenteeism", formatPercent(summary.absenteeismRate));

    document.querySelectorAll("[data-municipality]").forEach((element) => {
      element.classList.toggle("is-active", element.dataset.municipality === state.municipality);
    });

    const cityRecords = getFilteredRecords({ ignoreMunicipality: true });
    const cityGroups = [...groupBy(cityRecords, "municipality")]
      .map(([municipality, values]) => ({ municipality, ...aggregate(values) }))
      .sort((a, b) => a.municipality.localeCompare(b.municipality, "pt-BR"));
    elements.cityList.innerHTML = cityGroups.map((city) => `
      <button class="route-city-button${city.municipality === state.municipality ? " is-active" : ""}" type="button" data-municipality="${city.municipality}">
        <span>${city.municipality}</span>
        <small>${formatPercent(city.absenteeismRate)}</small>
      </button>
    `).join("");
  }

  function renderQuarterComparison() {
    const container = document.getElementById("routeQuarterComparison");
    container.innerHTML = [1, 2].map((quarter) => {
      let records = filterPeriod(state.payload.records, `q${quarter}`);
      if (state.municipality !== "all") records = records.filter((record) => record.municipality === state.municipality);
      if (state.specialty !== "all") records = records.filter((record) => record.specialty === state.specialty);
      const summary = aggregate(records);
      const lastMonth = Number(state.payload.metadata?.lastClosedMonth || 5);
      const secondQuarterEnd = Math.min(Math.max(lastMonth, 4), 6);
      const periodLabel = quarter === 1
        ? "Janeiro a março • fechado"
        : `Abril a ${monthNames[secondQuarterEnd - 1].toLowerCase()} • ${secondQuarterEnd >= 6 ? "fechado" : "em andamento"}`;
      return `
        <article class="route-quarter-card">
          <h3>${quarter}º trimestre<small>${periodLabel}</small></h3>
          <div class="route-quarter-metric"><span>Ofertado</span><strong>${formatNumber(summary.offered)}</strong></div>
          <div class="route-quarter-metric"><span>Realizado</span><strong>${formatNumber(summary.performed)}</strong></div>
          <div class="route-quarter-metric"><span>Perda primária</span><strong class="${rateClass(summary.primaryLossRate)}">${formatPercent(summary.primaryLossRate)}</strong></div>
          <div class="route-quarter-metric"><span>Absenteísmo</span><strong class="${rateClass(summary.absenteeismRate)}">${formatPercent(summary.absenteeismRate)}</strong></div>
        </article>
      `;
    }).join("");
  }

  function monthlySeries() {
    const base = state.payload.records.filter((record) =>
      (state.municipality === "all" || record.municipality === state.municipality) &&
      (state.specialty === "all" || record.specialty === state.specialty)
    );
    const groups = groupBy(base, "month");
    const lastMonth = Math.max(1, Number(state.payload.metadata?.lastClosedMonth || 5));
    return Array.from({ length: lastMonth }, (_value, index) => index + 1).map((month) => {
      const records = groups.get(month) || [];
      const summary = aggregate(records);
      return { month, label: records[0]?.monthShort || monthLabels[month - 1], ...summary };
    });
  }

  function renderVolumeChart(series) {
    const container = document.getElementById("routeVolumeChart");
    const maxValue = Math.max(1, ...series.flatMap((item) => [item.offered, item.scheduledWithPool, item.performed]));
    container.style.gridTemplateColumns = `repeat(${Math.max(1, series.length)}, minmax(56px, 1fr))`;
    container.innerHTML = series.map((item) => `
      <div class="route-volume-month">
        <div class="route-volume-bars">
          <div class="route-volume-bar route-bar-offered" style="height:${Math.max(2, item.offered / maxValue * 210)}px"><span>${formatNumber(item.offered)}</span></div>
          <div class="route-volume-bar route-bar-scheduled" style="height:${Math.max(2, item.scheduledWithPool / maxValue * 210)}px"><span>${formatNumber(item.scheduledWithPool)}</span></div>
          <div class="route-volume-bar route-bar-performed" style="height:${Math.max(2, item.performed / maxValue * 210)}px"><span>${formatNumber(item.performed)}</span></div>
        </div>
        <strong>${item.label}</strong>
      </div>
    `).join("");
  }

  function renderRateChart(series) {
    const container = document.getElementById("routeRateChart");
    const width = 640;
    const height = 280;
    const left = 44;
    const right = 18;
    const top = 24;
    const bottom = 38;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maxRate = Math.max(.1, Math.ceil(Math.max(...series.flatMap((item) => [item.primaryLossRate, item.absenteeismRate])) * 10) / 10);
    const x = (index) => left + (plotWidth / Math.max(1, series.length - 1)) * index;
    const y = (value) => top + plotHeight - (value / maxRate) * plotHeight;
    const points = (key) => series.map((item, index) => `${x(index)},${y(item[key])}`).join(" ");
    const grid = [0, .25, .5, .75, 1].map((ratio) => {
      const lineY = top + plotHeight - plotHeight * ratio;
      return `<line class="route-chart-gridline" x1="${left}" y1="${lineY}" x2="${width - right}" y2="${lineY}"/><text class="route-chart-axis-label" x="2" y="${lineY + 4}">${formatPercent(maxRate * ratio)}</text>`;
    }).join("");
    const labels = series.map((item, index) => `<text class="route-chart-axis-label" x="${x(index)}" y="${height - 10}" text-anchor="middle">${item.label}</text>`).join("");
    const dots = (key, color) => series.map((item, index) => `
      <circle cx="${x(index)}" cy="${y(item[key])}" r="4" fill="${color}"/>
      <text class="route-chart-value-label" x="${x(index)}" y="${Math.max(12, y(item[key]) - 9)}" text-anchor="middle">${formatPercent(item[key])}</text>
    `).join("");
    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução mensal da perda primária e do absenteísmo">
        ${grid}
        <polyline points="${points("primaryLossRate")}" fill="none" stroke="#d88a07" stroke-width="3"/>
        <polyline points="${points("absenteeismRate")}" fill="none" stroke="#d34b50" stroke-width="3"/>
        ${dots("primaryLossRate", "#d88a07")}
        ${dots("absenteeismRate", "#d34b50")}
        ${labels}
      </svg>
    `;
  }

  function renderTables() {
    const cityBody = document.getElementById("routeMunicipalityTable");
    const specialtyBody = document.getElementById("routeSpecialtyTable");
    const cities = [...groupBy(getFilteredRecords({ ignoreMunicipality: true }), "municipality")]
      .map(([municipality, records]) => ({ municipality, ...aggregate(records) }))
      .sort((a, b) => b.performed - a.performed);
    cityBody.innerHTML = cities.length ? cities.map((city) => `
      <tr data-municipality="${city.municipality}">
        <td>${city.municipality}</td>
        <td>${formatNumber(city.offered)}</td>
        <td>${formatNumber(city.performed)}</td>
        <td class="${rateClass(city.primaryLossRate)}">${formatPercent(city.primaryLossRate)}</td>
        <td class="${rateClass(city.absenteeismRate)}">${formatPercent(city.absenteeismRate)}</td>
      </tr>
    `).join("") : `<tr><td colspan="5" class="route-empty-state">Nenhum município encontrado.</td></tr>`;

    const specialties = [...groupBy(getFilteredRecords({ ignoreSpecialty: true }), "specialty")]
      .map(([specialty, records]) => ({ specialty, ...aggregate(records) }))
      .sort((a, b) => b.offered - a.offered)
      .slice(0, 12);
    specialtyBody.innerHTML = specialties.length ? specialties.map((item) => `
      <tr>
        <td>${item.specialty}</td>
        <td>${formatNumber(item.offered)}</td>
        <td>${formatNumber(item.performed)}</td>
        <td class="${rateClass(item.primaryLossRate)}">${formatPercent(item.primaryLossRate)}</td>
        <td class="${rateClass(item.absenteeismRate)}">${formatPercent(item.absenteeismRate)}</td>
      </tr>
    `).join("") : `<tr><td colspan="5" class="route-empty-state">Nenhuma especialidade encontrada.</td></tr>`;
  }

  function render() {
    const records = getFilteredRecords();
    renderKpis(records);
    renderMap(records);
    renderQuarterComparison();
    const series = monthlySeries();
    renderVolumeChart(series);
    renderRateChart(series);
    renderTables();
  }

  function setImportFeedback(message, tone = "neutral") {
    if (!elements.importFeedback) return;
    elements.importFeedback.textContent = message;
    elements.importFeedback.className = `route-import-feedback${tone === "success" ? " is-success" : tone === "error" ? " is-error" : ""}`;
  }

  function currentSession() {
    return typeof appUtils.getUnifiedSession === "function" ? appUtils.getUnifiedSession() : {};
  }

  function showImportAccess() {
    const session = currentSession();
    const authenticated = Boolean(session.token);
    elements.importAuthForm.hidden = authenticated;
    elements.importWorkspace.hidden = !authenticated;
    setImportFeedback(
      authenticated
        ? `Sessão ativa para ${session.label || session.username || "usuário autorizado"}.`
        : "Acesso protegido para atualização da base."
    );
  }

  function existingRecordsFor(item) {
    return state.payload.records.filter((record) =>
      record.municipality === item.municipality &&
      Number(record.year) === Number(item.competence.slice(0, 4)) &&
      Number(record.month) === Number(item.competence.slice(5, 7))
    ).length;
  }

  function previewSummary(rows) {
    return rows.reduce((summary, row) => {
      const offered = Number(row.offered) || 0;
      const scheduled = Number(row.scheduled) || 0;
      summary.offered += offered;
      summary.scheduled += Math.min(offered, scheduled);
      summary.performed += Number(row.performed) || 0;
      return summary;
    }, { offered: 0, scheduled: 0, performed: 0 });
  }

  function renderImportPreview() {
    elements.importPreviewBody.innerHTML = importState.items.map((item) => {
      const summary = previewSummary(item.rows);
      const existing = existingRecordsFor(item);
      return `
        <tr>
          <td>${item.file.name}</td>
          <td>${item.municipality}</td>
          <td>${item.competence.slice(5, 7)}/${item.competence.slice(0, 4)}</td>
          <td>${formatNumber(item.rows.length)}</td>
          <td>${formatNumber(summary.offered)}</td>
          <td>${formatNumber(summary.scheduled)}</td>
          <td>${formatNumber(summary.performed)}</td>
          <td><span class="route-import-status ${existing ? "route-import-status-replace" : "route-import-status-new"}">${existing ? `Substituir ${existing} registros` : "Nova competência"}</span></td>
        </tr>
      `;
    }).join("");
    elements.importPreview.hidden = !importState.items.length;
    elements.confirmImports.hidden = !importState.items.length;
    elements.confirmImports.textContent = `Confirmar importação (${importState.items.length})`;
  }

  async function analyzeImportFiles() {
    const files = [...(elements.importFiles.files || [])];
    if (!files.length) {
      setImportFeedback("Selecione ao menos um arquivo .xls.", "error");
      return;
    }
    if (files.length > 20) {
      setImportFeedback("Selecione no máximo 20 arquivos por importação.", "error");
      return;
    }
    try {
      setImportFeedback("Analisando arquivos SIReSP...");
      const parsed = [];
      const keys = new Set();
      for (const file of files) {
        if (!/\.xls$/i.test(file.name)) throw new Error(`${file.name}: formato inválido.`);
        const item = window.SirespXlsParser.parse(await file.arrayBuffer(), file.name);
        const key = `${item.municipality}|${item.competence}`;
        if (keys.has(key)) throw new Error(`Há mais de um arquivo para ${item.municipality} em ${item.competence}.`);
        keys.add(key);
        parsed.push({ ...item, file });
      }
      importState.items = parsed;
      renderImportPreview();
      setImportFeedback(`${parsed.length} arquivo(s) analisado(s). Confira os totais antes de confirmar.`, "success");
    } catch (error) {
      importState.items = [];
      renderImportPreview();
      setImportFeedback(error.message || "Falha ao analisar os arquivos.", "error");
    }
  }

  async function loadDashboardData() {
    const configuredDataUrl = document.documentElement.dataset.routeDataUrl || "../../assets/data/rotas/consultas-2026.json";
    const separator = configuredDataUrl.includes("?") ? "&" : "?";
    const response = await fetch(`${configuredDataUrl}${separator}v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar a base de consultas.");
    state.payload = await response.json();
    populatePeriodFilter();
    populateFilters();
    const lastMonth = Number(state.payload.metadata?.lastClosedMonth || 0);
    setText(
      "routeScopeBadge",
      lastMonth >= 4
        ? `1º tri fechado • 2º tri até ${monthNames[Math.min(lastMonth, 12) - 1].toLowerCase()}`
        : `Base atualizada até ${monthNames[Math.max(lastMonth, 1) - 1].toLowerCase()}`
    );
    const partialNote = document.querySelector(".route-partial-note");
    if (partialNote) partialNote.textContent = lastMonth >= 6 ? "2º trimestre fechado" : `2º trimestre: abril a ${monthNames[Math.max(lastMonth, 4) - 1].toLowerCase()}`;
  }

  async function confirmImports() {
    if (!importState.items.length) return;
    const session = currentSession();
    if (!session.token) {
      showImportAccess();
      setImportFeedback("Sua sessão expirou. Entre novamente para importar.", "error");
      return;
    }
    elements.confirmImports.disabled = true;
    elements.analyzeImports.disabled = true;
    try {
      const results = [];
      for (let index = 0; index < importState.items.length; index += 1) {
        const item = importState.items[index];
        setImportFeedback(`Importando ${index + 1} de ${importState.items.length}: ${item.file.name}...`);
        const form = new FormData();
        form.append("sirespFile", item.file, item.file.name);
        form.append("data", JSON.stringify({
          municipality: item.municipality,
          competence: item.competence,
          rows: item.rows,
        }));
        const result = await appUtils.requestJson(
          `${apiBaseUrl}/api/route-dashboard/import`,
          { method: "POST", headers: appUtils.unifiedAuthHeaders(), body: form },
          `Falha ao importar ${item.file.name}.`
        );
        results.push(result);
      }
      await loadDashboardData();
      render();
      const replaced = results.filter((result) => Number(result.replacedRecords || 0) > 0).length;
      setImportFeedback(`${results.length} arquivo(s) importado(s). ${replaced} competência(s) substituída(s).`, "success");
      importState.items = [];
      elements.importFiles.value = "";
      renderImportPreview();
    } catch (error) {
      setImportFeedback(error.message || "Falha ao concluir a importação.", "error");
      if (error.status === 401) appUtils.clearUnifiedSession?.();
      showImportAccess();
    } finally {
      elements.confirmImports.disabled = false;
      elements.analyzeImports.disabled = false;
    }
  }

  async function publishDashboard() {
    const session = currentSession();
    if (!session.token) {
      showImportAccess();
      setImportFeedback("Sua sessão expirou. Entre novamente para publicar.", "error");
      return;
    }
    if (!window.confirm("Publicar a versão sanitizada do Painel de Ofertas e Absenteísmo?")) return;
    elements.publishDashboard.disabled = true;
    try {
      setImportFeedback("Gerando versão pública sanitizada...");
      const result = await appUtils.requestJson(
        `${apiBaseUrl}/api/route-dashboard/publish`,
        { method: "POST", headers: appUtils.unifiedAuthHeaders(), body: JSON.stringify({}) },
        "Não foi possível gerar a publicação."
      );
      setImportFeedback(
        result.status === "published"
          ? `Painel publicado com ${formatNumber(result.recordCount)} registros agregados.`
          : `Pacote público gerado com ${formatNumber(result.recordCount)} registros. Conexão GitHub/Vercel ainda não configurada.`,
        "success"
      );
    } catch (error) {
      setImportFeedback(error.message || "Falha ao publicar o painel.", "error");
      if (error.status === 401) appUtils.clearUnifiedSession?.();
      showImportAccess();
    } finally {
      elements.publishDashboard.disabled = false;
    }
  }

  async function loginForImport(event) {
    event.preventDefault();
    const username = document.getElementById("routeImportUsername").value.trim();
    const password = document.getElementById("routeImportPassword").value;
    try {
      setImportFeedback("Validando acesso...");
      const session = await appUtils.requestJson(
        `${apiBaseUrl}/api/auth/login`,
        { method: "POST", body: JSON.stringify({ username, password }) },
        "Não foi possível entrar."
      );
      appUtils.setUnifiedSession(session);
      document.getElementById("routeImportPassword").value = "";
      showImportAccess();
    } catch (error) {
      setImportFeedback(error.message || "Usuário ou senha inválidos.", "error");
    }
  }

  function selectMunicipality(value) {
    state.municipality = value || "all";
    elements.municipality.value = state.municipality;
    render();
  }

  function bindEvents() {
    elements.period.addEventListener("change", () => {
      state.period = elements.period.value;
      render();
    });
    elements.municipality.addEventListener("change", () => selectMunicipality(elements.municipality.value));
    elements.specialty.addEventListener("change", () => {
      state.specialty = elements.specialty.value;
      render();
    });
    elements.clear.addEventListener("click", () => {
      state.period = "all";
      state.municipality = "all";
      state.specialty = "all";
      elements.period.value = "all";
      elements.municipality.value = "all";
      elements.specialty.value = "all";
      render();
    });
    elements.showAll.addEventListener("click", () => selectMunicipality("all"));
    elements.importToggle?.addEventListener("click", () => {
      const open = elements.importPanel.hidden;
      elements.importPanel.hidden = !open;
      elements.importToggle.setAttribute("aria-expanded", String(open));
      if (open) showImportAccess();
    });
    elements.importAuthForm?.addEventListener("submit", loginForImport);
    elements.analyzeImports?.addEventListener("click", analyzeImportFiles);
    elements.confirmImports?.addEventListener("click", confirmImports);
    elements.publishDashboard?.addEventListener("click", publishDashboard);
    document.addEventListener("click", (event) => {
      const cityControl = event.target.closest("[data-municipality]");
      if (!cityControl) return;
      selectMunicipality(cityControl.dataset.municipality);
    });
  }

  async function start() {
    try {
      await loadDashboardData();
      bindEvents();
      render();
    } catch (error) {
      setText("routeScopeBadge", "Falha ao carregar a base");
      document.querySelector(".route-kpi-grid").innerHTML = `<div class="route-empty-state">${error.message}</div>`;
    }
  }

  start();
})();
