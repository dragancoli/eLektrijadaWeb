// features/roleFeatures.js
// Backend vraća nazive iz USER_TYPE (npr. "KoordinatorNauka", "VodjaTima", ...)
// Ovdje normalizujemo naziv (uklanjanje dijakritika, razbijanje CamelCase, spajanje sinonima)
// i mapiramo na interne ključeve kako bi se prikazale odgovarajuće akcije.

const stripDiacritics = (str) =>
  String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "dj")
    .replace(/Đ/g, "Dj");

// Ukloni dijakritike, razbij CamelCase ("KoordinatorNauka" -> "Koordinator Nauka"),
// zamijeni _, - sa razmakom i spusti u lowercase.
const normalizeRoleName = (name) => {
  const noDiacritics = stripDiacritics(name);
  return noDiacritics
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase -> razdvoji
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const roleKeyFromName = (name) => {
  if (!name) return null;
  const base = normalizeRoleName(name);

  // Eksplicitna mapa sinonima -> interni ključevi
  const map = {
    // iz tvoje tabele
    admin: "admin",
    mentor: "mentor",
    student: "student",
    "koordinator nauka": "koordinator_nauka",
    "koordinator nauke": "koordinator_nauka",
    "koordinator za nauka": "koordinator_nauka",
    "koordinator za nauku": "koordinator_nauka",

    "koordinator sport": "koordinator_sport",
    "koordinator sporta": "koordinator_sport",
    "koordinator za sport": "koordinator_sport",

    organizator: "organizator",

    "vodja tima": "vodja_tima",
    "vođa tima": "vodja_tima",

    redar: "redar",
  };

  // Direktno poklapanje
  if (map[base]) return map[base];

  // Heuristika: ako nema match, probaj sa underscore varijantom
  const underscored = base.replace(/\s+/g, "_");
  if (map[underscored]) return map[underscored];

  return null;
};

// Mapiranje po ID-u na osnovu tvoje UserType tabele:
// 1 Admin, 2 Mentor, 3 Student, 4 KoordinatorNauka, 5 KoordinatorSport, 6 Organizator, 7 VodjaTima, 8 Redar
const roleKeyFromId = (id) => {
  const map = {
    1: "admin",
    2: "mentor",
    3: "student",
    4: "koordinator_nauka",
    5: "koordinator_sport",
    6: "organizator",
    7: "vodja_tima",
    8: "redar",
  };
  return map[Number(id)] || null;
};

const humanizeRoleName = (name) => {
  if (!name) return "";
  return String(name)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
};

export const getRoleDisplayName = (roleInput) => {
  const roleKey =
    typeof roleInput === "string"
      ? roleKeyFromName(roleInput)
      : typeof roleInput === "number"
        ? roleKeyFromId(roleInput)
        : roleInput && typeof roleInput === "object"
          ? roleKeyFromName(roleInput.UserTypeName || roleInput.Name) ||
            roleKeyFromId(roleInput.IdUserType || roleInput.id)
          : null;

  const displayByRoleKey = {
    admin: "Admin",
    mentor: "Mentor",
    student: "Student",
    koordinator_nauka: "Koordinator za nauku",
    koordinator_sport: "Koordinator za sport",
    organizator: "Organizator",
    vodja_tima: "Vodja tima",
    redar: "Redar",
  };

  if (roleKey && displayByRoleKey[roleKey]) return displayByRoleKey[roleKey];

  if (typeof roleInput === "string") return humanizeRoleName(roleInput);
  if (roleInput && typeof roleInput === "object") {
    return humanizeRoleName(roleInput.UserTypeName || roleInput.Name);
  }

  return "";
};

// Funkcija prihvata ili ime uloge, ili ID uloge, ili cijeli user objekat
export const getRoleFeatures = (roleInput) => {
  let roleKey = null;

  if (typeof roleInput === "string") {
    roleKey = roleKeyFromName(roleInput);
  } else if (typeof roleInput === "number") {
    roleKey = roleKeyFromId(roleInput);
  } else if (roleInput && typeof roleInput === "object") {
    // Podrška ako je prosleđen user objekat
    roleKey =
      roleKeyFromName(roleInput.UserTypeName || roleInput.Name) || roleKeyFromId(roleInput.IdUserType || roleInput.id);
  }

  const featuresByRole = {
    student: [
      { key: "my_competitions", label: "Pregled vlastitih takmičenja", icon: "trophy-outline", routeName: "MyCompetitions"},
      { key: "qr_code", label: "Prikaz QR koda", icon: "qr-code-outline", routeName: "QRCode" },
    ],
    vodja_tima: [
      { key: "manage_teams", label: "Pregled i upravljanje timovima", icon: "people-outline", routeName: "TeamsHome" },
      { key: "statistics", label: "Statistike", icon: "bar-chart-outline", routeName: "TeamLeaderStats" },
    ],
    mentor: [
      { key: "manage_competitions", label: "Upravljanje takmičenjima i rezultatima", icon: "trophy-outline", routeName: "MentorManage" },
      { key: "statistics", label: "Statistike", icon: "bar-chart-outline", routeName: "MentorStats" },
    ],
    redar: [{ key: "verify_contestants", label: "Verifikacija takmičara", icon: "shield-checkmark-outline", routeName: "StudentVerification" }],
    koordinator_sport: [
      {
        key: "publish_results_sport",
        label: "Objavljivanje rezultata",
        icon: "analytics-outline",
        routeName: "ManageSportTeamPositions",
      },
      {
        key: "manage_schedule_sport",
        label: "Upravljanje rasporedom takmičenja za sport",
        icon: "calendar-outline",
        routeName: "ManageSportMatches",
      },
      {
        key: "manage_sport_competitions",
        label: "Upravljanje sportskim takmičenjima",
        icon: "football-outline",
        routeName: "ManageSportCompetitions",
      },
      {
        key: "verify_team_leaders",
        label: "Verifikacija vođa tima (sport)",
        icon: "person-add-outline",
        routeName: "TeamLeaderVerification",
      },
      { key: "statistics", label: "Statistike", icon: "bar-chart-outline", routeName: "SportStats" },
    ],
    koordinator_nauka: [
      { key: "manage_competitions_science", label: "Upravljanje naučnim takmičenjima", icon: "flask-outline", routeName: "ScienceCompetitions" },
      { key: "verify_accounts", label: "Verifikovanje naloga (mentora i vođe tima)", icon: "person-add-outline", routeName: "UserVerification" },
      { key: "manage_marshal_accounts", label: "Upravljanje redarskim nalozima", icon: "people-outline", routeName: "StewardManagement" },
      { key: "view_results", label: "Pregled/izmjena rezultata", icon: "stats-chart-outline", routeName: "ScienceResult" },
      { key: "statistics", label: "Statistike", icon: "bar-chart-outline", routeName: "ScienceStats" },
    ],
    organizator: [
      { key: "publish_news", label: "Objavljivanje novosti", icon: "newspaper-outline", routeName: "NewsPublisher" },
      { key: "statistics", label: "Statistike", icon: "bar-chart-outline", routeName: "OrganizerStats" },
    ],    
    // Admin može imati superset (po potrebi prilagodi)
    admin: [
      { key: "publish_news", label: "Objavljivanje novosti", icon: "newspaper-outline" },
      { key: "verify_accounts", label: "Verifikovanje naloga", icon: "person-checkmark-outline" },
      { key: "manage_marshal_accounts", label: "Upravljanje redarskim nalozima", icon: "people-outline" },
      { key: "manage_sport_competitions", label: "Upravljanje sportskim takmičenjima", icon: "football-outline" },
      { key: "manage_competitions_science", label: "Upravljanje naučnim takmičenjima", icon: "flask-outline", routeName: "ScienceCompetitions" },
      { key: "view_results", label: "Pregled/izmjena rezultata", icon: "stats-chart-outline" },
    ],
  };

  return roleKey ? featuresByRole[roleKey] || [] : [];
};

export const getCommonFeatures = (logout) => [
  { key: "change_password", label: "Promjena lozinke", icon: "key-outline", routeName: "ChangePassword" },
  { key: "edit_profile", label: "Izmjena podataka naloga", icon: "create-outline", routeName: "EditProfile" },
  { key: "report_issue", label: "Prijava problema", icon: "flag-outline", routeName: "ReportProblem" },
  { key: "deactivate", label: "Deaktivacija naloga", icon: "trash-outline" },
  { key: "logout", label: "Odjava", icon: "log-out-outline", onPress: logout, destructive: true },
];
