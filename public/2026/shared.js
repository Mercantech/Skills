(function () {
  const groupsKey = "mercantec-kryds-bolle-groups";
  const legacyGroupsKey = "mercantec-kryds-bolle-links";
  const votesKey = "mercantec-kryds-bolle-votes";
  const dateKey = "mercantec-kryds-bolle-date-gallery";
  const appBaseUrl = new URL(".", document.currentScript.src);
  const apiUrl = new URL("api/storage", appBaseUrl);
  let serverEnabled = false;
  let isHydrating = true;
  let saveTimer = 0;
  let saveInFlight = false;
  let saveQueued = false;
  let dirtyScopes = new Set();

  const audienceCategories = [
    { id: "ui", label: "Bedste UI-Design", points: 10 },
    { id: "fun", label: "Sjoveste spil", points: 10 },
    { id: "creative", label: "Mest kreative spil", points: 10 }
  ];

  const checklistSections = [
    {
      id: "basis",
      title: "Krav / basis",
      items: [
        { id: "playable", label: "Spillet er spilbart", points: 1 },
        { id: "winner", label: "Spillet registrerer korrekt vinder", points: 1 },
        { id: "draw", label: "Spillet registrerer uafgjort", points: 1 },
        { id: "taken", label: "Man kan ikke v\u00e6lge et felt, der allerede er taget", points: 1 },
        { id: "turns", label: "Det skifter korrekt mellem spillerne", points: 1 },
        { id: "restart", label: "Man kan starte et nyt spil", points: 1 }
      ]
    },
    {
      id: "hosting",
      title: "Hosting",
      items: [
        { id: "public-url", label: "Hostet i en VM med offentlig URL", points: 1 },
        { id: "gf2-machine", label: "Hostet p\u00e5 GF2's maskiner inde ved siden af", points: 2 },
        { id: "readme", label: "Der er en README med ops\u00e6tning og startkommandoer", points: 1 }
      ]
    },
    {
      id: "multiplayer",
      title: "Multiplayer",
      items: [
        { id: "same-computer", label: "Multiplayer p\u00e5 samme computer", points: 1 },
        { id: "local-network", label: "Multiplayer lokalt p\u00e5 netv\u00e6rk", points: 1 },
        { id: "across-network", label: "Multiplayer p\u00e5 tv\u00e6rs af netv\u00e6rk", points: 1 },
        { id: "lobby-code", label: "Man kan oprette eller joine et spil via lobby/kode", points: 2 }
      ]
    },
    {
      id: "extra",
      title: "Ekstra funktioner",
      items: [
        { id: "scoreboard", label: "Pointtavle / score mellem runder", points: 1 },
        { id: "ai", label: "Computer-modstander / AI", points: 2 },
        { id: "ai-levels", label: "AI har flere sv\u00e6rhedsgrader", points: 1 },
        { id: "timer", label: "Timer p\u00e5 tur", points: 1 },
        { id: "larger-board", label: "St\u00f8rre spilleplade, fx 4x4 eller 5x5", points: 1 },
        { id: "twist", label: "Alternative regler eller twist p\u00e5 Kryds & Bolle", points: 2 },
        { id: "effects", label: "Lyd, animationer eller visuelle effekter", points: 2 }
      ]
    },
    {
      id: "code",
      title: "Rundt om koden",
      items: [
        { id: "dev-howto", label: "How-to til fremtidige udviklere", points: 1 },
        { id: "dev-setup", label: "Setup til fremtidige udviklere", points: 1 },
        { id: "user-howto", label: "How-to til brugere", points: 1 },
        { id: "edge-cases", label: "Der er h\u00e5ndtering af fejl/edge cases", points: 1 },
        { id: "rule-tests", label: "Der er lavet test af spillets regler", points: 2 }
      ]
    }
  ];

  function loadJson(key, fallback) {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function saveLocalJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function isQuotaExceeded(error) {
    return (
      error?.name === "QuotaExceededError" ||
      error?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error?.code === 22 ||
      error?.code === 1014
    );
  }

  function loadGroups() {
    const groups = loadJson(groupsKey, null);
    if (Array.isArray(groups)) return groups.map(normalizeGroup);

    const legacy = loadJson(legacyGroupsKey, []);
    if (!Array.isArray(legacy) || legacy.length === 0) return [];

    const migrated = legacy.map((item) =>
      normalizeGroup({
        ...item,
        description: "",
        image: "",
        checklist: {}
      })
    );
    saveGroups(migrated);
    return migrated;
  }

  function normalizeGroup(group) {
    return {
      id: group.id || createId(),
      title: group.title || "Uden navn",
      url: group.url || "",
      owner: group.owner || "",
      description: group.description || "",
      image: group.image || "",
      checklist: group.checklist || {},
      createdAt: group.createdAt || new Date().toISOString(),
      updatedAt: group.updatedAt || group.createdAt || new Date().toISOString()
    };
  }

  function saveGroups(groups) {
    saveJson(groupsKey, groups.map(normalizeGroup));
    queueServerSave("groups");
  }

  function loadVotes() {
    const votes = loadJson(votesKey, {});
    return normalizeVotes(votes);
  }

  function saveVotes(votes) {
    const normalized = normalizeVotes(votes);
    saveJson(votesKey, {
      totals: normalized.totals,
      voters: normalized.voters
    });
    queueServerSave("votes");
  }

  function cleanVotesForGroups(groups) {
    const ids = new Set(groups.map((group) => group.id));
    const votes = loadVotes();
    audienceCategories.forEach((category) => {
      Object.keys(votes.totals[category.id]).forEach((groupId) => {
        if (!ids.has(groupId)) delete votes.totals[category.id][groupId];
      });
    });
    Object.values(votes.voters).forEach((voter) => {
      Object.keys(voter.choices || {}).forEach((categoryId) => {
        if (!ids.has(voter.choices[categoryId])) delete voter.choices[categoryId];
      });
    });
    saveVotes(votes);
  }

  function normalizeVotes(votes) {
    const totals = audienceCategories.reduce((result, category) => {
      result[category.id] = {
        ...(votes?.totals?.[category.id] || votes?.[category.id] || {})
      };
      return result;
    }, {});

    const normalized = {
      totals,
      voters: votes?.voters || {}
    };

    audienceCategories.forEach((category) => {
      normalized[category.id] = normalized.totals[category.id];
    });

    return normalized;
  }

  function loadDateItems() {
    return loadJson(dateKey, []);
  }

  function saveDateItems(items) {
    saveJson(dateKey, items);
    queueServerSave("dateItems");
  }

  function calculateChecklistPoints(group) {
    const checklist = group.checklist || {};
    return checklistSections.reduce((total, section) => {
      return total + section.items.reduce((sectionTotal, item) => {
        return sectionTotal + (checklist[item.id] ? item.points : 0);
      }, 0);
    }, 0);
  }

  function getVoteCount(votes, categoryId, groupId) {
    return Number(votes?.totals?.[categoryId]?.[groupId] || votes?.[categoryId]?.[groupId] || 0);
  }

  function getAudienceAwards(groups, votes) {
    const awards = {};
    groups.forEach((group) => {
      awards[group.id] = 0;
    });

    audienceCategories.forEach((category) => {
      const counts = groups.map((group) => ({
        id: group.id,
        count: getVoteCount(votes, category.id, group.id)
      }));
      const top = Math.max(0, ...counts.map((item) => item.count));
      if (top === 0) return;
      counts
        .filter((item) => item.count === top)
        .forEach((item) => {
          awards[item.id] += category.points;
        });
    });

    return awards;
  }

  function calculateScores(groups, votes) {
    const awards = getAudienceAwards(groups, votes);
    return groups
      .map((group) => {
        const checklist = calculateChecklistPoints(group);
        const audience = awards[group.id] || 0;
        return {
          id: group.id,
          title: group.title,
          owner: group.owner,
          image: group.image,
          checklist,
          audience,
          total: checklist + audience
        };
      })
      .sort((a, b) => b.total - a.total || a.title.localeCompare(b.title));
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function normalizeVoterId(value) {
    return value.trim().toLowerCase().replace(/\s+/g, "-");
  }

  function normalizeUrl(value) {
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return `https://${value}`;
  }

  function isValidHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function getHostLabel(value) {
    try {
      const url = new URL(value);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return value;
    }
  }

  function resolveMediaUrl(value) {
    if (!value || value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("http") || value.startsWith("/")) {
      return value;
    }

    return new URL(value, appBaseUrl).href;
  }

  function formatShortDate(value) {
    return new Intl.DateTimeFormat("da-DK", {
      day: "2-digit",
      month: "2-digit"
    }).format(new Date(value));
  }

  async function fileToDataUrl(file, options = {}) {
    const dataUrl = await readFileDataUrl(file);
    return compressDataUrl(dataUrl, options);
  }

  function readFileDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function compressDataUrl(dataUrl, options = {}) {
    const settings = {
      maxWidth: options.maxWidth || 1200,
      maxHeight: options.maxHeight || 900,
      quality: options.quality || 0.74,
      minQuality: options.minQuality || 0.46,
      maxBytes: options.maxBytes || 650000,
      mimeType: options.mimeType || "image/jpeg"
    };

    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      return Promise.resolve(dataUrl);
    }

    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, settings.maxWidth / image.width, settings.maxHeight / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = width;
        canvas.height = height;
        context.fillStyle = "#080d10";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        let quality = settings.quality;
        let result = canvas.toDataURL(settings.mimeType, quality);

        while (result.length > settings.maxBytes && quality > settings.minQuality) {
          quality = Math.max(settings.minQuality, quality - 0.08);
          result = canvas.toDataURL(settings.mimeType, quality);
        }

        resolve(result);
      };
      image.onerror = () => resolve(dataUrl);
      image.src = dataUrl;
    });
  }

  async function copyToClipboard(value) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        // Fall back for local previews and browsers that block clipboard writes.
      }
    }

    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }

  const readyPromise = hydrateFromServer();

  function ready() {
    return readyPromise;
  }

  async function hydrateFromServer() {
    let shouldSaveLocalData = false;

    try {
      const response = await fetch(apiUrl.href, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) throw new Error("Server storage not available");

      const data = await response.json();
      serverEnabled = true;

      if (hasServerData(data)) {
        applyServerData(data);
      } else if (hasLocalData()) {
        shouldSaveLocalData = true;
      }
    } catch {
      serverEnabled = false;
    } finally {
      isHydrating = false;
      if (shouldSaveLocalData) queueServerSave();
    }
  }

  async function refreshFromServer() {
    if (!serverEnabled) return false;

    try {
      const data = await fetchServerData();
      if (!hasServerData(data)) return false;
      applyServerData(data);
      return true;
    } catch {
      return false;
    }
  }

  async function fetchServerData() {
    const response = await fetch(apiUrl.href, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) throw new Error("Server storage not available");

    return response.json();
  }

  function hasServerData(data) {
    return Boolean(
      data?.groups?.length ||
        Object.keys(data?.votes?.voters || {}).length ||
        data?.dateItems?.length
    );
  }

  function hasLocalData() {
    return Boolean(
      loadGroups().length ||
        Object.keys(loadVotes().voters || {}).length ||
        loadDateItems().length
    );
  }

  function applyServerData(data) {
    saveLocalJson(groupsKey, Array.isArray(data.groups) ? data.groups.map(normalizeGroup) : []);
    saveLocalJson(votesKey, normalizeVotes(data.votes || {}));
    saveLocalJson(dateKey, Array.isArray(data.dateItems) ? data.dateItems : []);
  }

  function collectData() {
    return {
      groups: loadGroups(),
      votes: normalizeVotes(loadVotes()),
      dateItems: loadDateItems()
    };
  }

  function queueServerSave(scope) {
    if (scope) dirtyScopes.add(scope);
    if (!serverEnabled || isHydrating) return;

    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveToServer, 180);
  }

  async function saveToServer() {
    if (!serverEnabled) return;

    if (saveInFlight) {
      saveQueued = true;
      return;
    }

    saveInFlight = true;
    const scopes = new Set(dirtyScopes);
    dirtyScopes.clear();

    try {
      const localData = collectData();
      let outgoing = localData;

      if (scopes.size > 0 && scopes.size < 3) {
        const serverData = await fetchServerData();
        outgoing = {
          groups: scopes.has("groups") ? localData.groups : serverData.groups || [],
          votes: scopes.has("votes") ? localData.votes : normalizeVotes(serverData.votes || {}),
          dateItems: scopes.has("dateItems") ? localData.dateItems : serverData.dateItems || []
        };
      }

      const response = await fetch(apiUrl.href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(outgoing)
      });

      if (!response.ok) throw new Error("Could not save data");

      const saved = await response.json();
      if (saved?.ok && saved.data) applyServerData(saved.data);
    } catch (error) {
      scopes.forEach((scope) => dirtyScopes.add(scope));
      console.warn("Server-gemning fejlede, bruger lokal fallback.", error);
    } finally {
      saveInFlight = false;
      if (saveQueued) {
        saveQueued = false;
        queueServerSave();
      }
    }
  }

  function isServerEnabled() {
    return serverEnabled;
  }

  window.SkillsStore = {
    audienceCategories,
    checklistSections,
    loadGroups,
    saveGroups,
    loadVotes,
    saveVotes,
    cleanVotesForGroups,
    normalizeVotes,
    isQuotaExceeded,
    loadDateItems,
    saveDateItems,
    calculateChecklistPoints,
    calculateScores,
    getVoteCount,
    createId,
    normalizeVoterId,
    normalizeUrl,
    isValidHttpUrl,
    getHostLabel,
    formatShortDate,
    fileToDataUrl,
    compressDataUrl,
    copyToClipboard,
    ready,
    refreshFromServer,
    isServerEnabled,
    resolveMediaUrl
  };
})();
