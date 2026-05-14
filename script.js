const STORAGE_KEY = "timeDepthCurveApp.v10";
const FLAT_DEPTH_TOLERANCE_M = 1;

const planFileInput = document.getElementById("planCsvFile");
const realFileInput = document.getElementById("realCsvFile");
const wellNameInput = document.getElementById("wellNameInput");
const savedPlanFileInfo = document.getElementById("savedPlanFileInfo");
const savedRealFileInfo = document.getElementById("savedRealFileInfo");

const planXColumnSelect = document.getElementById("planXColumnSelect");
const planYColumnSelect = document.getElementById("planYColumnSelect");
const realDateColumnSelect = document.getElementById("realDateColumnSelect");
const realTimeColumnSelect = document.getElementById("realTimeColumnSelect");
const realDepthColumnSelect = document.getElementById("realDepthColumnSelect");

const spudDateTime = document.getElementById("spudDateTime");
const xGridSelect = document.getElementById("xGridSelect");
const yGridSelect = document.getElementById("yGridSelect");
const plotButton = document.getElementById("plotButton");
const resetButton = document.getElementById("resetButton");
const addFlatTimeButton = document.getElementById("addFlatTimeButton");
const flatTimeBody = document.getElementById("flatTimeBody");
const addManualPointButton = document.getElementById("addManualPointButton");
const manualPointBody = document.getElementById("manualPointBody");
const manualReference = document.getElementById("manualReference");

const canvas = document.getElementById("curveCanvas");
const ctx = canvas.getContext("2d");

const statusCard = document.getElementById("statusCard");
const statusText = document.getElementById("statusText");
const chartHint = document.getElementById("chartHint");

const summary = {
  wellName: document.getElementById("summaryWellName"),
  spud: document.getElementById("summarySpud"),
  realMaxTime: document.getElementById("realMaxTime"),
  realFinalDepth: document.getElementById("realFinalDepth"),
  projectFinalDepth: document.getElementById("projectFinalDepth"),
  flatTimeDeducted: document.getElementById("flatTimeDeducted"),
  currentVariance: document.getElementById("currentVariance"),
  plannedReferenceTime: document.getElementById("plannedReferenceTime"),
};

let planRows = [];
let planHeaders = [];
let planData = [];
let planFileName = "";
let planCsvText = "";

let realRows = [];
let realHeaders = [];
let realData = [];
let realFileName = "";
let realCsvText = "";
let flatTimes = [];
let manualRealPoints = [];

initGridOptions();
loadSavedState();
renderFlatTimes();
renderManualPoints();

planFileInput.addEventListener("change", (event) => handleFileUpload(event, "plan"));
realFileInput.addEventListener("change", (event) => handleFileUpload(event, "real"));
plotButton.addEventListener("click", plotCurves);
resetButton.addEventListener("click", resetApp);
addFlatTimeButton.addEventListener("click", addFlatTime);
addManualPointButton.addEventListener("click", addManualPoint);

[planXColumnSelect, planYColumnSelect, realDateColumnSelect, realTimeColumnSelect, realDepthColumnSelect].forEach((select) => {
  select.addEventListener("change", () => {
    saveState();
    if (hasAnyData()) plotCurves();
  });
});

xGridSelect.addEventListener("change", () => { saveState(); if (hasAnyPlottedData()) drawChart(); });
yGridSelect.addEventListener("change", () => { saveState(); if (hasAnyPlottedData()) drawChart(); });
spudDateTime.addEventListener("change", () => { saveState(); updateSpudSummary(); if (realRows.length) plotCurves(); });
wellNameInput.addEventListener("input", () => { saveState(); updateWellSummary(); });

flatTimeBody.addEventListener("input", handleFlatTimeTableChange);
flatTimeBody.addEventListener("change", handleFlatTimeTableChange);
flatTimeBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='delete-flat']");
  if (!button) return;
  deleteFlatTime(button.dataset.id);
});

manualPointBody.addEventListener("input", handleManualPointTableChange);
manualPointBody.addEventListener("change", handleManualPointTableChange);
manualPointBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='delete-manual']");
  if (!button) return;
  deleteManualPoint(button.dataset.id);
});

window.addEventListener("resize", () => {
  if (hasAnyPlottedData()) drawChart();
  else drawEmptyCanvas();
});

function initGridOptions() {
  const xValues = [];
  for (let value = 0.5; value <= 30; value += 0.5) xValues.push(value);
  fillOptions(xGridSelect, xValues, " dias");
  xGridSelect.value = "4";

  const yValues = [50, 100, 200, 250, 500, 1000];
  fillOptions(yGridSelect, yValues, " m");
  yGridSelect.value = "200";
}

function fillOptions(select, values, suffix) {
  select.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = `${formatPlainNumber(value)}${suffix}`;
    select.appendChild(option);
  });
}

function handleFileUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      if (type === "plan") loadPlanCsvText(text, file.name);
      else loadRealCsvText(text, file.name);
      plotCurves();
      saveState();
    } catch (error) {
      setStatus(error.message, "error");
    }
  };
  reader.readAsText(file, "UTF-8");
}

function loadPlanCsvText(text, fileName = "") {
  const result = parseCsv(text);
  planHeaders = result.headers;
  planRows = result.rows;
  planFileName = fileName;
  planCsvText = text;

  if (!planHeaders.length || !planRows.length) {
    throw new Error("CSV do plano sem cabeçalho ou sem linhas de dados.");
  }

  fillColumnSelect(planXColumnSelect, planHeaders);
  fillColumnSelect(planYColumnSelect, planHeaders);
  setDefaultPlanColumns(planHeaders);
  setSavedFileInfo();
  enableSelects([planXColumnSelect, planYColumnSelect]);
  plotButton.disabled = false;
  resetButton.disabled = false;
  setStatus(`Plano carregado: ${planRows.length} linhas`, "ready");
}

function loadRealCsvText(text, fileName = "") {
  const result = parseCsv(text);
  realHeaders = result.headers;
  realRows = result.rows;
  realFileName = fileName;
  realCsvText = text;

  if (!realHeaders.length || !realRows.length) {
    throw new Error("CSV real/Pason sem cabeçalho ou sem linhas de dados.");
  }

  fillColumnSelect(realDateColumnSelect, realHeaders);
  fillColumnSelect(realTimeColumnSelect, realHeaders);
  fillColumnSelect(realDepthColumnSelect, realHeaders);
  setDefaultRealColumns(realHeaders);
  setSavedFileInfo();
  enableSelects([realDateColumnSelect, realTimeColumnSelect, realDepthColumnSelect]);
  plotButton.disabled = false;
  resetButton.disabled = false;
  setStatus(`Real/Pason carregado: ${realRows.length} linhas`, "ready");
}

function parseCsv(text) {
  const cleanText = String(text || "").replace(/^\uFEFF/, "").trim();
  const lines = cleanText.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (!lines.length) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = splitCsvLine(lines[0], delimiter).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i], delimiter);
    const row = {};
    rawHeaders.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index].trim() : "";
    });
    rows.push(row);
  }

  return { headers: rawHeaders, rows };
}

