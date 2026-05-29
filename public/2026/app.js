(async function () {
  await SkillsStore.ready();

  const form = document.querySelector("#group-form");
  const idInput = document.querySelector("#group-id");
  const titleInput = document.querySelector("#group-title");
  const urlInput = document.querySelector("#group-url");
  const ownerInput = document.querySelector("#group-owner");
  const descriptionInput = document.querySelector("#group-description");
  const imageInput = document.querySelector("#group-image");
  const imagePreview = document.querySelector("#image-preview");
  const cancelEdit = document.querySelector("#cancel-edit");
  const searchInput = document.querySelector("#search-input");
  const list = document.querySelector("#group-list");
  const template = document.querySelector("#group-card-template");
  const totalCount = document.querySelector("#total-count");
  const topScore = document.querySelector("#top-score");
  const lastAdded = document.querySelector("#last-added");
  const submitTitle = document.querySelector("#submit-title");

  let groups = SkillsStore.loadGroups();
  let selectedImage = "";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const rawUrl = urlInput.value.trim();
    const url = rawUrl ? SkillsStore.normalizeUrl(rawUrl) : "";
    const owner = ownerInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title) return;
    if (url && !SkillsStore.isValidHttpUrl(url)) {
      urlInput.setCustomValidity("Skriv et gyldigt link.");
      urlInput.reportValidity();
      return;
    }

    const file = imageInput.files[0];
    const image = file
      ? await SkillsStore.fileToDataUrl(file, { maxWidth: 1100, maxHeight: 800, quality: 0.72, maxBytes: 520000 })
      : selectedImage;
    const existing = groups.find((group) => group.id === idInput.value);

    if (existing) {
      Object.assign(existing, {
        title,
        url,
        owner,
        description,
        image,
        updatedAt: new Date().toISOString()
      });
    } else {
      groups.unshift({
        id: SkillsStore.createId(),
        title,
        url,
        owner,
        description,
        image,
        checklist: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    SkillsStore.saveGroups(groups);
    resetForm();
    render();
  });

  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;
    selectedImage = await SkillsStore.fileToDataUrl(file, {
      maxWidth: 1100,
      maxHeight: 800,
      quality: 0.72,
      maxBytes: 520000
    });
    renderImagePreview(selectedImage);
  });

  urlInput.addEventListener("input", () => urlInput.setCustomValidity(""));
  searchInput.addEventListener("input", render);
  cancelEdit.addEventListener("click", resetForm);

  list.addEventListener("click", async (event) => {
    const copyButton = event.target.closest(".copy-link");
    const editButton = event.target.closest(".edit-link");
    const deleteButton = event.target.closest(".delete-link");

    if (copyButton) {
      const group = groups.find((item) => item.id === copyButton.dataset.id);
      if (!group?.url) return;
      await SkillsStore.copyToClipboard(group.url);
      copyButton.textContent = "Kopieret";
      window.setTimeout(() => {
        copyButton.textContent = "Kopier";
      }, 1400);
    }

    if (editButton) {
      const group = groups.find((item) => item.id === editButton.dataset.id);
      if (!group) return;
      startEdit(group);
    }

    if (deleteButton) {
      groups = groups.filter((item) => item.id !== deleteButton.dataset.id);
      SkillsStore.saveGroups(groups);
      SkillsStore.cleanVotesForGroups(groups);
      resetForm();
      render();
    }
  });

  render();

  function render() {
    groups = SkillsStore.loadGroups();
    const query = searchInput.value.trim().toLowerCase();
    const scores = SkillsStore.calculateScores(groups, SkillsStore.loadVotes());
    const visibleGroups = groups.filter((group) => {
      const haystack = `${group.title} ${group.owner} ${group.url} ${group.description}`.toLowerCase();
      return haystack.includes(query);
    });

    totalCount.textContent = String(groups.length);
    topScore.textContent = String(scores[0]?.total || 0);
    lastAdded.textContent = groups[0] ? SkillsStore.formatShortDate(groups[0].createdAt) : "-";

    list.replaceChildren();

    if (visibleGroups.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = query
        ? "<div><strong>Ingen match</strong><span>Pr\u00f8v en anden s\u00f8gning.</span></div>"
        : "<div><strong>Ingen grupper endnu</strong><span>Tilf\u00f8j den f\u00f8rste gruppe ovenfor.</span></div>";
      list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    visibleGroups.forEach((group) => {
      const card = template.content.firstElementChild.cloneNode(true);
      const image = card.querySelector("img");
      const mark = card.querySelector(".game-card__mark");
      const title = card.querySelector("h3");
      const owner = card.querySelector(".owner");
      const description = card.querySelector(".description");
      const host = card.querySelector(".host");
      const openLink = card.querySelector(".open-link");
      const copyButton = card.querySelector(".copy-link");
      const editButton = card.querySelector(".edit-link");
      const deleteButton = card.querySelector(".delete-link");
      const score = scores.find((item) => item.id === group.id);

      title.textContent = group.title;
      owner.textContent = group.owner || "Elevspil";
      description.textContent = group.description || "";
      if (group.url) {
        host.textContent = SkillsStore.getHostLabel(group.url);
        host.href = group.url;
        openLink.href = group.url;
      } else {
        host.textContent = "Intet link endnu";
        openLink.hidden = true;
        copyButton.hidden = true;
      }
      copyButton.dataset.id = group.id;
      editButton.dataset.id = group.id;
      deleteButton.dataset.id = group.id;
      deleteButton.setAttribute("aria-label", `Slet ${group.title}`);
      card.querySelector(".score-pill strong").textContent = String(score?.total || 0);

      if (group.image) {
        image.src = SkillsStore.resolveMediaUrl(group.image);
        image.alt = group.title;
        mark.hidden = true;
      } else {
        image.hidden = true;
      }

      fragment.append(card);
    });

    list.append(fragment);
  }

  function startEdit(group) {
    idInput.value = group.id;
    titleInput.value = group.title;
    urlInput.value = group.url;
    ownerInput.value = group.owner || "";
    descriptionInput.value = group.description || "";
    selectedImage = group.image || "";
    imageInput.value = "";
    renderImagePreview(selectedImage);
    submitTitle.textContent = "Rediger gruppe";
    cancelEdit.hidden = false;
    titleInput.focus();
    document.querySelector(".submit-panel").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetForm() {
    form.reset();
    idInput.value = "";
    selectedImage = "";
    imagePreview.hidden = true;
    imagePreview.replaceChildren();
    submitTitle.textContent = "Tilf\u00f8j gruppe";
    cancelEdit.hidden = true;
    urlInput.setCustomValidity("");
  }

  function renderImagePreview(src) {
    imagePreview.replaceChildren();
    if (!src) {
      imagePreview.hidden = true;
      return;
    }

    const image = document.createElement("img");
    image.src = src;
    image.alt = "";
    imagePreview.append(image);
    imagePreview.hidden = false;
  }
})();
