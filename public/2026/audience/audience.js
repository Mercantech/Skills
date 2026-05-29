(async function () {
  await SkillsStore.ready();
  await SkillsStore.refreshFromServer();

  const voterForm = document.querySelector("#voter-form");
  const voterName = document.querySelector("#voter-name");
  const activeVoterBox = document.querySelector("#active-voter");
  const activeVoterName = activeVoterBox.querySelector("strong");
  const nextVoter = document.querySelector("#next-voter");
  const categoryButtons = document.querySelector("#category-buttons");
  const categoryTitle = document.querySelector("#category-title");
  const grid = document.querySelector("#vote-grid");
  const template = document.querySelector("#vote-card-template");
  const activeVoterKey = "mercantec-kryds-bolle-active-voter";

  let activeCategoryId = SkillsStore.audienceCategories[0].id;
  let activeVoter = loadActiveVoter();

  SkillsStore.audienceCategories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.id = category.id;
    button.setAttribute("role", "tab");
    button.textContent = category.label;
    categoryButtons.append(button);
  });

  voterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const label = voterName.value.trim();
    const id = SkillsStore.normalizeVoterId(label);
    if (!id) return;

    activeVoter = { id, label };
    saveActiveVoter(activeVoter);

    const votes = SkillsStore.loadVotes();
    votes.voters[id] = votes.voters[id] || {
      label,
      choices: {},
      createdAt: new Date().toISOString()
    };
    votes.voters[id].label = label;
    votes.voters[id].updatedAt = new Date().toISOString();
    SkillsStore.saveVotes(votes);

    voterForm.reset();
    render();
  });

  nextVoter.addEventListener("click", () => {
    activeVoter = null;
    sessionStorage.removeItem(activeVoterKey);
    render();
    voterName.focus();
  });

  categoryButtons.addEventListener("click", (event) => {
    const button = event.target.closest(".category-button");
    if (!button) return;
    activeCategoryId = button.dataset.id;
    render();
  });

  grid.addEventListener("click", (event) => {
    const button = event.target.closest(".vote-button");
    if (!button || !activeVoter) {
      voterName.focus();
      return;
    }

    const groupId = button.dataset.id;
    const votes = SkillsStore.loadVotes();
    const voter = votes.voters[activeVoter.id] || {
      label: activeVoter.label,
      choices: {},
      createdAt: new Date().toISOString()
    };
    const previous = voter.choices[activeCategoryId];

    if (previous === groupId) return;

    if (previous && votes.totals[activeCategoryId][previous]) {
      votes.totals[activeCategoryId][previous] = Math.max(0, votes.totals[activeCategoryId][previous] - 1);
    }

    votes.totals[activeCategoryId][groupId] = (votes.totals[activeCategoryId][groupId] || 0) + 1;
    voter.choices[activeCategoryId] = groupId;
    voter.label = activeVoter.label;
    voter.updatedAt = new Date().toISOString();
    votes.voters[activeVoter.id] = voter;

    SkillsStore.saveVotes(votes);
    render();
  });

  render();
  window.setInterval(async () => {
    await SkillsStore.refreshFromServer();
    render();
  }, 5000);

  window.addEventListener("focus", async () => {
    await SkillsStore.refreshFromServer();
    render();
  });

  function render() {
    const groups = SkillsStore.loadGroups();
    const votes = SkillsStore.loadVotes();
    const activeChoice = activeVoter ? votes.voters[activeVoter.id]?.choices?.[activeCategoryId] : "";
    const category = SkillsStore.audienceCategories.find((item) => item.id === activeCategoryId);

    categoryTitle.textContent = category.label;
    renderActiveVoter();
    renderCategoryButtons(category.id);
    grid.replaceChildren();

    if (groups.length === 0) {
      grid.append(emptyState("Ingen grupper endnu", "Tilf\u00f8j grupper p\u00e5 forsiden f\u00f8rst."));
      return;
    }

    const fragment = document.createDocumentFragment();
    groups.forEach((group) => {
      const card = template.content.firstElementChild.cloneNode(true);
      const image = card.querySelector("img");
      const button = card.querySelector(".vote-button");
      const count = SkillsStore.getVoteCount(votes, category.id, group.id);
      const selected = activeChoice === group.id;

      image.src = group.image
        ? SkillsStore.resolveMediaUrl(group.image)
        : SkillsStore.resolveMediaUrl("assets/mercantec-kryds-og-bolle.png");
      image.alt = group.title;
      card.querySelector("h3").textContent = group.title;
      card.querySelector(".owner").textContent = group.owner || "Elevspil";
      card.querySelector(".description").textContent = group.description || "";
      card.querySelector(".vote-count").textContent = `${count} stemmer`;
      button.dataset.id = group.id;
      button.disabled = !activeVoter;
      button.textContent = !activeVoter ? "Skriv kode f\u00f8rst" : selected ? "Din stemme" : "Stem";
      button.setAttribute("aria-pressed", selected ? "true" : "false");

      fragment.append(card);
    });
    grid.append(fragment);
  }

  function renderActiveVoter() {
    activeVoterBox.hidden = !activeVoter;
    voterForm.hidden = Boolean(activeVoter);
    if (activeVoter) activeVoterName.textContent = activeVoter.label;
  }

  function renderCategoryButtons(activeId) {
    categoryButtons.querySelectorAll(".category-button").forEach((button) => {
      const selected = button.dataset.id === activeId;
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function loadActiveVoter() {
    try {
      return JSON.parse(sessionStorage.getItem(activeVoterKey)) || null;
    } catch {
      return null;
    }
  }

  function saveActiveVoter(voter) {
    sessionStorage.setItem(activeVoterKey, JSON.stringify(voter));
  }

  function emptyState(title, text) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div><strong>${title}</strong><span>${text}</span></div>`;
    return empty;
  }
})();
