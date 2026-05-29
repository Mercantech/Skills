(async function () {
  await SkillsStore.ready();

  const groupSelect = document.querySelector("#group-select");
  const area = document.querySelector("#checklist-area");
  const score = document.querySelector("#check-score");
  const template = document.querySelector("#check-section-template");

  let groups = SkillsStore.loadGroups();

  groupSelect.addEventListener("change", renderChecklist);
  area.addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[type='checkbox']");
    if (!checkbox) return;

    const group = getSelectedGroup();
    if (!group) return;

    group.checklist = group.checklist || {};
    group.checklist[checkbox.dataset.id] = checkbox.checked;
    SkillsStore.saveGroups(groups);
    updateScore(group);
  });

  renderGroupSelect();
  renderChecklist();

  function renderGroupSelect() {
    groupSelect.replaceChildren();
    if (groups.length === 0) {
      const option = document.createElement("option");
      option.textContent = "Ingen grupper";
      option.value = "";
      groupSelect.append(option);
      return;
    }

    groups.forEach((group) => {
      const option = document.createElement("option");
      option.value = group.id;
      option.textContent = group.title;
      groupSelect.append(option);
    });
  }

  function renderChecklist() {
    groups = SkillsStore.loadGroups();
    const group = getSelectedGroup();
    area.replaceChildren();

    if (!group) {
      area.append(emptyState("Ingen grupper endnu", "Tilf\u00f8j grupper p\u00e5 forsiden f\u00f8rst."));
      score.textContent = "0";
      return;
    }

    const fragment = document.createDocumentFragment();
    SkillsStore.checklistSections.forEach((section) => {
      const sectionNode = template.content.firstElementChild.cloneNode(true);
      sectionNode.querySelector("h3").textContent = section.title;
      const list = sectionNode.querySelector(".check-list");

      section.items.forEach((item) => {
        const label = document.createElement("label");
        label.className = "check-item";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.id = item.id;
        input.checked = Boolean(group.checklist?.[item.id]);

        const text = document.createElement("span");
        text.textContent = item.label;

        const points = document.createElement("strong");
        points.className = "points";
        points.textContent = `+${item.points}`;

        label.append(input, text, points);
        list.append(label);
      });

      fragment.append(sectionNode);
    });

    area.append(fragment);
    updateScore(group);
  }

  function getSelectedGroup() {
    return groups.find((group) => group.id === groupSelect.value) || groups[0];
  }

  function updateScore(group) {
    score.textContent = String(SkillsStore.calculateChecklistPoints(group));
  }

  function emptyState(title, text) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div><strong>${title}</strong><span>${text}</span></div>`;
    return empty;
  }
})();
