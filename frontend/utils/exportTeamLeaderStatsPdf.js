// utils/exportTeamLeaderStatsPdf.js
// Generates a PDF report for the Team Leader statistics.
//
// • Web  → opens the report in a new tab and triggers window.print()
// • iOS / Android → uses expo-print + expo-sharing

import { Platform } from "react-native";

// ─── Colour palette ────────────────────────────────────────────────────────
const BLUE = "#3F51B5";
const ORANGE = "#fa8d10";
const GREEN = "#4CAF50";
const PINK = "#E91E63";
const PURPLE = "#9C27B0";
const LIGHT = "#f5f5f5";
const BORDER = "#e0e0e0";

const PALETTE = [
  "#F44336", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5",
  "#2196F3", "#03A9F4", "#00BCD4", "#009688", "#4CAF50",
  "#8BC34A", "#CDDC39", "#FFEB3B", "#FFC107", "#FF9800",
  "#FF5722", "#795548", "#9E9E9E", "#607D8B", "#880E4F"
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const buildPieChart = (slices) => {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return "<p style='color:#999;font-size:12px;'>Nema podataka</p>";

  const cx = 80, cy = 80, r = 70;
  let paths = "";
  let startAngle = -Math.PI / 2;

  slices.forEach((sl) => {
    const angle = (sl.value / total) * 2 * Math.PI;
    if (angle >= 2 * Math.PI - 0.001) {
      paths += "<circle cx='" + cx + "' cy='" + cy + "' r='" + r + "' fill='" + sl.color + "' stroke='#fff' stroke-width='2'/>";
      paths += "<text x='" + cx + "' y='" + cy + "' text-anchor='middle' dominant-baseline='middle' font-size='11' font-weight='700' fill='#fff'>100%</text>";
      return;
    }
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    paths += "<path d='M" + cx + "," + cy + " L" + x1.toFixed(2) + "," + y1.toFixed(2) + " A" + r + "," + r + " 0 " + largeArc + ",1 " + x2.toFixed(2) + "," + y2.toFixed(2) + " Z' fill='" + sl.color + "' stroke='#fff' stroke-width='2'/>";
    const midAngle = startAngle + angle / 2;
    const lx = cx + (r * 0.62) * Math.cos(midAngle);
    const ly = cy + (r * 0.62) * Math.sin(midAngle);
    const pct = Math.round((sl.value / total) * 100);
    if (pct >= 5) {
      paths += "<text x='" + lx.toFixed(2) + "' y='" + ly.toFixed(2) + "' text-anchor='middle' dominant-baseline='middle' font-size='11' font-weight='700' fill='#fff'>" + pct + "%</text>";
    }
    startAngle = endAngle;
  });

  const legendRows = slices.map((sl) =>
    "<tr>" +
    "<td style='width:14px;padding:3px 8px 3px 0;font-size:16px;color:" + sl.color + ";'>&#9632;</td>" +
    "<td style='font-size:12px;padding:3px 12px 3px 0;color:#1a1a2e;'>" + sl.label + "</td>" +
    "<td style='font-size:12px;font-weight:700;padding:3px 0;color:#1a1a2e;'>" + sl.value + "</td>" +
    "<td style='font-size:11px;padding:3px 0 3px 6px;color:#888;'>(" + Math.round((sl.value / total) * 100) + "%)</td>" +
    "</tr>"
  ).join("");

  return (
    "<div style='display:flex;align-items:center;gap:28px;flex-wrap:wrap;'>" +
    "<svg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'>" + paths + "</svg>" +
    "<table style='border-collapse:collapse;'><tbody>" + legendRows + "</tbody></table>" +
    "</div>"
  );
};

// ─── Section builders ─────────────────────────────────────────────────────────

const buildKpiSection = (kpi) => (
  "<section>" +
  "<h2 class='section-title'>Pregled tima</h2>" +
  "<div class='kpi-grid'>" +
  "<div class='kpi-card' style='border-top:4px solid " + BLUE + ";'><div class='kpi-icon'>🛡️</div><div class='kpi-value'>" + (kpi.teams ?? "–") + "</div><div class='kpi-label'>Moji timovi</div></div>" +
  "<div class='kpi-card' style='border-top:4px solid " + ORANGE + ";'><div class='kpi-icon'>👥</div><div class='kpi-value'>" + (kpi.members ?? "–") + "</div><div class='kpi-label'>Članovi</div></div>" +
  "</div></section>"
);

const buildVerificationSection = (ver) => {
  const verified = Number(ver?.verified) || 0;
  const unverified = Number(ver?.unverified) || 0;
  const slices = [
    { label: "Verifikovani", value: verified, color: GREEN },
    { label: "Neverifikovani", value: unverified, color: ORANGE },
  ];
  return "<section><h2 class='section-title'>Status verifikacije članova</h2>" + buildPieChart(slices) + "</section>";
};

const buildParticipantsSection = (participants) => {
  if (!participants?.length) return "";
  const slices = participants.map((p, i) => ({
    label: p.competition_name,
    value: Number(p.participant_count) || 0,
    color: PALETTE[i % PALETTE.length]
  }));
  return "<section><h2 class='section-title'>Učesnici po takmičenju</h2>" + buildPieChart(slices) + "</section>";
};

const buildTeamPositionsSection = (teamPositions) => {
  if (!teamPositions?.length) return "";
  
  // Group by competition
  const byComp = {};
  teamPositions.forEach((t) => {
    const comp = t.competition_name || "Nedefinisano takmičenje";
    if (!byComp[comp]) byComp[comp] = [];
    byComp[comp].push(t);
  });
  
  let html = "<section><h2 class='section-title'>Pozicije timova</h2>";
  
  for (const [comp, teams] of Object.entries(byComp)) {
    const rows = teams.map((t, i) =>
      "<tr class='" + (i % 2 === 0 ? "row-even" : "row-odd") + "'>" +
      "<td class='rank-pos'>" + (t.position || t.Position ? (t.position || t.Position) + ". mj." : "–") + "</td>" +
      "<td class='rank-name'>" + t.team_name + " <span class='sub-text'>(" + t.faculty_name + ")</span></td>" +
      "<td class='rank-comp' style='text-align:center;'>" + t.type + "</td>" +
      "</tr>"
    ).join("");
    
    html += "<h3 style='margin:16px 0 8px 0;font-size:13px;color:#333;'>" + comp + "</h3>";
    html += "<table class='data-table'><thead><tr><th style='width:60px;'>Pozicija</th><th>Tim (Fakultet)</th><th style='text-align:center;'>Vrsta</th></tr></thead><tbody>" + rows + "</tbody></table>";
  }
  html += "</section>";
  return html;
};

const buildUpcomingMatchesSection = (upcomingMatches) => {
  if (!upcomingMatches?.length) return "";
  
  const formatDate = (ds) => {
    if (!ds) return "–";
    const d = new Date(ds);
    return d.toLocaleDateString("bs-BA") + " " + d.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" });
  };
  
  const rows = upcomingMatches.map((m, i) =>
    "<tr class='" + (i % 2 === 0 ? "row-even" : "row-odd") + "'>" +
    "<td style='font-weight:700;color:" + BLUE + ";'>" + m.team1 + " <span style='color:#666;'>vs</span> " + m.team2 + "</td>" +
    "<td>" + m.sport_name + (m.Stage ? " <span class='sub-text'>(" + m.Stage + ")</span>" : "") + "</td>" +
    "<td>" + formatDate(m.StartDate) + "</td>" +
    "<td>" + (m.Location || "–") + "</td>" +
    "</tr>"
  ).join("");
  
  return (
    "<section><h2 class='section-title'>Nadolazeći mečevi</h2>" +
    "<table class='data-table'><thead><tr><th>Meč</th><th>Sport (Faza)</th><th>Datum i vrijeme</th><th>Lokacija</th></tr></thead><tbody>" + rows + "</tbody></table></section>"
  );
};

// ─── Full HTML template ───────────────────────────────────────────────────────

const buildHtml = (stats, year) => {
  const {
    kpiCards = {},
    verificationStatus = {},
    participantsByCompetition = [],
    teamPositions = [],
    upcomingMatches = [],
  } = stats;

  const now = new Date().toLocaleDateString("bs-BA", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const css = (
    "* { box-sizing: border-box; margin: 0; padding: 0; }" +
    "body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 32px 40px; }" +
    ".report-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid " + BLUE + "; padding-bottom: 14px; margin-bottom: 28px; }" +
    ".report-title { font-size: 20px; font-weight: 800; color: " + BLUE + "; }" +
    ".report-subtitle { font-size: 12px; color: #666; margin-top: 4px; }" +
    ".report-year { font-size: 36px; font-weight: 900; color: " + ORANGE + "; line-height: 1; }" +
    "section { margin-bottom: 32px; page-break-inside: avoid; }" +
    ".section-title { font-size: 14px; font-weight: 700; color: " + BLUE + "; border-left: 4px solid " + ORANGE + "; padding-left: 10px; margin-bottom: 14px; }" +
    ".kpi-grid { display: flex; flex-wrap: wrap; gap: 12px; }" +
    ".kpi-card { flex: 1 1 200px; background: " + LIGHT + "; border-radius: 10px; padding: 14px 16px; text-align: center; border: 1px solid " + BORDER + "; }" +
    ".kpi-icon { font-size: 20px; margin-bottom: 6px; }" +
    ".kpi-value { font-size: 28px; font-weight: 900; color: #1a1a2e; }" +
    ".kpi-label { font-size: 11px; color: #666; margin-top: 4px; }" +
    ".data-table { width: 100%; border-collapse: collapse; }" +
    ".data-table thead tr { background: " + BLUE + "; color: #fff; }" +
    ".data-table th { padding: 8px 10px; font-size: 12px; text-align: left; }" +
    ".data-table td { padding: 7px 10px; font-size: 12px; vertical-align: middle; }" +
    ".row-even { background: " + LIGHT + "; } .row-odd { background: #fff; }" +
    ".rank-pos { font-weight: 800; color: " + ORANGE + "; }" +
    ".rank-name { color: #1a1a2e; font-weight: 600; }" +
    ".sub-text { font-weight: 400; color: #777; font-size: 11px; }" +
    ".rank-comp { color: #555; }" +
    ".two-col { display: flex; gap: 40px; flex-wrap: wrap; }" +
    ".two-col > * { flex: 1 1 300px; }" +
    ".report-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid " + BORDER + "; font-size: 10px; color: #aaa; text-align: center; }"
  );

  return (
    "<!DOCTYPE html><html lang='bs'><head>" +
    "<meta charset='UTF-8'/>" +
    "<meta name='viewport' content='width=device-width,initial-scale=1.0'/>" +
    "<title>Izvještaj tima – " + year + "</title>" +
    "<style>" + css + "</style>" +
    "</head><body>" +
    "<div class='report-header'>" +
    "<div><div class='report-title'>Izvještaj vođe tima</div>" +
    "<div class='report-subtitle'>Generisano: " + now + "</div></div>" +
    "<div class='report-year'>" + year + "</div>" +
    "</div>" +
    buildKpiSection(kpiCards) +
    "<div class='two-col'>" +
    buildVerificationSection(verificationStatus) +
    buildParticipantsSection(participantsByCompetition) +
    "</div>" +
    buildTeamPositionsSection(teamPositions) +
    buildUpcomingMatchesSection(upcomingMatches) +
    "<div class='report-footer'>Izvještaj tima za godinu " + year + " · Automatski generisan</div>" +
    "</body></html>"
  );
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const exportTeamLeaderStatsPdf = async (stats, year) => {
  const html = buildHtml(stats, year);

  if (Platform.OS === "web") {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "timovi-izvjestaj-" + year + ".html";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  } else {
    try {
      const Print = require("expo-print");
      const Sharing = require("expo-sharing");
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Izvještaj tima - " + year,
        UTI: "com.adobe.pdf",
      });
    } catch (err) {
      console.error("PDF export failed:", err);
      throw err;
    }
  }
};