function detectDelimiter(headerLine) {
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function splitCsvLine(line, delimiter) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function fillColumnSelect(select, columns) {
  const previous = select.value;
  select.innerHTML = "";
  columns.forEach((column) => {
    const option = document.createElement("option");
    option.value = column;
    option.textContent = column;
    select.appendChild(option);
  });
  if (columns.includes(previous)) select.value = previous;
}

function enableSelects(selects) {
  selects.forEach((select) => (select.disabled = false));
}

function setDefaultPlanColumns(columns) {
  const saved = readSavedState();
  const xGuess = saved?.planXColumn && columns.includes(saved.planXColumn)
    ? saved.planXColumn
    : findColumn(columns, ["dias acum", "dias", "horas acum", "hora", "tempo", "time"]);
  const yGuess = saved?.planYColumn && columns.includes(saved.planYColumn)
    ? saved.planYColumn
    : findColumn(columns, ["prof", "depth", "md"]);

  if (xGuess) planXColumnSelect.value = xGuess;
  if (yGuess) planYColumnSelect.value = yGuess;
}

function setDefaultRealColumns(columns) {
  const saved = readSavedState();
  const dateGuess = saved?.realDateColumn && columns.includes(saved.realDateColumn)
    ? saved.realDateColumn
    : findColumn(columns, ["date", "data"]);
  const timeGuess = saved?.realTimeColumn && columns.includes(saved.realTimeColumn)
    ? saved.realTimeColumn
    : findColumn(columns, ["time", "hora"]);
  const depthGuess = saved?.realDepthColumn && columns.includes(saved.realDepthColumn)
    ? saved.realDepthColumn
    : findExactOrIncludes(columns, "Hole Depth (meters)") || findColumn(columns, ["hole depth", "prof", "depth", "md"]);

  if (dateGuess) realDateColumnSelect.value = dateGuess;
  if (timeGuess) realTimeColumnSelect.value = timeGuess;
  if (depthGuess) realDepthColumnSelect.value = depthGuess;
}

function findColumn(columns, terms) {
  return columns.find((column) => {
    const normalized = normalizeText(column);
    return terms.some((term) => normalized.includes(normalizeText(term)));
  });
}

function findExactOrIncludes(columns, wanted) {
  const exact = columns.find((column) => column.trim() === wanted);
  if (exact) return exact;
  const wantedNorm = normalizeText(wanted);
  return columns.find((column) => normalizeText(column).includes(wantedNorm));
}

function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseNumber(value) {
  if (value === null || value === undefined) return NaN;
  const text = String(value).trim().replace(/\s/g, "");
  if (text === "") return NaN;

  const commaCount = (text.match(/,/g) || []).length;
  const dotCount = (text.match(/\./g) || []).length;

  if (commaCount && dotCount) return Number(text.replace(/\./g, "").replace(",", "."));
  if (commaCount) return Number(text.replace(",", "."));
  return Number(text);
}

function parseSpudDate() {
  if (!spudDateTime.value) return null;
  const date = new Date(spudDateTime.value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePasonDateTime(dateValue, timeValue) {
  const dateText = String(dateValue || "").trim();
  const timeText = String(timeValue || "").trim();
  if (!dateText || !timeText) return null;

  const dateParts = dateText.includes("/") ? dateText.split("/") : dateText.split("-");
  if (dateParts.length !== 3) return null;

  let year, month, day;
  if (dateParts[0].length === 4) [year, month, day] = dateParts;
  else [day, month, year] = dateParts;

  const timeParts = timeText.split(":");
  const hour = Number(timeParts[0] || 0);
  const minute = Number(timeParts[1] || 0);
  const second = Number(timeParts[2] || 0);

  const date = new Date(Number(year), Number(month) - 1, Number(day), hour, minute, second);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildPlanData() {
  if (!planRows.length) return [];

  const xColumn = planXColumnSelect.value;
  const yColumn = planYColumnSelect.value;

  return planRows
    .map((row, index) => ({
      index: index + 1,
      x: parseNumber(row[xColumn]),
      y: parseNumber(row[yColumn]),
      rawX: row[xColumn],
      rawY: row[yColumn],
      description: row["Descrição"] || row["Descricao"] || row["Description"] || "",
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((a, b) => a.x - b.x);
}

function buildRealData() {
  if (!realRows.length) return [];

  const spud = parseSpudDate();
  if (!spud) {
    setStatus("Informe o Spud / Data e hora para processar o real/Pason.", "error");
    return [];
  }

  const dateColumn = realDateColumnSelect.value;
  const timeColumn = realTimeColumnSelect.value;
  const depthColumn = realDepthColumnSelect.value;
  const spudMs = spud.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const pasonData = realRows
    .map((row, index) => {
      const dateTime = parsePasonDateTime(row[dateColumn], row[timeColumn]);
      const depth = parseNumber(row[depthColumn]);
      if (!dateTime || !Number.isFinite(depth)) return null;
      const elapsedDays = (dateTime.getTime() - spudMs) / dayMs;
      if (elapsedDays < 0) return null;
      return {
        index: index + 1,
        x: elapsedDays,
        y: depth,
        rawDate: row[dateColumn],
        rawTime: row[timeColumn],
        rawY: row[depthColumn],
        dateTime,
        source: "pason",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.x - b.x);

  const manualData = buildManualRealData(pasonData, spud);
  updateManualReference(pasonData);
  return [...pasonData, ...manualData].sort((a, b) => a.x - b.x);
}

function buildManualRealData(pasonData, spud) {
  const evaluations = evaluateManualPoints(pasonData);

  return evaluations
    .filter((item) => item.status === "valid")
    .map((item, index) => ({
      index: index + 1,
      x: item.elapsedDays,
      y: item.depth,
      rawY: item.point.depth,
      rawDate: item.point.captureDateTime,
      dateTime: item.dateTime,
      source: "manual",
    }))
    .sort((a, b) => a.x - b.x);
}

function evaluateManualPoints(pasonData = null) {
  const dayMs = 24 * 60 * 60 * 1000;
  const lastPason = getLastPasonPoint(pasonData);
  const results = new Map();

  const sorted = manualRealPoints
    .map((point, originalIndex) => ({ point: normalizeManualPoint(point), originalIndex }))
    .sort((a, b) => {
      const aDate = parseDateTimeLocal(a.point.captureDateTime);
      const bDate = parseDateTimeLocal(b.point.captureDateTime);
      const aTime = aDate ? aDate.getTime() : Number.POSITIVE_INFINITY;
      const bTime = bDate ? bDate.getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime || a.originalIndex - b.originalIndex;
    });

  if (!lastPason) {
    sorted.forEach(({ point }) => {
      results.set(point.id, { point, status: "waiting-pason", label: "Aguardando Pason", elapsedDays: NaN, depth: parseNumber(point.depth), dateTime: parseDateTimeLocal(point.captureDateTime) });
    });
    return Array.from(results.values());
  }

  let referenceTimeMs = lastPason.dateTime.getTime();
  let referenceElapsedDays = lastPason.x;
  let referenceLabel = "último Pason";

  sorted.forEach(({ point }) => {
    const dateTime = parseDateTimeLocal(point.captureDateTime);
    const depth = parseNumber(point.depth);

    if (!dateTime || !Number.isFinite(depth)) {
      results.set(point.id, { point, status: "pending", label: "Incompleto", elapsedDays: NaN, depth, dateTime });
      return;
    }

    const currentMs = dateTime.getTime();
    if (currentMs <= lastPason.dateTime.getTime()) {
      results.set(point.id, {
        point,
        status: "ignored",
        label: "Desconsiderado: coberto pela Pason",
        elapsedDays: NaN,
        depth,
        dateTime,
      });
      return;
    }

    if (currentMs <= referenceTimeMs) {
      results.set(point.id, {
        point,
        status: "invalid",
        label: `Data <= ${referenceLabel}`,
        elapsedDays: NaN,
        depth,
        dateTime,
      });
      return;
    }

    const deltaDays = (currentMs - referenceTimeMs) / dayMs;
    const elapsedDays = referenceElapsedDays + deltaDays;
    results.set(point.id, {
      point,
      status: "valid",
      label: `Válido: ${formatTwoDecimals(elapsedDays)} d`,
      elapsedDays,
      depth,
      dateTime,
    });

    referenceTimeMs = currentMs;
    referenceElapsedDays = elapsedDays;
    referenceLabel = "manual anterior";
  });

  return manualRealPoints
    .map((point) => results.get(point.id) || { point, status: "pending", label: "Incompleto", elapsedDays: NaN, depth: NaN, dateTime: null });
}

function getManualEvaluationById(id) {
  return evaluateManualPoints().find((item) => item.point.id === id);
}

function getLastPasonPoint(pasonData = null) {
  const data = pasonData || realData.filter((point) => point.source === "pason");
  if (!data.length) return null;
  return data[data.length - 1];
}

function getLastPasonElapsedDays(pasonData = null) {
  const last = getLastPasonPoint(pasonData);
  return last ? last.x : NaN;
}

function plotCurves() {
  planData = buildPlanData();
  realData = buildRealData();
  renderManualStatusOnly();

  if (!planData.length && !realData.length) {
    drawEmptyCanvas("Carregue ao menos uma curva válida para plotar.");
    updateSummary();
    return;
  }

  drawChart();
  updateSummary();

  const parts = [];
  if (planData.length) parts.push(`Plano: ${planData.length} pts`);
  if (realData.length) parts.push(`Real: ${realData.length} pts`);
  setStatus(parts.join(" | "), "ready");
  chartHint.textContent = "Eixo X em dias desde o spud para o real. Profundidade aumenta para baixo.";
  saveState();
}

function drawChart() {
  resizeCanvasToDisplaySize();

  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 30, right: 32, bottom: 58, left: 90 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const allData = [...planData, ...realData];
  if (!allData.length) {
    drawEmptyCanvas();
    return;
  }

  const xs = allData.map((point) => point.x);
  const ys = allData.map((point) => point.y);
  const rawMinX = Math.min(...xs);
  const rawMaxX = Math.max(...xs);
  const rawMinY = Math.min(...ys);
  const rawMaxY = Math.max(...ys);

  const xStep = Number(xGridSelect.value) || 4;
  const yStep = Number(yGridSelect.value) || 200;

  const minX = floorToStep(rawMinX, xStep);
  const maxX = ceilToStep(rawMaxX, xStep);
  const minY = floorToStep(rawMinY, yStep);
  const maxY = ceilToStep(rawMaxY, yStep);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#07111f";
  ctx.fillRect(0, 0, width, height);

  const xToCanvas = (x) => padding.left + ((x - minX) / safeRange(minX, maxX)) * plotWidth;
  const yToCanvas = (y) => padding.top + ((y - minY) / safeRange(minY, maxY)) * plotHeight;

  drawGrid(width, height, padding, minX, maxX, minY, maxY, xStep, yStep, xToCanvas, yToCanvas);

  ctx.save();
  ctx.beginPath();
  ctx.rect(padding.left, padding.top, plotWidth, plotHeight);
  ctx.clip();

  if (planData.length) {
    drawLineSeries(planData, xToCanvas, yToCanvas, "#38bdf8", 3, true);
    drawProjectDepthLine(planData, padding, width, xToCanvas, yToCanvas);
  }

  if (realData.length) drawLineSeries(realData, xToCanvas, yToCanvas, "#fb7185", 2.5, false);

  ctx.restore();
  drawAxes(width, height, padding, "Tempo (dias)", "Profundidade (m)");
}

function drawLineSeries(data, xToCanvas, yToCanvas, color, lineWidth, showPoints) {
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.beginPath();
  data.forEach((point, index) => {
    const cx = xToCanvas(point.x);
    const cy = yToCanvas(point.y);
    if (index === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.stroke();

  if (!showPoints) return;
  ctx.fillStyle = "#e0f2fe";
  data.forEach((point) => {
    const cx = xToCanvas(point.x);
    const cy = yToCanvas(point.y);
    ctx.beginPath();
    ctx.arc(cx, cy, 3.1, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGrid(width, height, padding, minX, maxX, minY, maxY, xStep, yStep, xToCanvas, yToCanvas) {
  ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
  ctx.fillStyle = "rgba(229, 231, 235, 0.72)";
  ctx.lineWidth = 1;
  ctx.font = "13px system-ui";

  for (let xValue = minX; xValue <= maxX + xStep / 1000; xValue += xStep) {
    const x = xToCanvas(xValue);
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillText(formatGridNumber(xValue), x, height - padding.bottom + 28);
  }

  for (let yValue = minY; yValue <= maxY + yStep / 1000; yValue += yStep) {
    const y = yToCanvas(yValue);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(formatDepthAxis(yValue), padding.left - 12, y + 4);
  }
}

function drawProjectDepthLine(data, padding, width, xToCanvas, yToCanvas) {
  const finalPoint = data[data.length - 1];
  const y = yToCanvas(finalPoint.y);
  const x = xToCanvas(finalPoint.x);
  const label = `Prof. projeto: ${formatRawDepth(finalPoint.rawY)} m`;

  ctx.save();
  ctx.strokeStyle = "rgba(250, 204, 21, 0.92)";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(padding.left, y);
  ctx.lineTo(width - padding.right, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "800 13px system-ui";
  const textWidth = ctx.measureText(label).width;
  const boxWidth = textWidth + 20;
  const boxHeight = 26;
  const boxX = Math.max(padding.left + 10, Math.min(width - padding.right - boxWidth - 8, x - boxWidth / 2));
  const boxY = Math.max(padding.top + 6, y - boxHeight - 8);

  roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 8);
  ctx.fillStyle = "rgba(17, 24, 39, 0.95)";
  ctx.fill();
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#fde68a";
  ctx.textAlign = "center";
  ctx.fillText(label, boxX + boxWidth / 2, boxY + 17);
  ctx.restore();
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawAxes(width, height, padding, xLabel, yLabel) {
  ctx.strokeStyle = "rgba(229, 231, 235, 0.8)";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  ctx.fillStyle = "rgba(229, 231, 235, 0.9)";
  ctx.font = "700 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(xLabel, padding.left + (width - padding.left - padding.right) / 2, height - 14);

  ctx.save();
  ctx.translate(22, padding.top + (height - padding.top - padding.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function drawEmptyCanvas(message = "Carregue um CSV para plotar a curva.") {
  resizeCanvasToDisplaySize();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#07111f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(229, 231, 235, 0.72)";
  ctx.font = "700 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

function resizeCanvasToDisplaySize() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
}

function floorToStep(value, step) { return Math.floor(value / step) * step; }
function ceilToStep(value, step) { return Math.ceil(value / step) * step; }
function safeRange(min, max) { return max - min === 0 ? 1 : max - min; }

function calculateCurrentVariance() {
  if (!planData.length || !realData.length) return null;

  const actual = realData[realData.length - 1];
  const flatInfo = getRealFlatDeductionUntil(actual.dateTime);
  const effectiveActualTime = actual.x - flatInfo.deductedDays;
  const plannedTime = interpolatePlannedTimeAtDepth(actual.y);

  if (!Number.isFinite(plannedTime)) return null;

  return {
    deltaDays: effectiveActualTime - plannedTime,
    referenceTime: plannedTime,
    effectiveActualTime,
    flatInfo,
    reference: flatInfo.activeFlat
      ? `Interpolação na profundidade atual, com flat time aberto congelando a diferença (${flatInfo.activeFlat.description || "sem descrição"})`
      : flatInfo.deductedDays > 0
        ? `Interpolação na profundidade atual, descontando flat times reais`
        : `Interpolação na profundidade atual (${formatDepthAxis(actual.y)} m)`,
  };
}

function getRealFlatDeductionUntil(currentDate) {
  const currentMs = currentDate?.getTime?.();
  if (!Number.isFinite(currentMs)) return { deductedDays: 0, activeFlat: null };

  const dayMs = 24 * 60 * 60 * 1000;
  let deductedMs = 0;
  let activeFlat = null;

  getValidFlatTimes()
    .sort((a, b) => a.startDate - b.startDate)
    .forEach((flat) => {
      const startMs = flat.startDate.getTime();
      const endMs = flat.endDate ? flat.endDate.getTime() : currentMs;
      if (currentMs <= startMs) return;
      const cappedEnd = Math.min(endMs, currentMs);
      if (cappedEnd <= startMs) return;
      deductedMs += cappedEnd - startMs;
      if (!flat.endDate || (currentMs >= startMs && currentMs <= flat.endDate.getTime())) activeFlat = flat;
    });

  return { deductedDays: deductedMs / dayMs, activeFlat };
}

function getValidFlatTimes() {
  return flatTimes
    .map((flat) => {
      const startDate = parseDateTimeLocal(flat.start);
      const endDate = flat.end ? parseDateTimeLocal(flat.end) : null;
      if (!startDate) return null;
      if (endDate && endDate <= startDate) return null;
      return { ...flat, startDate, endDate };
    })
    .filter(Boolean);
}

function parseDateTimeLocal(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function interpolatePlannedTimeAtDepth(depth) {
  for (let i = 1; i < planData.length; i++) {
    const previous = planData[i - 1];
    const current = planData[i];
    if (Math.abs(current.y - previous.y) <= FLAT_DEPTH_TOLERANCE_M) continue;

    const minDepth = Math.min(previous.y, current.y);
    const maxDepth = Math.max(previous.y, current.y);
    if (depth < minDepth || depth > maxDepth) continue;

    const fraction = (depth - previous.y) / (current.y - previous.y);
    return previous.x + fraction * (current.x - previous.x);
  }
  return NaN;
}

function formatVarianceLabel(deltaDays) {
  if (Math.abs(deltaDays) < 0.005) return "0,00 dias | no plano";
  const status = deltaDays > 0 ? "atrasado" : "adiantado";
  const sign = deltaDays > 0 ? "+" : "-";
  return `${sign}${formatTwoDecimals(Math.abs(deltaDays))} dias | ${status}`;
}

function updateSummary() {
  const finalPlanPoint = planData[planData.length - 1];
  const finalRealPoint = realData[realData.length - 1];
  const variance = calculateCurrentVariance();

  updateWellSummary();
  summary.projectFinalDepth.textContent = finalPlanPoint ? `${formatRawDepth(finalPlanPoint.rawY)} m` : "-";
  summary.realMaxTime.textContent = finalRealPoint ? `${formatGridNumber(finalRealPoint.x)} dias` : "-";
  summary.realFinalDepth.textContent = finalRealPoint ? `${formatRawDepth(finalRealPoint.rawY)} m` : "-";

  if (variance) {
    summary.currentVariance.textContent = formatVarianceLabel(variance.deltaDays);
    summary.currentVariance.className = variance.deltaDays > 0 ? "behind" : variance.deltaDays < 0 ? "ahead" : "onplan";
    summary.plannedReferenceTime.textContent = `${formatTwoDecimals(variance.referenceTime)} dias`;
    summary.flatTimeDeducted.textContent = `${formatTwoDecimals(variance.flatInfo.deductedDays)} dias`;
  } else {
    summary.currentVariance.textContent = "-";
    summary.currentVariance.className = "";
    summary.plannedReferenceTime.textContent = "-";
    summary.flatTimeDeducted.textContent = "-";
  }

  updateSpudSummary();
}

function updateWellSummary() {
  summary.wellName.textContent = wellNameInput.value.trim() || "-";
}

function updateSpudSummary() {
  summary.spud.textContent = spudDateTime.value ? formatDateTimeLocal(spudDateTime.value) : "-";
}

function addFlatTime() {
  flatTimes.push({
    id: createId(),
    description: "",
    start: "",
    end: "",
  });
  renderFlatTimes();
  saveState();
}

function deleteFlatTime(id) {
  flatTimes = flatTimes.filter((flat) => flat.id !== id);
  renderFlatTimes();
  saveState();
  if (hasAnyData()) plotCurves();
}

function handleFlatTimeTableChange(event) {
  const field = event.target.dataset.field;
  const id = event.target.dataset.id;
  if (!field || !id) return;

  const flat = flatTimes.find((item) => item.id === id);
  if (!flat) return;
  flat[field] = event.target.value;
  saveState();
  renderFlatStatusOnly();
  if (hasAnyData()) plotCurves();
}

function renderFlatTimes() {
  if (!flatTimes.length) {
    flatTimeBody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum flat time cadastrado.</td></tr>';
    return;
  }

  flatTimeBody.innerHTML = "";
  flatTimes.forEach((flat) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="description-cell">
        <input type="text" data-id="${flat.id}" data-field="description" value="${escapeAttribute(flat.description)}" placeholder="Ex.: descida de revestimento" />
      </td>
      <td class="date-cell">
        <input type="datetime-local" data-id="${flat.id}" data-field="start" value="${escapeAttribute(flat.start)}" />
      </td>
      <td class="date-cell">
        <input type="datetime-local" data-id="${flat.id}" data-field="end" value="${escapeAttribute(flat.end)}" />
      </td>
      <td><span class="${getFlatStatusClass(flat)}" data-flat-status="${flat.id}">${getFlatStatusText(flat)}</span></td>
      <td><button class="danger-button" type="button" data-action="delete-flat" data-id="${flat.id}">Excluir</button></td>
    `;
    flatTimeBody.appendChild(tr);
  });
}

function renderFlatStatusOnly() {
  flatTimes.forEach((flat) => {
    const status = flatTimeBody.querySelector(`[data-flat-status="${flat.id}"]`);
    if (!status) return;
    status.className = getFlatStatusClass(flat);
    status.textContent = getFlatStatusText(flat);
  });
}

function getFlatStatusText(flat) {
  if (!flat.start) return "Sem início";
  if (flat.end) return "Fechado";
  return "Aberto";
}

function getFlatStatusClass(flat) {
  return flat.end ? "flat-status closed" : "flat-status";
}


function addManualPoint() {
  manualRealPoints.push({
    id: createManualId(),
    captureDateTime: "",
    depth: "",
  });
  renderManualPoints();
  saveState();
}

function deleteManualPoint(id) {
  manualRealPoints = manualRealPoints.filter((point) => point.id !== id);
  renderManualPoints();
  saveState();
  if (hasAnyData()) plotCurves();
}

function handleManualPointTableChange(event) {
  const field = event.target.dataset.field;
  const id = event.target.dataset.id;
  if (!field || !id) return;

  const point = manualRealPoints.find((item) => item.id === id);
  if (!point) return;
  point[field] = event.target.value;
  saveState();
  renderManualStatusOnly();
  if (hasAnyData()) plotCurves();
}

function renderManualPoints() {
  manualRealPoints = manualRealPoints.map(normalizeManualPoint);

  if (!manualRealPoints.length) {
    manualPointBody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum ponto manual cadastrado.</td></tr>';
    updateManualReference();
    return;
  }

  manualPointBody.innerHTML = "";
  manualRealPoints.forEach((point) => {
    const evaluation = getManualEvaluationById(point.id);
    const tr = document.createElement("tr");
    tr.className = evaluation ? `manual-row ${evaluation.status}` : "manual-row";
    tr.innerHTML = `
      <td class="manual-time-cell">
        <input type="datetime-local" data-id="${point.id}" data-field="captureDateTime" value="${escapeAttribute(point.captureDateTime)}" />
      </td>
      <td class="manual-depth-cell">
        <input type="number" step="0.01" min="0" data-id="${point.id}" data-field="depth" value="${escapeAttribute(point.depth)}" placeholder="Ex.: 1250" />
      </td>
      <td class="manual-elapsed-cell" data-manual-elapsed="${point.id}">${evaluation && Number.isFinite(evaluation.elapsedDays) ? formatTwoDecimals(evaluation.elapsedDays) : "-"}</td>
      <td><span class="${getManualStatusClass(point)}" data-manual-status="${point.id}">${getManualStatusText(point)}</span></td>
      <td class="action-cell"><button class="danger-button delete-line-button" type="button" data-action="delete-manual" data-id="${point.id}" title="Excluir esta linha manual">Excluir linha</button></td>
    `;
    manualPointBody.appendChild(tr);
  });
  updateManualReference();
}

function renderManualStatusOnly() {
  updateManualReference();
  manualRealPoints = manualRealPoints.map(normalizeManualPoint);
  const evaluations = evaluateManualPoints();
  manualRealPoints.forEach((point) => {
    const evaluation = evaluations.find((item) => item.point.id === point.id);
    const status = manualPointBody.querySelector(`[data-manual-status="${point.id}"]`);
    const elapsed = manualPointBody.querySelector(`[data-manual-elapsed="${point.id}"]`);
    const row = status ? status.closest("tr") : null;
    if (status) {
      status.className = getManualStatusClass(point);
      status.textContent = getManualStatusText(point);
    }
    if (elapsed) elapsed.textContent = evaluation && Number.isFinite(evaluation.elapsedDays) ? formatTwoDecimals(evaluation.elapsedDays) : "-";
    if (row && evaluation) row.className = `manual-row ${evaluation.status}`;
  });
}

function getManualStatusText(point) {
  const evaluation = getManualEvaluationById(point.id);
  return evaluation ? evaluation.label : "Incompleto";
}

function getManualStatusClass(point) {
  const evaluation = getManualEvaluationById(point.id);
  const status = evaluation ? evaluation.status : "pending";
  if (status === "valid") return "manual-status valid";
  if (status === "ignored") return "manual-status ignored";
  if (status === "pending" || status === "waiting-pason") return "manual-status pending";
  return "manual-status invalid";
}

function updateManualReference(pasonData = null) {
  const lastPason = getLastPasonPoint(pasonData);
  if (!manualReference) return;
  if (!lastPason) {
    manualReference.textContent = "Último dado Pason: -. Sem CSV real, os pontos manuais ficam aguardando referência.";
    return;
  }
  manualReference.textContent = `Último dado Pason: ${formatTwoDecimals(lastPason.x)} dias | ${formatDateTimeForDisplay(lastPason.dateTime)}. Capturas manuais com data/hora anterior ou igual serão desconsideradas.`;
}

function normalizeManualPoint(point) {
  const normalized = { ...point };
  if (!normalized.captureDateTime && normalized.timeDays && spudDateTime.value) {
    const spud = parseDateTimeLocal(spudDateTime.value);
    const timeDays = parseNumber(normalized.timeDays);
    if (spud && Number.isFinite(timeDays)) {
      const date = new Date(spud.getTime() + timeDays * 24 * 60 * 60 * 1000);
      normalized.captureDateTime = toDateTimeLocalValue(date);
    }
  }
  normalized.captureDateTime = normalized.captureDateTime || "";
  normalized.depth = normalized.depth || "";
  return normalized;
}

function toDateTimeLocalValue(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTimeForDisplay(date) {
  if (!date || Number.isNaN(date.getTime())) return "-";
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createManualId() {
  return `manual_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function resetApp() {
  localStorage.removeItem(STORAGE_KEY);
  planFileInput.value = "";
  realFileInput.value = "";
  planRows = [];
  planHeaders = [];
  planData = [];
  planFileName = "";
  planCsvText = "";
  realRows = [];
  realHeaders = [];
  realData = [];
  realFileName = "";
  realCsvText = "";
  flatTimes = [];
  manualRealPoints = [];
  spudDateTime.value = "";
  wellNameInput.value = "";
  xGridSelect.value = "4";
  yGridSelect.value = "200";

  [planXColumnSelect, planYColumnSelect, realDateColumnSelect, realTimeColumnSelect, realDepthColumnSelect].forEach((select) => {
    select.innerHTML = "";
    select.disabled = true;
  });

  plotButton.disabled = true;
  resetButton.disabled = true;
  chartHint.textContent = "As curvas aparecerão aqui após carregar os CSVs.";
  savedPlanFileInfo.textContent = "Nenhum plano salvo no navegador.";
  savedRealFileInfo.textContent = "Nenhum real salvo no navegador.";
  Object.values(summary).forEach((item) => (item.textContent = "-"));
  renderFlatTimes();
  renderManualPoints();
  setStatus("Aguardando CSV", "idle");
  drawEmptyCanvas();
}

function setSavedFileInfo() {
  savedPlanFileInfo.textContent = planFileName
    ? `Plano salvo localmente: ${planFileName}`
    : "Nenhum plano salvo no navegador.";
  savedRealFileInfo.textContent = realFileName
    ? `Real salvo localmente: ${realFileName}`
    : "Nenhum real salvo no navegador.";
}

function setStatus(message, type) {
  statusText.textContent = message;
  statusCard.classList.remove("ready", "error");
  if (type === "ready") statusCard.classList.add("ready");
  if (type === "error") statusCard.classList.add("error");
}

function saveState() {
  const state = {
    wellName: wellNameInput.value.trim(),
    planFileName,
    planCsvText,
    realFileName,
    realCsvText,
    planXColumn: planXColumnSelect.value,
    planYColumn: planYColumnSelect.value,
    realDateColumn: realDateColumnSelect.value,
    realTimeColumn: realTimeColumnSelect.value,
    realDepthColumn: realDepthColumnSelect.value,
    spudDateTime: spudDateTime.value,
    xGrid: xGridSelect.value,
    yGrid: yGridSelect.value,
    flatTimes,
    manualRealPoints,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    setStatus("Não consegui salvar tudo no navegador. O CSV real pode estar grande demais para o localStorage.", "error");
  }
}

function readSavedState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function loadSavedState() {
  const state = readSavedState();
  if (!state) {
    drawEmptyCanvas();
    return;
  }

  wellNameInput.value = state.wellName || "";
  spudDateTime.value = state.spudDateTime || "";
  if (state.xGrid) xGridSelect.value = state.xGrid;
  if (state.yGrid) yGridSelect.value = state.yGrid;
  flatTimes = Array.isArray(state.flatTimes) ? state.flatTimes : [];
  manualRealPoints = Array.isArray(state.manualRealPoints) ? state.manualRealPoints.map(normalizeManualPoint) : [];
  renderFlatTimes();
  renderManualPoints();
  updateWellSummary();
  updateSpudSummary();

  try {
    if (state.planCsvText) {
      loadPlanCsvText(state.planCsvText, state.planFileName || "");
      if (state.planXColumn && planHeaders.includes(state.planXColumn)) planXColumnSelect.value = state.planXColumn;
      if (state.planYColumn && planHeaders.includes(state.planYColumn)) planYColumnSelect.value = state.planYColumn;
    }

    if (state.realCsvText) {
      loadRealCsvText(state.realCsvText, state.realFileName || "");
      if (state.realDateColumn && realHeaders.includes(state.realDateColumn)) realDateColumnSelect.value = state.realDateColumn;
      if (state.realTimeColumn && realHeaders.includes(state.realTimeColumn)) realTimeColumnSelect.value = state.realTimeColumn;
      if (state.realDepthColumn && realHeaders.includes(state.realDepthColumn)) realDepthColumnSelect.value = state.realDepthColumn;
    }

    if (state.planCsvText || state.realCsvText) {
      plotCurves();
      setStatus("Dados recuperados do navegador", "ready");
    } else {
      drawEmptyCanvas();
    }
  } catch (error) {
    setStatus("Não consegui recuperar os dados salvos.", "error");
    drawEmptyCanvas();
  }
}

function hasAnyData() { return planRows.length > 0 || realRows.length > 0; }
function hasAnyPlottedData() { return planData.length > 0 || realData.length > 0; }

function createId() {
  return `flat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatDateTimeLocal(value) {
  const [datePart, timePart = ""] = String(value).split("T");
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year} ${timePart}`;
}

function formatPlainNumber(value) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

function formatGridNumber(value) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

function formatTwoDecimals(value) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDepthAxis(value) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatRawDepth(value) {
  const text = String(value ?? "").trim();
  return text || "-";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
